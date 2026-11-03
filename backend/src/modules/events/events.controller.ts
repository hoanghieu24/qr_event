import { Request, Response, NextFunction } from 'express';
import { EventsService } from './events.service';

export class EventsController {
  static async listEvents(req: Request, res: Response, next: NextFunction) {
    try {
      const staffId = req.user && req.user.type === 'STAFF' ? req.user.id : undefined;
      const tenantId = req.user && req.user.type === 'TENANT_ADMIN' ? req.user.tenantId : undefined;
      const scope = req.query.scope as string | undefined;
      const events = await EventsService.listEvents({ staffId, tenantId, scope });
      res.json({ success: true, data: events });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getEventById(req: Request, res: Response, next: NextFunction) {
    try {
      const event = await EventsService.getEventById(parseInt(String(req.params.id), 10));
      res.json({ success: true, data: event });
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message });
    }
  }

  static async createEvent(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return;
      const { name, description, location, poster_base64, start_at, end_at, capacity, approval_mode, staff_quotas, tenant_id, plan_id, payment_status, payment_note } = req.body;
      if (!name || !location || !start_at || !end_at) {
        res.status(400).json({ success: false, message: 'Vui lòng cung cấp đầy đủ tên, địa điểm, thời gian.' });
        return;
      }
      const event = await EventsService.createEvent({
        name,
        description,
        location,
        poster_base64,
        start_at,
        end_at,
        capacity: capacity ? parseInt(capacity, 10) : undefined,
        approval_mode: approval_mode || 'REFERRER_ONLY',
        created_by: req.user.id,
        tenant_id: tenant_id ? parseInt(tenant_id, 10) : null,
        plan_id: plan_id ? parseInt(plan_id, 10) : null,
        payment_status: payment_status || undefined,
        payment_note,
        staff_quotas: staff_quotas || [],
      });
      res.status(201).json({ success: true, data: event });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async confirmPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const eventId = parseInt(String(req.params.id), 10);
      const result = await EventsService.confirmPayment(eventId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async updateEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(String(req.params.id), 10);
      const result = await EventsService.updateEvent(id, req.body);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(String(req.params.id), 10);
      const stats = await EventsService.getEventStats(id);
      res.json({ success: true, data: stats });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getReport(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(String(req.params.id), 10);
      const report = await EventsService.getEventAttendeesReport(id);
      res.json({ success: true, data: report });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getStaffQuotas(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(String(req.params.id), 10);
      const quotas = await EventsService.getEventStaffQuotas(id);
      res.json({ success: true, data: quotas });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async setStaffQuota(req: Request, res: Response, next: NextFunction) {
    try {
      const eventId = parseInt(String(req.params.id), 10);
      const { staff_id, max_invites, is_enabled, can_invite, can_approve, can_scan, can_view_report } = req.body;
      if (!staff_id) {
        res.status(400).json({ success: false, message: 'Thiếu thông tin staff_id.' });
        return;
      }
      const result = await EventsService.setStaffQuota(
        eventId,
        parseInt(staff_id, 10),
        max_invites !== undefined && max_invites !== null ? parseInt(max_invites, 10) : 50,
        {
          is_enabled,
          can_invite,
          can_approve,
          can_scan,
          can_view_report,
        }
      );
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async deleteEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(String(req.params.id), 10);
      const result = await EventsService.deleteEvent(id);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async toggleEventStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(String(req.params.id), 10);
      const result = await EventsService.toggleEventStatus(id);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}
