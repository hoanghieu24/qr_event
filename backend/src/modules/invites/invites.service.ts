import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../../config/database';
import { ENV } from '../../config/env';

export class InvitesService {
  // Generate HMAC Signature for invite token
  static generateSignature(eventId: number, referrerId: number, token: string): string {
    return crypto
      .createHmac('sha256', ENV.INVITE_HMAC_SECRET)
      .update(`${eventId}:${referrerId}:${token}`)
      .digest('hex');
  }

  // Tạo mã link mời ngắn gọn (8 ký tự ngẫu nhiên, dễ đọc, không gây nhầm lẫn)
  static async generateUniqueShortToken(): Promise<string> {
    const chars = '23456789abcdefghjkmnpqrstuvwxyz';
    let token = '';
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      attempts++;
      token = '';
      const bytes = crypto.randomBytes(8);
      for (let i = 0; i < 8; i++) {
        token += chars[bytes[i] % chars.length];
      }

      const existing = await query<any[]>('SELECT id FROM invite_links WHERE token = ?', [token]);
      if (existing.length === 0) {
        isUnique = true;
      }
    }

    return token;
  }

  static async getStaffQuotaForEvent(eventId: number, staffId: number) {
    const rows = await query<any[]>(
      `SELECT max_invites, is_enabled, can_invite FROM staff_event_quotas WHERE event_id = ? AND staff_id = ?`,
      [eventId, staffId]
    );
    if (!rows.length || !rows[0].is_enabled || !rows[0].can_invite) {
      throw new Error('Bạn chưa được cấp quyền mời khách cho sự kiện này.');
    }
    const max_invites = rows[0].max_invites;
    const regs = await query<any[]>(
      `SELECT COUNT(*) as total FROM registrations WHERE event_id = ? AND referrer_id = ?`,
      [eventId, staffId]
    );
    const current_registrations = regs[0]?.total || 0;
    return {
      max_invites,
      current_registrations,
      remaining: Math.max(0, max_invites - current_registrations),
    };
  }

  static async createInviteLink(data: {
    event_id: number;
    referrer_id: number;
    expires_in_days?: number;
    max_registrations?: number;
    is_admin?: boolean;
  }) {
    // Generate secure short token (8 ký tự ngẫu nhiên, gọn đẹp, dễ chia sẻ)
    const token = await this.generateUniqueShortToken();
    const signature = this.generateSignature(data.event_id, data.referrer_id, token);

    const days = data.expires_in_days || 30;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    // If not Admin override, apply Admin's quota
    let maxRegs = data.max_registrations || 50;
    if (!data.is_admin) {
      const quotaInfo = await this.getStaffQuotaForEvent(data.event_id, data.referrer_id);
      maxRegs = quotaInfo.max_invites;
    }

    const res: any = await query(
      `INSERT INTO invite_links (event_id, referrer_id, token, signature, expires_at, max_registrations, status)
       VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      [
        data.event_id,
        data.referrer_id,
        token,
        signature,
        expiresAt,
        maxRegs,
      ]
    );

    const linkUrl = `${ENV.FRONTEND_URL}/invite/${token}`;

    return {
      id: res.insertId,
      event_id: data.event_id,
      referrer_id: data.referrer_id,
      token,
      url: linkUrl,
      invite_url: linkUrl,
      expires_at: expiresAt,
      max_registrations: maxRegs,
    };
  }

  static async verifyInviteToken(token: string) {
    const rows = await query<any[]>(
      `SELECT il.*, 
              e.name as event_name, e.description as event_description, 
              e.location as event_location, e.poster_url as event_poster,
              e.start_at as event_start_at, e.end_at as event_end_at, e.status as event_status,
              e.approval_mode as event_approval_mode,
              u.name as referrer_name, u.email as referrer_email, u.phone as referrer_phone
       FROM invite_links il
       JOIN events e ON il.event_id = e.id
       JOIN users u ON il.referrer_id = u.id
       WHERE il.token = ? OR il.legacy_token = ?`,
      [token, token]
    );

    if (rows.length === 0) {
      throw new Error('Link mời không tồn tại hoặc không hợp lệ.');
    }

    const invite = rows[0];

    // Verify HMAC signature (hỗ trợ cả token mới ngắn gọn và token cũ nếu có khách bấm link cũ)
    const currentSig = this.generateSignature(invite.event_id, invite.referrer_id, invite.token);
    const legacySig = invite.legacy_token ? this.generateSignature(invite.event_id, invite.referrer_id, invite.legacy_token) : '';

    if (invite.signature !== currentSig && invite.signature !== legacySig) {
      throw new Error('Chữ ký bảo mật của link mời không hợp lệ.');
    }

    if (invite.status === 'CLOSED' || invite.current_registrations >= invite.max_registrations) {
      throw new Error('Link mời này đã đạt đủ số lượng đăng ký tối đa và đã tự động đóng.');
    }

    if (invite.status !== 'ACTIVE') {
      throw new Error('Link mời này đã bị thu hồi hoặc đóng.');
    }

    if (new Date() > new Date(invite.expires_at)) {
      throw new Error('Link mời này đã hết hạn tham gia.');
    }

    return invite;
  }

  static async getMyInviteLinks(referrerId: number) {
    const rows = await query<any[]>(`
      SELECT il.*, e.name as event_name, e.start_at as event_start_at, e.approval_mode as event_approval_mode,
             COALESCE((SELECT max_invites FROM staff_event_quotas q WHERE q.event_id = il.event_id AND q.staff_id = il.referrer_id), 50) as admin_assigned_quota,
             (SELECT COUNT(*) FROM registrations r WHERE r.invite_link_id = il.id AND r.status = 'PENDING') as pending_count,
             (SELECT COUNT(*) FROM registrations r WHERE r.invite_link_id = il.id AND r.status = 'PENDING_ADMIN') as pending_admin_count,
             (SELECT COUNT(*) FROM registrations r WHERE r.invite_link_id = il.id AND r.status = 'APPROVED') as approved_count
      FROM invite_links il
      JOIN events e ON il.event_id = e.id
      WHERE il.referrer_id = ?
      ORDER BY il.id DESC
    `, [referrerId]);

    // Tự động rút ngắn các link cũ đang bị dài quá 12 ký tự hoặc có tiền tố inv_
    for (const r of rows) {
      if (r.token && (r.token.length > 12 || r.token.startsWith('inv_')) && r.status === 'ACTIVE') {
        try {
          const shortToken = await this.generateUniqueShortToken();
          const newSig = this.generateSignature(r.event_id, r.referrer_id, shortToken);
          await query(
            'UPDATE invite_links SET legacy_token = token, token = ?, signature = ? WHERE id = ?',
            [shortToken, newSig, r.id]
          );
          r.legacy_token = r.token;
          r.token = shortToken;
          r.signature = newSig;
        } catch (shortErr) {
          console.warn('Auto-shorten link error:', shortErr);
        }
      }
    }

    return rows.map((r) => ({
      ...r,
      url: `${ENV.FRONTEND_URL}/invite/${r.token}`,
      invite_url: `${ENV.FRONTEND_URL}/invite/${r.token}`,
    }));
  }
}
