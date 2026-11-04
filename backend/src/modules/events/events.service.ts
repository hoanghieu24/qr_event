import { query } from '../../config/database';
import { uploadImageToCloudinary } from '../../config/cloudinary';
import { Realtime } from '../../realtime/socket';

export class EventsService {
  static async listEvents(options?: { staffId?: number; tenantId?: number; scope?: string }) {
    const staffId = options?.staffId;
    const tenantId = options?.tenantId;
    const scope = options?.scope;

    const whereClauses: string[] = [];

    if (scope === 'active') {
      whereClauses.push("e.status = 'PUBLISHED'");
    }

    if (tenantId) whereClauses.push('e.tenant_id = ?');

    if (staffId) {
      // Staff member: must be explicitly assigned and enabled in staff_event_quotas
      const whereSql = whereClauses.length > 0 ? 'AND ' + whereClauses.join(' AND ') : '';
      return await query(`
        SELECT e.*, u.name as creator_name, tn.name as tenant_name,
          (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id) as total_registrations,
          (SELECT COUNT(*) FROM tickets t WHERE t.event_id = e.id) as total_tickets,
          (SELECT COUNT(*) FROM tickets t WHERE t.event_id = e.id AND t.status = 'USED') as total_checked_in,
          q.is_enabled as my_is_enabled,
          q.can_invite as my_can_invite,
          GREATEST(COALESCE(q.can_approve, 0), COALESCE(q.can_invite, 0)) as my_can_approve,
          q.can_scan as my_can_scan,
          q.can_view_report as my_can_view_report,
          q.max_invites as my_max_invites,
          (e.end_at < NOW()) as is_expired
        FROM events e
        JOIN users u ON e.created_by = u.id
        LEFT JOIN tenants tn ON tn.id = e.tenant_id
        JOIN staff_event_quotas q ON q.event_id = e.id AND q.staff_id = ? AND q.is_enabled = 1
        WHERE 1=1 ${whereSql}
        ORDER BY e.start_at DESC
      `, tenantId ? [staffId, tenantId] : [staffId]);
    }

    const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';
    return await query(`
      SELECT e.*, u.name as creator_name, tn.name as tenant_name,
        (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id) as total_registrations,
        (SELECT COUNT(*) FROM tickets t WHERE t.event_id = e.id) as total_tickets,
        (SELECT COUNT(*) FROM tickets t WHERE t.event_id = e.id AND t.status = 'USED') as total_checked_in,
        1 as my_can_scan,
        1 as my_can_invite,
        1 as my_can_approve,
        1 as my_can_view_report,
        (e.end_at < NOW()) as is_expired
      FROM events e
      JOIN users u ON e.created_by = u.id
      LEFT JOIN tenants tn ON tn.id = e.tenant_id
      ${whereSql}
      ORDER BY e.start_at DESC
    `, tenantId ? [tenantId] : []);
  }

  static async deleteEvent(id: number) {
    const tenantRows = await query<any[]>('SELECT tenant_id FROM events WHERE id = ? LIMIT 1', [id]);
    if (tenantRows?.[0]?.tenant_id) {
      throw new Error('Không thể xóa sự kiện của khách thuê; hãy đóng sự kiện để lưu lịch sử và hạn mức đã dùng.');
    }
    // Delete in order to satisfy FK constraints
    await query('DELETE d FROM disputes d JOIN tickets t ON d.ticket_id = t.id WHERE t.event_id = ?', [id]);
    await query('DELETE FROM scan_logs WHERE event_id = ?', [id]);
    await query('DELETE FROM tickets WHERE event_id = ?', [id]);
    await query('DELETE FROM registrations WHERE event_id = ?', [id]);
    await query('DELETE FROM invite_links WHERE event_id = ?', [id]);
    await query('DELETE FROM staff_event_quotas WHERE event_id = ?', [id]);
    const res: any = await query('DELETE FROM events WHERE id = ?', [id]);
    if (res.affectedRows === 0) {
      throw new Error('Sự kiện không tồn tại hoặc đã bị xóa trước đó.');
    }
    Realtime.emitDashboardRefresh();
    return { success: true, message: 'Đã xóa vĩnh viễn sự kiện và toàn bộ dữ liệu liên quan.' };
  }

  static async toggleEventStatus(id: number) {
    const events = await query<any[]>('SELECT id, name, status FROM events WHERE id = ?', [id]);
    if (events.length === 0) {
      throw new Error('Sự kiện không tồn tại.');
    }
    const currentStatus = events[0].status;
    const newStatus = currentStatus === 'PUBLISHED' ? 'CLOSED' : 'PUBLISHED';
    await query('UPDATE events SET status = ? WHERE id = ?', [newStatus, id]);
    if (newStatus === 'PUBLISHED') {
      await query("UPDATE invite_links SET status = 'ACTIVE' WHERE event_id = ?", [id]);
    } else {
      await query("UPDATE invite_links SET status = 'CLOSED' WHERE event_id = ? AND status = 'ACTIVE'", [id]);
    }
    Realtime.emitDashboardRefresh();
    return {
      success: true,
      status: newStatus,
      message:
        newStatus === 'PUBLISHED'
          ? `Đã bật mở lại sự kiện "${events[0].name}".`
          : `Đã tắt / đóng sự kiện "${events[0].name}".`,
    };
  }

  static async getEventById(id: number) {
    const events = await query<any[]>(
      `SELECT e.*, u.name as creator_name
       FROM events e
       JOIN users u ON e.created_by = u.id
       WHERE e.id = ?`,
      [id]
    );

    if (events.length === 0) {
      throw new Error('Sự kiện không tồn tại.');
    }
    return events[0];
  }

  static async createEvent(data: {
    name: string;
    description?: string;
    location: string;
    poster_base64?: string;
    start_at: string;
    end_at: string;
    capacity?: number;
    approval_mode?: 'REFERRER_ONLY' | 'TWO_TIER' | 'AUTO';
    latitude?: number;
    longitude?: number;
    geofence_radius_meters?: number;
    geofence_enabled?: boolean;
    created_by: number;
    tenant_id?: number | null;
    plan_id?: number | null;
    payment_status?: 'PAID' | 'PENDING_PAYMENT';
    payment_note?: string;
    staff_quotas?: {
      staff_id: number;
      max_invites?: number;
      is_enabled?: boolean;
      can_invite?: boolean;
      can_approve?: boolean;
      can_scan?: boolean;
      can_view_report?: boolean;
    }[];
  }) {
    let posterUrl = null;
    if (data.poster_base64) {
      posterUrl = await uploadImageToCloudinary(data.poster_base64, 'events');
    }

    let packageName: string | null = null;
    let maxEmployees = 10;
    let maxReferrers = 10;
    let maxScanners = 10;
    let packagePriceVnd = 0;
    let isTrial = 0;
    let capacity = data.capacity || 500;

    if (data.tenant_id) {
      const [tenants]: any = await query("SELECT id, name FROM tenants WHERE id = ? AND status = 'ACTIVE'", [data.tenant_id]);
      if (!tenants) throw new Error('Khách thuê không tồn tại hoặc đang bị khóa.');

      if (data.plan_id) {
        const [plans]: any = await query('SELECT * FROM subscription_plans WHERE id = ?', [data.plan_id]);
        if (plans) {
          packageName = plans.name;
          maxEmployees = plans.max_employees;
          maxReferrers = plans.max_referrers;
          maxScanners = plans.max_scanners;
          packagePriceVnd = Number(plans.price_vnd) || 0;
          isTrial = plans.is_trial ? 1 : 0;
          if (!data.capacity) capacity = plans.max_attendees;
        }
      }
    }

    const paymentStatus = data.payment_status || (isTrial || packagePriceVnd === 0 ? 'PAID' : 'PENDING_PAYMENT');
    const paidAt = paymentStatus === 'PAID' ? new Date() : null;

    const res: any = await query(
      `INSERT INTO events (name, description, location, poster_url, start_at, end_at, capacity, approval_mode, latitude, longitude, geofence_radius_meters, geofence_enabled, status, created_by, tenant_id, package_name, max_employees, max_referrers, max_scanners, package_price_vnd, is_trial, payment_status, payment_note, paid_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PUBLISHED', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        data.description || null,
        data.location,
        posterUrl,
        data.start_at,
        data.end_at,
        capacity,
        data.approval_mode || 'REFERRER_ONLY',
        data.latitude || null,
        data.longitude || null,
        data.geofence_radius_meters || 0,
        0,
        data.created_by,
        data.tenant_id || null,
        packageName,
        maxEmployees,
        maxReferrers,
        maxScanners,
        packagePriceVnd,
        isTrial,
        paymentStatus,
        data.payment_note || null,
        paidAt,
      ]
    );

    const eventId = res.insertId;

    if (data.tenant_id && data.plan_id) {
      await query(
        `INSERT INTO subscription_requests (tenant_id, plan_id, event_credits, validity_days, package_name, max_attendees, max_employees, max_referrers, max_scanners, price_vnd, status, event_id, reviewed_at)
         VALUES (?, ?, 1, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.tenant_id,
          data.plan_id,
          packageName,
          capacity,
          maxEmployees,
          maxReferrers,
          maxScanners,
          packagePriceVnd,
          paymentStatus === 'PAID' ? 'APPROVED' : 'PENDING',
          eventId,
          paymentStatus === 'PAID' ? new Date() : null,
        ]
      );
    }

    if (data.staff_quotas && Array.isArray(data.staff_quotas)) {
      for (const sq of data.staff_quotas) {
        if (sq.staff_id) {
          await this.setStaffQuota(
            eventId,
            Number(sq.staff_id),
            sq.max_invites !== undefined && sq.max_invites !== null ? Number(sq.max_invites) : 50,
            {
              is_enabled: sq.is_enabled,
              can_invite: sq.can_invite,
              can_approve: sq.can_approve,
              can_scan: sq.can_scan,
              can_view_report: sq.can_view_report,
            }
          );
        }
      }
    }

    Realtime.emitDashboardRefresh();
    return {
      id: eventId,
      ...data,
      capacity,
      package_name: packageName,
      package_price_vnd: packagePriceVnd,
      payment_status: paymentStatus,
      paid_at: paidAt,
      poster_url: posterUrl
    };
  }

  static async confirmPayment(eventId: number) {
    await query("UPDATE events SET payment_status = 'PAID', paid_at = NOW() WHERE id = ?", [eventId]);
    await query("UPDATE subscription_requests SET status = 'APPROVED', reviewed_at = NOW() WHERE event_id = ?", [eventId]);
    Realtime.emitDashboardRefresh();
    return { success: true, payment_status: 'PAID' };
  }

  static async updateEvent(id: number, data: any) {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.name) { fields.push('name = ?'); values.push(data.name); }
    if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
    if (data.location) { fields.push('location = ?'); values.push(data.location); }
    if (data.start_at) { fields.push('start_at = ?'); values.push(data.start_at); }
    if (data.end_at) { fields.push('end_at = ?'); values.push(data.end_at); }
    if (data.capacity) { fields.push('capacity = ?'); values.push(data.capacity); }
    if (data.approval_mode) { fields.push('approval_mode = ?'); values.push(data.approval_mode); }
    if (data.status) { fields.push('status = ?'); values.push(data.status); }
    if (data.tenant_id) throw new Error('Sự kiện của khách thuê cần được tạo trong cổng quản lý khách thuê để áp dụng hạn mức.');
    if (data.tenant_id === null) {
      const current = await query<any[]>('SELECT tenant_id FROM events WHERE id = ? LIMIT 1', [id]);
      if (current[0]?.tenant_id) throw new Error('Không thể tách sự kiện của khách thuê khỏi đơn vị quản lý. Hãy đóng sự kiện để lưu lịch sử.');
      fields.push('tenant_id = ?'); values.push(null);
    }
    if (data.latitude !== undefined) { fields.push('latitude = ?'); values.push(data.latitude || null); }
    if (data.longitude !== undefined) { fields.push('longitude = ?'); values.push(data.longitude || null); }
    if (data.geofence_radius_meters !== undefined) { fields.push('geofence_radius_meters = ?'); values.push(data.geofence_radius_meters); }
    if (data.geofence_enabled !== undefined) { fields.push('geofence_enabled = ?'); values.push(data.geofence_enabled ? 1 : 0); }
    if (data.poster_base64) {
      const url = await uploadImageToCloudinary(data.poster_base64, 'events');
      fields.push('poster_url = ?');
      values.push(url);
    }

    if (fields.length === 0) return { success: true };

    values.push(id);
    await query(`UPDATE events SET ${fields.join(', ')} WHERE id = ?`, values);
    return { success: true, message: 'Cập nhật sự kiện thành công.' };
  }

  static async getEventStats(eventId: number) {
    const statsRows: any = await query(`
      SELECT 
        (SELECT COUNT(*) FROM registrations WHERE event_id = ?) as total_registered,
        (SELECT COUNT(*) FROM registrations WHERE event_id = ? AND status = 'PENDING') as pending_approvals,
        (SELECT COUNT(*) FROM registrations WHERE event_id = ? AND status = 'PENDING_ADMIN') as pending_admin_approvals,
        (SELECT COUNT(*) FROM tickets WHERE event_id = ?) as tickets_issued,
        (SELECT COUNT(*) FROM tickets WHERE event_id = ? AND status = 'USED') as tickets_checked_in,
        (SELECT COUNT(*) FROM disputes d JOIN tickets t ON d.ticket_id = t.id WHERE t.event_id = ?) as disputes_count
      `, [eventId, eventId, eventId, eventId, eventId, eventId]);

    return statsRows && statsRows[0] ? statsRows[0] : {};
  }

  static async getEventAttendeesReport(eventId: number) {
    const event = await this.getEventById(eventId);

    const attendees = await query<any[]>(`
      SELECT 
        r.id as registration_id,
        r.full_name,
        r.phone,
        r.email,
        r.address,
        r.status as registration_status,
        r.created_at as registered_at,
        r.approved_at,
        u_ref.id as referrer_id,
        u_ref.name as referrer_name,
        u_ref.phone as referrer_phone,
        t.id as ticket_id,
        t.code as ticket_code,
        t.status as ticket_status,
        t.used_at as checked_in_at,
        u_scan.name as scanner_name
      FROM registrations r
      LEFT JOIN users u_ref ON r.referrer_id = u_ref.id
      LEFT JOIN tickets t ON r.id = t.registration_id
      LEFT JOIN users u_scan ON t.used_by = u_scan.id
      WHERE r.event_id = ?
      ORDER BY r.created_at DESC
    `, [eventId]);

    const total_registered = attendees.length;
    const total_approved = attendees.filter(a => a.registration_status === 'APPROVED' && a.ticket_id).length;
    const total_checked_in = attendees.filter(a => a.ticket_status === 'USED').length;
    const total_absent = total_approved - total_checked_in;
    const total_pending_referrer = attendees.filter(a => a.registration_status === 'PENDING').length;
    const total_pending_admin = attendees.filter(a => a.registration_status === 'PENDING_ADMIN').length;
    const attendance_rate = total_approved > 0 ? Math.round((total_checked_in / total_approved) * 1000) / 10 : 0;

    return {
      event,
      summary: {
        total_registered,
        total_approved,
        total_checked_in,
        total_absent,
        total_pending_referrer,
        total_pending_admin,
        attendance_rate,
      },
      attendees,
    };
  }

  static async getEventStaffQuotas(eventId: number) {
    const events = await query<any[]>('SELECT id, name, tenant_id FROM events WHERE id = ?', [eventId]);
    if (!events.length) throw new Error('Sự kiện không tồn tại.');
    const event = events[0];

    if (event.tenant_id) {
      // Sự kiện của Khách thuê: Chỉ lấy nhân sự thuộc khách thuê này
      return await query<any[]>(`
        SELECT u.id as staff_id, u.name as staff_name, u.email as staff_email, u.phone as staff_phone,
               COALESCE(q.max_invites, 50) as max_invites,
               COALESCE(q.is_enabled, 0) as is_enabled,
               COALESCE(q.can_invite, 1) as can_invite,
               COALESCE(q.can_approve, 0) as can_approve,
               COALESCE(q.can_scan, 0) as can_scan,
               COALESCE(q.can_view_report, 0) as can_view_report,
               (SELECT COUNT(*) FROM registrations r WHERE r.event_id = ? AND r.referrer_id = u.id) as current_registrations,
               (SELECT COUNT(*) FROM invite_links il WHERE il.event_id = ? AND il.referrer_id = u.id AND il.status = 'ACTIVE') as active_links_count
        FROM users u
        JOIN tenant_users tu ON tu.user_id = u.id AND tu.tenant_id = ?
        LEFT JOIN staff_event_quotas q ON q.event_id = ? AND q.staff_id = u.id
        WHERE u.status = 'ACTIVE'
        ORDER BY is_enabled DESC, u.name ASC
      `, [eventId, eventId, event.tenant_id, eventId]);
    } else {
      // Sự kiện nội bộ của công ty: Chỉ lấy nhân viên nội bộ công ty (STAFF không thuộc khách thuê nào)
      return await query<any[]>(`
        SELECT u.id as staff_id, u.name as staff_name, u.email as staff_email, u.phone as staff_phone,
               COALESCE(q.max_invites, 50) as max_invites,
               COALESCE(q.is_enabled, 0) as is_enabled,
               COALESCE(q.can_invite, 1) as can_invite,
               COALESCE(q.can_approve, 1) as can_approve,
               COALESCE(q.can_scan, 1) as can_scan,
               COALESCE(q.can_view_report, 1) as can_view_report,
               (SELECT COUNT(*) FROM registrations r WHERE r.event_id = ? AND r.referrer_id = u.id) as current_registrations,
               (SELECT COUNT(*) FROM invite_links il WHERE il.event_id = ? AND il.referrer_id = u.id AND il.status = 'ACTIVE') as active_links_count
        FROM users u
        LEFT JOIN staff_event_quotas q ON q.event_id = ? AND q.staff_id = u.id
        WHERE u.type = 'STAFF' AND u.status = 'ACTIVE'
          AND u.id NOT IN (SELECT user_id FROM tenant_users)
        ORDER BY is_enabled DESC, u.name ASC
      `, [eventId, eventId, eventId]);
    }
  }

  static async setStaffQuota(
    eventId: number,
    staffId: number,
    maxInvites: number,
    permissions?: {
      is_enabled?: boolean;
      can_invite?: boolean;
      can_approve?: boolean;
      can_scan?: boolean;
      can_view_report?: boolean;
    }
  ) {
    const events = await query<any[]>('SELECT id, tenant_id FROM events WHERE id = ?', [eventId]);
    if (!events.length) throw new Error('Sự kiện không tồn tại.');
    const event = events[0];

    if (event.tenant_id) {
      const members = await query<any[]>(
        'SELECT user_id FROM tenant_users WHERE tenant_id = ? AND user_id = ?',
        [event.tenant_id, staffId]
      );
      if (!members.length) throw new Error('Nhân sự này không thuộc đơn vị khách thuê của sự kiện.');
    }

    const isEnabled = permissions?.is_enabled !== undefined ? (permissions.is_enabled ? 1 : 0) : 1;
    const canInvite = permissions?.can_invite !== undefined ? (permissions.can_invite ? 1 : 0) : 1;
    const canApprove = permissions?.can_approve !== undefined ? (permissions.can_approve ? 1 : 0) : 1;
    const canScan = permissions?.can_scan !== undefined ? (permissions.can_scan ? 1 : 0) : 1;
    const canViewReport = permissions?.can_view_report !== undefined ? (permissions.can_view_report ? 1 : 0) : 1;

    await query(`
      INSERT INTO staff_event_quotas (event_id, staff_id, max_invites, is_enabled, can_invite, can_approve, can_scan, can_view_report)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        max_invites = VALUES(max_invites),
        is_enabled = VALUES(is_enabled),
        can_invite = VALUES(can_invite),
        can_approve = VALUES(can_approve),
        can_scan = VALUES(can_scan),
        can_view_report = VALUES(can_view_report)
    `, [eventId, staffId, maxInvites, isEnabled, canInvite, canApprove, canScan, canViewReport]);

    if (!isEnabled || !canInvite) {
      await query(`
        UPDATE invite_links 
        SET status = 'CLOSED'
        WHERE event_id = ? AND referrer_id = ? AND status = 'ACTIVE'
      `, [eventId, staffId]);
    } else {
      await query(`
        UPDATE invite_links 
        SET max_registrations = ?
        WHERE event_id = ? AND referrer_id = ? AND status = 'ACTIVE'
      `, [maxInvites, eventId, staffId]);
    }

    // Sync user_permissions across all enabled event quotas for this staff
    const allQuotas = await query<any[]>(`
      SELECT SUM(can_invite = 1) AS has_invite, SUM(can_scan = 1) AS has_scan,
             SUM(can_approve = 1) AS has_approve, SUM(can_view_report = 1) AS has_report
      FROM staff_event_quotas
      WHERE staff_id = ? AND is_enabled = 1
    `, [staffId]);
    const q = allQuotas[0] || {};
    const permsToGrant = new Set<string>(['registrations:view_own']);
    if (Number(q.has_invite) > 0) {
      permsToGrant.add('invite:create');
      permsToGrant.add('registrations:approve');
    }
    if (Number(q.has_approve) > 0) permsToGrant.add('registrations:approve');
    if (Number(q.has_scan) > 0) permsToGrant.add('tickets:scan');
    if (Number(q.has_report) > 0) permsToGrant.add('reports:view');
    for (const p of permsToGrant) {
      await query(
        `INSERT IGNORE INTO user_permissions (user_id, permission_id)
         SELECT ?, id FROM permissions WHERE code = ?`,
        [staffId, p]
      );
    }

    try {
      Realtime.emitQuotaUpdated({
        eventId,
        staffId,
        maxInvites,
      });
    } catch (e) {
      console.warn('[Realtime] Quota emit failed:', e);
    }

    return {
      success: true,
      max_invites: maxInvites,
      is_enabled: !!isEnabled,
      can_invite: !!canInvite,
      can_approve: !!canApprove,
      can_scan: !!canScan,
      can_view_report: !!canViewReport,
    };
  }
}
