import QRCode from 'qrcode';
import { query } from '../../config/database';

export class TicketsService {
  // Get customer's ticket for an event
  static async getCustomerTicket(customerId: number, eventId?: number) {
    let sql = `
      SELECT t.id, t.code, t.status, t.used_at, t.created_at,
             e.id as event_id, e.name as event_name, e.location as event_location,
             e.start_at as event_start_at, e.end_at as event_end_at, e.poster_url as event_poster,
             r.full_name, r.phone, r.email,
             u_ref.name as referrer_name
      FROM tickets t
      JOIN registrations r ON t.registration_id = r.id
      JOIN events e ON t.event_id = e.id
      JOIN users u_ref ON r.referrer_id = u_ref.id
      WHERE r.customer_id = ?
    `;
    const params: any[] = [customerId];

    if (eventId) {
      sql += ' AND t.event_id = ?';
      params.push(eventId);
    }

    sql += ' ORDER BY t.id DESC LIMIT 1';

    const rows = await query<any[]>(sql, params);
    if (rows.length === 0) {
      return null;
    }

    const ticket = rows[0];
    // Generate QR Code data URL (Data URI PNG)
    const qrDataUrl = await QRCode.toDataURL(ticket.code, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 320,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });

    return {
      ...ticket,
      qr_image: qrDataUrl,
    };
  }

  // Get all tickets and pending registrations for customer
  static async getAllCustomerTickets(customerId: number) {
    const sql = `
      SELECT t.id, t.code, t.status, t.used_at, t.created_at,
             e.id as event_id, e.name as event_name, e.location as event_location,
             e.start_at as event_start_at, e.end_at as event_end_at, e.poster_url as event_poster,
             r.id as registration_id, r.full_name, r.phone, r.email,
             u_ref.name as referrer_name, u_ref.phone as referrer_phone
      FROM tickets t
      JOIN registrations r ON t.registration_id = r.id
      JOIN events e ON t.event_id = e.id
      JOIN users u_ref ON r.referrer_id = u_ref.id
      WHERE r.customer_id = ?
      ORDER BY t.id DESC
    `;
    const rows = await query<any[]>(sql, [customerId]);

    const tickets = await Promise.all(
      rows.map(async (ticket) => {
        const qrDataUrl = await QRCode.toDataURL(ticket.code, {
          errorCorrectionLevel: 'H',
          margin: 2,
          width: 360,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
        });
        return {
          ...ticket,
          qr_image: qrDataUrl,
        };
      })
    );

    // Also get registrations without ticket (e.g. PENDING, PENDING_ADMIN)
    const pendingSql = `
      SELECT r.id as registration_id, r.status as registration_status, r.created_at,
             e.id as event_id, e.name as event_name, e.location as event_location,
             e.start_at as event_start_at, e.end_at as event_end_at,
             u_ref.name as referrer_name, u_ref.phone as referrer_phone
      FROM registrations r
      JOIN events e ON r.event_id = e.id
      JOIN users u_ref ON r.referrer_id = u_ref.id
      WHERE r.customer_id = ? AND r.id NOT IN (SELECT registration_id FROM tickets WHERE registration_id IS NOT NULL)
      ORDER BY r.id DESC
    `;
    const pendingRows = await query<any[]>(pendingSql, [customerId]);

    return {
      tickets,
      pending: pendingRows,
    };
  }

  // Generate QR image data URL for any code
  static async generateQrDataUrl(code: string): Promise<string> {
    return await QRCode.toDataURL(code, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 320,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });
  }
}
