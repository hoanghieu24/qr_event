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

  static async verifyInviteToken(rawToken: string): Promise<any> {
    const token = String(rawToken || '').trim();
    if (!token) {
      throw new Error('Link mời không tồn tại hoặc không hợp lệ.');
    }

    // 1. Thử tìm kiếm trực tiếp theo token hoặc legacy_token
    let rows = await query<any[]>(
      `SELECT il.*, 
              e.id as event_id, e.name as event_name, e.description as event_description, 
              e.location as event_location, e.poster_url as event_poster,
              e.start_at as event_start_at, e.end_at as event_end_at, e.status as event_status,
              e.approval_mode as event_approval_mode,
              COALESCE(u.name, 'Ban Tổ Chức') as referrer_name, 
              COALESCE(u.email, '') as referrer_email, 
              COALESCE(u.phone, '') as referrer_phone
       FROM invite_links il
       JOIN events e ON il.event_id = e.id
       LEFT JOIN users u ON il.referrer_id = u.id
       WHERE il.token = ? OR il.legacy_token = ?`,
      [token, token]
    );

    // 2. Thử tìm partial match (nếu token dài, có tiền tố inv_, hoặc người dùng copy bị thiếu ký tự)
    if (rows.length === 0 && (token.startsWith('inv_') || token.length >= 6)) {
      rows = await query<any[]>(
        `SELECT il.*, 
                e.id as event_id, e.name as event_name, e.description as event_description, 
                e.location as event_location, e.poster_url as event_poster,
                e.start_at as event_start_at, e.end_at as event_end_at, e.status as event_status,
                e.approval_mode as event_approval_mode,
                COALESCE(u.name, 'Ban Tổ Chức') as referrer_name, 
                COALESCE(u.email, '') as referrer_email, 
                COALESCE(u.phone, '') as referrer_phone
         FROM invite_links il
         JOIN events e ON il.event_id = e.id
         LEFT JOIN users u ON il.referrer_id = u.id
         WHERE il.legacy_token LIKE ? OR il.token LIKE ?
         ORDER BY il.id DESC LIMIT 1`,
        [`%${token}%`, `%${token}%`]
      );
    }

    // 3. Fallback: Nếu token là dạng 'event_<id>', 'event-<id>' hoặc ID số nguyên
    if (rows.length === 0) {
      const match = token.match(/^(?:event[_-]?)?(\d+)$/i);
      if (match) {
        const eventId = parseInt(match[1], 10);
        // Tìm link gần nhất của sự kiện này
        rows = await query<any[]>(
          `SELECT il.*, 
                  e.id as event_id, e.name as event_name, e.description as event_description, 
                  e.location as event_location, e.poster_url as event_poster,
                  e.start_at as event_start_at, e.end_at as event_end_at, e.status as event_status,
                  e.approval_mode as event_approval_mode,
                  COALESCE(u.name, 'Ban Tổ Chức') as referrer_name, 
                  COALESCE(u.email, '') as referrer_email, 
                  COALESCE(u.phone, '') as referrer_phone
           FROM invite_links il
           JOIN events e ON il.event_id = e.id
           LEFT JOIN users u ON il.referrer_id = u.id
           WHERE il.event_id = ?
           ORDER BY (il.status = 'ACTIVE') DESC, il.id DESC LIMIT 1`,
          [eventId]
        );

        // Nếu sự kiện chưa từng có link mời nào, kiểm tra sự kiện có tồn tại không và tự tạo link mặc định
        if (rows.length === 0) {
          const evRows = await query<any[]>('SELECT id, created_by, status FROM events WHERE id = ? LIMIT 1', [eventId]);
          if (evRows.length > 0) {
            const ev = evRows[0];
            const refId = ev.created_by || 1;
            const newLink = await this.createInviteLink({
              event_id: eventId,
              referrer_id: refId,
              expires_in_days: 60,
              max_registrations: 1000,
              is_admin: true,
            });
            return await this.verifyInviteToken(newLink.token);
          }
        }
      }
    }

    if (rows.length === 0) {
      throw new Error('Link mời không tồn tại hoặc không hợp lệ.');
    }

    const invite = rows[0];

    // Tự động hồi phục signature nếu link tồn tại hợp lệ trong DB
    const currentSig = this.generateSignature(invite.event_id, invite.referrer_id, invite.token);
    const legacySig = invite.legacy_token ? this.generateSignature(invite.event_id, invite.referrer_id, invite.legacy_token) : '';

    if (invite.signature !== currentSig && invite.signature !== legacySig) {
      try {
        await query('UPDATE invite_links SET signature = ? WHERE id = ?', [currentSig, invite.id]);
        invite.signature = currentSig;
      } catch (sigErr) {
        console.warn('Auto fix invite signature error:', sigErr);
      }
    }

    // Nếu sự kiện vẫn đang PUBLISHED nhưng link vô tình bị CLOSED, tự động mở lại link
    if (invite.event_status === 'PUBLISHED' && invite.status === 'CLOSED') {
      try {
        await query("UPDATE invite_links SET status = 'ACTIVE' WHERE id = ?", [invite.id]);
        invite.status = 'ACTIVE';
      } catch (_) {}
    }

    if (invite.event_status === 'CLOSED') {
      throw new Error('Sự kiện này đã kết thúc hoặc ban tổ chức đã đóng nhận đăng ký.');
    }

    if (invite.status === 'CLOSED' || (invite.max_registrations > 0 && invite.current_registrations >= invite.max_registrations)) {
      throw new Error('Link mời này đã đạt đủ số lượng đăng ký tối đa và đã tự động đóng.');
    }

    if (invite.status !== 'ACTIVE') {
      throw new Error('Link mời này đã bị thu hồi hoặc đóng.');
    }

    if (invite.expires_at && new Date() > new Date(invite.expires_at)) {
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
