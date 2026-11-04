import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query, withTransaction } from '../../config/database';
import { uploadImageToCloudinary } from '../../config/cloudinary';
import { Realtime } from '../../realtime/socket';
import { ENV } from '../../config/env';
import { InvitesService } from '../invites/invites.service';

const FREE_EVENT_LIMIT = 3;

const ROLE_CONFIG: Record<string, { permissionCodes: string[]; can_invite: number; can_approve: number; can_scan: number; can_view_report: number }> = {
  INVITER: { permissionCodes: ['invite:create', 'registrations:view_own', 'registrations:approve'], can_invite: 1, can_approve: 1, can_scan: 0, can_view_report: 0 },
  APPROVER: { permissionCodes: ['registrations:view_own', 'registrations:approve'], can_invite: 0, can_approve: 1, can_scan: 0, can_view_report: 0 },
  SCANNER: { permissionCodes: ['tickets:scan'], can_invite: 0, can_approve: 0, can_scan: 1, can_view_report: 0 },
  REPORTER: { permissionCodes: ['reports:view'], can_invite: 0, can_approve: 0, can_scan: 0, can_view_report: 1 },
  MANAGER: { permissionCodes: ['invite:create', 'registrations:view_own', 'registrations:approve', 'tickets:scan', 'reports:view'], can_invite: 1, can_approve: 1, can_scan: 1, can_view_report: 1 },
};

export class TenantsService {
  static async listTenants() {
    return await query<any[]>(`
      SELECT t.id, t.name, t.contact_name, t.contact_email, t.phone, t.status, t.created_at,
             owner.id AS owner_id, owner.name AS owner_name, owner.email AS owner_email,
             t.free_events_used,
             (SELECT COUNT(*) FROM events e WHERE e.tenant_id = t.id) AS events_count,
             (SELECT COUNT(*) FROM tenant_users tu WHERE tu.tenant_id = t.id) AS team_count
      FROM tenants t
      LEFT JOIN tenant_users owner_link ON owner_link.tenant_id = t.id AND owner_link.role = 'OWNER'
      LEFT JOIN users owner ON owner.id = owner_link.user_id
      ORDER BY t.id DESC
    `);
  }

  static async createTenant(data: {
    name: string;
    contact_name: string;
    contact_email: string;
    phone?: string;
    owner_name: string;
    owner_email: string;
    owner_password: string;
    created_by: number;
  }) {
    if (data.owner_password.length < 8) throw new Error('Mật khẩu cần có ít nhất 8 ký tự.');
    const passwordHash = await bcrypt.hash(data.owner_password, 10);

    return await withTransaction(async (conn) => {
      const [existing]: any = await conn.query('SELECT id FROM users WHERE email = ? LIMIT 1', [data.owner_email]);
      if (existing.length) throw new Error('Email tài khoản khách thuê đã được sử dụng.');

      const [tenantResult]: any = await conn.query(
        `INSERT INTO tenants (name, contact_name, contact_email, phone, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [data.name, data.contact_name, data.contact_email, data.phone || null, data.created_by]
      );
      const tenantId = Number(tenantResult.insertId);

      const [userResult]: any = await conn.query(
        `INSERT INTO users (type, name, email, phone, password_hash, status)
         VALUES ('TENANT_ADMIN', ?, ?, ?, ?, 'ACTIVE')`,
        [data.owner_name, data.owner_email, data.phone || null, passwordHash]
      );
      const userId = Number(userResult.insertId);

      await conn.query(
        `INSERT INTO tenant_users (tenant_id, user_id, role) VALUES (?, ?, 'OWNER')`,
        [tenantId, userId]
      );

      return { id: tenantId, name: data.name, owner: { id: userId, name: data.owner_name, email: data.owner_email } };
    });
  }

  static async registerTenant(data: {
    name: string;
    contact_name?: string;
    email: string;
    phone?: string;
    password: string;
  }) {
    if (!data.name?.trim() || !data.email?.trim() || !data.password) {
      throw new Error('Vui lòng điền đủ tên đơn vị, email và mật khẩu.');
    }
    if (data.password.length < 8) {
      throw new Error('Mật khẩu cần có ít nhất 8 ký tự.');
    }
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanName = data.name.trim();
    const contactName = (data.contact_name?.trim()) || cleanName;

    return await withTransaction(async (conn) => {
      const [existing]: any = await conn.query(
        'SELECT id, type, name, phone, password_hash, status FROM users WHERE email = ? LIMIT 1',
        [cleanEmail]
      );

      let userId: number;
      let isUpgraded = false;

      if (existing.length) {
        const existingUser = existing[0];

        // Check if user already owns a tenant
        const [existingOwner]: any = await conn.query(
          `SELECT t.id, t.name 
           FROM tenants t 
           JOIN tenant_users tu ON tu.tenant_id = t.id 
           WHERE tu.user_id = ? AND tu.role = 'OWNER' 
           LIMIT 1`,
          [existingUser.id]
        );

        if (existingOwner.length) {
          // If password matches existing password, log them in directly
          if (existingUser.password_hash) {
            const isMatch = await bcrypt.compare(data.password, existingUser.password_hash);
            if (isMatch) {
              const token = jwt.sign(
                { id: existingUser.id, email: cleanEmail, type: 'TENANT_ADMIN' },
                ENV.JWT_SECRET,
                { expiresIn: '7d' }
              );
              return {
                token,
                user: {
                  id: existingUser.id,
                  type: 'TENANT_ADMIN',
                  name: existingUser.name,
                  email: cleanEmail,
                  phone: existingUser.phone,
                  tenant_id: existingOwner[0].id,
                  tenant_name: existingOwner[0].name,
                  permissions: [],
                },
                message: 'Chào mừng quay trở lại! Bạn đã sở hữu không gian sự kiện.',
              };
            }
          }
          throw new Error(`Email này đã sở hữu không gian sự kiện "${existingOwner[0].name}". Vui lòng chuyển sang tab "Đăng nhập" để vào sự kiện.`);
        }

        // User exists as CUSTOMER or STAFF without their own tenant:
        // UPGRADE to TENANT_ADMIN and set password!
        userId = Number(existingUser.id);
        const passwordHash = await bcrypt.hash(data.password, 10);
        await conn.query(
          `UPDATE users 
           SET type = 'TENANT_ADMIN', 
               password_hash = ?, 
               name = COALESCE(?, name), 
               phone = COALESCE(?, phone), 
               status = 'ACTIVE' 
           WHERE id = ?`,
          [passwordHash, contactName, data.phone?.trim() || null, userId]
        );
        isUpgraded = true;
      } else {
        // 1. Create brand new user with TENANT_ADMIN type
        const passwordHash = await bcrypt.hash(data.password, 10);
        const [userResult]: any = await conn.query(
          `INSERT INTO users (type, name, email, phone, password_hash, status)
           VALUES ('TENANT_ADMIN', ?, ?, ?, ?, 'ACTIVE')`,
          [contactName, cleanEmail, data.phone?.trim() || null, passwordHash]
        );
        userId = Number(userResult.insertId);
      }

      // 2. Create tenant record (gifts 3 free events: free_events_used = 0)
      const [tenantResult]: any = await conn.query(
        `INSERT INTO tenants (name, contact_name, contact_email, phone, created_by, status, free_events_used)
         VALUES (?, ?, ?, ?, ?, 'ACTIVE', 0)`,
        [cleanName, contactName, cleanEmail, data.phone?.trim() || null, userId]
      );
      const tenantId = Number(tenantResult.insertId);

      // 3. Link owner to tenant
      await conn.query(
        `INSERT INTO tenant_users (tenant_id, user_id, role) VALUES (?, ?, 'OWNER')`,
        [tenantId, userId]
      );

      // 4. Generate JWT token
      const token = jwt.sign(
        { id: userId, email: cleanEmail, type: 'TENANT_ADMIN' },
        ENV.JWT_SECRET,
        { expiresIn: '7d' }
      );

      return {
        token,
        user: {
          id: userId,
          type: 'TENANT_ADMIN',
          name: contactName,
          email: cleanEmail,
          phone: data.phone?.trim() || null,
          tenant_id: tenantId,
          tenant_name: cleanName,
          permissions: [],
        },
        is_upgraded: isUpgraded,
        message: isUpgraded
          ? 'Nâng cấp tài khoản thành Ban tổ chức thành công! Tặng bạn 3 lần mở sự kiện miễn phí.'
          : 'Đăng ký không gian sự kiện thành công! Tặng bạn 3 lần mở sự kiện miễn phí.',
      };
    });
  }

  static async setTenantStatus(tenantId: number, status: 'ACTIVE' | 'BLOCKED') {
    const result: any = await query('UPDATE tenants SET status = ? WHERE id = ?', [status, tenantId]);
    if (!result.affectedRows) {
      const rows = await query<any[]>( 'SELECT id FROM tenants WHERE id = ? LIMIT 1', [tenantId]);
      if (!rows.length) throw new Error('Tenant not found.');
    }
    return { success: true, status };
  }

  static async listEvents(tenantId: number) {
    return await query<any[]>(`
      SELECT e.id, e.name, e.description, e.location, e.poster_url, e.start_at, e.end_at,
             e.capacity, e.status, e.approval_mode, e.package_name, e.package_price_vnd,
             e.max_employees, e.max_referrers, e.max_scanners, e.is_trial,
             e.payment_status, e.payment_note, e.paid_at,
             (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id) AS total_registered,
             (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'APPROVED') AS total_approved,
             (SELECT COUNT(*) FROM tickets t WHERE t.event_id = e.id AND t.status = 'USED') AS total_checked_in
      FROM events e
      WHERE e.tenant_id = ?
      ORDER BY e.start_at DESC
    `, [tenantId]);
  }

  static async getTenantUsers(tenantId: number) {
    const users = await query<any[]>(`
      SELECT u.id, u.name, u.email, u.phone, u.status, u.type, tu.role, tu.created_at as joined_at,
             (SELECT COUNT(*) FROM registrations r WHERE r.referrer_id = u.id AND r.event_id IN (SELECT id FROM events WHERE tenant_id = ?)) as invites_count,
             (SELECT COUNT(*) FROM scan_logs sl WHERE sl.scanned_by = u.id AND sl.event_id IN (SELECT id FROM events WHERE tenant_id = ?)) as scans_count,
             COALESCE(
               (SELECT JSON_ARRAYAGG(
                 JSON_OBJECT('event_id', e.id, 'event_name', e.name, 'can_scan', seq.can_scan, 'can_invite', seq.can_invite, 'can_approve', seq.can_approve)
               )
               FROM staff_event_quotas seq
               JOIN events e ON e.id = seq.event_id
               WHERE seq.staff_id = u.id AND e.tenant_id = ?),
               JSON_ARRAY()
             ) as assigned_events
      FROM users u
      JOIN tenant_users tu ON tu.user_id = u.id
      WHERE tu.tenant_id = ?
      ORDER BY FIELD(tu.role, 'OWNER', 'TEAM'), u.id ASC
    `, [tenantId, tenantId, tenantId, tenantId]);

    return users.map((u) => ({
      ...u,
      assigned_events: typeof u.assigned_events === 'string' 
        ? JSON.parse(u.assigned_events) 
        : (u.assigned_events || []),
    }));
  }

  static async allTenantEvents() {
    return await query<any[]>(`
      SELECT e.id, e.name, e.description, e.location, e.start_at, e.end_at, e.capacity,
             e.status, e.package_name, e.package_price_vnd, e.payment_status, e.is_trial,
             tn.id AS tenant_id, tn.name AS tenant_name, tn.contact_name, tn.contact_email,
             (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id) AS total_registrations,
             (SELECT COUNT(*) FROM tickets t WHERE t.event_id = e.id AND t.status = 'USED') AS total_checked_in
      FROM events e
      JOIN tenants tn ON tn.id = e.tenant_id
      ORDER BY e.created_at DESC
    `);
  }

  static async getPaymentInfo() {
    const rows = await query<any[]>("SELECT `key`, `value` FROM system_settings WHERE `key` LIKE 'bank_%'");
    const info: Record<string, string> = {
      bank_code: 'MB',
      bank_name: 'MBBank',
      bank_account: '0386771868',
      bank_account_name: 'KTS QR EVENT',
      bank_qr_template: 'compact2'
    };
    for (const r of rows) {
      if (r.value) info[r.key] = r.value;
    }
    return info;
  }

  static async getUsage(tenantId: number) {
    const tenants = await query<any[]>(
      'SELECT free_events_used FROM tenants WHERE id = ? AND status = \'ACTIVE\' LIMIT 1',
      [tenantId]
    );
    if (!tenants.length) throw new Error('Khách thuê không tồn tại hoặc đang bị khóa.');
    const trialPlans = await query<any[]>(`
      SELECT id, name, max_attendees, max_employees, max_referrers, max_scanners
      FROM subscription_plans WHERE is_trial = 1 AND status = 'ACTIVE' ORDER BY id DESC LIMIT 1
    `);
    const availablePackages = await query<any[]>(`
      SELECT id, package_name AS name, max_attendees, max_employees, max_referrers,
             max_scanners, price_vnd, requested_at
      FROM subscription_requests
      WHERE tenant_id = ? AND status = 'APPROVED' AND event_id IS NULL
      ORDER BY reviewed_at ASC, id ASC
    `, [tenantId]);
    const allPlans = await query<any[]>(`
      SELECT id, name, description, max_attendees, max_employees, max_referrers, max_scanners, price_vnd, is_trial
      FROM subscription_plans WHERE status = 'ACTIVE'
      ORDER BY is_trial DESC, price_vnd ASC
    `);
    const paymentInfo = await this.getPaymentInfo();
    const requests = await query<any[]>(`
      SELECT id, package_name AS name, max_attendees, max_employees, max_referrers,
             max_scanners, price_vnd, status, requested_at, reviewed_at, review_note
      FROM subscription_requests WHERE tenant_id = ? AND event_id IS NULL
      ORDER BY requested_at DESC
    `, [tenantId]);
    const freeEventsUsed = Number(tenants[0].free_events_used);
    const freeEventsRemaining = Math.max(FREE_EVENT_LIMIT - freeEventsUsed, 0);
    return {
      free_event_limit: FREE_EVENT_LIMIT,
      free_events_used: freeEventsUsed,
      free_events_remaining: freeEventsRemaining,
      trial_package: trialPlans[0] || null,
      available_packages: availablePackages,
      package_requests: requests,
      all_plans: allPlans,
      payment_info: paymentInfo,
      can_create_event: true,
    };
  }

  static async createEvent(tenantId: number, userId: number, data: {
    name: string; description?: string; location: string; poster_base64?: string;
    start_at: string; end_at: string; capacity?: number;
    event_package_id?: number | string;
    plan_id?: number | string;
    approval_mode?: 'REFERRER_ONLY' | 'TWO_TIER' | 'AUTO';
    staff_assignments?: {
      staff_id: number;
      role?: string;
      can_invite?: boolean;
      can_approve?: boolean;
      can_scan?: boolean;
      can_view_report?: boolean;
      max_invites?: number;
    }[];
  }) {
    let posterUrl: string | null = null;
    if (data.poster_base64) posterUrl = await uploadImageToCloudinary(data.poster_base64, 'events');

    const created = await withTransaction(async (conn) => {
      const [tenantRows]: any = await conn.query(
        'SELECT id, status, free_events_used FROM tenants WHERE id = ? FOR UPDATE',
        [tenantId]
      );
      if (!tenantRows.length || tenantRows[0].status !== 'ACTIVE') {
        throw new Error('Khách thuê không tồn tại hoặc đang bị khóa.');
      }

      let quotaSource: 'FREE' | 'PACKAGE' | 'PLAN_PURCHASE' = 'FREE';
      let packageInfo: any;
      let packageRequestId: number | null = null;
      let paymentStatus: 'PAID' | 'PENDING_PAYMENT' = 'PAID';

      const packageParam = data.event_package_id || data.plan_id;

      // 1. If explicit package request ID is passed and matches approved unused request
      if (packageParam && typeof packageParam === 'number') {
        const [requests]: any = await conn.query(`
          SELECT id, package_name AS name, max_attendees, max_employees, max_referrers,
                 max_scanners, price_vnd
          FROM subscription_requests
          WHERE id = ? AND tenant_id = ? AND status = 'APPROVED' AND event_id IS NULL
          FOR UPDATE
        `, [packageParam, tenantId]);
        if (requests.length) {
          packageInfo = requests[0];
          packageRequestId = Number(requests[0].id);
          quotaSource = 'PACKAGE';
          paymentStatus = 'PAID';
        }
      }

      // 2. If plan ID is chosen from subscription_plans
      if (!packageInfo && packageParam) {
        const cleanPlanId = String(packageParam).replace(/^plan_/, '');
        const [plans]: any = await conn.query(`
          SELECT id, name, max_attendees, max_employees, max_referrers, max_scanners, price_vnd, is_trial
          FROM subscription_plans WHERE id = ? AND status = 'ACTIVE' FOR UPDATE
        `, [cleanPlanId]);

        if (plans.length) {
          const plan = plans[0];
          if (plan.is_trial && Number(tenantRows[0].free_events_used) < FREE_EVENT_LIMIT) {
            packageInfo = plan;
            quotaSource = 'FREE';
            paymentStatus = 'PAID';
            await conn.query('UPDATE tenants SET free_events_used = free_events_used + 1 WHERE id = ?', [tenantId]);
          } else {
            packageInfo = plan;
            quotaSource = 'PLAN_PURCHASE';
            paymentStatus = plan.price_vnd > 0 ? 'PENDING_PAYMENT' : 'PAID';
          }
        }
      }

      // 3. Fallback: use trial if remaining
      if (!packageInfo) {
        if (Number(tenantRows[0].free_events_used) < FREE_EVENT_LIMIT) {
          const [trialPlans]: any = await conn.query(`
            SELECT id, name, max_attendees, max_employees, max_referrers, max_scanners, price_vnd
            FROM subscription_plans WHERE is_trial = 1 AND status = 'ACTIVE' ORDER BY id DESC LIMIT 1 FOR UPDATE
          `);
          if (trialPlans.length) {
            packageInfo = trialPlans[0];
            quotaSource = 'FREE';
            paymentStatus = 'PAID';
            await conn.query('UPDATE tenants SET free_events_used = free_events_used + 1 WHERE id = ?', [tenantId]);
          }
        }
      }

      if (!packageInfo) {
        throw new Error('Vui lòng chọn một gói sự kiện phù hợp.');
      }

      let finalCapacity = packageInfo.max_attendees;
      if (data.capacity && Number(data.capacity) > 0) {
        const reqCap = Number(data.capacity);
        if (reqCap > packageInfo.max_attendees) {
          throw new Error(`Sức chứa tối đa (${reqCap} khách) không được vượt quá giới hạn của gói (${packageInfo.max_attendees} khách).`);
        }
        finalCapacity = reqCap;
      }

      const paidAt = paymentStatus === 'PAID' ? new Date() : null;

      const [result]: any = await conn.query(`
        INSERT INTO events (name, description, location, poster_url, start_at, end_at, capacity,
          approval_mode, status, created_by, tenant_id, package_request_id, package_name,
          max_employees, max_referrers, max_scanners, package_price_vnd, is_trial, payment_status, paid_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PUBLISHED', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        data.name, data.description || null, data.location, posterUrl, data.start_at, data.end_at,
        finalCapacity, data.approval_mode || 'REFERRER_ONLY', userId, tenantId,
        packageRequestId, packageInfo.name, packageInfo.max_employees, packageInfo.max_referrers,
        packageInfo.max_scanners, packageInfo.price_vnd, quotaSource === 'FREE' ? 1 : 0,
        paymentStatus, paidAt
      ]);

      const eventId = Number(result.insertId);

      if (quotaSource === 'PLAN_PURCHASE') {
        const [reqResult]: any = await conn.query(`
          INSERT INTO subscription_requests
            (tenant_id, plan_id, event_credits, validity_days, package_name, max_attendees,
             max_employees, max_referrers, max_scanners, price_vnd, status, event_id, reviewed_at)
          VALUES (?, ?, 1, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          tenantId,
          packageInfo.id,
          packageInfo.name,
          packageInfo.max_attendees,
          packageInfo.max_employees,
          packageInfo.max_referrers,
          packageInfo.max_scanners,
          packageInfo.price_vnd,
          paymentStatus === 'PAID' ? 'APPROVED' : 'PENDING',
          eventId,
          paidAt
        ]);
        packageRequestId = Number(reqResult.insertId);
        await conn.query('UPDATE events SET package_request_id = ? WHERE id = ?', [packageRequestId, eventId]);
      } else if (packageRequestId) {
        await conn.query('UPDATE subscription_requests SET event_id = ? WHERE id = ? AND event_id IS NULL', [eventId, packageRequestId]);
      }

      if (Array.isArray(data.staff_assignments) && data.staff_assignments.length > 0) {
        for (const sa of data.staff_assignments) {
          const roleConfig = ROLE_CONFIG[sa.role || 'INVITER'] || ROLE_CONFIG.INVITER;
          const canInvite = sa.can_invite !== undefined ? (sa.can_invite ? 1 : 0) : roleConfig.can_invite;
          const canApprove = sa.can_approve !== undefined ? (sa.can_approve ? 1 : 0) : roleConfig.can_approve;
          const canScan = sa.can_scan !== undefined ? (sa.can_scan ? 1 : 0) : roleConfig.can_scan;
          const canReport = sa.can_view_report !== undefined ? (sa.can_view_report ? 1 : 0) : roleConfig.can_view_report;

          for (const code of roleConfig.permissionCodes) {
            await conn.query(
              `INSERT IGNORE INTO user_permissions (user_id, permission_id)
               SELECT ?, id FROM permissions WHERE code = ?`,
              [sa.staff_id, code]
            );
          }

          await conn.query(`
            INSERT INTO staff_event_quotas (event_id, staff_id, max_invites, is_enabled, can_invite, can_approve, can_scan, can_view_report)
            VALUES (?, ?, ?, 1, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE max_invites = VALUES(max_invites), is_enabled = 1,
              can_invite = VALUES(can_invite), can_approve = VALUES(can_approve),
              can_scan = VALUES(can_scan), can_view_report = VALUES(can_view_report)
          `, [eventId, sa.staff_id, Math.max(0, Number(sa.max_invites ?? 50)), canInvite, canApprove, canScan, canReport]);
        }
      }

      return {
        id: eventId,
        quota_source: quotaSource,
        package: packageInfo,
        payment_status: paymentStatus,
        package_request_id: packageRequestId,
        paid_at: paidAt
      };
    });

    Realtime.emitDashboardRefresh();

    // Tu dong tao truoc 1 link moi chinh thuc mac dinh
    try {
      await InvitesService.createInviteLink({
        event_id: created.id,
        referrer_id: userId,
        expires_in_days: 60,
        max_registrations: created.package?.max_attendees || 1000,
        is_admin: true,
      });
    } catch (invErr) {
      console.warn('Auto create default invite on event creation error:', invErr);
    }

    return {
      ...created,
      name: data.name,
      description: data.description || null,
      location: data.location,
      start_at: data.start_at,
      end_at: data.end_at,
      capacity: data.capacity || created.package.max_attendees,
      poster_url: posterUrl,
      package_name: created.package.name,
      max_employees: created.package.max_employees,
      max_referrers: created.package.max_referrers,
      max_scanners: created.package.max_scanners,
      package_price_vnd: created.package.price_vnd,
      is_trial: created.quota_source === 'FREE',
      payment_status: created.payment_status,
      paid_at: created.paid_at
    };
  }

  static async closeEvent(tenantId: number, eventId: number) {
    await this.requireTenantEvent(tenantId, eventId);
    await query("UPDATE events SET status = 'CLOSED' WHERE id = ? AND tenant_id = ?", [eventId, tenantId]);
    await query("UPDATE invite_links SET status = 'CLOSED' WHERE event_id = ? AND status = 'ACTIVE'", [eventId]);
    Realtime.emitDashboardRefresh();
    return { success: true, status: 'CLOSED' };
  }

  static async reopenEvent(tenantId: number, eventId: number) {
    await this.requireTenantEvent(tenantId, eventId);
    await query("UPDATE events SET status = 'PUBLISHED' WHERE id = ? AND tenant_id = ?", [eventId, tenantId]);
    await query("UPDATE invite_links SET status = 'ACTIVE' WHERE event_id = ?", [eventId]);
    Realtime.emitDashboardRefresh();
    return { success: true, status: 'PUBLISHED' };
  }

  static async updateEvent(tenantId: number, eventId: number, data: {
    name?: string;
    description?: string;
    location?: string;
    start_at?: string;
    end_at?: string;
    capacity?: number;
    approval_mode?: string;
  }) {
    await this.requireTenantEvent(tenantId, eventId);
    const [events]: any = await query(`
      SELECT e.*, COALESCE(sr.max_attendees, sp.max_attendees, 500) AS max_package_capacity
      FROM events e
      LEFT JOIN subscription_requests sr ON sr.id = e.package_request_id
      LEFT JOIN subscription_plans sp ON sp.name = e.package_name
      WHERE e.id = ? AND e.tenant_id = ?
      LIMIT 1
    `, [eventId, tenantId]);
    if (!events.length) throw new Error('Không tìm thấy sự kiện.');
    const event = events[0];

    const fields: string[] = [];
    const values: any[] = [];
    if (data.name) { fields.push('name = ?'); values.push(data.name.trim()); }
    if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description ? data.description.trim() : null); }
    if (data.location) { fields.push('location = ?'); values.push(data.location.trim()); }
    if (data.start_at) { fields.push('start_at = ?'); values.push(data.start_at); }
    if (data.end_at) { fields.push('end_at = ?'); values.push(data.end_at); }
    if (data.approval_mode) { fields.push('approval_mode = ?'); values.push(data.approval_mode); }
    if (data.capacity) {
      const cap = Number(data.capacity);
      if (cap < 1) throw new Error('Sức chứa tối thiểu là 1 khách.');
      const maxAllowed = event.max_package_capacity || 500;
      if (cap > maxAllowed) {
        throw new Error(`Sức chứa tối đa không được vượt quá giới hạn của gói (${maxAllowed} khách).`);
      }
      fields.push('capacity = ?');
      values.push(cap);
    }
    if (!fields.length) return { success: true };
    values.push(eventId, tenantId);
    await query(`UPDATE events SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`, values);
    Realtime.emitDashboardRefresh();
    return { success: true, message: 'Cập nhật sự kiện thành công.' };
  }

  static async getAttendees(tenantId: number, eventId: number) {
    await this.requireTenantEvent(tenantId, eventId);
    return await query<any[]>(`
      SELECT r.id AS registration_id, r.full_name, r.phone, r.email, r.address,
             r.status AS registration_status, r.created_at AS registered_at, r.approved_at,
             t.code AS ticket_code, t.status AS ticket_status, t.used_at AS checked_in_at,
             u.name AS referrer_name
      FROM registrations r
      JOIN events e ON e.id = r.event_id AND e.tenant_id = ?
      JOIN users u ON u.id = r.referrer_id
      LEFT JOIN tickets t ON t.registration_id = r.id
      WHERE r.event_id = ?
      ORDER BY r.created_at DESC
    `, [tenantId, eventId]);
  }

  static async listTeam(tenantId: number) {
    return await query<any[]>(`
      SELECT u.id, u.name, u.email, u.phone, u.status, tu.created_at,
             COUNT(DISTINCT q.event_id) AS assigned_events
      FROM tenant_users tu
      JOIN users u ON u.id = tu.user_id
      LEFT JOIN staff_event_quotas q ON q.staff_id = u.id AND q.is_enabled = 1
      WHERE tu.tenant_id = ? AND tu.role = 'TEAM'
      GROUP BY u.id
      ORDER BY u.name ASC
    `, [tenantId]);
  }

  static async searchUsers(tenantId: number, term: string) {
    if (!term || term.trim().length < 2) return [];
    const cleanTerm = `%${term.trim()}%`;
    return await query<any[]>(`
      SELECT u.id, u.name, u.email, u.phone, u.type,
             IF(tu.user_id IS NOT NULL, 1, 0) AS is_already_member
      FROM users u
      LEFT JOIN tenant_users tu ON tu.user_id = u.id AND tu.tenant_id = ?
      WHERE u.email LIKE ? OR u.phone LIKE ? OR u.name LIKE ?
      ORDER BY is_already_member ASC, u.name ASC
      LIMIT 10
    `, [tenantId, cleanTerm, cleanTerm, cleanTerm]);
  }

  static async createTeamMember(tenantId: number, data: {
    user_id?: number;
    name?: string;
    email?: string;
    phone?: string;
    password?: string;
  }) {
    return await withTransaction(async (conn) => {
      // 1. Add by user_id if supplied
      if (data.user_id) {
        const [users]: any = await conn.query('SELECT id, name, email, phone, type, status FROM users WHERE id = ? LIMIT 1', [data.user_id]);
        if (!users.length) throw new Error('Không tìm thấy tài khoản người dùng.');
        const targetUser = users[0];
        if (targetUser.status !== 'ACTIVE') throw new Error('Tài khoản này đang bị khóa.');

        const [existingMember]: any = await conn.query('SELECT user_id FROM tenant_users WHERE tenant_id = ? AND user_id = ? LIMIT 1', [tenantId, targetUser.id]);
        if (existingMember.length) throw new Error('Người dùng này đã ở trong đội ngũ của bạn.');

        await conn.query(`INSERT INTO tenant_users (tenant_id, user_id, role) VALUES (?, ?, 'TEAM')`, [tenantId, targetUser.id]);
        if (targetUser.type === 'CUSTOMER') {
          await conn.query(`UPDATE users SET type = 'STAFF' WHERE id = ?`, [targetUser.id]);
        }
        return { id: targetUser.id, name: targetUser.name, email: targetUser.email, phone: targetUser.phone };
      }

      // 2. Add by email or create new
      if (!data.email) throw new Error('Vui lòng cung cấp email người dùng.');
      const cleanEmail = data.email.trim().toLowerCase();

      const [existing]: any = await conn.query('SELECT id, name, email, phone, type, status FROM users WHERE email = ? LIMIT 1', [cleanEmail]);
      if (existing.length) {
        const targetUser = existing[0];
        if (targetUser.status !== 'ACTIVE') throw new Error('Tài khoản này đang bị khóa.');

        const [existingMember]: any = await conn.query('SELECT user_id FROM tenant_users WHERE tenant_id = ? AND user_id = ? LIMIT 1', [tenantId, targetUser.id]);
        if (existingMember.length) throw new Error('Người dùng với email này đã nằm trong đội ngũ của bạn.');

        await conn.query(`INSERT INTO tenant_users (tenant_id, user_id, role) VALUES (?, ?, 'TEAM')`, [tenantId, targetUser.id]);
        if (targetUser.type === 'CUSTOMER') {
          await conn.query(`UPDATE users SET type = 'STAFF' WHERE id = ?`, [targetUser.id]);
        }
        return { id: targetUser.id, name: targetUser.name, email: targetUser.email, phone: targetUser.phone };
      }

      // 3. User does not exist -> Create new account
      if (!data.name || !data.password) {
        throw new Error('Tài khoản chưa tồn tại. Vui lòng nhập họ tên và mật khẩu (ít nhất 8 ký tự) để cấp mới.');
      }
      if (data.password.length < 8) throw new Error('Mật khẩu cần có ít nhất 8 ký tự.');
      const passwordHash = await bcrypt.hash(data.password, 10);

      const [userResult]: any = await conn.query(
        `INSERT INTO users (type, name, email, phone, password_hash, status)
         VALUES ('STAFF', ?, ?, ?, ?, 'ACTIVE')`,
        [data.name.trim(), cleanEmail, data.phone?.trim() || null, passwordHash]
      );
      const userId = Number(userResult.insertId);
      await conn.query(`INSERT INTO tenant_users (tenant_id, user_id, role) VALUES (?, ?, 'TEAM')`, [tenantId, userId]);
      return { id: userId, name: data.name, email: cleanEmail, phone: data.phone || null };
    });
  }

  static async listEventTeam(tenantId: number, eventId: number) {
    await this.requireTenantEvent(tenantId, eventId);
    return await query<any[]>(`
      SELECT u.id, u.name, u.email, u.phone, u.status, q.max_invites,
             q.is_enabled, q.can_invite, q.can_approve, q.can_scan, q.can_view_report
      FROM staff_event_quotas q
      JOIN users u ON u.id = q.staff_id
      JOIN tenant_users tu ON tu.user_id = u.id AND tu.tenant_id = ?
      WHERE q.event_id = ?
      ORDER BY u.name
    `, [tenantId, eventId]);
  }

  static async assignTeamMember(tenantId: number, eventId: number, data: {
    staff_id: number; role: string; max_invites?: number; is_enabled?: boolean;
  }) {
    await this.requireTenantEvent(tenantId, eventId);
    const role = ROLE_CONFIG[data.role];
    if (!role) throw new Error('Vai trò sự kiện không hợp lệ.');

    return await withTransaction(async (conn) => {
      const [events]: any = await conn.query(`
        SELECT max_employees, max_referrers, max_scanners, status FROM events
        WHERE id = ? AND tenant_id = ? FOR UPDATE
      `, [eventId, tenantId]);
      if (!events.length) throw new Error('Sự kiện không thuộc tài khoản khách thuê này.');
      if (events[0].status !== 'PUBLISHED') throw new Error('Chỉ có thể phân công nhân sự khi sự kiện đang mở.');
      const [members]: any = await conn.query(
        `SELECT u.id FROM users u
         JOIN tenant_users tu ON tu.user_id = u.id AND tu.tenant_id = ?
         WHERE u.id = ? AND u.status = 'ACTIVE'`,
        [tenantId, data.staff_id]
      );
      if (!members.length) throw new Error('Nhân sự không thuộc khách thuê này hoặc đang bị khóa.');

      const maxEmployees = Math.max(Number(events[0].max_employees || 0), 20);
      const maxReferrers = Math.max(Number(events[0].max_referrers || 0), 10);
      const maxScanners = Math.max(Number(events[0].max_scanners || 0), 10);

      const [current]: any = await conn.query(`
        SELECT staff_id, is_enabled, can_invite, can_scan FROM staff_event_quotas WHERE event_id = ? AND staff_id = ?
      `, [eventId, data.staff_id]);
      if (!current.length || !current[0].is_enabled) {
        const [counts]: any = await conn.query(`
          SELECT COUNT(*) AS employees, SUM(can_invite = 1) AS referrers, SUM(can_scan = 1) AS scanners
          FROM staff_event_quotas WHERE event_id = ? AND is_enabled = 1
        `, [eventId]);
        const count = counts[0] || {};
        if (Number(count.employees || 0) >= maxEmployees) throw new Error('Sự kiện đã dùng hết số nhân sự theo gói.');
        if (role.can_invite && Number(count.referrers || 0) >= maxReferrers) throw new Error('Sự kiện đã dùng hết số người giới thiệu theo gói.');
        if (role.can_scan && Number(count.scanners || 0) >= maxScanners) throw new Error('Sự kiện đã dùng hết số người soát vé theo gói.');
      } else {
        const [counts]: any = await conn.query(`
          SELECT SUM(can_invite = 1) AS referrers, SUM(can_scan = 1) AS scanners
          FROM staff_event_quotas WHERE event_id = ? AND is_enabled = 1 AND staff_id <> ?
        `, [eventId, data.staff_id]);
        if (role.can_invite && Number(counts[0]?.referrers || 0) >= maxReferrers) throw new Error('Sự kiện đã dùng hết số người giới thiệu theo gói.');
        if (role.can_scan && Number(counts[0]?.scanners || 0) >= maxScanners) throw new Error('Sự kiện đã dùng hết số người soát vé theo gói.');
      }

      await conn.query(`
        INSERT INTO staff_event_quotas (event_id, staff_id, max_invites, is_enabled, can_invite, can_approve, can_scan, can_view_report)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE max_invites = VALUES(max_invites), is_enabled = VALUES(is_enabled),
          can_invite = VALUES(can_invite), can_approve = VALUES(can_approve),
          can_scan = VALUES(can_scan), can_view_report = VALUES(can_view_report)
      `, [
        eventId,
        data.staff_id,
        Math.max(0, Number(data.max_invites ?? 50)),
        data.is_enabled === false ? 0 : 1,
        role.can_invite,
        role.can_approve,
        role.can_scan,
        role.can_view_report,
      ]);

      // Dynamic sync user_permissions across all events for this staff
      const [allQuotas]: any = await conn.query(`
        SELECT SUM(can_invite = 1) AS has_invite, SUM(can_scan = 1) AS has_scan,
               SUM(can_approve = 1) AS has_approve, SUM(can_view_report = 1) AS has_report
        FROM staff_event_quotas
        WHERE staff_id = ? AND is_enabled = 1
      `, [data.staff_id]);
      const q = allQuotas[0] || {};
      await conn.query('DELETE FROM user_permissions WHERE user_id = ?', [data.staff_id]);
      const permsToInsert: string[] = ['registrations:view_own'];
      if (Number(q.has_invite) > 0) permsToInsert.push('invite:create');
      if (Number(q.has_approve) > 0 || Number(q.has_invite) > 0) permsToInsert.push('registrations:approve');
      if (Number(q.has_scan) > 0) permsToInsert.push('tickets:scan');
      if (Number(q.has_report) > 0) permsToInsert.push('reports:view');
      for (const p of permsToInsert) {
        await conn.query(
          `INSERT IGNORE INTO user_permissions (user_id, permission_id)
           SELECT ?, id FROM permissions WHERE code = ?`,
          [data.staff_id, p]
        );
      }

      return { success: true };
    });
  }

  static async removeTeamMember(tenantId: number, eventId: number, staffId: number) {
    await this.requireTenantEvent(tenantId, eventId);
    await query(`
      DELETE q FROM staff_event_quotas q
      JOIN tenant_users tu ON tu.user_id = q.staff_id AND tu.tenant_id = ?
      WHERE q.event_id = ? AND q.staff_id = ?
    `, [tenantId, eventId, staffId]);
    await query(`UPDATE invite_links SET status = 'CLOSED' WHERE event_id = ? AND referrer_id = ? AND status = 'ACTIVE'`, [eventId, staffId]);
    return { success: true };
  }

  static async removeMemberFromTenant(tenantId: number, userId: number) {
    const rows = await query<any[]>('SELECT role FROM tenant_users WHERE tenant_id = ? AND user_id = ?', [tenantId, userId]);
    if (!rows || !rows.length) throw new Error('Thành viên không thuộc đơn vị này.');
    if (rows[0].role === 'OWNER') throw new Error('Không thể gỡ tài khoản chủ sở hữu đơn vị.');

    await query(`DELETE q FROM staff_event_quotas q JOIN events e ON e.id = q.event_id WHERE e.tenant_id = ? AND q.staff_id = ?`, [tenantId, userId]);
    await query('DELETE FROM tenant_users WHERE tenant_id = ? AND user_id = ?', [tenantId, userId]);
    return { success: true, message: 'Đã xóa nhân sự khỏi đơn vị thành công.' };
  }

  static async listEventInvites(tenantId: number, eventId: number, adminUserId?: number) {
    await this.requireTenantEvent(tenantId, eventId);
    let rows = await query<any[]>(`
      SELECT il.*, COALESCE(u.name, 'Ban Tổ Chức') AS referrer_name, u.email AS referrer_email,
             (SELECT COUNT(*) FROM registrations r WHERE r.invite_link_id = il.id) AS total_registered,
             (SELECT COUNT(*) FROM registrations r WHERE r.invite_link_id = il.id AND r.status = 'APPROVED') AS total_approved,
             (SELECT COUNT(*) FROM registrations r WHERE r.invite_link_id = il.id AND r.ticket_status = 'USED') AS total_checked_in
      FROM invite_links il
      LEFT JOIN users u ON il.referrer_id = u.id
      WHERE il.event_id = ?
      ORDER BY il.id DESC
    `, [eventId]);

    // Nếu chưa có link mời nào ở trạng thái ACTIVE, tự động tạo ngay 1 link chính thức
    let hasActive = rows.some((r) => r.status === 'ACTIVE');
    if (!hasActive) {
      try {
        let refId: number = Number(adminUserId || 0);
        if (!refId) {
          const tenantOwners = await query<any[]>(
            'SELECT tu.user_id FROM tenant_users tu WHERE tu.tenant_id = ? AND tu.role = "OWNER" LIMIT 1',
            [tenantId]
          );
          refId = tenantOwners[0]?.user_id ? Number(tenantOwners[0].user_id) : 0;
        }
        if (!refId) {
          const evRows = await query<any[]>('SELECT created_by FROM events WHERE id = ? LIMIT 1', [eventId]);
          refId = evRows[0]?.created_by ? Number(evRows[0].created_by) : 1;
        }

        const newLink = await InvitesService.createInviteLink({
          event_id: eventId,
          referrer_id: refId,
          expires_in_days: 60,
          max_registrations: 1000,
          is_admin: true,
        });

        const userRows = await query<any[]>('SELECT name, email FROM users WHERE id = ? LIMIT 1', [refId]);
        const newRow = {
          ...newLink,
          referrer_name: userRows[0]?.name || 'Ban Tổ Chức',
          referrer_email: userRows[0]?.email || '',
          total_registered: 0,
          total_approved: 0,
          total_checked_in: 0,
          status: 'ACTIVE',
        };
        rows.unshift(newRow);
      } catch (err) {
        console.warn('Auto create default invite link in listEventInvites error:', err);
      }
    }

    // Tự động rút gọn link cũ nếu dài hơn 12 ký tự hoặc có tiền tố inv_
    for (const r of rows) {
      if (r.token && (r.token.length > 12 || r.token.startsWith('inv_')) && r.status === 'ACTIVE') {
        try {
          const shortToken = await InvitesService.generateUniqueShortToken();
          const newSig = InvitesService.generateSignature(r.event_id, r.referrer_id, shortToken);
          await query(
            'UPDATE invite_links SET legacy_token = COALESCE(legacy_token, token), token = ?, signature = ? WHERE id = ?',
            [shortToken, newSig, r.id]
          );
          r.legacy_token = r.legacy_token || r.token;
          r.token = shortToken;
          r.signature = newSig;
        } catch (e) {
          console.warn('Auto shorten link error:', e);
        }
      }
    }

    return rows.map((r) => ({
      ...r,
      url: `${ENV.FRONTEND_URL}/invite/${r.token}`,
      invite_url: `${ENV.FRONTEND_URL}/invite/${r.token}`,
    }));
  }

  static async createEventInvite(tenantId: number, eventId: number, data: {
    referrer_id?: number;
    max_registrations?: number;
    expires_in_days?: number;
  }, adminUserId: number) {
    await this.requireTenantEvent(tenantId, eventId);
    const referrerId = data.referrer_id ? Number(data.referrer_id) : adminUserId;
    return await InvitesService.createInviteLink({
      event_id: eventId,
      referrer_id: referrerId,
      expires_in_days: data.expires_in_days ? Number(data.expires_in_days) : 60,
      max_registrations: data.max_registrations ? Number(data.max_registrations) : 1000,
      is_admin: true,
    });
  }

  private static async requireTenantEvent(tenantId: number, eventId: number) {
    const rows = await query<any[]>('SELECT id FROM events WHERE id = ? AND tenant_id = ? LIMIT 1', [eventId, tenantId]);
    if (!rows.length) throw new Error('Sự kiện không thuộc tài khoản khách thuê này.');
  }
}
