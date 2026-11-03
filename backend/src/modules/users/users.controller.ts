import { Request, Response, NextFunction } from 'express';
import { UsersService } from './users.service';

export class UsersController {
  static async listPermissions(req: Request, res: Response, next: NextFunction) {
    try {
      const perms = await UsersService.listPermissions();
      res.json({ success: true, data: perms });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async listStaff(req: Request, res: Response, next: NextFunction) {
    try {
      const staff = await UsersService.listStaff();
      res.json({ success: true, data: staff });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async createStaff(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, email, phone, password, permission_ids } = req.body;
      if (!name || !email || !password) {
        res.status(400).json({ success: false, message: 'Vui lòng điền đủ tên, email và mật khẩu.' });
        return;
      }
      const result = await UsersService.createStaff({
        name,
        email,
        phone,
        password,
        permission_ids,
      });
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async updatePermissions(req: Request, res: Response, next: NextFunction) {
    try {
      const staffId = parseInt(String(req.params.id), 10);
      const { permission_ids } = req.body;
      if (!Array.isArray(permission_ids)) {
        res.status(400).json({ success: false, message: 'permission_ids phải là mảng số ID.' });
        return;
      }
      const result = await UsersService.updatePermissions(staffId, permission_ids);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const staffId = parseInt(String(req.params.id), 10);
      const { status } = req.body;
      if (!['ACTIVE', 'BLOCKED'].includes(status)) {
        res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ.' });
        return;
      }
      const result = await UsersService.updateStatus(staffId, status);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  // Master Admin handlers
  static async listAllUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const { type, status, search } = req.query;
      const users = await UsersService.listAllUsers({
        type: type ? String(type) : undefined,
        status: status ? String(status) : undefined,
        search: search ? String(search) : undefined,
      });
      res.json({ success: true, data: users });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async createUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, email, phone, type, password, permission_ids } = req.body;
      if (!name || !email || !type) {
        res.status(400).json({ success: false, message: 'Vui lòng cung cấp họ tên, email và loại tài khoản.' });
        return;
      }
      const user = await UsersService.createUser({
        name,
        email,
        phone,
        type,
        password,
        permission_ids,
      });
      res.status(201).json({ success: true, data: user });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async updateRole(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return;
      const userId = parseInt(String(req.params.id), 10);
      const { type } = req.body;
      if (!['ADMIN', 'STAFF', 'CUSTOMER'].includes(type)) {
        res.status(400).json({ success: false, message: 'Loại tài khoản không hợp lệ.' });
        return;
      }
      const result = await UsersService.updateUserRole(userId, type, req.user.id);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = parseInt(String(req.params.id), 10);
      const { password } = req.body;
      const result = await UsersService.resetUserPassword(userId, password);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async updateUserStatus(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return;
      const userId = parseInt(String(req.params.id), 10);
      const { status } = req.body;
      if (!['ACTIVE', 'BLOCKED'].includes(status)) {
        res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ.' });
        return;
      }
      const result = await UsersService.updateGeneralUserStatus(userId, status, req.user.id);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async deleteUser(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return;
      const userId = parseInt(String(req.params.id), 10);
      const result = await UsersService.deleteUser(userId, req.user.id);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}
