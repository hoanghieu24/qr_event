import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';

// Check if user is logged in
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Vui lòng đăng nhập để tiếp tục.',
    });
    return;
  }
  next();
}

// Check if user is Admin
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.type !== 'ADMIN') {
    res.status(403).json({
      success: false,
      message: 'Từ chối truy cập: Yêu cầu quyền quản trị viên (Admin).',
    });
    return;
  }
  next();
}

export function requireTenantAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.type !== 'TENANT_ADMIN' || !req.user.tenantId) {
    res.status(403).json({ success: false, message: 'Tài khoản không có quyền quản lý khách thuê.' });
    return;
  }
  next();
}

type EventCapability = 'can_invite' | 'can_approve' | 'can_scan' | 'can_view_report';

export function requireEventCapability(capability: EventCapability) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để tiếp tục.' });
      return;
    }
    if (req.user.type === 'ADMIN') return next();

    const eventId = Number(req.params.id || req.params.eventId || req.query.event_id || req.body?.event_id);
    if (!eventId) {
      res.status(400).json({ success: false, message: 'Thiếu ID sự kiện.' });
      return;
    }

    try {
      if (req.user.type === 'TENANT_ADMIN') {
        const events = await query<any[]>(
          'SELECT id FROM events WHERE id = ? AND tenant_id = ? LIMIT 1',
          [eventId, req.user.tenantId]
        );
        if (events.length) return next();
      } else if (req.user.type === 'STAFF') {
        const assignments = await query<any[]>(
          `SELECT ${capability} AS allowed FROM staff_event_quotas
           WHERE event_id = ? AND staff_id = ? AND is_enabled = 1 LIMIT 1`,
          [eventId, req.user.id]
        );
        if (assignments[0]?.allowed) return next();
      }

      res.status(403).json({ success: false, message: 'Bạn chưa được phân quyền cho thao tác này trong sự kiện.' });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  };
}

// Check dynamic permission
export function requirePermission(permissionCode: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Vui lòng đăng nhập để tiếp tục.',
      });
      return;
    }

    // Admin and Tenant Admin always bypass specific permission checks
    if (req.user.type === 'ADMIN' || req.user.type === 'TENANT_ADMIN') {
      next();
      return;
    }

    if (!req.user.permissions.includes(permissionCode)) {
      res.status(403).json({
        success: false,
        message: `Từ chối truy cập: Bạn không có quyền '${permissionCode}'.`,
        requiredPermission: permissionCode,
      });
      return;
    }

    next();
  };
}

// Check if user has ANY of the specified permissions
export function requireAnyPermission(permissionCodes: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Vui lòng đăng nhập để tiếp tục.',
      });
      return;
    }

    if (req.user.type === 'ADMIN' || req.user.type === 'TENANT_ADMIN') {
      next();
      return;
    }

    const hasAny = permissionCodes.some((code) => req.user?.permissions.includes(code));
    if (!hasAny) {
      res.status(403).json({
        success: false,
        message: `Từ chối truy cập: Bạn cần có ít nhất một trong các quyền [${permissionCodes.join(', ')}].`,
        requiredPermissions: permissionCodes,
      });
      return;
    }

    next();
  };
}
