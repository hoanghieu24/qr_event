import { Request, Response } from 'express';
import { SubscriptionsService } from './subscriptions.service';

export class SubscriptionsController {
  static async listPlans(req: Request, res: Response) {
    try {
      const tenantId = req.user?.tenantId ? Number(req.user.tenantId) : null;
      res.json({ success: true, data: await SubscriptionsService.listPlans(tenantId, req.user?.type !== 'ADMIN') });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async savePlan(req: Request, res: Response) {
    try {
      res.status(req.body.id ? 200 : 201).json({ success: true, data: await SubscriptionsService.savePlan(req.body) });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async requests(req: Request, res: Response) {
    try {
      res.json({ success: true, data: await SubscriptionsService.listRequests(req.query.status as string | undefined) });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async createRequest(req: Request, res: Response) {
    try {
      const planId = Number(req.body.plan_id);
      if (!Number.isInteger(planId) || planId < 1) {
        res.status(400).json({ success: false, message: 'Vui lòng chọn gói dịch vụ.' });
        return;
      }
      res.status(201).json({ success: true, data: await SubscriptionsService.createRequest(Number(req.user!.tenantId), planId) });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async reviewRequest(req: Request, res: Response) {
    try {
      const { status, review_note } = req.body;
      if (!['APPROVED', 'REJECTED'].includes(status)) {
        res.status(400).json({ success: false, message: 'Trạng thái duyệt không hợp lệ.' });
        return;
      }
      res.json({ success: true, data: await SubscriptionsService.reviewRequest(Number(req.params.id), req.user!.id, status, review_note) });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}
