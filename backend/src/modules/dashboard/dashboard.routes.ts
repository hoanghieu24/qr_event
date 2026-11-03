import { Router, Request, Response } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireEventCapability, requirePermission } from '../../middlewares/rbac.middleware';
import { query } from '../../config/database';
import nodemailer from 'nodemailer';

const router = Router();

// 1. Overall Summary
router.get('/summary', authenticate, requirePermission('reports:view'), async (req: Request, res: Response) => {
  try {
    const isStaff = req.user?.type === 'STAFF';
    const staffId = req.user?.id;
    const eventScope = isStaff
      ? ` AND EXISTS (SELECT 1 FROM staff_event_quotas q WHERE q.event_id = e.id AND q.staff_id = ? AND q.is_enabled = 1 AND q.can_view_report = 1)`
      : '';
    const eventsRows: any = await query(`SELECT COUNT(*) as total FROM events e WHERE 1=1 ${eventScope}`, isStaff ? [staffId] : []);
    const ticketsRows: any = await query(
      `SELECT COUNT(*) as total FROM tickets t JOIN events e ON e.id = t.event_id WHERE 1=1 ${eventScope}`,
      isStaff ? [staffId] : []
    );
    const checkedInRows: any = await query(
      `SELECT COUNT(*) as total FROM tickets t JOIN events e ON e.id = t.event_id WHERE t.status = 'USED' ${eventScope}`,
      isStaff ? [staffId] : []
    );
    const disputesRows: any = await query(
      `SELECT COUNT(*) as total FROM disputes d JOIN tickets t ON t.id = d.ticket_id JOIN events e ON e.id = t.event_id WHERE d.decision = 'PENDING' ${eventScope}`,
      isStaff ? [staffId] : []
    );
    const staffRows: any = await query('SELECT COUNT(*) as total FROM users WHERE type = "STAFF"');
    const customersRows: any = await query('SELECT COUNT(*) as total FROM users WHERE type = "CUSTOMER"');

    const eventsCount = eventsRows[0] || { total: 0 };
    const ticketsCount = ticketsRows[0] || { total: 0 };
    const checkedInCount = checkedInRows[0] || { total: 0 };
    const disputesCount = disputesRows[0] || { total: 0 };
    const staffCount = staffRows[0] || { total: 0 };
    const customersCount = customersRows[0] || { total: 0 };

    // Recent 10 scans
    const recentScans = await query(`
      SELECT sl.id, sl.scanned_code, sl.result, sl.scanned_at,
             u.name as scanner_name, e.name as event_name,
             r.full_name as attendee_name
      FROM scan_logs sl
      JOIN users u ON sl.scanned_by = u.id
      JOIN events e ON sl.event_id = e.id
      LEFT JOIN tickets t ON sl.ticket_id = t.id
      LEFT JOIN registrations r ON t.registration_id = r.id
      ${isStaff ? 'WHERE EXISTS (SELECT 1 FROM staff_event_quotas q WHERE q.event_id = e.id AND q.staff_id = ? AND q.is_enabled = 1 AND q.can_view_report = 1)' : ''}
      ORDER BY sl.scanned_at DESC
      LIMIT 10
    `, isStaff ? [staffId] : []);

    res.json({
      success: true,
      data: {
        total_events: eventsCount.total,
        total_tickets: ticketsCount.total,
        total_checked_in: checkedInCount.total,
        pending_disputes: disputesCount.total,
        total_staff: staffCount.total,
        total_customers: customersCount.total,
        recent_scans: recentScans,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Check-in Velocity / Traffic Peak Timeline
router.get('/velocity', authenticate, requirePermission('reports:view'), requireEventCapability('can_view_report'), async (req: Request, res: Response) => {
  try {
    const eventId = req.query.event_id ? parseInt(String(req.query.event_id), 10) : null;
    let sql = `
      SELECT DATE_FORMAT(sl.scanned_at, '%H:00') as time_block,
             COUNT(*) as total_scans,
             SUM(CASE WHEN sl.result = 'SUCCESS' THEN 1 ELSE 0 END) as success_scans,
             SUM(CASE WHEN sl.result = 'ALREADY_USED' THEN 1 ELSE 0 END) as duplicate_scans,
             SUM(CASE WHEN sl.result = 'INVALID' THEN 1 ELSE 0 END) as invalid_scans
      FROM scan_logs sl
    `;
    const params: any[] = [];
    if (eventId) {
      sql += ' WHERE sl.event_id = ? ';
      params.push(eventId);
    }
    sql += ' GROUP BY time_block ORDER BY time_block ASC ';

    const rows: any = await query(sql, params);

    // Calculate throughput velocity (scans per hour / minute)
    let peakBlock = null;
    let maxScans = 0;
    for (const r of rows) {
      if (Number(r.total_scans) > maxScans) {
        maxScans = Number(r.total_scans);
        peakBlock = r.time_block;
      }
    }

    res.json({
      success: true,
      data: {
        timeline: rows,
        peak_hour: peakBlock || 'N/A',
        peak_scans: maxScans,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Top Referrers Leaderboard
router.get('/leaderboard', authenticate, requirePermission('reports:view'), requireEventCapability('can_view_report'), async (req: Request, res: Response) => {
  try {
    const eventId = req.query.event_id ? parseInt(String(req.query.event_id), 10) : null;
    let sql = `
      SELECT u.id as referrer_id, u.name as referrer_name, u.phone as referrer_phone, u.email as referrer_email,
             COUNT(r.id) as total_registered,
             SUM(CASE WHEN r.status = 'APPROVED' THEN 1 ELSE 0 END) as total_approved,
             SUM(CASE WHEN t.status = 'USED' THEN 1 ELSE 0 END) as total_attended,
             ROUND(
               COALESCE(
                 (SUM(CASE WHEN t.status = 'USED' THEN 1 ELSE 0 END) * 100.0) / 
                 NULLIF(SUM(CASE WHEN r.status = 'APPROVED' THEN 1 ELSE 0 END), 0),
                 0
               ), 1
             ) as show_up_rate
      FROM users u
      JOIN registrations r ON r.referrer_id = u.id
      LEFT JOIN tickets t ON r.id = t.registration_id
    `;
    const params: any[] = [];
    if (eventId) {
      sql += ' WHERE r.event_id = ? ';
      params.push(eventId);
    }
    sql += ' GROUP BY u.id, u.name, u.phone, u.email ORDER BY total_attended DESC, total_approved DESC LIMIT 20 ';

    const rows: any = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. System Settings (Email SMTP, Notification Rules, etc.)
router.get('/settings', authenticate, requirePermission('users:manage'), async (req: Request, res: Response) => {
  try {
    const rows: any = await query('SELECT `key`, `value` FROM system_settings');
    const settings: Record<string, string> = {};
    for (const r of rows) {
      settings[r.key] = r.value;
    }
    res.json({ success: true, data: settings });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/settings', authenticate, requirePermission('users:manage'), async (req: Request, res: Response) => {
  try {
    const settingsObj = req.body;
    if (!settingsObj || typeof settingsObj !== 'object') {
      res.status(400).json({ success: false, message: 'Dữ liệu cấu hình không hợp lệ.' });
      return;
    }

    for (const [k, v] of Object.entries(settingsObj)) {
      await query(
        'INSERT INTO system_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
        [k, String(v)]
      );
    }

    res.json({ success: true, message: 'Đã lưu cấu hình hệ thống thành công!' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5. Test SMTP Email configuration
router.post('/settings/test-email', authenticate, requirePermission('users:manage'), async (req: Request, res: Response) => {
  try {
    const { target_email, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_sender_name } = req.body;
    const recipient = target_email || req.user?.email || 'admin@eventqr.com';

    const testTransporter = nodemailer.createTransport({
      host: smtp_host || 'smtp.gmail.com',
      port: Number(smtp_port) || 587,
      secure: Number(smtp_port) === 465,
      auth: {
        user: smtp_user,
        pass: smtp_pass,
      },
    });

    const info = await testTransporter.sendMail({
      from: `"${smtp_sender_name || 'KTSQR Event System'}" <${smtp_user}>`,
      to: recipient,
      subject: '🧪 [KTSQR] Thử nghiệm cấu hình SMTP Email thành công!',
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
          <h2 style="color: #4f46e5;">Cấu hình SMTP của bạn hoạt động hoàn hảo!</h2>
          <p>Email này được gửi thử nghiệm từ trang quản trị hệ thống <strong>KTSQR Event Check-in</strong>.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 15px 0;">
          <p style="font-size: 12px; color: #64748b;">Thời gian kiểm tra: ${new Date().toLocaleString('vi-VN')}</p>
        </div>
      `,
    });

    res.json({ success: true, message: `Email thử nghiệm đã được gửi tới ${recipient} (Message ID: ${info.messageId})` });
  } catch (error: any) {
    res.status(400).json({ success: false, message: `Lỗi kết nối SMTP: ${error.message}` });
  }
});

// 6. Admin Realtime OTP Lookup
router.get('/recent-otps', authenticate, async (req: Request, res: Response) => {
  try {
    if (req.user?.type !== 'ADMIN') {
      res.status(403).json({ success: false, message: 'Chỉ Quản trị viên (Admin) mới có quyền truy cập bảng mã OTP.' });
      return;
    }

    const q = req.query.q ? String(req.query.q).trim() : '';
    let sql = `
      SELECT id, name, email, phone, type, otp_code, otp_expires_at, updated_at,
             CASE WHEN otp_expires_at > NOW() THEN 1 ELSE 0 END as is_valid
      FROM users
      WHERE otp_code IS NOT NULL
    `;
    const params: any[] = [];
    if (q) {
      sql += ` AND (email LIKE ? OR phone LIKE ? OR name LIKE ? OR otp_code LIKE ?)`;
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    sql += ` ORDER BY updated_at DESC LIMIT 50`;

    const otps: any = await query(sql, params);
    res.json({ success: true, data: otps });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 7. Admin Generate Instant OTP on Demand
router.post('/generate-otp', authenticate, async (req: Request, res: Response) => {
  try {
    if (req.user?.type !== 'ADMIN') {
      res.status(403).json({ success: false, message: 'Chỉ Quản trị viên mới có quyền tạo mã OTP.' });
      return;
    }

    const { email, phone } = req.body;
    if (!email && !phone) {
      res.status(400).json({ success: false, message: 'Vui lòng cung cấp email hoặc số điện thoại.' });
      return;
    }

    const targetEmail = (email || `${phone}@eventqr.local`).toLowerCase().trim();
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const existingUsers = await query<any[]>('SELECT id FROM users WHERE email = ?', [targetEmail]);
    if (existingUsers.length > 0) {
      await query(
        'UPDATE users SET otp_code = ?, otp_expires_at = ?, phone = COALESCE(?, phone) WHERE email = ?',
        [otp, expiresAt, phone || null, targetEmail]
      );
    } else {
      const defaultName = (email ? email.split('@')[0] : phone) || 'Khách mời';
      await query(
        `INSERT INTO users (type, name, email, phone, otp_code, otp_expires_at, status)
         VALUES ('CUSTOMER', ?, ?, ?, ?, ?, 'ACTIVE')`,
        [defaultName, targetEmail, phone || null, otp, expiresAt]
      );
    }

    res.json({
      success: true,
      message: 'Đã tạo mã OTP thành công!',
      data: {
        email: targetEmail,
        phone,
        otp_code: otp,
        otp_expires_at: expiresAt,
      },
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;
