import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import { query, withTransaction } from '../../config/database';
import { ENV } from '../../config/env';
import { sendEmail, sendEmailWithResult, shouldSendApprovedEmail } from '../../config/mailer';
import { InvitesService } from '../invites/invites.service';
import { Realtime } from '../../realtime/socket';
import { getSessionLabel } from '../../utils/eventSessions';

export class RegistrationsService {
  private static escapeHtml(value: string): string {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private static formatEventDateTime(dateInput: any): string {
    if (!dateInput) return 'Đang cập nhật';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return 'Đang cập nhật';
    return d.toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  private static async sendApprovedTicketEmail(params: {
    to: string;
    fullName: string;
    eventName: string;
    eventLocation: string;
    eventMapUrl?: string | null;
    eventStartAt: any;
    ticketCode: string;
    referrerName?: string | null;
    sessionType?: string | null;
    isAutoApproved?: boolean;
  }): Promise<{ sent: boolean; simulated: boolean; error?: string }> {
    try {
      const enabled = await shouldSendApprovedEmail();
      if (!enabled) {
        return { sent: false, simulated: false };
      }

      const qrPngBuffer = await QRCode.toBuffer(params.ticketCode, {
        type: 'png',
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 360,
        color: { dark: '#0f172a', light: '#ffffff' },
      });

      const baseFrontendUrl = (ENV.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
      const ticketUrl = `${baseFrontendUrl}/my-ticket`;
      const mapHref = params.eventMapUrl
        ? params.eventMapUrl
        : params.eventLocation
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(params.eventLocation)}`
          : '';

      const safeName = this.escapeHtml(params.fullName);
      const safeEventName = this.escapeHtml(params.eventName);
      const safeLocation = this.escapeHtml(params.eventLocation || 'Sẽ cập nhật sau');
      const safeTicketCode = this.escapeHtml(params.ticketCode);
      const safeReferrer = params.referrerName ? this.escapeHtml(params.referrerName) : '';
      const timeLabel = this.formatEventDateTime(params.eventStartAt);

      const introText = params.isAutoApproved
        ? `Bạn đã đăng ký thành công sự kiện <strong>${safeEventName}</strong>. Vé QR của bạn đã được kích hoạt tự động!`
        : `Yêu cầu tham dự sự kiện <strong>${safeEventName}</strong> của bạn đã được phê duyệt chính thức!`;

      const html = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 26px; border: 1px solid #cbd5e1; border-radius: 16px; background-color: #ffffff; color: #0f172a;">
          <div style="text-align: center; margin-bottom: 16px;">
            <span style="display: inline-block; background-color: #ecfdf5; color: #047857; font-weight: 700; font-size: 12px; padding: 6px 14px; border-radius: 999px; letter-spacing: 0.5px;">
              VÉ THAM DỰ SỰ KIỆN EVENTGO HỢP LỆ
            </span>
          </div>
          <h2 style="color: #0284c7; text-align: center; margin: 0 0 14px 0; font-size: 22px;">${safeEventName}</h2>
          <p style="font-size: 14px; line-height: 1.6;">Kính gửi <strong>${safeName}</strong>,</p>
          <p style="font-size: 14px; line-height: 1.6;">${introText}</p>

          <div style="text-align: center; margin: 22px 0; padding: 20px; background-color: #f8fafc; border: 1px dashed #94a3b8; border-radius: 12px;">
            <div style="font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">
              MÃ QR CHECK-IN TẠI CỔNG
            </div>
            <img src="cid:ktsqr-ticket-qr" alt="QR Vé Tham Dự" width="220" height="220" style="display: block; margin: 0 auto; background: #ffffff; padding: 10px; border-radius: 12px; border: 1px solid #e2e8f0;" />
            <div style="margin-top: 12px; font-family: monospace; font-size: 16px; font-weight: 800; color: #b91c1c; letter-spacing: 1px;">
              ${safeTicketCode}
            </div>
          </div>

          <div style="background-color: #f8fafc; padding: 16px; border-radius: 10px; margin: 18px 0; font-size: 14px; line-height: 1.7;">
            <div><strong>Sự kiện:</strong> ${safeEventName}</div>
            <div><strong>Khung buổi:</strong> ${this.escapeHtml(getSessionLabel(params.sessionType))}</div>
            <div><strong>Thời gian:</strong> ${timeLabel}</div>
            <div><strong>Địa điểm:</strong> ${safeLocation}${mapHref ? ` (<a href="${this.escapeHtml(mapHref)}" style="color: #0284c7; font-weight: 600;">Xem Google Maps</a>)` : ''}</div>
            ${safeReferrer ? `<div><strong>Người giới thiệu:</strong> ${safeReferrer}</div>` : ''}
          </div>

          <p style="text-align: center; margin: 22px 0;">
            <a href="${this.escapeHtml(ticketUrl)}" style="background-color: #0284c7; color: #ffffff; padding: 12px 26px; text-decoration: none; border-radius: 8px; font-weight: 700; display: inline-block; font-size: 14px;">
              MỞ THẺ VÉ QR TRỰC TUYẾN
            </a>
          </p>

          <p style="font-size: 12px; color: #64748b; line-height: 1.6; border-top: 1px solid #e2e8f0; padding-top: 14px; margin-top: 20px;">
            • Vui lòng xuất trình mã QR ở trên (trực tiếp từ email này hoặc từ trang Vé của tôi) tại quầy check-in.<br/>
            • Mỗi mã QR chỉ có giá trị check-in <strong>ĐÚNG 1 LẦN</strong>. Vui lòng bảo mật, không chia sẻ ảnh mã QR cho người khác.
          </p>
        </div>
      `;

      return await sendEmailWithResult({
        to: params.to,
        subject: `[EventGo] Vé QR tham dự sự kiện: ${params.eventName}`,
        html,
        attachments: [
          {
            filename: `ticket-${params.ticketCode}.png`,
            content: qrPngBuffer,
            cid: 'ktsqr-ticket-qr',
            contentType: 'image/png',
          },
        ],
      });
    } catch (err: any) {
      console.error('[Mail] Failed to send approved ticket email:', err);
      return { sent: false, simulated: false, error: err?.message };
    }
  }

  private static async emitApprovedTicketRealtime(params: {
    registrationId: number;
    eventId: number;
    eventName: string;
    customerId: number;
    referrerId: number;
    ticketId: number;
    ticketCode: string;
    eventLocation: string;
    eventStartAt: any;
    fullName: string;
    phone: string;
    referrerName?: string;
  }) {
    try {
      const qrDataUrl = await QRCode.toDataURL(params.ticketCode, {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 360,
        color: { dark: '#0f172a', light: '#ffffff' },
      });

      Realtime.emitRegistrationApproved({
        registrationId: params.registrationId,
        eventId: params.eventId,
        eventName: params.eventName,
        customerId: params.customerId,
        referrerId: params.referrerId,
        status: 'APPROVED',
        ticket: {
          id: params.ticketId,
          code: params.ticketCode,
          status: 'ISSUED',
          qr_image: qrDataUrl,
          event_id: params.eventId,
          event_name: params.eventName,
          event_location: params.eventLocation,
          event_start_at: params.eventStartAt,
          full_name: params.fullName,
          phone: params.phone,
          referrer_name: params.referrerName,
        },
      });
    } catch (rtErr) {
      console.warn('[Realtime] Failed to emit approval:', rtErr);
    }
  }

  // Generate secure QR ticket code with HMAC integrity
  private static generateTicketCode(eventId: number, regId: number): string {
    const rawUuid = uuidv4().replace(/-/g, '');
    const sig = crypto
      .createHmac('sha256', ENV.QR_HMAC_SECRET)
      .update(`${eventId}:${regId}:${rawUuid}`)
      .digest('hex')
      .substring(0, 16);
    return `TKT-${eventId}-${rawUuid.substring(0, 8).toUpperCase()}-${sig.toUpperCase()}`;
  }

  // Customer registers via invite link
  static async register(customerId: number, data: {
    token: string;
    full_name: string;
    phone: string;
    email: string;
    address?: string;
  }) {
    // 1. Verify invite link token (strict: ném lỗi nếu link đã hết hạn hoặc sự kiện đã đóng)
    const invite = await InvitesService.verifyInviteToken(data.token, { strict: true });

    const cleanEmail = data.email.trim().toLowerCase();
    const cleanPhone = data.phone.trim();

    // 2. Check duplicate registration by email or phone for this event BEFORE touching users table
    const existingByEmail = await query<any[]>(
      `SELECT id, session_type FROM registrations WHERE event_id = ? AND LOWER(email) = ? LIMIT 1`,
      [invite.event_id, cleanEmail]
    );
    if (existingByEmail.length > 0) {
      const prevSession = existingByEmail[0].session_type && existingByEmail[0].session_type !== 'FULL_DAY'
        ? ` (${getSessionLabel(existingByEmail[0].session_type)})`
        : '';
      throw new Error(`Khách hàng với email này đã đăng ký tham gia sự kiện trước đó${prevSession}.`);
    }

    const existingPhone = await query<any[]>(
      `SELECT id, session_type FROM registrations WHERE event_id = ? AND phone = ? LIMIT 1`,
      [invite.event_id, cleanPhone]
    );
    if (existingPhone.length > 0) {
      const prevSession = existingPhone[0].session_type && existingPhone[0].session_type !== 'FULL_DAY'
        ? ` (${getSessionLabel(existingPhone[0].session_type)})`
        : '';
      throw new Error(`Số điện thoại này đã được đăng ký vé cho sự kiện này${prevSession}.`);
    }

    // 3. Identify or create customer account by email
    let actualCustomerId = customerId;
    const existingUsers = await query<any[]>('SELECT id FROM users WHERE email = ? LIMIT 1', [cleanEmail]);
    if (existingUsers.length > 0) {
      actualCustomerId = existingUsers[0].id;
    } else {
      const existingPhoneUser = await query<any[]>('SELECT id FROM users WHERE phone = ? LIMIT 1', [cleanPhone]);
      if (existingPhoneUser.length > 0) {
        throw new Error('Số điện thoại này đã được liên kết với một tài khoản khác trên hệ thống. Vui lòng sử dụng đúng email đã đăng ký.');
      }
      const newCust: any = await query(
        `INSERT INTO users (type, name, email, phone, status) VALUES ('CUSTOMER', ?, ?, ?, 'ACTIVE')`,
        [data.full_name, cleanEmail, cleanPhone]
      );
      actualCustomerId = newCust.insertId;
    }

    // 4. Also check if resolved customer account already registered for this event
    const existing = await query<any[]>(
      `SELECT id, status, session_type FROM registrations WHERE event_id = ? AND customer_id = ?`,
      [invite.event_id, actualCustomerId]
    );
    if (existing.length > 0) {
      const prevSession = existing[0].session_type && existing[0].session_type !== 'FULL_DAY'
        ? ` (${getSessionLabel(existing[0].session_type)})`
        : '';
      throw new Error(`Khách hàng với email này đã đăng ký tham gia sự kiện trước đó${prevSession}.`);
    }

    const sessionType = invite.session_type || 'FULL_DAY';

    const txResult = await withTransaction(async (conn) => {
      // 4. Fetch event details including approval_mode, dates, capacities, and registration deadline
      const [evRows]: any = await conn.query(
        'SELECT approval_mode, name, location, map_url, start_at, end_at, registration_deadline, capacity, session_mode, morning_capacity, afternoon_capacity, status FROM events WHERE id = ? FOR UPDATE',
        [invite.event_id]
      );
      const eventDetails = evRows[0] || {};
      if (eventDetails.status && eventDetails.status !== 'PUBLISHED') {
        throw new Error('Sự kiện này đã đóng nhận đăng ký.');
      }
      const now = new Date();
      if (eventDetails.end_at && now > new Date(eventDetails.end_at)) {
        throw new Error('Sự kiện này đã kết thúc, cổng đăng ký đã tự động đóng.');
      }
      const deadline = eventDetails.registration_deadline
        ? new Date(eventDetails.registration_deadline)
        : (eventDetails.start_at ? new Date(eventDetails.start_at) : null);
      if (deadline && now > deadline) {
        const deadlineStr = deadline.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ngày ' + deadline.toLocaleDateString('vi-VN');
        throw new Error(`Đã hết thời hạn đăng ký sự kiện (Hạn chót: ${deadlineStr}). Cổng đăng ký đã tự động đóng.`);
      }
      if (eventDetails.capacity) {
        const [countRows]: any = await conn.query('SELECT COUNT(*) AS total FROM registrations WHERE event_id = ?', [invite.event_id]);
        if (Number(countRows[0]?.total || 0) >= Number(eventDetails.capacity)) {
          throw new Error(`Sự kiện đã đạt giới hạn khách tham gia tối đa (${eventDetails.capacity} khách). Cổng đăng ký đã đóng.`);
        }
      }
      if (eventDetails.session_mode === 'SPLIT_SESSIONS' && (sessionType === 'MORNING' || sessionType === 'AFTERNOON')) {
        const sessionCap = sessionType === 'MORNING' ? eventDetails.morning_capacity : eventDetails.afternoon_capacity;
        if (sessionCap !== null && sessionCap !== undefined) {
          const [sessCountRows]: any = await conn.query(
            'SELECT COUNT(*) AS total FROM registrations WHERE event_id = ? AND session_type = ?',
            [invite.event_id, sessionType]
          );
          if (Number(sessCountRows[0]?.total || 0) >= Number(sessionCap)) {
            throw new Error(`${getSessionLabel(sessionType)} đã đạt giới hạn khách tối đa (${sessionCap} khách). Cổng đăng ký buổi này đã đóng.`);
          }
        }
      }
      const approvalMode = eventDetails.approval_mode || 'REFERRER_ONLY';

      // Atomic increment and quota check under transaction to prevent race conditions
      const [updateRes]: any = await conn.query(
        `UPDATE invite_links 
         SET current_registrations = current_registrations + 1,
             status = IF(current_registrations + 1 >= max_registrations, 'CLOSED', 'ACTIVE')
         WHERE id = ? AND status = 'ACTIVE' AND current_registrations < max_registrations`,
        [invite.id]
      );

      if (updateRes.affectedRows === 0) {
        throw new Error('Link mời này đã đạt đủ số lượng khách đăng ký tối đa và đã tự động đóng.');
      }

      const customerToken = jwt.sign(
        { id: actualCustomerId, email: data.email, type: 'CUSTOMER' },
        ENV.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Handle AUTO approval mode
      if (approvalMode === 'AUTO') {
        const [res]: any = await conn.query(
          `INSERT INTO registrations 
           (event_id, customer_id, invite_link_id, referrer_id, full_name, phone, email, address, session_type, status, approved_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'APPROVED', NOW())`,
          [
            invite.event_id,
            actualCustomerId,
            invite.id,
            invite.referrer_id,
            data.full_name,
            data.phone,
            data.email,
            data.address || null,
            sessionType,
          ]
        );

        const regId = res.insertId;
        const ticketCode = this.generateTicketCode(invite.event_id, regId);

        const [tktRes]: any = await conn.query(
          `INSERT INTO tickets (registration_id, event_id, code, status)
           VALUES (?, ?, ?, 'ISSUED')`,
          [regId, invite.event_id, ticketCode]
        );

        return {
          mode: 'AUTO' as const,
          regId,
          ticketId: tktRes.insertId,
          ticketCode,
          eventLocation: eventDetails.location || invite.event_location,
          eventMapUrl: eventDetails.map_url || null,
          eventStartAt: eventDetails.start_at || invite.event_start_at,
          referrerName: invite.referrer_name as string | undefined,
          payload: {
            id: regId,
            status: 'APPROVED',
            session_type: sessionType,
            session_label: getSessionLabel(sessionType),
            ticket_id: tktRes.insertId,
            code: ticketCode,
            token: customerToken,
            user: {
              id: actualCustomerId,
              name: data.full_name,
              email: data.email,
              phone: data.phone,
              type: 'CUSTOMER',
              permissions: [],
            },
            message: 'Đăng ký thành công! Vé QR của bạn đã được cấp tự động.',
          },
        };
      }

      // Default or TWO_TIER mode: PENDING status
      const [res]: any = await conn.query(
        `INSERT INTO registrations 
         (event_id, customer_id, invite_link_id, referrer_id, full_name, phone, email, address, session_type, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
        [
          invite.event_id,
          actualCustomerId,
          invite.id,
          invite.referrer_id,
          data.full_name,
          data.phone,
          data.email,
          data.address || null,
          sessionType,
        ]
      );

      const [referrer]: any = await conn.query(
        'SELECT name, email FROM users WHERE id = ?',
        [invite.referrer_id]
      );

      const msg = approvalMode === 'TWO_TIER'
        ? 'Đăng ký thành công! Đang chờ người giới thiệu và Ban Quản Trị phê duyệt cấp vé QR.'
        : 'Đăng ký thành công! Vui lòng chờ người giới thiệu phê duyệt cấp vé QR.';

      return {
        mode: 'PENDING' as const,
        regId: res.insertId,
        referrer: referrer?.[0] || null,
        payload: {
          id: res.insertId,
          status: 'PENDING',
          session_type: sessionType,
          session_label: getSessionLabel(sessionType),
          token: customerToken,
          user: {
            id: actualCustomerId,
            name: data.full_name,
            email: data.email,
            phone: data.phone,
            type: 'CUSTOMER',
            permissions: [],
          },
          message: msg,
        },
      };
    });

    // Post-commit emails & realtime events (outside DB transaction lock)
    if (txResult.mode === 'AUTO') {
      await this.sendApprovedTicketEmail({
        to: data.email,
        fullName: data.full_name,
        eventName: invite.event_name,
        eventLocation: txResult.eventLocation,
        eventMapUrl: txResult.eventMapUrl,
        eventStartAt: txResult.eventStartAt,
        ticketCode: txResult.ticketCode,
        referrerName: txResult.referrerName,
        sessionType,
        isAutoApproved: true,
      });

      try {
        Realtime.emitRegistrationNew({
          registrationId: txResult.regId,
          eventId: invite.event_id,
          eventName: invite.event_name,
          customerId: actualCustomerId,
          fullName: data.full_name,
          phone: data.phone,
          email: data.email,
          referrerId: invite.referrer_id,
          referrerName: txResult.referrerName,
          status: 'APPROVED',
          createdAt: new Date().toISOString(),
        });
      } catch (rtErr) {
        console.warn('[Realtime] Failed to emit new registration:', rtErr);
      }

      await this.emitApprovedTicketRealtime({
        registrationId: txResult.regId,
        eventId: invite.event_id,
        eventName: invite.event_name,
        customerId: actualCustomerId,
        referrerId: invite.referrer_id,
        ticketId: txResult.ticketId,
        ticketCode: txResult.ticketCode,
        eventLocation: txResult.eventLocation,
        eventStartAt: txResult.eventStartAt,
        fullName: data.full_name,
        phone: data.phone,
        referrerName: txResult.referrerName,
      });

      return txResult.payload;
    }

    if (txResult.referrer?.email) {
      await sendEmail({
        to: txResult.referrer.email,
        subject: `[EventGo] Có lượt đăng ký mới từ khách hàng ${data.full_name}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h3>Có lượt đăng ký mới cần duyệt!</h3>
            <p>Chào <strong>${this.escapeHtml(txResult.referrer.name)}</strong>,</p>
            <p>Khách hàng <strong>${this.escapeHtml(data.full_name)}</strong> (SĐT: ${this.escapeHtml(data.phone)}, Email: ${this.escapeHtml(data.email)}) vừa đăng ký tham dự sự kiện <strong>${this.escapeHtml(invite.event_name)}</strong> qua link của bạn.</p>
            <p>Vui lòng đăng nhập hệ thống để xem và phê duyệt.</p>
          </div>
        `,
      });
    }

    try {
      Realtime.emitRegistrationNew({
        registrationId: txResult.regId,
        eventId: invite.event_id,
        eventName: invite.event_name,
        customerId: actualCustomerId,
        fullName: data.full_name,
        phone: data.phone,
        email: data.email,
        referrerId: invite.referrer_id,
        referrerName: txResult.referrer?.name,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      });
    } catch (rtErr) {
      console.warn('[Realtime] Failed to emit pending registration:', rtErr);
    }

    return txResult.payload;
  }

  // List registrations with RBAC filtering
  static async listRegistrations(user: any, eventId?: number, status?: string) {
    let sql = `
      SELECT r.*, e.name as event_name, e.approval_mode as event_approval_mode,
             u_ref.name as referrer_name, u_ref.phone as referrer_phone,
             t.code as ticket_code, t.status as ticket_status, t.used_at as ticket_used_at
      FROM registrations r
      JOIN events e ON r.event_id = e.id
      LEFT JOIN users u_ref ON r.referrer_id = u_ref.id
      LEFT JOIN tickets t ON r.id = t.registration_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (user.type === 'TENANT_ADMIN') {
      sql += ' AND e.tenant_id = ?';
      params.push(user.tenantId || -1);
    } else if (user.type === 'STAFF') {
      sql += ` AND EXISTS (
        SELECT 1 FROM staff_event_quotas q
        WHERE q.event_id = r.event_id AND q.staff_id = ? AND q.is_enabled = 1
          AND (
            q.can_approve = 1
            OR q.can_view_report = 1
            OR (q.can_invite = 1 AND r.referrer_id = ?)
          )
      )`;
      params.push(user.id, user.id);
    } else if (user.type !== 'ADMIN') {
      sql += ' AND r.referrer_id = ?';
      params.push(user.id);
    }

    if (eventId) {
      sql += ' AND r.event_id = ?';
      params.push(eventId);
    }

    if (status) {
      sql += ' AND r.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY r.id DESC';

    return await query(sql, params);
  }

  // Staff / Admin approves registration
  static async approveRegistration(regId: number, staffUser: any) {
    // 1. Fetch registration details
    const rows = await query<any[]>(
      `SELECT r.*, e.name as event_name, e.start_at as event_start_at, e.location as event_location,
              e.map_url as event_map_url, e.approval_mode as event_approval_mode,
              u_cust.email as customer_email, u_ref.name as referrer_name
       FROM registrations r
       JOIN events e ON r.event_id = e.id
       JOIN users u_cust ON r.customer_id = u_cust.id
       JOIN users u_ref ON r.referrer_id = u_ref.id
       WHERE r.id = ?`,
      [regId]
    );

    if (rows.length === 0) {
      throw new Error('Thông tin đăng ký không tồn tại.');
    }

    const reg = rows[0];

    if (staffUser.type === 'STAFF') {
      const assignments = await query<any[]>(
        `SELECT can_approve, can_invite FROM staff_event_quotas
         WHERE event_id = ? AND staff_id = ? AND is_enabled = 1 LIMIT 1`,
        [reg.event_id, staffUser.id]
      );
      const isReferrer = Number(reg.referrer_id) === Number(staffUser.id);
      const canApprove = Boolean(assignments[0]?.can_approve || assignments[0]?.can_invite || isReferrer);
      if (!canApprove) {
        throw new Error('Bạn chưa được phân quyền duyệt khách trong sự kiện này.');
      }
      if (!staffUser.tenantId && !isReferrer && !assignments[0]?.can_approve) {
        throw new Error('Bạn không có quyền duyệt khách của nhân viên khác.');
      }
    }

    if (reg.status === 'APPROVED') {
      throw new Error('Đăng ký này đã được phê duyệt trước đó.');
    }

    // Two-tier approval handling:
    // If event is TWO_TIER and caller is NOT Admin/TenantAdmin and status is PENDING:
    if (reg.event_approval_mode === 'TWO_TIER' && staffUser.type !== 'ADMIN' && staffUser.type !== 'TENANT_ADMIN' && reg.status === 'PENDING') {
      await query(
        `UPDATE registrations 
         SET status = 'PENDING_ADMIN', approved_by = ?, approved_at = NOW() 
         WHERE id = ?`,
        [staffUser.id, regId]
      );

      // Notify customer that referrer approved, waiting for Admin
      await sendEmail({
        to: reg.email,
        subject: `[EventGo] Đăng ký của bạn đã qua vòng 1: ${reg.event_name}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <p>Chào <strong>${reg.full_name}</strong>,</p>
            <p>Người giới thiệu <strong>${reg.referrer_name}</strong> đã phê duyệt yêu cầu của bạn.</p>
            <p>Hồ sơ đang chờ Ban Quản Trị (Admin) phê duyệt lần 2 để xuất mã vé QR chính thức.</p>
          </div>
        `,
      });

      return {
        status: 'PENDING_ADMIN',
        message: 'Đã duyệt vòng 1 thành công! Đang chuyển tiếp để Admin duyệt cấp vé QR.',
      };
    }

    // Final Approval (either REFERRER_ONLY or Admin approving)
    const ticketCode = this.generateTicketCode(reg.event_id, reg.id);

    const ticketId = await withTransaction(async (conn) => {
      // Update registration status
      await conn.query(
        `UPDATE registrations 
         SET status = 'APPROVED', approved_by = ?, approved_at = NOW() 
         WHERE id = ?`,
        [staffUser.id, regId]
      );

      // Create Ticket with status ISSUED
      const [tktRes]: any = await conn.query(
        `INSERT INTO tickets (registration_id, event_id, code, status)
         VALUES (?, ?, ?, 'ISSUED')`,
        [regId, reg.event_id, ticketCode]
      );

      return tktRes.insertId as number;
    });

    const recipientEmail = reg.email || reg.customer_email;
    const mailRes = recipientEmail
      ? await this.sendApprovedTicketEmail({
          to: recipientEmail,
          fullName: reg.full_name,
          eventName: reg.event_name,
          eventLocation: reg.event_location,
          eventMapUrl: reg.event_map_url,
          eventStartAt: reg.event_start_at,
          ticketCode,
          referrerName: reg.referrer_name,
          sessionType: reg.session_type,
          isAutoApproved: false,
        })
      : { sent: false, simulated: false };

    await this.emitApprovedTicketRealtime({
      registrationId: regId,
      eventId: reg.event_id,
      eventName: reg.event_name,
      customerId: reg.customer_id,
      referrerId: reg.referrer_id,
      ticketId,
      ticketCode,
      eventLocation: reg.event_location,
      eventStartAt: reg.event_start_at,
      fullName: reg.full_name,
      phone: reg.phone,
      referrerName: reg.referrer_name,
    });

    return {
      ticket_id: ticketId,
      code: ticketCode,
      status: 'APPROVED',
      email_sent: mailRes.sent,
      message: 'Đã duyệt đăng ký và cấp vé QR thành công.',
    };
  }

  // Staff rejects registration
  static async rejectRegistration(regId: number, staffUser: any, reason?: string) {
    const rows = await query<any[]>(
      `SELECT r.*, e.name as event_name 
       FROM registrations r 
       JOIN events e ON r.event_id = e.id 
       WHERE r.id = ?`,
      [regId]
    );

    if (rows.length === 0) {
      throw new Error('Thông tin đăng ký không tồn tại.');
    }

    const reg = rows[0];

    if (staffUser.type === 'STAFF') {
      const assignments = await query<any[]>(
        `SELECT can_approve, can_invite FROM staff_event_quotas
         WHERE event_id = ? AND staff_id = ? AND is_enabled = 1 LIMIT 1`,
        [reg.event_id, staffUser.id]
      );
      const isReferrer = Number(reg.referrer_id) === Number(staffUser.id);
      const canApprove = Boolean(assignments[0]?.can_approve || assignments[0]?.can_invite || isReferrer);
      if (!canApprove) throw new Error('Bạn chưa được phân quyền duyệt khách trong sự kiện này.');
    }

    await query(
      `UPDATE registrations 
       SET status = 'REJECTED', rejection_reason = ?, approved_by = ?, approved_at = NOW() 
       WHERE id = ?`,
      [reason || 'Không đáp ứng điều kiện tham gia', staffUser.id, regId]
    );

    // Send email notification
    await sendEmail({
      to: reg.email,
      subject: `[Event QR] Thông báo về đăng ký tham dự: ${reg.event_name}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <p>Chào <strong>${reg.full_name}</strong>,</p>
          <p>Rất tiếc yêu cầu tham dự sự kiện <strong>${reg.event_name}</strong> của bạn đã bị từ chối.</p>
          <p><strong>Lý do:</strong> ${reason || 'Không đáp ứng điều kiện tham gia.'}</p>
        </div>
      `,
    });

    return { success: true, message: 'Đã từ chối đăng ký.' };
  }
}
