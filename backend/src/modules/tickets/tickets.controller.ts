import { Request, Response, NextFunction } from 'express';
import { TicketsService } from './tickets.service';

export class TicketsController {
  static async getMyTicket(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return;
      const data = await TicketsService.getAllCustomerTickets(req.user.id);
      res.json({
        success: true,
        data: {
          tickets: data.tickets,
          pending: data.pending,
          primary_ticket: data.tickets[0] || null,
        },
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getMyTickets(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) return;
      const data = await TicketsService.getAllCustomerTickets(req.user.id);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getQrImage(req: Request, res: Response, next: NextFunction) {
    try {
      const code = String(req.params.code);
      const qrDataUrl = await TicketsService.generateQrDataUrl(code);
      res.json({ success: true, qr_data_url: qrDataUrl });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}
