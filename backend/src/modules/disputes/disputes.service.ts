import { query, withTransaction } from '../../config/database';
import { Realtime } from '../../realtime/socket';

export class DisputesService {
  // Check-in staff creates a dispute when QR is ALREADY_USED
  static async createDispute(data: {
    scan_log_id: number;
    ticket_id: number;
    claimant_name: string;
    claimant_phone: string;
    explanation: string;
    recorded_by: number;
  }) {
    const res: any = await query(
      `INSERT INTO disputes (scan_log_id, ticket_id, claimant_name, claimant_phone, explanation, recorded_by, decision)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
      [
        data.scan_log_id,
        data.ticket_id,
        data.claimant_name,
        data.claimant_phone,
        data.explanation,
        data.recorded_by,
      ]
    );

    try {
      Realtime.emitDisputeUpdated({
        disputeId: res.insertId,
        ticketId: data.ticket_id,
        status: 'PENDING',
        action: 'CREATED',
      });
    } catch (e) {
      console.warn('[Realtime] Dispute emit failed:', e);
    }

    return {
      id: res.insertId,
      status: 'PENDING',
      message: 'Đã tiếp nhận giải trình và chuyển cho bộ phận Quản lý khách hàng xử lý.',
    };
  }

  // List all disputes scoped by user role/tenant
  static async listDisputes(eventId?: number, decision?: string, user?: any) {
    let sql = `
      SELECT d.*, 
             t.code as ticket_code, t.used_at as first_used_at, t.event_id,
             e.name as event_name, e.tenant_id,
             r_staff.name as recorder_name,
             d_staff.name as decider_name,
             reg.full_name as original_attendee_name, reg.phone as original_phone,
             u_ref.name as referrer_name
      FROM disputes d
      JOIN tickets t ON d.ticket_id = t.id
      JOIN events e ON t.event_id = e.id
      JOIN registrations reg ON t.registration_id = reg.id
      LEFT JOIN users u_ref ON reg.referrer_id = u_ref.id
      LEFT JOIN users r_staff ON d.recorded_by = r_staff.id
      LEFT JOIN users d_staff ON d.decided_by = d_staff.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (user && user.type !== 'ADMIN') {
      if (user.tenantId) {
        sql += ' AND e.tenant_id = ?';
        params.push(user.tenantId);
      } else if (user.type === 'STAFF') {
        sql += ` AND (d.recorded_by = ? OR EXISTS (
          SELECT 1 FROM staff_event_quotas seq
          WHERE seq.event_id = e.id AND seq.staff_id = ? AND seq.is_enabled = 1
        ))`;
        params.push(user.id, user.id);
      }
    }

    if (eventId) {
      sql += ' AND t.event_id = ?';
      params.push(eventId);
    }

    if (decision) {
      sql += ' AND d.decision = ?';
      params.push(decision);
    }

    sql += ' ORDER BY d.id DESC';

    return await query(sql, params);
  }

  // Resolve dispute (ALLOW or DENY manual entry)
  static async resolveDispute(
    disputeId: number,
    decidedBy: number,
    decision: 'ALLOW' | 'DENY',
    decisionNote?: string
  ) {
    const disputes = await query<any[]>('SELECT * FROM disputes WHERE id = ?', [disputeId]);
    if (disputes.length === 0) {
      throw new Error('Hồ sơ giải trình không tồn tại.');
    }

    const disp = disputes[0];
    if (disp.decision !== 'PENDING') {
      throw new Error('Ca này đã được đưa ra quyết định xử lý trước đó.');
    }

    return await withTransaction(async (conn) => {
      await conn.query(
        `UPDATE disputes 
         SET decision = ?, decision_note = ?, decided_by = ?, decided_at = NOW()
         WHERE id = ?`,
        [decision, decisionNote || null, decidedBy, disputeId]
      );

      // Audit Log
      await conn.query(
        `INSERT INTO audit_logs (user_id, action, entity, entity_id, details)
         VALUES (?, ?, 'disputes', ?, ?)`,
        [
          decidedBy,
          `DISPUTE_${decision}`,
          disputeId,
          JSON.stringify({ decision, note: decisionNote, ticket_id: disp.ticket_id }),
        ]
      );

      try {
        Realtime.emitDisputeUpdated({
          disputeId,
          ticketId: disp.ticket_id,
          status: decision,
          action: 'RESOLVED',
        });
      } catch (e) {
        console.warn('[Realtime] Dispute resolve emit failed:', e);
      }

      return {
        id: disputeId,
        decision,
        message: decision === 'ALLOW' 
          ? 'Đã duyệt: Cho phép khách vào cổng thủ công.' 
          : 'Đã từ chối: Không cho phép khách vào cổng.',
      };
    });
  }
}
