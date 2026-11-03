import { Request, Response, NextFunction } from 'express';
import { CheckinService } from './checkin.service';

export class CheckinController {
  static async scan(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return;
      const { code, event_id, device_info, lat, lng } = req.body;
      if (!code || !event_id) {
        res.status(400).json({ success: false, message: 'Vui lòng cung cấp mã QR và ID sự kiện.' });
        return;
      }

      const ip = req.ip || req.socket.remoteAddress;
      const result = await CheckinService.scanQr(
        req.user.id,
        parseInt(event_id, 10),
        code,
        device_info,
        ip,
        lat !== undefined ? Number(lat) : undefined,
        lng !== undefined ? Number(lng) : undefined,
        req.user.type === 'ADMIN'
      );

      if (result.result === 'INVALID') {
        res.status(400).json({ success: false, data: result });
      } else {
        res.json({ success: true, data: result });
      }
    } catch (error: any) {
      res.status(error.message.includes('chưa được phân quyền') ? 403 : 500).json({ success: false, message: error.message });
    }
  }

  static async getOfflineCache(req: Request, res: Response) {
    try {
      const eventId = parseInt(String(req.query.event_id), 10);
      if (!eventId) {
        res.status(400).json({ success: false, message: 'Vui lòng cung cấp ID sự kiện.' });
        return;
      }

      if (!req.user) return;
      const tickets = await CheckinService.getOfflineCache(eventId, req.user.id, req.user.type === 'ADMIN');
      res.json({ success: true, data: tickets });
    } catch (error: any) {
      res.status(error.message.includes('chưa được phân quyền') ? 403 : 500).json({ success: false, message: error.message });
    }
  }

  static async syncBatch(req: Request, res: Response) {
    try {
      if (!req.user) return;
      const { event_id, scans } = req.body;
      if (!event_id || !Array.isArray(scans)) {
        res.status(400).json({ success: false, message: 'Vui lòng cung cấp danh sách quét ngoại tuyến (scans).' });
        return;
      }

      const ip = req.ip || req.socket.remoteAddress;
      const result = await CheckinService.syncBatch(
        req.user.id,
        parseInt(event_id, 10),
        scans,
        ip,
        req.user.type === 'ADMIN'
      );

      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(error.message.includes('chưa được phân quyền') ? 403 : 500).json({ success: false, message: error.message });
    }
  }

  static async getRecentLogs(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return;
      const eventId = parseInt(String(req.params.eventId), 10);
      const logs = await CheckinService.getRecentLogs(eventId, req.user.id, req.user.type === 'ADMIN');
      res.json({ success: true, data: logs });
    } catch (error: any) {
      res.status(error.message.includes('chưa được phân quyền') ? 403 : 400).json({ success: false, message: error.message });
    }
  }
}
