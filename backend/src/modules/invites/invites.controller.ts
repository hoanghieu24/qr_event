import { Request, Response, NextFunction } from 'express';
import { InvitesService } from './invites.service';

export class InvitesController {
  static async createInviteLink(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return;
      const { event_id, expires_in_days, max_registrations, referrer_id } = req.body;
      if (!event_id) {
        res.status(400).json({ success: false, message: 'Vui lòng chọn sự kiện.' });
        return;
      }

      const isAdmin = req.user.type === 'ADMIN' || req.user.type === 'TENANT_ADMIN';
      const targetReferrerId = (isAdmin && referrer_id) ? parseInt(referrer_id, 10) : req.user.id;

      const invite = await InvitesService.createInviteLink({
        event_id: parseInt(event_id, 10),
        referrer_id: targetReferrerId,
        expires_in_days: expires_in_days ? parseInt(expires_in_days, 10) : 30,
        max_registrations: max_registrations ? parseInt(max_registrations, 10) : undefined,
        is_admin: isAdmin,
      });

      res.status(201).json({ success: true, data: invite });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getQuota(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return;
      const eventId = parseInt(String(req.query.event_id), 10);
      if (!eventId) {
        res.status(400).json({ success: false, message: 'Thiếu event_id.' });
        return;
      }
      const quota = await InvitesService.getStaffQuotaForEvent(eventId, req.user.id);
      res.json({ success: true, data: quota });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async verifyToken(req: Request, res: Response, next: NextFunction) {
    try {
      const token = String(req.params.token);
      const invite = await InvitesService.verifyInviteToken(token);
      res.json({
        success: true,
        data: {
          token: invite.token,
          event: {
            id: invite.event_id,
            name: invite.event_name,
            description: invite.event_description,
            location: invite.event_location,
            poster_url: invite.event_poster,
            start_at: invite.event_start_at,
            end_at: invite.event_end_at,
          },
          referrer: {
            id: invite.referrer_id,
            name: invite.referrer_name,
            phone: invite.referrer_phone,
            email: invite.referrer_email,
          },
          expires_at: invite.expires_at,
        },
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getMyLinks(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return;
      const links = await InvitesService.getMyInviteLinks(req.user.id);
      res.json({ success: true, data: links });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}
