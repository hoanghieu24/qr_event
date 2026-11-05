import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import { query, withTransaction } from '../../config/database';
import { ENV } from '../../config/env';
import { sendEmail } from '../../config/mailer';
import { InvitesService } from '../invites/invites.service';
import { Realtime } from '../../realtime/socket';

export class RegistrationsService {
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

    // 2. Identify or create customer account by email
    let actualCustomerId = customerId;
    const existingUsers = await query<any[]>('SELECT id FROM users WHERE email = ?', [data.email]);
    if (existingUsers.length > 0) {
      actualCustomerId = existingUsers[0].id;
    } else {
      const newCust: any = await query(
        `INSERT INTO users (type, name, email, phone, status) VALUES ('CUSTOMER', ?, ?, ?, 'ACTIVE')`,
        [data.full_name, data.email, data.phone]
      );
      actualCustomerId = newCust.insertId;
    }

    // 3. Check if customer already registered for this event
    const existing = await query<any[]>(
      `SELECT id, status FROM registrations WHERE event_id = ? AND customer_id = ?`,
      [invite.event_id, actualCustomerId]
    );

    if (existing.length > 0) {
      throw new Error('Khách hàng với email này đã đăng ký tham gia sự kiện trước đó.');
    }

    // Also check phone duplicate for this event
    const existingPhone = await query<any[]>(
      `SELECT id FROM registrations WHERE event_id = ? AND phone = ?`,
      [invite.event_id, data.phone]
    );

    if (existingPhone.length > 0) {
      throw new Error('Số điện thoại này đã được đăng ký vé cho sự kiện này.');
    }

    return await withTransaction(async (conn) => {
      // 4. Fetch event details including approval_mode, dates, and registration deadline
      const [evRows]: any = await conn.query(
        'SELECT approval_mode, name, location, start_at, end_at, registration_deadline, capacity, status FROM events WHERE id = ? FOR UPDATE',
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

      // Handle AUTO approval mode
      if (approvalMode === 'AUTO') {
        const [res]: any = await conn.query(
          `INSERT INTO registrations 
           (event_id, customer_id, invite_link_id, referrer_id, full_name, phone, email, address, status, approved_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'APPROVED', NOW())`,
          [
            invite.event_id,
            actualCustomerId,
            invite.id,
            invite.referrer_id,
            data.full_name,
            data.phone,
            data.email,
            data.address || null,
          ]
        );

        const regId = res.insertId;
        const ticketCode = this.generateTicketCode(invite.event_id, regId);

        const [tktRes]: any = await conn.query(
          `INSERT INTO tickets (registration_id, event_id, code, status)
           VALUES (?, ?, ?, 'ISSUED')`,
          [regId, invite.event_id, ticketCode]
        );

        // Send Ticket Email directly to Customer
        const ticketUrl = `${ENV.FRONTEND_URL}/my-ticket`;
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 2px solid #0284c7; border-radius: 10px;">
            <h2 style="color: #0284c7; text-align: center;">VÉ THAM DỰ SỰ KIỆN KTSQR HỢP LỆ</h2>
            <p>Kính gửi <strong>${data.full_name}</strong>,</p>
            <p>Bạn đã đăng ký thành công sự kiện <strong>${invite.event_name}</strong>. Vé QR của bạn đã được kích hoạt tự động!</p>
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Sự kiện:</strong> ${invite.event_name}</p>
              <p><strong>Địa điểm:</strong> ${eventDetails.location || invite.event_location}</p>
              <p><strong>Thời gian:</strong> ${new Date(eventDetails.start_at || invite.event_start_at).toLocaleString('vi-VN')}</p>
              <p><strong>Mã số vé:</strong> <span style="font-family: monospace; font-size: 18px; font-weight: bold; color: #b91c1c;">${ticketCode}</span></p>
            </div>
            <p style="text-align: center;">
              <a href="${ticketUrl}" style="background-color: #0284c7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                XEM MÃ QR VÉ CỦA BẠN
              </a>
            </p>
          </div>
        `;

        await sendEmail({
          to: data.email,
          subject: `[KTSQR] Vé tham dự sự kiện của bạn: ${invite.event_name}`,
          html,
        });

        // Generate QR code for AUTO approval mode & emit realtime
        try {
          const qrDataUrl = await QRCode.toDataURL(ticketCode, {
            errorCorrectionLevel: 'H',
            margin: 2,
            width: 360,
            color: { dark: '#0f172a', light: '#ffffff' },
          });

          Realtime.emitRegistrationNew({
            registrationId: regId,
            eventId: invite.event_id,
            eventName: invite.event_name,
            customerId: actualCustomerId,
            fullName: data.full_name,
            phone: data.phone,
            email: data.email,
            referrerId: invite.referrer_id,
            referrerName: invite.referrer_name,
            status: 'APPROVED',
            createdAt: new Date().toISOString(),
          });

          Realtime.emitRegistrationApproved({
            registrationId: regId,
            eventId: invite.event_id,
            eventName: invite.event_name,
            customerId: actualCustomerId,
            referrerId: invite.referrer_id,
            status: 'APPROVED',
            ticket: {
              id: tktRes.insertId,
              code: ticketCode,
              status: 'ISSUED',
              qr_image: qrDataUrl,
              event_id: invite.event_id,
              event_name: invite.event_name,
              event_location: eventDetails.location || invite.event_location,
              event_start_at: eventDetails.start_at || invite.event_start_at,
              full_name: data.full_name,
              phone: data.phone,
              referrer_name: invite.referrer_name,
            },
          });
        } catch (rtErr) {
          console.warn('[Realtime] Failed to emit auto approval:', rtErr);
        }

        const customerToken = jwt.sign(
          { id: actualCustomerId, email: data.email, type: 'CUSTOMER' },
          ENV.JWT_SECRET,
          { expiresIn: '7d' }
        );

        return {
          id: regId,
          status: 'APPROVED',
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
        };
      }

      // Default or TWO_TIER mode: PENDING status
      const [res]: any = await conn.query(
        `INSERT INTO registrations 
         (event_id, customer_id, invite_link_id, referrer_id, full_name, phone, email, address, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
        [
          invite.event_id,
          actualCustomerId,
          invite.id,
          invite.referrer_id,
          data.full_name,
          data.phone,
          data.email,
          data.address || null,
        ]
      );

      // Send notification email to Referrer
      const [referrer]: any = await conn.query(
        'SELECT name, email FROM users WHERE id = ?',
        [invite.referrer_id]
      );
      if (referrer && referrer[0]) {
        await sendEmail({
          to: referrer[0].email,
          subject: `[KTSQR] Có lượt đăng ký mới từ khách hàng ${data.full_name}`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
              <h3>Có lượt đăng ký mới cần duyệt!</h3>
              <p>Chào <strong>${referrer[0].name}</strong>,</p>
              <p>Khách hàng <strong>${data.full_name}</strong> (SĐT: ${data.phone}, Email: ${data.email}) vừa đăng ký tham dự sự kiện <strong>${invite.event_name}</strong> qua link của bạn.</p>
              <p>Vui lòng đăng nhập hệ thống để xem và phê duyệt.</p>
            </div>
          `,
        });
      }

      // Emit realtime registration new event
      try {
        Realtime.emitRegistrationNew({
          registrationId: res.insertId,
          eventId: invite.event_id,
          eventName: invite.event_name,
          customerId: actualCustomerId,
          fullName: data.full_name,
          phone: data.phone,
          email: data.email,
          referrerId: invite.referrer_id,
          referrerName: referrer[0]?.name,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
        });
      } catch (rtErr) {
        console.warn('[Realtime] Failed to emit pending registration:', rtErr);
      }

      const msg = approvalMode === 'TWO_TIER'
        ? 'Đăng ký thành công! Đang chờ người giới thiệu và Ban Quản Trị phê duyệt cấp vé QR.'
        : 'Đăng ký thành công! Vui lòng chờ người giới thiệu phê duyệt cấp vé QR.';

      const customerToken = jwt.sign(
        { id: actualCustomerId, email: data.email, type: 'CUSTOMER' },
        ENV.JWT_SECRET,
        { expiresIn: '7d' }
      );

      return {
        id: res.insertId,
        status: 'PENDING',
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
      };
    });
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
              e.approval_mode as event_approval_mode,
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
        subject: `[KTSQR] Đăng ký của bạn đã qua vòng 1: ${reg.event_name}`,
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

    return await withTransaction(async (conn) => {
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

      // Send Ticket Email to Customer
      const ticketUrl = `${ENV.FRONTEND_URL}/my-ticket`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 2px solid #0284c7; border-radius: 10px;">
          <h2 style="color: #0284c7; text-align: center;">VÉ THAM DỰ SỰ KIỆN KTSQR HỢP LỆ</h2>
          <p>Kính gửi <strong>${reg.full_name}</strong>,</p>
          <p>Yêu cầu tham dự sự kiện của bạn đã được phê duyệt chính thức!</p>
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Sự kiện:</strong> ${reg.event_name}</p>
            <p><strong>Địa điểm:</strong> ${reg.event_location}</p>
            <p><strong>Thời gian:</strong> ${new Date(reg.event_start_at).toLocaleString('vi-VN')}</p>
            <p><strong>Mã số vé:</strong> <span style="font-family: monospace; font-size: 18px; font-weight: bold; color: #b91c1c;">${ticketCode}</span></p>
          </div>
          <p style="text-align: center;">
            <a href="${ticketUrl}" style="background-color: #0284c7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              XEM MÃ QR VÉ CỦA BẠN
            </a>
          </p>
          <p style="font-size: 13px; color: #64748b; margin-top: 20px;">
            * Mỗi mã QR chỉ có giá trị check-in <strong>ĐÚNG 1 LẦN</strong>. Vui lòng xuất trình mã QR tại cổng kiểm soát.
          </p>
        </div>
      `;

      await sendEmail({
        to: reg.email,
        subject: `[KTSQR] Vé tham dự chính thức: ${reg.event_name}`,
        html,
      });

      // Generate QR Code data URL for realtime push to customer wallet & staff dashboard
      try {
        const qrDataUrl = await QRCode.toDataURL(ticketCode, {
          errorCorrectionLevel: 'H',
          margin: 2,
          width: 360,
          color: { dark: '#0f172a', light: '#ffffff' },
        });

        Realtime.emitRegistrationApproved({
          registrationId: regId,
          eventId: reg.event_id,
          eventName: reg.event_name,
          customerId: reg.customer_id,
          referrerId: reg.referrer_id,
          status: 'APPROVED',
          ticket: {
            id: tktRes.insertId,
            code: ticketCode,
            status: 'ISSUED',
            qr_image: qrDataUrl,
            event_id: reg.event_id,
            event_name: reg.event_name,
            event_location: reg.event_location,
            event_start_at: reg.event_start_at,
            full_name: reg.full_name,
            phone: reg.phone,
            referrer_name: reg.referrer_name,
          },
        });
      } catch (rtErr) {
        console.warn('[Realtime] Failed to emit approval:', rtErr);
      }

      return {
        ticket_id: tktRes.insertId,
        code: ticketCode,
        status: 'APPROVED',
        message: 'Đã duyệt đăng ký và cấp vé QR thành công.',
      };
    });
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
