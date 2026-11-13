import { query } from '../../config/database';
import { ENV } from '../../config/env';
import {
  generateUniqueShortToken as genShortToken,
  getSessionLabel,
  InviteSessionType,
  signInviteTokenPayload,
} from '../../utils/eventSessions';

export class InvitesService {
  // Generate HMAC Signature for invite token
  static generateSignature(eventId: number, referrerId: number, token: string): string {
    return signInviteTokenPayload(eventId, referrerId, token);
  }

  // Tạo mã link mời ngắn gọn (8 ký tự ngẫu nhiên, dễ đọc, không gây nhầm lẫn)
  static async generateUniqueShortToken(): Promise<string> {
    return await genShortToken();
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
    session_type?: InviteSessionType;
  }) {
    const eventRows = await query<any[]>(
      'SELECT capacity, session_mode, morning_capacity, afternoon_capacity FROM events WHERE id = ? LIMIT 1',
      [data.event_id]
    );
    const ev = eventRows[0];
    if (!ev) throw new Error('Sự kiện không tồn tại.');

    const resolvedSessionType: InviteSessionType =
      ev.session_mode === 'SPLIT_SESSIONS'
        ? data.session_type === 'AFTERNOON'
          ? 'AFTERNOON'
          : 'MORNING'
        : 'FULL_DAY';

    const sessionCapacity =
      resolvedSessionType === 'MORNING'
        ? Number(ev.morning_capacity ?? ev.capacity ?? 50)
        : resolvedSessionType === 'AFTERNOON'
        ? Number(ev.afternoon_capacity ?? ev.capacity ?? 50)
        : Number(ev.capacity ?? 50);

    // Generate secure short token (8 ký tự ngẫu nhiên, gọn đẹp, dễ chia sẻ)
    const token = await this.generateUniqueShortToken();
    const signature = this.generateSignature(data.event_id, data.referrer_id, token);

    const days = data.expires_in_days || 30;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    // If not Admin override, apply Admin's quota
    let maxRegs = data.max_registrations ?? sessionCapacity ?? 50;
    if (!data.is_admin) {
      const quotaInfo = await this.getStaffQuotaForEvent(data.event_id, data.referrer_id);
      maxRegs = quotaInfo.max_invites;
    }

    const res: any = await query(
      `INSERT INTO invite_links (event_id, referrer_id, token, signature, expires_at, max_registrations, session_type, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      [
        data.event_id,
        data.referrer_id,
        token,
        signature,
        expiresAt,
        maxRegs,
        resolvedSessionType,
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
      session_type: resolvedSessionType,
      session_label: getSessionLabel(resolvedSessionType),
    };
  }

  static async verifyInviteToken(rawToken: string, options?: { strict?: boolean }): Promise<any> {
    const token = String(rawToken || '').trim();
    if (!token) {
      throw new Error('Link mời không tồn tại hoặc không hợp lệ.');
    }

    const selectFields = `
      il.*, 
      e.id as event_id, e.name as event_name, e.description as event_description, 
      e.location as event_location, e.map_url as event_map_url, e.info_url as event_info_url,
      e.poster_url as event_poster, e.capacity as event_capacity,
      e.session_mode as event_session_mode, e.morning_capacity as event_morning_capacity, e.afternoon_capacity as event_afternoon_capacity,
      e.start_at as event_start_at, e.end_at as event_end_at, 
      e.registration_deadline as event_registration_deadline,
      e.status as event_status, e.approval_mode as event_approval_mode,
      (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id) as current_event_registrations,
      (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.session_type = COALESCE(il.session_type, 'FULL_DAY')) as current_session_registrations,
      COALESCE(u.name, 'Ban Tổ Chức') as referrer_name, 
      COALESCE(u.email, '') as referrer_email, 
      COALESCE(u.phone, '') as referrer_phone
    `;

    // 1. Thử tìm kiếm trực tiếp theo token hoặc legacy_token
    let rows = await query<any[]>(
      `SELECT ${selectFields}
       FROM invite_links il
       JOIN events e ON il.event_id = e.id
       LEFT JOIN users u ON il.referrer_id = u.id
       WHERE il.token = ? OR il.legacy_token = ?`,
      [token, token]
    );

    // 2. Thử tìm partial match (nếu token dài, có tiền tố inv_, hoặc người dùng copy bị thiếu ký tự)
    if (rows.length === 0 && (token.startsWith('inv_') || token.length >= 6)) {
      rows = await query<any[]>(
        `SELECT ${selectFields}
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
          `SELECT ${selectFields}
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
            return await this.verifyInviteToken(newLink.token, options);
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

    // Nếu sự kiện vẫn đang PUBLISHED nhưng link vô tình bị CLOSED, tự động mở lại link (nếu chưa quá hạn)
    if (invite.event_status === 'PUBLISHED' && invite.status === 'CLOSED') {
      try {
        await query("UPDATE invite_links SET status = 'ACTIVE' WHERE id = ?", [invite.id]);
        invite.status = 'ACTIVE';
      } catch (_) {}
    }

    // Đánh giá trạng thái đóng/mở đăng ký
    const now = new Date();
    const eventEnd = invite.event_end_at ? new Date(invite.event_end_at) : null;
    const eventStart = invite.event_start_at ? new Date(invite.event_start_at) : null;
    const deadline = invite.event_registration_deadline
      ? new Date(invite.event_registration_deadline)
      : eventStart;

    let isClosed = false;
    let closureReason = '';

    const sessionType: InviteSessionType = invite.session_type || 'FULL_DAY';
    const sessionCapacity =
      sessionType === 'MORNING'
        ? invite.event_morning_capacity
        : sessionType === 'AFTERNOON'
        ? invite.event_afternoon_capacity
        : invite.event_capacity;

    invite.session_type = sessionType;
    invite.session_label = getSessionLabel(sessionType);
    invite.session_capacity = sessionCapacity;
    invite.current_session_registrations = Number(invite.current_session_registrations || 0);

    if (invite.event_status === 'CLOSED' || invite.event_status === 'CANCELLED') {
      isClosed = true;
      closureReason = 'Ban tổ chức đã đóng cổng đăng ký cho sự kiện này.';
    } else if (eventEnd && now > eventEnd) {
      isClosed = true;
      const endStr = eventEnd.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ngày ' + eventEnd.toLocaleDateString('vi-VN');
      closureReason = `Sự kiện đã kết thúc (${endStr}). Cổng đăng ký đã đóng.`;
    } else if (deadline && now > deadline) {
      isClosed = true;
      const dlStr = deadline.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ngày ' + deadline.toLocaleDateString('vi-VN');
      closureReason = `Đã hết thời hạn đăng ký sự kiện (Hạn chót: ${dlStr}). Cổng đăng ký đã tự động đóng.`;
    } else if (invite.event_capacity > 0 && Number(invite.current_event_registrations) >= Number(invite.event_capacity)) {
      isClosed = true;
      closureReason = `Sự kiện đã đạt số lượng khách tham dự tối đa (${invite.event_capacity} khách). Cổng đăng ký đã đóng.`;
    } else if (
      invite.event_session_mode === 'SPLIT_SESSIONS' &&
      (sessionType === 'MORNING' || sessionType === 'AFTERNOON') &&
      sessionCapacity !== null &&
      sessionCapacity !== undefined &&
      (Number(sessionCapacity) <= 0 || Number(invite.current_session_registrations || 0) >= Number(sessionCapacity))
    ) {
      isClosed = true;
      closureReason = `${getSessionLabel(sessionType)} đã đạt số lượng khách tối đa (${sessionCapacity} khách). Cổng đăng ký buổi này đã đóng.`;
    } else if (
      invite.status === 'CLOSED' ||
      (invite.max_registrations !== null &&
        invite.max_registrations !== undefined &&
        Number(invite.current_registrations) >= Number(invite.max_registrations))
    ) {
      isClosed = true;
      closureReason = 'Link mời này đã đạt đủ số lượng khách đăng ký tối đa.';
    } else if (invite.status !== 'ACTIVE') {
      isClosed = true;
      closureReason = 'Link mời này hiện đang tạm dừng hoạt động.';
    } else if (invite.expires_at && now > new Date(invite.expires_at)) {
      isClosed = true;
      closureReason = 'Link mời này đã hết thời hạn sử dụng.';
    }

    invite.is_registration_closed = isClosed;
    invite.closure_reason = closureReason;

    // Nếu gọi với strict: true (ví dụ khi gửi đăng ký form), chặn và ném lỗi nếu đã đóng
    if (options?.strict && isClosed) {
      throw new Error(closureReason || 'Cổng đăng ký sự kiện hiện đã đóng.');
    }

    return invite;
  }

  static async getMyInviteLinks(referrerId: number) {
    const rows = await query<any[]>(`
      SELECT il.*, e.name as event_name, e.start_at as event_start_at, e.approval_mode as event_approval_mode,
             e.session_mode as event_session_mode, e.morning_capacity as event_morning_capacity, e.afternoon_capacity as event_afternoon_capacity,
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
      session_type: r.session_type || 'FULL_DAY',
      session_label: getSessionLabel(r.session_type),
      url: `${ENV.FRONTEND_URL}/invite/${r.token}`,
      invite_url: `${ENV.FRONTEND_URL}/invite/${r.token}`,
    }));
  }
}
