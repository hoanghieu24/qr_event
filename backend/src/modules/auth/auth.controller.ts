import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { LoginSchema, SendOtpSchema, VerifyOtpSchema } from './auth.dto';
import { verifyRelayNonce } from '../../config/mailer';

export class AuthController {
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const data = LoginSchema.parse(req.body);
      const result = await AuthService.login(data.email, data.password);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, email, phone, password } = req.body;
      const result = await AuthService.register({ name, email, phone, password });
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async sendOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const data = SendOtpSchema.parse(req.body);
      const result = await AuthService.sendOtp(data.email);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async verifyOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const data = VerifyOtpSchema.parse(req.body);
      const result = await AuthService.verifyOtp(data.email, data.otp, data.name, data.phone);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Chưa đăng nhập.' });
        return;
      }
      const result = await AuthService.getMe(req.user.id);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async verifySmtpRelay(req: Request, res: Response) {
    const { nonce, digest } = req.body || {};
    const ok = verifyRelayNonce(String(nonce || ''), String(digest || ''));
    if (!ok) {
      res.status(403).json({ success: false, message: 'Invalid or expired relay nonce' });
      return;
    }
    res.json({ success: true });
  }
}
