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

  // Master Admin: List all users in system (ADMIN, STAFF, CUSTOMER)
  static async listAllUsers(filters: { type?: string; status?: string; search?: string }) {
    let sql = `
      SELECT u.id, u.name, u.email, u.phone, u.type, u.status, u.created_at,
             (SELECT COUNT(*) FROM registrations r WHERE r.customer_id = u.id) as registrations_count,
             (SELECT COUNT(*) FROM invite_links il WHERE il.referrer_id = u.id) as links_count,
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
    type: 'ADMIN' | 'STAFF' | 'CUSTOMER';
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
  static async updateUserRole(userId: number, type: 'ADMIN' | 'STAFF' | 'CUSTOMER', currentAdminId: number) {
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

  // Master Admin: Delete user
  static async deleteUser(userId: number, currentAdminId: number) {
    if (userId === currentAdminId) {
      throw new Error('Bạn không thể tự xóa tài khoản của chính mình.');
    }
    if (userId === 1) {
      throw new Error('Không thể xóa tài khoản Quản trị viên gốc của hệ thống.');
    }
    await query('DELETE FROM users WHERE id = ?', [userId]);
    return { success: true, message: 'Đã xóa người dùng khỏi hệ thống.' };
  }
}
