import { Request, Response, NextFunction } from 'express';
import { RegistrationsService } from './registrations.service';

export class RegistrationsController {
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Vui lòng đăng nhập trước khi đăng ký.' });
        return;
      }
      const { token, full_name, phone, email, address } = req.body;
      if (!token || !full_name || !phone || !email) {
        res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ họ tên, SĐT và email.' });
        return;
      }

      const result = await RegistrationsService.register(req.user.id, {
        token,
        full_name,
        phone,
        email,
        address,
      });

      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async listRegistrations(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return;
      const eventId = req.query.event_id ? parseInt(req.query.event_id as string, 10) : undefined;
      const status = req.query.status as string | undefined;

      const list = await RegistrationsService.listRegistrations(req.user, eventId, status);
      res.json({ success: true, data: list });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async approve(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return;
      const regId = parseInt(String(req.params.id), 10);
      const result = await RegistrationsService.approveRegistration(regId, req.user);
      res.json({ success: true, data: result });
    } catch (error: any) {
      const statusCode = error.message.includes('Từ chối truy cập') ? 403 : 400;
      res.status(statusCode).json({ success: false, message: error.message });
    }
  }

  static async reject(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return;
      const regId = parseInt(String(req.params.id), 10);
      const { reason } = req.body;
      const result = await RegistrationsService.rejectRegistration(regId, req.user, reason);
      res.json({ success: true, data: result });
    } catch (error: any) {
      const statusCode = error.message.includes('Từ chối truy cập') ? 403 : 400;
      res.status(statusCode).json({ success: false, message: error.message });
    }
  }
}
