import { Request, Response, NextFunction } from 'express';
import { DisputesService } from './disputes.service';

export class DisputesController {
  // Check-in staff records a dispute
  static async createDispute(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return;
      const { scan_log_id, ticket_id, claimant_name, claimant_phone, explanation } = req.body;
      if (!scan_log_id || !ticket_id || !claimant_name || !claimant_phone || !explanation) {
        res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ thông tin giải trình.' });
        return;
      }

      const result = await DisputesService.createDispute({
        scan_log_id: parseInt(scan_log_id, 10),
        ticket_id: parseInt(ticket_id, 10),
        claimant_name,
        claimant_phone,
        explanation,
        recorded_by: req.user.id,
      });

      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  // Customer Management, Tenant Admin, or Admin lists disputes
  static async listDisputes(req: Request, res: Response, next: NextFunction) {
    try {
      const eventId = req.query.event_id ? parseInt(req.query.event_id as string, 10) : undefined;
      const decision = req.query.decision as string | undefined;

      const list = await DisputesService.listDisputes(eventId, decision, req.user);
      res.json({ success: true, data: list });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  // Customer Management or Admin resolves dispute
  static async resolveDispute(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return;
      const disputeId = parseInt(String(req.params.id), 10);
      const { decision, decision_note } = req.body;

      if (!['ALLOW', 'DENY'].includes(decision)) {
        res.status(400).json({ success: false, message: 'Quyết định phải là ALLOW hoặc DENY.' });
        return;
      }

      const result = await DisputesService.resolveDispute(
        disputeId,
        req.user.id,
        decision,
        decision_note
      );

      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}
