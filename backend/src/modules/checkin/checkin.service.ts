import { query, withTransaction } from '../../config/database';
import { Realtime } from '../../realtime/socket';

export interface ScanResult {
  result: 'SUCCESS' | 'ALREADY_USED' | 'INVALID';
  message: string;
  scan_log_id?: number;
  ticket?: {
    id: number;
    code: string;
    status: string;
    used_at?: string;
    first_scanner?: string;
  };
  attendee?: {
    full_name: string;
    phone: string;
    email: string;
    address?: string;
    approved_at?: string;
  };
  referrer?: {
    name: string;
    phone?: string;
    email: string;
  };
  event?: {
    id: number;
    name: string;
    location: string;
  };
}

export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export class CheckinService {
  static async scanQr(
    staffId: number,
    eventId: number,
    code: string,
    deviceInfo?: string,
    ipAddress?: string,
    clientLat?: number,
    clientLng?: number,
    isAdmin = false
  ): Promise<ScanResult> {
    await this.requireCanScan(staffId, eventId, isAdmin);
    let cleanCode = code.trim();
    const tktMatch = cleanCode.match(/TKT-\d+-[A-Z0-9]+-[A-Z0-9]+/i);
    if (tktMatch) {
      cleanCode = tktMatch[0].toUpperCase();
    } else {
      cleanCode = cleanCode.toUpperCase();
    }

    return await withTransaction(async (conn) => {
      // 1. ATOMIC CONDITIONAL UPDATE:
      // Uses InnoDB row-level locking. Only one concurrent scan can match status = 'ISSUED'.
      const [updateRes]: any = await conn.query(
        `UPDATE tickets 
         SET status = 'USED', used_at = NOW(), used_by = ? 
         WHERE code = ? AND event_id = ? AND status = 'ISSUED'`,
        [staffId, cleanCode, eventId]
      );

      if (updateRes.affectedRows === 1) {
        // === SUCCESS (GREEN) ===
        const [rows]: any = await conn.query(
          `SELECT t.id as ticket_id, t.code, t.status, t.used_at,
                  r.customer_id, r.referrer_id, r.session_type,
                  r.full_name, r.phone, r.email, r.address, r.approved_at,
                  u_ref.name as referrer_name, u_ref.phone as referrer_phone, u_ref.email as referrer_email,
                  e.id as event_id, e.name as event_name, e.location as event_location
           FROM tickets t
           JOIN registrations r ON t.registration_id = r.id
           JOIN events e ON t.event_id = e.id
           LEFT JOIN users u_ref ON r.referrer_id = u_ref.id
           WHERE t.code = ? AND t.event_id = ?`,
          [cleanCode, eventId]
        );

        const data = rows[0];

        // Record scan log
        const [logRes]: any = await conn.query(
          `INSERT INTO scan_logs (ticket_id, event_id, scanned_code, scanned_by, result, device_info, ip_address)
           VALUES (?, ?, ?, ?, 'SUCCESS', ?, ?)`,
          [data.ticket_id, eventId, cleanCode, staffId, deviceInfo || 'Camera Scanner', ipAddress || '127.0.0.1']
        );

        // Fetch scanner name & emit realtime event
        const [staffRows]: any = await conn.query('SELECT name FROM users WHERE id = ?', [staffId]);
        const scannerName = staffRows[0]?.name || 'Nhân viên soát vé';

        try {
          Realtime.emitScanRecorded({
            eventId: data.event_id,
            eventName: data.event_name,
            ticketId: data.ticket_id,
            code: data.code,
            customerId: data.customer_id,
            customerName: data.full_name,
            customerPhone: data.phone,
            referrerId: data.referrer_id,
            referrerName: data.referrer_name,
            staffId: staffId,
            staffName: scannerName,
            result: 'SUCCESS',
            usedAt: data.used_at ? new Date(data.used_at).toISOString() : new Date().toISOString(),
          });
        } catch (emitErr) {
          console.warn('[Realtime] Failed to emit scan result:', emitErr);
        }

        return {
          result: 'SUCCESS',
          message: 'CHECK-IN THÀNH CÔNG! Chào mừng quý khách.',
          scan_log_id: logRes.insertId,
          ticket: {
            id: data.ticket_id,
            code: data.code,
            status: data.status,
            used_at: data.used_at,
          },
          attendee: {
            full_name: data.full_name,
            phone: data.phone,
            email: data.email,
            address: data.address,
            session_type: data.session_type || 'FULL_DAY',
            approved_at: data.approved_at,
          },
          referrer: {
            name: data.referrer_name,
            phone: data.referrer_phone,
            email: data.referrer_email,
          },
          event: {
            id: data.event_id,
            name: data.event_name,
            location: data.event_location,
          },
        };
      }

      // If affectedRows === 0, investigate why: ALREADY_USED or INVALID
      const [ticketRows]: any = await conn.query(
        `SELECT t.id as ticket_id, t.code, t.status, t.used_at, t.used_by,
                u_staff.name as first_scanner_name,
                r.customer_id, r.referrer_id, r.session_type,
                r.full_name, r.phone, r.email, r.address, r.approved_at,
                u_ref.name as referrer_name, u_ref.phone as referrer_phone, u_ref.email as referrer_email,
                e.id as event_id, e.name as event_name, e.location as event_location
         FROM tickets t
         LEFT JOIN users u_staff ON t.used_by = u_staff.id
         JOIN registrations r ON t.registration_id = r.id
         JOIN events e ON t.event_id = e.id
         LEFT JOIN users u_ref ON r.referrer_id = u_ref.id
         WHERE t.code = ? AND t.event_id = ?
         FOR UPDATE`,
        [cleanCode, eventId]
      );

      if (ticketRows.length > 0 && ticketRows[0].status === 'USED') {
        const data = ticketRows[0];

        // Record scan log
        const [logRes]: any = await conn.query(
          `INSERT INTO scan_logs (ticket_id, event_id, scanned_code, scanned_by, result, device_info, ip_address)
           VALUES (?, ?, ?, ?, 'ALREADY_USED', ?, ?)`,
          [data.ticket_id, eventId, cleanCode, staffId, deviceInfo || 'Camera Scanner', ipAddress || '127.0.0.1']
        );

        const [staffRows]: any = await conn.query('SELECT name FROM users WHERE id = ?', [staffId]);
        const scannerName = staffRows[0]?.name || 'Nhân viên soát vé';

        try {
          Realtime.emitScanRecorded({
            eventId: data.event_id,
            eventName: data.event_name,
            ticketId: data.ticket_id,
            code: data.code,
            customerId: data.customer_id,
            customerName: data.full_name,
            customerPhone: data.phone,
            referrerId: data.referrer_id,
            referrerName: data.referrer_name,
            staffId: staffId,
            staffName: scannerName,
            result: 'ALREADY_USED',
            usedAt: new Date().toISOString(),
          });
        } catch (emitErr) {
          console.warn('[Realtime] Failed to emit already_used result:', emitErr);
        }

        return {
          result: 'ALREADY_USED',
          message: 'CẢNH BÁO: MÃ QR NÀY ĐÃ ĐƯỢC CHECK-IN TRƯỚC ĐÓ!',
          scan_log_id: logRes.insertId,
          ticket: {
            id: data.ticket_id,
            code: data.code,
            status: data.status,
            used_at: data.used_at,
            first_scanner: data.first_scanner_name,
          },
          attendee: {
            full_name: data.full_name,
            phone: data.phone,
            email: data.email,
            address: data.address,
            session_type: data.session_type || 'FULL_DAY',
            approved_at: data.approved_at,
          },
          referrer: {
            name: data.referrer_name,
            phone: data.referrer_phone,
            email: data.referrer_email,
          },
          event: {
            id: data.event_id,
            name: data.event_name,
            location: data.event_location,
          },
        };
      }

      // === INVALID (RED) ===
      // Check if this ticket actually belongs to a different event so we can give a clear message
      const [otherEventRows]: any = await conn.query(
        `SELECT e.name as event_name FROM tickets t JOIN events e ON t.event_id = e.id WHERE t.code = ? LIMIT 1`,
        [cleanCode]
      );
      const invalidMsg = otherEventRows.length > 0
        ? `Vé này thuộc sự kiện "${otherEventRows[0].event_name}", không phải sự kiện đang chọn!`
        : 'MÃ QR KHÔNG HỢP LỆ HOẶC KHÔNG THUỘC SỰ KIỆN NÀY!';

      const [logRes]: any = await conn.query(
        `INSERT INTO scan_logs (ticket_id, event_id, scanned_code, scanned_by, result, device_info, ip_address)
         VALUES (NULL, ?, ?, ?, 'INVALID', ?, ?)`,
        [eventId, cleanCode, staffId, deviceInfo || 'Camera Scanner', ipAddress || '127.0.0.1']
      );

      return {
        result: 'INVALID',
        message: invalidMsg,
        scan_log_id: logRes.insertId,
      };
    });
  }

  // Pre-fetch cache for Offline Mode
  static async getOfflineCache(eventId: number, staffId: number, isAdmin = false) {
    await this.requireCanScan(staffId, eventId, isAdmin);
    return await query(`
      SELECT t.id as ticket_id, t.code, t.status, t.used_at,
             r.full_name, r.phone, r.email, r.session_type,
             u_ref.name as referrer_name
      FROM tickets t
      JOIN registrations r ON t.registration_id = r.id
      LEFT JOIN users u_ref ON r.referrer_id = u_ref.id
      WHERE t.event_id = ?
    `, [eventId]);
  }

  // Batch sync offline scans back to server
  static async syncBatch(staffId: number, eventId: number, scans: any[], ipAddress?: string, isAdmin = false) {
    const results = [];
    let syncedSuccess = 0;
    let alreadyUsed = 0;
    let invalid = 0;

    for (const item of scans) {
      try {
        const res = await this.scanQr(
          staffId,
          eventId,
          item.code,
          item.device_info || 'Offline Auto-Sync',
          ipAddress,
          item.lat,
          item.lng,
          isAdmin
        );
        if (res.result === 'SUCCESS') syncedSuccess++;
        else if (res.result === 'ALREADY_USED') alreadyUsed++;
        else invalid++;
        results.push({ code: item.code, ...res });
      } catch (err: any) {
        invalid++;
        results.push({ code: item.code, result: 'INVALID', message: err.message });
      }
    }

    return {
      total: scans.length,
      synced_success: syncedSuccess,
      already_used: alreadyUsed,
      invalid,
      results,
    };
  }

  // Get recent scan logs for event
  static async getRecentLogs(eventId: number, staffId: number, isAdmin = false, limit = 50) {
    await this.requireCanScan(staffId, eventId, isAdmin);
    return await query(`
      SELECT sl.*, u.name as scanner_name, t.code as ticket_code,
             r.full_name as attendee_name, r.session_type as attendee_session_type
      FROM scan_logs sl
      JOIN users u ON sl.scanned_by = u.id
      LEFT JOIN tickets t ON sl.ticket_id = t.id
      LEFT JOIN registrations r ON t.registration_id = r.id
      WHERE sl.event_id = ?
      ORDER BY sl.scanned_at DESC
      LIMIT ?
    `, [eventId, limit]);
  }

  private static async requireCanScan(staffId: number, eventId: number, isAdmin: boolean) {
    if (isAdmin) return;

    // Check if user is owner of the event's tenant or creator of the event
    const events = await query<any[]>('SELECT tenant_id, created_by FROM events WHERE id = ?', [eventId]);
    if (events?.length) {
      if (events[0].created_by && Number(events[0].created_by) === Number(staffId)) return;
      if (events[0].tenant_id) {
        const owners = await query<any[]>(
          "SELECT 1 FROM tenant_users WHERE tenant_id = ? AND user_id = ? AND role = 'OWNER'",
          [events[0].tenant_id, staffId]
        );
        if (owners.length > 0) return;
      }
    }

    const rows = await query<any[]>(
      `SELECT can_scan FROM staff_event_quotas
       WHERE event_id = ? AND staff_id = ? AND is_enabled = 1 LIMIT 1`,
      [eventId, staffId]
    );
    if (!rows[0]?.can_scan) throw new Error('Bạn chưa được phân quyền quét QR trong sự kiện này.');
  }
}
