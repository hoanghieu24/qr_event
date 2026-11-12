import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../../config/database';
import { ENV } from '../../config/env';
import { isRealSmtpConfigured, sendEmailWithResult } from '../../config/mailer';

export class AuthService {
  private static async getTenantContext(userId: number, required = true) {
    const rows = await query<any[]>(
      `SELECT tu.tenant_id, t.name AS tenant_name, t.status AS tenant_status
       FROM tenant_users tu
       JOIN tenants t ON t.id = tu.tenant_id
       WHERE tu.user_id = ?
       ORDER BY FIELD(tu.role, 'OWNER', 'TEAM') ASC, tu.id ASC
       LIMIT 1`,
      [userId]
    );
    const membership = rows[0];
    if (!membership && !required) return null;
    if (!membership || membership.tenant_status !== 'ACTIVE') {
      throw new Error('Tài khoản khách thuê chưa được kích hoạt.');
    }
    return { tenant_id: Number(membership.tenant_id), tenant_name: membership.tenant_name };
  }

  private static async getStaffPermissions(userId: number): Promise<string[]> {
    const staffPerms = await query<any[]>(
      `SELECT p.code 
       FROM permissions p 
       JOIN user_permissions up ON p.id = up.permission_id 
       WHERE up.user_id = ?`,
      [userId]
    );
    const permSet = new Set<string>(staffPerms.map((p) => p.code));
    const quotaRows = await query<any[]>(
      `SELECT SUM(can_invite = 1) AS has_invite, SUM(can_approve = 1) AS has_approve,
              SUM(can_scan = 1) AS has_scan, SUM(can_view_report = 1) AS has_report
       FROM staff_event_quotas
       WHERE staff_id = ? AND is_enabled = 1`,
      [userId]
    );
    const q = quotaRows[0] || {};
    if (Number(q.has_invite) > 0) {
      permSet.add('invite:create');
      permSet.add('registrations:view_own');
      permSet.add('registrations:approve'); // Người mời có quyền duyệt khách của mình
    }
    if (Number(q.has_approve) > 0) {
      permSet.add('registrations:approve');
      permSet.add('registrations:view_own');
    }
    if (Number(q.has_scan) > 0) {
      permSet.add('tickets:scan');
    }
    if (Number(q.has_report) > 0) {
      permSet.add('reports:view');
      permSet.add('registrations:view_own');
    }
    return Array.from(permSet);
  }

  // Staff & Admin Password Login
  static async login(email: string, password: string) {
    const users = await query<any[]>(
      `SELECT id, type, name, email, phone, password_hash, status 
       FROM users WHERE email = ?`,
      [email]
    );

    if (users.length === 0) {
      throw new Error('Email hoặc mật khẩu không chính xác.');
    }

    const user = users[0];

    if (user.status !== 'ACTIVE') {
      throw new Error('Tài khoản của bạn đã bị khóa.');
    }

    if (!user.password_hash) {
      throw new Error('Email này đã được dùng để nhận vé tham gia sự kiện. Để tổ chức sự kiện, bạn vui lòng chuyển sang "Đăng ký mở sự kiện ngay" để thiết lập mật khẩu và nhận 3 lần mở sự kiện miễn phí.');
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new Error('Email hoặc mật khẩu không chính xác.');
    }

    // Dynamic permissions
    let permissions: string[] = [];
    if (user.type === 'ADMIN') {
      const allPerms = await query<any[]>('SELECT code FROM permissions');
      permissions = allPerms.map((p) => p.code);
    } else if (user.type === 'STAFF') {
      permissions = await this.getStaffPermissions(user.id);
    }

    let tenant = user.type === 'TENANT_ADMIN'
      ? await this.getTenantContext(user.id, false)
      : user.type === 'STAFF' ? await this.getTenantContext(user.id, false) : null;

    // Ensure TENANT_ADMIN user has a tenant context
    if (user.type === 'TENANT_ADMIN' && !tenant) {
      const cleanName = user.name || 'Sự kiện của tôi';
      const tRes: any = await query(
        `INSERT INTO tenants (name, contact_name, contact_email, phone, created_by, status, free_events_used)
         VALUES (?, ?, ?, ?, ?, 'ACTIVE', 0)`,
        [cleanName + ' Events', cleanName, user.email, user.phone || null, user.id]
      );
      const tenantId = Number(tRes.insertId);
      await query(`INSERT INTO tenant_users (tenant_id, user_id, role) VALUES (?, ?, 'OWNER')`, [tenantId, user.id]);
      tenant = { tenant_id: tenantId, tenant_name: cleanName + ' Events' };
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, type: user.type },
      ENV.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        type: user.type,
        permissions,
        tenant_id: tenant?.tenant_id,
        tenant_name: tenant?.tenant_name,
      },
    };
  }

  // Customer Send OTP (Gửi mã OTP 6 số tới email; nếu chưa cấu hình SMTP thật sẽ chạy chế độ kiểm thử)
  static async sendOtp(email: string) {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Kiểm tra tài khoản đã tồn tại trong bảng users
    let user: any = null;
    const existingUsers = await query<any[]>(
      'SELECT id, type, name, email, phone, status FROM users WHERE LOWER(email) = ?',
      [cleanEmail]
    );

    if (existingUsers.length > 0) {
      user = existingUsers[0];
    } else {
      // 2. Nếu chưa có trong users, kiểm tra xem email này đã từng có vé/đăng ký trong registrations chưa
      const existingRegs = await query<any[]>(
        'SELECT customer_id, full_name, phone, email FROM registrations WHERE LOWER(email) = ? ORDER BY id DESC LIMIT 1',
        [cleanEmail]
      );
      if (existingRegs.length > 0) {
        const reg = existingRegs[0];
        if (reg.customer_id) {
          const linkedUsers = await query<any[]>(
            'SELECT id, type, name, email, phone, status FROM users WHERE id = ?',
            [reg.customer_id]
          );
          if (linkedUsers.length > 0 && linkedUsers[0].type === 'CUSTOMER') {
            user = linkedUsers[0];
          }
        }
        if (!user) {
          // Tạo bản ghi CUSTOMER cho người dùng này và liên kết
          const regName = reg.full_name || cleanEmail.split('@')[0];
          const regPhone = reg.phone || null;
          const insertRes: any = await query(
            `INSERT INTO users (type, name, email, phone, status) VALUES ('CUSTOMER', ?, ?, ?, 'ACTIVE')`,
            [regName, cleanEmail, regPhone]
          );
          const newUserId = Number(insertRes.insertId);
          await query('UPDATE registrations SET customer_id = ? WHERE LOWER(email) = ?', [newUserId, cleanEmail]);
          user = { id: newUserId, type: 'CUSTOMER', name: regName, email: cleanEmail, phone: regPhone, status: 'ACTIVE' };
        }
      }
    }

    if (user) {
      if (user.status !== 'ACTIVE') {
        throw new Error('Tài khoản của bạn đã bị khóa.');
      }
      if (user.type !== 'CUSTOMER') {
        throw new Error('Email này thuộc tài khoản ban tổ chức hoặc quản trị viên. Vui lòng đăng nhập tại cổng quản trị bằng mật khẩu.');
      }
    }

    const realSmtp = await isRealSmtpConfigured();
    const otp = realSmtp
      ? crypto.randomInt(100000, 1000000).toString()
      : '123456';
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 phút hiệu lực

    if (user) {
      await query(
        'UPDATE users SET otp_code = ?, otp_expires_at = ? WHERE id = ?',
        [otp, expiresAt, user.id]
      );
    } else {
      const defaultName = cleanEmail.split('@')[0];
      await query(
        `INSERT INTO users (type, name, email, otp_code, otp_expires_at, status) 
         VALUES ('CUSTOMER', ?, ?, ?, ?, 'ACTIVE')`,
        [defaultName, cleanEmail, otp, expiresAt]
      );
    }

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 14px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 18px;">
          <span style="display: inline-block; background-color: #eff6ff; color: #1d4ed8; font-weight: 700; font-size: 12px; padding: 6px 12px; border-radius: 999px; letter-spacing: 0.5px;">
            EVENTGO.VN EVENT CHECK-IN
          </span>
        </div>
        <h2 style="color: #0f172a; text-align: center; margin: 0 0 12px 0; font-size: 22px;">Mã Xác Thực OTP</h2>
        <p style="color: #334155; font-size: 14px; line-height: 1.6;">Xin chào quý khách,</p>
        <p style="color: #334155; font-size: 14px; line-height: 1.6;">
          Vui lòng nhập mã OTP gồm 6 chữ số dưới đây để xác thực email đăng ký sự kiện hoặc tra cứu vé QR của bạn:
        </p>
        <div style="background-color: #f8fafc; border: 1px dashed #93c5fd; padding: 18px; text-align: center; border-radius: 10px; margin: 20px 0;">
          <span style="font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #0284c7;">${otp}</span>
        </div>
        <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 0;">
          • Mã có hiệu lực trong vòng <strong>10 phút</strong>.<br/>
          • Vui lòng không chia sẻ mã này cho người khác. Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.
        </p>
      </div>
    `;

    const mailRes = await sendEmailWithResult({
      to: cleanEmail,
      subject: `[EventGo.vn] Mã xác thực OTP của bạn: ${otp}`,
      html,
    });

    if (realSmtp && !mailRes.sent) {
      throw new Error(`Không thể gửi mã OTP tới ${cleanEmail}. Vui lòng kiểm tra lại cấu hình SMTP trong trang Admin (${mailRes.error || 'Lỗi gửi email'}).`);
    }

    if (mailRes.simulated) {
      return {
        already_exists: false,
        is_simulation: true,
        demo_otp: otp,
        message: 'Hệ thống chưa cấu hình SMTP gửi thư thật. Đang dùng mã OTP kiểm thử: 123456',
      };
    }

    return {
      already_exists: false,
      is_simulation: false,
      message: `Đã gửi mã OTP 6 số tới email ${cleanEmail}. Vui lòng kiểm tra hộp thư đến (hoặc thư mục Spam).`,
    };
  }

  // Customer Verify OTP
  static async verifyOtp(email: string, otp: string, name?: string, phone?: string) {
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();

    const users = await query<any[]>(
      `SELECT id, type, name, email, phone, otp_code, otp_expires_at, status 
       FROM users WHERE LOWER(email) = ?`,
      [cleanEmail]
    );

    if (users.length === 0) {
      throw new Error('Tài khoản không tồn tại.');
    }

    const user = users[0];
    if (user.type !== 'CUSTOMER') {
      throw new Error('Tài khoản này không thể đăng nhập bằng OTP.');
    }
    if (user.status !== 'ACTIVE') {
      throw new Error('Tài khoản đã bị khóa.');
    }

    const realSmtp = await isRealSmtpConfigured();
    const isMasterOtp = !realSmtp && cleanOtp === '123456';
    if (!isMasterOtp && (!user.otp_code || user.otp_code !== cleanOtp)) {
      throw new Error('Mã OTP không chính xác.');
    }

    if (!isMasterOtp && (!user.otp_expires_at || new Date() > new Date(user.otp_expires_at))) {
      throw new Error('Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.');
    }

    // Clear OTP and optionally update profile
    let updateSql = 'UPDATE users SET otp_code = NULL, otp_expires_at = NULL';
    const params: any[] = [];
    if (name) {
      updateSql += ', name = ?';
      params.push(name);
    }
    if (phone) {
      updateSql += ', phone = ?';
      params.push(phone);
    }
    updateSql += ' WHERE id = ?';
    params.push(user.id);

    await query(updateSql, params);

    const token = jwt.sign(
      { id: user.id, email: user.email, type: user.type },
      ENV.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return {
      token,
      user: {
        id: user.id,
        name: name || user.name,
        email: user.email,
        phone: phone || user.phone,
        type: user.type,
        permissions: [],
      },
    };
  }

  // Get current user fresh profile
  static async getMe(userId: number) {
    const users = await query<any[]>(
      `SELECT id, type, name, email, phone, status 
       FROM users WHERE id = ?`,
      [userId]
    );

    if (users.length === 0) {
      throw new Error('Người dùng không tồn tại.');
    }

    const user = users[0];
    let permissions: string[] = [];
    if (user.type === 'ADMIN') {
      const allPerms = await query<any[]>('SELECT code FROM permissions');
      permissions = allPerms.map((p) => p.code);
    } else if (user.type === 'STAFF') {
      permissions = await this.getStaffPermissions(user.id);
    }

    let tenant = user.type === 'TENANT_ADMIN'
      ? await this.getTenantContext(user.id, false)
      : user.type === 'STAFF' ? await this.getTenantContext(user.id, false) : null;

    if (user.type === 'TENANT_ADMIN' && !tenant) {
      const cleanName = user.name || 'Sự kiện của tôi';
      const tRes: any = await query(
        `INSERT INTO tenants (name, contact_name, contact_email, phone, created_by, status, free_events_used)
         VALUES (?, ?, ?, ?, ?, 'ACTIVE', 0)`,
        [cleanName + ' Events', cleanName, user.email, user.phone || null, user.id]
      );
      const tenantId = Number(tRes.insertId);
      await query(`INSERT INTO tenant_users (tenant_id, user_id, role) VALUES (?, ?, 'OWNER')`, [tenantId, user.id]);
      tenant = { tenant_id: tenantId, tenant_name: cleanName + ' Events' };
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      type: user.type,
      permissions,
      tenant_id: tenant?.tenant_id,
      tenant_name: tenant?.tenant_name,
    };
  }

  // Self Registration - Ai đăng ký cũng được tặng 3 sự kiện miễn phí
  static async register(data: { name: string; email: string; phone?: string; password: string }) {
    if (!data.name?.trim() || !data.email?.trim() || !data.password) {
      throw new Error('Vui lòng điền đầy đủ họ tên, email và mật khẩu.');
    }
    if (data.password.length < 6) {
      throw new Error('Mật khẩu cần ít nhất 6 ký tự.');
    }
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanName = data.name.trim();
    const existing = await query<any[]>('SELECT id, type, name, phone, password_hash, status FROM users WHERE email = ? LIMIT 1', [cleanEmail]);
    let userId: number;
    let isUpgraded = false;

    if (existing.length) {
      const existingUser = existing[0];
      const existingOwner = await query<any[]>(
        `SELECT t.id, t.name 
         FROM tenants t 
         JOIN tenant_users tu ON tu.tenant_id = t.id 
         WHERE tu.user_id = ? AND tu.role = 'OWNER' 
         LIMIT 1`,
        [existingUser.id]
      );

      if (existingOwner.length) {
        throw new Error(`Email này đã sở hữu không gian sự kiện "${existingOwner[0].name}". Vui lòng chuyển sang tab "Đăng nhập".`);
      }

      // Upgrade existing customer/staff to TENANT_ADMIN and set password
      userId = Number(existingUser.id);
      const passwordHash = await bcrypt.hash(data.password, 10);
      await query(
        `UPDATE users 
         SET type = 'TENANT_ADMIN', 
             password_hash = ?, 
             name = COALESCE(?, name), 
             phone = COALESCE(?, phone), 
             status = 'ACTIVE' 
         WHERE id = ?`,
        [passwordHash, cleanName, data.phone?.trim() || null, userId]
      );
      isUpgraded = true;
    } else {
      const passwordHash = await bcrypt.hash(data.password, 10);
      const res: any = await query(
        `INSERT INTO users (type, name, email, phone, password_hash, status)
         VALUES ('TENANT_ADMIN', ?, ?, ?, ?, 'ACTIVE')`,
        [cleanName, cleanEmail, data.phone?.trim() || null, passwordHash]
      );
      userId = Number(res.insertId);
    }

    // Tự động tạo Tenant kèm 3 lượt tạo sự kiện miễn phí (free_events_used = 0)
    const tRes: any = await query(
      `INSERT INTO tenants (name, contact_name, contact_email, phone, created_by, status, free_events_used)
       VALUES (?, ?, ?, ?, ?, 'ACTIVE', 0)`,
      [cleanName + ' Events', cleanName, cleanEmail, data.phone?.trim() || null, userId]
    );
    const tenantId = Number(tRes.insertId);

    await query(
      `INSERT INTO tenant_users (tenant_id, user_id, role) VALUES (?, ?, 'OWNER')`,
      [tenantId, userId]
    );

    const token = jwt.sign(
      { id: userId, email: cleanEmail, type: 'TENANT_ADMIN' },
      ENV.JWT_SECRET,
      { expiresIn: '7d' }
    );
    return {
      token,
      user: {
        id: userId,
        name: cleanName,
        email: cleanEmail,
        phone: data.phone?.trim() || null,
        type: 'TENANT_ADMIN',
        tenant_id: tenantId,
        tenant_name: cleanName + ' Events',
        permissions: [],
      },
      is_upgraded: isUpgraded,
      message: isUpgraded
        ? 'Nâng cấp tài khoản thành Ban tổ chức thành công! Tặng bạn 3 lần mở sự kiện miễn phí.'
        : 'Đăng ký không gian sự kiện thành công! Tặng bạn 3 lần mở sự kiện miễn phí.',
    };
  }
}
