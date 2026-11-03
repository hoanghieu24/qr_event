import { query, withTransaction } from '../../config/database';

type PlanInput = {
  id?: number;
  code?: string;
  name: string;
  description?: string;
  max_attendees: number;
  max_employees: number;
  max_referrers: number;
  max_scanners: number;
  price_vnd: number;
  is_trial?: boolean;
  status?: 'ACTIVE' | 'INACTIVE';
  for_all_tenants?: boolean;
  tenant_ids?: number[];
};

export class SubscriptionsService {
  static async listPlans(tenantId?: number | null, activeOnly = false) {
    const plans = await query<any[]>(`
      SELECT p.id, p.code, p.name, p.description, p.max_attendees, p.max_employees,
             p.max_referrers, p.max_scanners, p.price_vnd, p.is_trial, p.status, p.created_at,
             p.for_all_tenants,
             (SELECT GROUP_CONCAT(pt.tenant_id) FROM plan_tenants pt WHERE pt.plan_id = p.id) AS target_tenant_ids_str
      FROM subscription_plans p
      WHERE 1=1
      ${activeOnly ? "AND p.status = 'ACTIVE' AND p.is_trial = 0" : ''}
      ${tenantId ? "AND (p.for_all_tenants = 1 OR EXISTS (SELECT 1 FROM plan_tenants pt WHERE pt.plan_id = p.id AND pt.tenant_id = ?))" : ''}
      ORDER BY p.price_vnd ASC, p.max_attendees ASC, p.id ASC
    `, tenantId ? [tenantId] : []);

    return plans.map((p) => ({
      ...p,
      for_all_tenants: Boolean(p.for_all_tenants),
      target_tenant_ids: p.target_tenant_ids_str ? p.target_tenant_ids_str.split(',').map(Number) : []
    }));
  }

  static async savePlan(data: PlanInput) {
    const fields = ['max_attendees', 'max_employees', 'max_referrers', 'max_scanners'] as const;
    const limits = fields.map((field) => Number(data[field]));
    const price = Number(data.price_vnd);
    const isTrial = Boolean(data.is_trial);
    if (!data.name?.trim() || limits.some((value, index) => !Number.isSafeInteger(value) || value < (index === 0 ? 1 : 0)) ||
      !Number.isSafeInteger(price) || price < 0 || (isTrial && price !== 0)) {
      throw new Error('Tên gói và số khách phải lớn hơn 0; giới hạn nhân sự có thể bằng 0; gói dùng thử cần có giá 0 đồng.');
    }
    const status = data.status || 'ACTIVE';
    const forAll = data.for_all_tenants !== undefined ? (data.for_all_tenants ? 1 : 0) : (data.tenant_ids && data.tenant_ids.length > 0 ? 0 : 1);
    const tenantIds = Array.isArray(data.tenant_ids) ? data.tenant_ids.map(Number) : [];

    return await withTransaction(async (conn) => {
      if (isTrial && status === 'ACTIVE') {
        await conn.query("UPDATE subscription_plans SET status = 'INACTIVE' WHERE is_trial = 1");
      }
      if (data.id) {
        const [result]: any = await conn.query(`
          UPDATE subscription_plans SET name = ?, description = ?, max_attendees = ?,
            max_employees = ?, max_referrers = ?, max_scanners = ?, price_vnd = ?, is_trial = ?, status = ?,
            for_all_tenants = ?
          WHERE id = ?
        `, [data.name.trim(), data.description?.trim() || null, ...limits, price, isTrial ? 1 : 0, status, forAll, data.id]);
        if (!result.affectedRows) {
          const [exists]: any = await conn.query('SELECT id FROM subscription_plans WHERE id = ?', [data.id]);
          if (!exists.length) throw new Error('Không tìm thấy gói sự kiện.');
        }
        await conn.query('DELETE FROM plan_tenants WHERE plan_id = ?', [data.id]);
        if (!forAll && tenantIds.length > 0) {
          for (const tid of tenantIds) {
            await conn.query('INSERT IGNORE INTO plan_tenants (plan_id, tenant_id) VALUES (?, ?)', [data.id, tid]);
          }
        }
        return { id: data.id };
      }

      const baseCode = (data.code || data.name).trim().toLowerCase().normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 45);
      const code = `${baseCode || 'event-package'}-${Date.now()}`;
      const [result]: any = await conn.query(`
        INSERT INTO subscription_plans
          (code, name, description, event_credits, validity_days, max_attendees,
           max_employees, max_referrers, max_scanners, price_vnd, is_trial, status, for_all_tenants)
        VALUES (?, ?, ?, 1, 1, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [code || `event-package-${Date.now()}`, data.name.trim(), data.description?.trim() || null,
        ...limits, price, isTrial ? 1 : 0, status, forAll]);
      const newPlanId = Number(result.insertId);
      if (!forAll && tenantIds.length > 0) {
        for (const tid of tenantIds) {
          await conn.query('INSERT IGNORE INTO plan_tenants (plan_id, tenant_id) VALUES (?, ?)', [newPlanId, tid]);
        }
      }
      return { id: newPlanId };
    });
  }

  static async createRequest(tenantId: number, planId: number) {
    return await withTransaction(async (conn) => {
      const [tenants]: any = await conn.query("SELECT id, free_events_used FROM tenants WHERE id = ? AND status = 'ACTIVE' FOR UPDATE", [tenantId]);
      if (!tenants.length) throw new Error('Khách thuê không tồn tại hoặc đang bị khóa.');
      if (Number(tenants[0].free_events_used) < 3) throw new Error('Bạn có thể dùng 3 sự kiện thử trước khi mua gói.');
      const [plans]: any = await conn.query(`
        SELECT id, name, max_attendees, max_employees, max_referrers, max_scanners, price_vnd
        FROM subscription_plans WHERE id = ? AND status = 'ACTIVE' AND is_trial = 0 LIMIT 1
      `, [planId]);
      if (!plans.length) throw new Error('Gói sự kiện không còn khả dụng.');
      const [result]: any = await conn.query(`
        INSERT INTO subscription_requests
          (tenant_id, plan_id, event_credits, validity_days, package_name, max_attendees,
           max_employees, max_referrers, max_scanners, price_vnd)
        VALUES (?, ?, 1, 1, ?, ?, ?, ?, ?, ?)
      `, [tenantId, planId, plans[0].name, plans[0].max_attendees, plans[0].max_employees,
        plans[0].max_referrers, plans[0].max_scanners, plans[0].price_vnd]);
      return { id: Number(result.insertId), status: 'PENDING' };
    });
  }

  static async listRequests(status?: string) {
    const filter = status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status) ? 'WHERE sr.status = ?' : '';
    return await query<any[]>(`
      SELECT sr.id, sr.tenant_id, tn.name AS tenant_name, owner.email AS owner_email,
             sr.plan_id, COALESCE(sr.package_name, p.name) AS plan_name,
             sr.max_attendees, sr.max_employees, sr.max_referrers, sr.max_scanners,
             sr.price_vnd, sr.event_id, e.name AS event_name,
             sr.status, sr.requested_at, sr.reviewed_at, sr.review_note,
             reviewer.name AS reviewer_name
      FROM subscription_requests sr
      JOIN tenants tn ON tn.id = sr.tenant_id
      JOIN subscription_plans p ON p.id = sr.plan_id
      LEFT JOIN events e ON e.id = sr.event_id
      LEFT JOIN tenant_users tu ON tu.tenant_id = tn.id AND tu.role = 'OWNER'
      LEFT JOIN users owner ON owner.id = tu.user_id
      LEFT JOIN users reviewer ON reviewer.id = sr.reviewed_by
      ${filter}
      ORDER BY sr.requested_at DESC
    `, filter ? [status] : []);
  }

  static async reviewRequest(requestId: number, reviewerId: number, decision: 'APPROVED' | 'REJECTED', note?: string) {
    return await withTransaction(async (conn) => {
      const [rows]: any = await conn.query(`
        SELECT sr.id, sr.status, sr.event_id, p.status AS plan_status
        FROM subscription_requests sr
        JOIN subscription_plans p ON p.id = sr.plan_id
        WHERE sr.id = ? FOR UPDATE
      `, [requestId]);
      if (!rows.length) throw new Error('Không tìm thấy yêu cầu mua gói.');
      const request = rows[0];
      if (request.status !== 'PENDING') throw new Error('Yêu cầu này đã được xử lý.');
      if (request.event_id) throw new Error('Gói sự kiện này đã được sử dụng.');
      if (decision === 'APPROVED' && request.plan_status !== 'ACTIVE') {
        throw new Error('Gói đã ngừng bán nên không thể duyệt yêu cầu này.');
      }
      await conn.query(`
        UPDATE subscription_requests SET status = ?, reviewed_at = NOW(), reviewed_by = ?, review_note = ?
        WHERE id = ?
      `, [decision, reviewerId, note?.trim() || null, requestId]);
      return { id: requestId, status: decision };
    });
  }
}
