import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { query } from '../config/database';

export interface AuthUser {
  id: number;
  type: 'ADMIN' | 'STAFF' | 'CUSTOMER' | 'TENANT_ADMIN';
  name: string;
  email: string;
  phone?: string;
  permissions: string[];
  tenantId?: number;
  tenantName?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      message: 'Không có token xác thực hoặc định dạng không hợp lệ.',
    });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as any;
    
    // Check if user still exists and active
    const users = await query<any[]>(
      'SELECT id, type, name, email, phone, status FROM users WHERE id = ?',
      [decoded.id]
    );

    if (users.length === 0 || users[0].status !== 'ACTIVE') {
      res.status(401).json({
        success: false,
        message: 'Tài khoản không tồn tại hoặc đã bị khóa.',
      });
      return;
    }

    const userRecord = users[0];

    let tenantContext: any = null;
    if (userRecord.type === 'TENANT_ADMIN' || userRecord.type === 'STAFF') {
      const memberships = await query<any[]>(
        `SELECT tu.tenant_id, t.name AS tenant_name, t.status AS tenant_status
         FROM tenant_users tu
         JOIN tenants t ON t.id = tu.tenant_id
         WHERE tu.user_id = ?
         ORDER BY FIELD(tu.role, 'OWNER', 'TEAM') ASC, tu.id ASC
         LIMIT 1`,
        [userRecord.id]
      );
      tenantContext = memberships[0] || null;
      if ((userRecord.type === 'TENANT_ADMIN' && !tenantContext) || (tenantContext && tenantContext.tenant_status !== 'ACTIVE')) {
        res.status(401).json({ success: false, message: 'Tài khoản khách thuê chưa được kích hoạt.' });
        return;
      }
    }

    // Fetch dynamic permissions
    let permissions: string[] = [];
    if (userRecord.type === 'ADMIN') {
      // Admin gets all active permission codes
      const allPerms = await query<any[]>('SELECT code FROM permissions');
      permissions = allPerms.map((p) => p.code);
    } else if (userRecord.type === 'STAFF') {
      const staffPerms = await query<any[]>(
        `SELECT p.code 
         FROM permissions p 
         JOIN user_permissions up ON p.id = up.permission_id 
         WHERE up.user_id = ?`,
        [userRecord.id]
      );
      const permSet = new Set<string>(staffPerms.map((p) => p.code));
      const quotaRows = await query<any[]>(
        `SELECT SUM(can_invite = 1) AS has_invite, SUM(can_approve = 1) AS has_approve,
                SUM(can_scan = 1) AS has_scan, SUM(can_view_report = 1) AS has_report
         FROM staff_event_quotas
         WHERE staff_id = ? AND is_enabled = 1`,
        [userRecord.id]
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
      permissions = Array.from(permSet);
    }

    req.user = {
      id: userRecord.id,
      type: userRecord.type,
      name: userRecord.name,
      email: userRecord.email,
      phone: userRecord.phone,
      permissions,
      tenantId: tenantContext ? Number(tenantContext.tenant_id) : undefined,
      tenantName: tenantContext?.tenant_name,
    };

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Token đã hết hạn hoặc không hợp lệ.',
    });
  }
}

export async function authenticateOptional(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as any;
    const users = await query<any[]>(
      'SELECT id, type, name, email, phone, status FROM users WHERE id = ?',
      [decoded.id]
    );

    if (users.length > 0 && users[0].status === 'ACTIVE') {
      const userRecord = users[0];
      let tenantContext: any = null;
      if (userRecord.type === 'TENANT_ADMIN' || userRecord.type === 'STAFF') {
        const memberships = await query<any[]>(
          `SELECT tu.tenant_id, t.name AS tenant_name
           FROM tenant_users tu
           JOIN tenants t ON t.id = tu.tenant_id AND t.status = 'ACTIVE'
           WHERE tu.user_id = ?
           LIMIT 1`,
          [userRecord.id]
        );
        tenantContext = memberships[0] || null;
      }
      req.user = {
        id: userRecord.id,
        type: userRecord.type,
        name: userRecord.name,
        email: userRecord.email,
        phone: userRecord.phone,
        permissions: [],
        tenantId: tenantContext ? Number(tenantContext.tenant_id) : undefined,
        tenantName: tenantContext?.tenant_name,
      };
    }
  } catch (error) {
    // Ignore invalid token on optional auth
  }
  next();
}
