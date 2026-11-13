import crypto from 'crypto';
import { query } from '../config/database';
import { ENV } from '../config/env';

export type EventSessionMode = 'FULL_DAY' | 'SPLIT_SESSIONS';
export type InviteSessionType = 'FULL_DAY' | 'MORNING' | 'AFTERNOON';

export interface NormalizedSessionConfig {
  session_mode: EventSessionMode;
  morning_capacity: number | null;
  afternoon_capacity: number | null;
}

const SHORT_TOKEN_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

export function makeShortInviteToken(length = 8): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += SHORT_TOKEN_CHARS[bytes[i] % SHORT_TOKEN_CHARS.length];
  }
  return out;
}

export async function generateUniqueShortToken(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const token = makeShortInviteToken(8);
    const existing = await query<any[]>('SELECT id FROM invite_links WHERE token = ? LIMIT 1', [token]);
    if (existing.length === 0) return token;
  }
  return makeShortInviteToken(10);
}

export function signInviteTokenPayload(eventId: number, referrerId: number, token: string): string {
  return crypto
    .createHmac('sha256', ENV.INVITE_HMAC_SECRET)
    .update(`${eventId}:${referrerId}:${token}`)
    .digest('hex');
}

export function getSessionLabel(sessionType?: string | null): string {
  if (sessionType === 'MORNING') return 'Buổi sáng';
  if (sessionType === 'AFTERNOON') return 'Buổi chiều';
  return 'Cả ngày';
}

export function normalizeSessionConfig(input: {
  capacity: number;
  session_mode?: string | null;
  morning_capacity?: any;
  afternoon_capacity?: any;
}): NormalizedSessionConfig {
  const cap = Number(input.capacity);
  if (!Number.isFinite(cap) || cap < 1) {
    throw new Error('Sức chứa sự kiện phải từ 1 khách trở lên.');
  }

  const rawMode = String(input.session_mode || 'FULL_DAY').trim().toUpperCase();
  const isSplit =
    rawMode === 'SPLIT_SESSIONS' ||
    rawMode === 'SPLIT' ||
    rawMode === 'MORNING' ||
    rawMode === 'AFTERNOON';

  if (!isSplit) {
    return {
      session_mode: 'FULL_DAY',
      morning_capacity: null,
      afternoon_capacity: null,
    };
  }

  const hasMorning =
    input.morning_capacity !== undefined &&
    input.morning_capacity !== null &&
    input.morning_capacity !== '';
  const hasAfternoon =
    input.afternoon_capacity !== undefined &&
    input.afternoon_capacity !== null &&
    input.afternoon_capacity !== '';

  let morning = hasMorning ? Number(input.morning_capacity) : Math.ceil(cap / 2);
  let afternoon = hasAfternoon ? Number(input.afternoon_capacity) : Math.floor(cap / 2);

  if (hasMorning && !hasAfternoon) {
    afternoon = Math.max(0, cap - morning);
  } else if (!hasMorning && hasAfternoon) {
    morning = Math.max(0, cap - afternoon);
  }

  if (
    !Number.isFinite(morning) ||
    !Number.isFinite(afternoon) ||
    !Number.isInteger(morning) ||
    !Number.isInteger(afternoon) ||
    morning < 0 ||
    afternoon < 0
  ) {
    throw new Error('Số lượng khách buổi sáng và buổi chiều phải là số nguyên không âm.');
  }

  if (morning + afternoon <= 0) {
    throw new Error('Tổng số lượng khách buổi sáng và buổi chiều phải lớn hơn 0.');
  }

  if (morning + afternoon > cap) {
    throw new Error(
      `Tổng số khách buổi sáng (${morning}) + buổi chiều (${afternoon}) = ${morning + afternoon} không được vượt quá giới hạn tối đa của sự kiện (${cap} khách).`
    );
  }

  return {
    session_mode: 'SPLIT_SESSIONS',
    morning_capacity: morning,
    afternoon_capacity: afternoon,
  };
}

export async function resolveEventOrganizerUserId(event: {
  created_by: number;
  tenant_id?: number | null;
}): Promise<number> {
  if (event.tenant_id) {
    const owners = await query<any[]>(
      "SELECT user_id FROM tenant_users WHERE tenant_id = ? AND role = 'OWNER' ORDER BY id ASC LIMIT 1",
      [event.tenant_id]
    );
    if (owners[0]?.user_id) {
      return Number(owners[0].user_id);
    }
  }
  return Number(event.created_by);
}

function computeDefaultInviteExpiry(endAt?: Date | string | null): Date {
  const sixtyDays = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
  if (!endAt) return sixtyDays;
  const endDate = new Date(endAt);
  if (Number.isNaN(endDate.getTime())) return sixtyDays;
  const afterEvent = new Date(endDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  return afterEvent > sixtyDays ? afterEvent : sixtyDays;
}

async function createSessionInviteRow(params: {
  eventId: number;
  referrerId: number;
  sessionType: InviteSessionType;
  maxRegistrations: number;
  expiresAt: Date;
  status: 'ACTIVE' | 'CLOSED';
}) {
  const token = await generateUniqueShortToken();
  const signature = signInviteTokenPayload(params.eventId, params.referrerId, token);
  const res: any = await query(
    `INSERT INTO invite_links (event_id, referrer_id, token, signature, expires_at, max_registrations, session_type, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.eventId,
      params.referrerId,
      token,
      signature,
      params.expiresAt,
      params.maxRegistrations,
      params.sessionType,
      params.status,
    ]
  );
  return {
    id: res.insertId,
    event_id: params.eventId,
    referrer_id: params.referrerId,
    token,
    signature,
    expires_at: params.expiresAt,
    max_registrations: params.maxRegistrations,
    current_registrations: 0,
    session_type: params.sessionType,
    status: params.status,
  };
}

export async function ensureEventSessionInvites(
  eventId: number,
  fallbackReferrerId?: number
): Promise<void> {
  const events = await query<any[]>(
    `SELECT id, created_by, tenant_id, capacity, status, end_at,
            session_mode, morning_capacity, afternoon_capacity
     FROM events WHERE id = ? LIMIT 1`,
    [eventId]
  );
  const event = events[0];
  if (!event) return;

  const referrerId = fallbackReferrerId || (await resolveEventOrganizerUserId(event));
  const expiresAt = computeDefaultInviteExpiry(event.end_at);
  const baseStatus: 'ACTIVE' | 'CLOSED' = event.status === 'PUBLISHED' ? 'ACTIVE' : 'CLOSED';

  const existing = await query<any[]>(
    `SELECT id, session_type, status
     FROM invite_links
     WHERE event_id = ? AND status IN ('ACTIVE', 'CLOSED')`,
    [eventId]
  );

  if (event.session_mode === 'SPLIT_SESSIONS') {
    const hasMorning = existing.some((r) => r.session_type === 'MORNING');
    const hasAfternoon = existing.some((r) => r.session_type === 'AFTERNOON');

    if (!hasMorning) {
      await createSessionInviteRow({
        eventId,
        referrerId,
        sessionType: 'MORNING',
        maxRegistrations: Number(event.morning_capacity ?? Math.ceil((event.capacity || 500) / 2)),
        expiresAt,
        status: baseStatus,
      });
    }
    if (!hasAfternoon) {
      await createSessionInviteRow({
        eventId,
        referrerId,
        sessionType: 'AFTERNOON',
        maxRegistrations: Number(event.afternoon_capacity ?? Math.floor((event.capacity || 500) / 2)),
        expiresAt,
        status: baseStatus,
      });
    }
    return;
  }

  const hasFullDay = existing.some((r) => !r.session_type || r.session_type === 'FULL_DAY');
  if (!hasFullDay) {
    await createSessionInviteRow({
      eventId,
      referrerId,
      sessionType: 'FULL_DAY',
      maxRegistrations: Number(event.capacity || 500),
      expiresAt,
      status: baseStatus,
    });
  }
}

export async function syncEventSessionInvitesOnUpdate(
  eventId: number,
  fallbackReferrerId?: number
): Promise<void> {
  const events = await query<any[]>(
    `SELECT id, created_by, tenant_id, capacity, status, end_at,
            session_mode, morning_capacity, afternoon_capacity
     FROM events WHERE id = ? LIMIT 1`,
    [eventId]
  );
  const event = events[0];
  if (!event) return;

  const organizerId = fallbackReferrerId || (await resolveEventOrganizerUserId(event));

  if (event.session_mode === 'SPLIT_SESSIONS') {
    await query(
      `UPDATE invite_links
       SET status = IF(referrer_id = ?, 'REVOKED', 'CLOSED')
       WHERE event_id = ? AND session_type = 'FULL_DAY' AND status IN ('ACTIVE', 'CLOSED')`,
      [organizerId, eventId]
    );
    await ensureEventSessionInvites(eventId, organizerId);

    const morningCap = Number(event.morning_capacity ?? 0);
    const afternoonCap = Number(event.afternoon_capacity ?? 0);

    await query(
      `UPDATE invite_links
       SET max_registrations = ?,
           status = IF(? = 'PUBLISHED' AND current_registrations < ?, 'ACTIVE', 'CLOSED')
       WHERE event_id = ? AND referrer_id = ? AND session_type = 'MORNING' AND status IN ('ACTIVE', 'CLOSED')`,
      [morningCap, event.status, morningCap, eventId, organizerId]
    );
    await query(
      `UPDATE invite_links
       SET max_registrations = ?,
           status = IF(? = 'PUBLISHED' AND current_registrations < ?, 'ACTIVE', 'CLOSED')
       WHERE event_id = ? AND referrer_id = ? AND session_type = 'AFTERNOON' AND status IN ('ACTIVE', 'CLOSED')`,
      [afternoonCap, event.status, afternoonCap, eventId, organizerId]
    );
    return;
  }

  await query(
    `UPDATE invite_links
     SET status = IF(referrer_id = ?, 'REVOKED', 'CLOSED')
     WHERE event_id = ? AND session_type IN ('MORNING', 'AFTERNOON') AND status IN ('ACTIVE', 'CLOSED')`,
    [organizerId, eventId]
  );
  await ensureEventSessionInvites(eventId, organizerId);

  const totalCap = Number(event.capacity || 500);
  await query(
    `UPDATE invite_links
     SET max_registrations = ?,
         status = IF(? = 'PUBLISHED' AND current_registrations < ?, 'ACTIVE', 'CLOSED')
     WHERE event_id = ? AND referrer_id = ? AND session_type = 'FULL_DAY' AND status IN ('ACTIVE', 'CLOSED')`,
    [totalCap, event.status, totalCap, eventId, organizerId]
  );
}

export async function listEventInvitesDetailed(eventId: number, ensureReferrerId?: number) {
  await ensureEventSessionInvites(eventId, ensureReferrerId);

  const eventRows = await query<any[]>(
    `SELECT id, capacity, session_mode, morning_capacity, afternoon_capacity, status
     FROM events WHERE id = ? LIMIT 1`,
    [eventId]
  );
  const event = eventRows[0];

  const sessCounts = await query<any[]>(
    `SELECT session_type, COUNT(*) AS total
     FROM registrations
     WHERE event_id = ?
     GROUP BY session_type`,
    [eventId]
  );
  const regCountBySession: Record<string, number> = {};
  for (const row of sessCounts) {
    regCountBySession[row.session_type || 'FULL_DAY'] = Number(row.total || 0);
  }

  const rows = await query<any[]>(
    `SELECT il.id, il.event_id, il.referrer_id, il.token, il.max_registrations, il.current_registrations,
            il.session_type, il.status, il.expires_at, il.created_at,
            u.name AS referrer_name, u.email AS referrer_email,
            (SELECT COUNT(*) FROM registrations r WHERE r.invite_link_id = il.id) AS total_registered
     FROM invite_links il
     JOIN users u ON u.id = il.referrer_id
     WHERE il.event_id = ? AND il.status != 'REVOKED'
     ORDER BY FIELD(il.session_type, 'MORNING', 'AFTERNOON', 'FULL_DAY') ASC,
              il.status = 'ACTIVE' DESC,
              il.id ASC`,
    [eventId]
  );

  for (const link of rows) {
    if (link.token && link.token.length > 20) {
      const shortToken = await generateUniqueShortToken();
      const newSig = signInviteTokenPayload(eventId, Number(link.referrer_id), shortToken);
      try {
        await query(
          `UPDATE invite_links
           SET legacy_token = COALESCE(legacy_token, token), token = ?, signature = ?
           WHERE id = ?`,
          [shortToken, newSig, link.id]
        );
        link.token = shortToken;
      } catch (e) {
        console.warn('[Invite] Shorten legacy token failed:', e);
      }
    }

    const st: InviteSessionType = link.session_type || 'FULL_DAY';
    const sessionCapacity =
      st === 'MORNING'
        ? Number(event?.morning_capacity ?? link.max_registrations ?? 0)
        : st === 'AFTERNOON'
        ? Number(event?.afternoon_capacity ?? link.max_registrations ?? 0)
        : Number(event?.capacity ?? link.max_registrations ?? 0);

    link.session_type = st;
    link.session_label = getSessionLabel(st);
    link.session_capacity = sessionCapacity;
    link.session_registered = regCountBySession[st] || 0;
  }

  return rows;
}
