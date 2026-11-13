import bcrypt from 'bcrypt';
import { query, withTransaction } from '../../config/database';

export class UsersService {
  static async listPermissions() {
    return await query('SELECT id, code, name, description FROM permissions ORDER BY id ASC');
  }

  static async listStaff() {
    const staffList = await query<any[]>(
      `SELECT u.id, u.name, u.email, u.phone, u.type, u.status, u.created_at,
              COALESCE(JSON_ARRAYAGG(
                IF(p.id IS NOT NULL, 
                  JSON_OBJECT('id', p.id, 'code', p.code, 'name', p.name), 
                  NULL
                )
              ), JSON_ARRAY()) as permissions
       FROM users u
       LEFT JOIN user_permissions up ON u.id = up.user_id
       LEFT JOIN permissions p ON up.permission_id = p.id
       WHERE (u.type IN ('ADMIN', 'STAFF')) AND (u.id NOT IN (SELECT user_id FROM tenant_users))
       GROUP BY u.id
       ORDER BY FIELD(u.type, 'ADMIN', 'STAFF'), u.id DESC`
    );

    return staffList.map((s) => ({
      ...s,
      permissions: typeof s.permissions === 'string' 
        ? JSON.parse(s.permissions).filter((p: any) => p !== null) 
        : (s.permissions || []).filter((p: any) => p !== null),
    }));
  }

  static async createStaff(data: {
    name: string;
    email: string;
    phone?: string;
    password: string;
    permission_ids?: number[];
  }) {
    // Check if email exists
    const existing = await query<any[]>('SELECT id FROM users WHERE email = ?', [data.email]);
    if (existing.length > 0) {
      throw new Error('Email này đã được sử dụng.');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    return await withTransaction(async (conn) => {
      const [res]: any = await conn.query(
        `INSERT INTO users (type, name, email, phone, password_hash, status)
         VALUES ('STAFF', ?, ?, ?, ?, 'ACTIVE')`,
        [data.name, data.email, data.phone || null, passwordHash]
      );
      const staffId = res.insertId;

      if (data.permission_ids && data.permission_ids.length > 0) {
        for (const pId of data.permission_ids) {
          await conn.query(
            'INSERT INTO user_permissions (user_id, permission_id) VALUES (?, ?)',
            [staffId, pId]
          );
        }
      }

      return { id: staffId, name: data.name, email: data.email };
    });
  }

  static async updatePermissions(staffId: number, permissionIds: number[]) {
    return await withTransaction(async (conn) => {
      // Clear old permissions
      await conn.query('DELETE FROM user_permissions WHERE user_id = ?', [staffId]);

      // Assign new permissions
      if (permissionIds.length > 0) {
        for (const pId of permissionIds) {
          await conn.query(
            'INSERT INTO user_permissions (user_id, permission_id) VALUES (?, ?)',
            [staffId, pId]
          );
        }
      }

      return { success: true, message: 'Cập nhật quyền thành công.' };
    });
  }

  static async updateStatus(staffId: number, status: 'ACTIVE' | 'BLOCKED') {
    await query('UPDATE users SET status = ? WHERE id = ?', [status, staffId]);
    return { success: true, message: `Đã chuyển trạng thái sang ${status}.` };
  }

  // Master Admin: List all users in system (ADMIN, TENANT_ADMIN, STAFF, CUSTOMER)
  static async listAllUsers(filters: { type?: string; status?: string; search?: string }) {
    let sql = `
      SELECT u.id, u.name, u.email, u.phone, u.type, u.status, u.created_at,
             (SELECT COUNT(*) FROM registrations r WHERE r.customer_id = u.id OR r.referrer_id = u.id) as registrations_count,
             (SELECT COUNT(*) FROM invite_links il WHERE il.referrer_id = u.id) as links_count,
             (SELECT COUNT(*) FROM tenants tc WHERE tc.created_by = u.id) as created_tenants_count,
             (SELECT COUNT(*) FROM events ec WHERE ec.created_by = u.id) as created_events_count,
             (SELECT COUNT(*) FROM tenant_users tu WHERE tu.user_id = u.id) as tenant_memberships_count,
             (SELECT GROUP_CONCAT(DISTINCT t.name ORDER BY t.id SEPARATOR ', ')
              FROM tenant_users tu
              JOIN tenants t ON t.id = tu.tenant_id
              WHERE tu.user_id = u.id) as tenant_names,
             (SELECT GROUP_CONCAT(DISTINCT tu.role SEPARATOR ',')
              FROM tenant_users tu
              WHERE tu.user_id = u.id) as tenant_roles,
             COALESCE((
               SELECT JSON_ARRAYAGG(p.name)
               FROM user_permissions up
               JOIN permissions p ON up.permission_id = p.id
               WHERE up.user_id = u.id
             ), JSON_ARRAY()) as permissions_list
      FROM users u
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.type) {
      sql += ' AND u.type = ?';
      params.push(filters.type);
    }

    if (filters.status) {
      sql += ' AND u.status = ?';
      params.push(filters.status);
    }

    if (filters.search) {
      sql += ' AND (u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)';
      const s = `%${filters.search}%`;
      params.push(s, s, s);
    }

    sql += ' ORDER BY u.id DESC';

    const users = await query<any[]>(sql, params);
    return users.map((u) => ({
      ...u,
      tenant_names: u.tenant_names || '',
      tenant_roles: u.tenant_roles || '',
      is_tenant_account: u.type === 'TENANT_ADMIN' || Number(u.tenant_memberships_count) > 0,
      permissions_list: typeof u.permissions_list === 'string'
        ? JSON.parse(u.permissions_list)
        : (u.permissions_list || []),
    }));
  }

  // Master Admin: Create any user
  static async createUser(data: {
    name: string;
    email: string;
    phone?: string;
    type: 'ADMIN' | 'TENANT_ADMIN' | 'STAFF' | 'CUSTOMER';
    password?: string;
    permission_ids?: number[];
  }) {
    const existing = await query<any[]>('SELECT id FROM users WHERE email = ?', [data.email]);
    if (existing.length > 0) {
      throw new Error('Email này đã được sử dụng.');
    }

    const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : null;

    return await withTransaction(async (conn) => {
      const [res]: any = await conn.query(
        `INSERT INTO users (type, name, email, phone, password_hash, status)
         VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
        [data.type, data.name, data.email, data.phone || null, passwordHash]
      );
      const userId = res.insertId;

      if (data.permission_ids && data.permission_ids.length > 0) {
        for (const pId of data.permission_ids) {
          await conn.query(
            'INSERT INTO user_permissions (user_id, permission_id) VALUES (?, ?)',
            [userId, pId]
          );
        }
      }

      return { id: userId, name: data.name, email: data.email, type: data.type };
    });
  }

  // Master Admin: Update user role
  static async updateUserRole(
    userId: number,
    type: 'ADMIN' | 'TENANT_ADMIN' | 'STAFF' | 'CUSTOMER',
    currentAdminId: number
  ) {
    if (userId === currentAdminId && type !== 'ADMIN') {
      throw new Error('Bạn không thể tự hạ quyền quản trị viên của chính mình.');
    }
    await query('UPDATE users SET type = ? WHERE id = ?', [type, userId]);
    return { success: true, message: 'Đã cập nhật vai trò người dùng thành công.' };
  }

  // Master Admin: Reset user password
  static async resetUserPassword(userId: number, newPassword: string) {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Mật khẩu mới phải có ít nhất 6 ký tự.');
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
    return { success: true, message: 'Đã đặt lại mật khẩu người dùng thành công.' };
  }

  // Master Admin: Update any user status
  static async updateGeneralUserStatus(userId: number, status: 'ACTIVE' | 'BLOCKED', currentAdminId: number) {
    if (userId === currentAdminId) {
      throw new Error('Bạn không thể tự khóa tài khoản của chính mình.');
    }
    await query('UPDATE users SET status = ? WHERE id = ?', [status, userId]);
    return { success: true, message: `Đã chuyển trạng thái người dùng sang ${status}.` };
  }

  private static createHttpError(message: string, statusCode: number, code?: string) {
    const err: any = new Error(message);
    err.statusCode = statusCode;
    if (code) err.code = code;
    return err;
  }

  // Master Admin: Inspect foreign-key and related records before deleting a user
  static async getUserDependencies(userId: number) {
    const users = await query<any[]>(
      'SELECT id, name, email, type, status FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    if (!users.length) {
      throw UsersService.createHttpError('Không tìm thấy tài khoản người dùng.', 404, 'USER_NOT_FOUND');
    }

    const [tenantsCreated, eventsCreated, tenantMemberships, countRows] = await Promise.all([
      query<any[]>('SELECT id, name FROM tenants WHERE created_by = ?', [userId]),
      query<any[]>('SELECT id, name FROM events WHERE created_by = ?', [userId]),
      query<any[]>(
        `SELECT t.id, t.name, tu.role
         FROM tenant_users tu
         JOIN tenants t ON t.id = tu.tenant_id
         WHERE tu.user_id = ?`,
        [userId]
      ),
      query<any[]>(
        `SELECT
           (SELECT COUNT(*) FROM registrations WHERE customer_id = ? OR referrer_id = ?) as registrations_count,
           (SELECT COUNT(*) FROM invite_links WHERE referrer_id = ?) as links_count,
           (SELECT COUNT(*) FROM scan_logs WHERE scanned_by = ?) as scan_logs_count,
           (SELECT COUNT(*) FROM disputes WHERE recorded_by = ?) as disputes_count`,
        [userId, userId, userId, userId, userId]
      ),
    ]);

    const counts = countRows[0] || {};
    const foreignKeyItems: string[] = [];
    const cascadeItems: string[] = [];

    if (tenantsCreated.length > 0) {
      const names = tenantsCreated.slice(0, 3).map((t) => t.name).join(', ');
      foreignKeyItems.push(
        `Đang đứng tên tạo ${tenantsCreated.length} đơn vị khách thuê (${names}${tenantsCreated.length > 3 ? ', ...' : ''})`
      );
    }
    if (eventsCreated.length > 0) {
      const names = eventsCreated.slice(0, 3).map((e) => e.name).join(', ');
      foreignKeyItems.push(
        `Đang đứng tên tạo ${eventsCreated.length} sự kiện (${names}${eventsCreated.length > 3 ? ', ...' : ''})`
      );
    }
    if (tenantMemberships.length > 0) {
      const names = tenantMemberships.slice(0, 3).map((t) => `${t.name} [${t.role}]`).join(', ');
      cascadeItems.push(`Đang thuộc đơn vị khách thuê: ${names}${tenantMemberships.length > 3 ? ', ...' : ''}`);
    }
    if (Number(counts.registrations_count) > 0) {
      cascadeItems.push(`Có ${counts.registrations_count} hồ sơ / vé đăng ký liên quan (sẽ bị xóa theo nếu xóa tài khoản)`);
    }
    if (Number(counts.links_count) > 0) {
      cascadeItems.push(`Có ${counts.links_count} link mời sự kiện đã tạo (sẽ bị xóa theo nếu xóa tài khoản)`);
    }
    if (Number(counts.scan_logs_count) > 0) {
      cascadeItems.push(`Có ${counts.scan_logs_count} lượt lịch sử quét vé check-in`);
    }
    if (Number(counts.disputes_count) > 0) {
      cascadeItems.push(`Có ${counts.disputes_count} biên bản tranh chấp đã ghi nhận`);
    }

    return {
      user: users[0],
      hasForeignKeyConstraint: foreignKeyItems.length > 0,
      hasRelatedData: foreignKeyItems.length > 0 || cascadeItems.length > 0,
      foreignKeyItems,
      cascadeItems,
    };
  }

  // Master Admin: Delete user (requires 4-digit PIN, reassigns creator foreign keys cleanly)
  static async deleteUser(userId: number, currentAdminId: number, pin?: string) {
    if (userId === currentAdminId) {
      throw UsersService.createHttpError('Bạn không thể tự xóa tài khoản của chính mình.', 400);
    }
    if (userId === 1) {
      throw UsersService.createHttpError('Không thể xóa tài khoản Quản trị viên gốc của hệ thống.', 400);
    }

    const expectedDeletePin = process.env.ADMIN_DELETE_PIN || '9191';
    if (String(pin || '').trim() !== expectedDeletePin) {
      throw UsersService.createHttpError(
        'Mật khẩu xác nhận 4 số không đúng. Cần nhập đúng mật khẩu xóa để tiếp tục, hoặc hãy chọn Khóa tài khoản.',
        403,
        'INVALID_PIN'
      );
    }

    return await withTransaction(async (conn) => {
      const [existing]: any = await conn.query('SELECT id, name, email FROM users WHERE id = ? LIMIT 1', [userId]);
      if (!existing.length) {
        throw UsersService.createHttpError('Tài khoản không tồn tại hoặc đã bị xóa.', 404, 'USER_NOT_FOUND');
      }

      // Transfer non-nullable creator foreign keys (fk_tenants_creator, fk_events_creator)
      // to the executing admin so business entities remain intact and user deletion never fails on FK
      await conn.query('UPDATE tenants SET created_by = ? WHERE created_by = ?', [currentAdminId, userId]);
      await conn.query('UPDATE events SET created_by = ? WHERE created_by = ?', [currentAdminId, userId]);

      try {
        await conn.query('DELETE FROM users WHERE id = ?', [userId]);
      } catch (err: any) {
        if (err?.errno === 1451 || err?.code === 'ER_ROW_IS_REFERENCED_2') {
          throw UsersService.createHttpError(
            'Tài khoản này vẫn còn ràng buộc khóa phụ từ dữ liệu hệ thống nên không thể xóa trực tiếp. Vui lòng dùng tính năng Khóa tài khoản.',
            409,
            'FOREIGN_KEY_CONSTRAINT'
          );
        }
        throw err;
      }

      return { success: true, message: `Đã xóa vĩnh viễn tài khoản ${existing[0].name}.` };
    });
  }
}
