export type EventSessionMode = 'FULL_DAY' | 'SPLIT_SESSIONS';
export type InviteSessionType = 'FULL_DAY' | 'MORNING' | 'AFTERNOON';

export function formatSessionLabel(sessionType?: string | null): string {
  if (sessionType === 'MORNING') return 'Buổi sáng';
  if (sessionType === 'AFTERNOON') return 'Buổi chiều';
  return 'Cả ngày';
}

export function sessionBadgeClasses(sessionType?: string | null): string {
  if (sessionType === 'MORNING') {
    return 'bg-amber-50 text-amber-800 border-amber-200';
  }
  if (sessionType === 'AFTERNOON') {
    return 'bg-indigo-50 text-indigo-800 border-indigo-200';
  }
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

export function buildInviteUrl(token?: string | null): string {
  if (!token) return '';
  if (typeof window === 'undefined') return `/invite/${token}`;
  return `${window.location.origin}/invite/${token}`;
}

export function splitDefaultCapacities(capacity: number): { morning: number; afternoon: number } {
  const safeCap = Math.max(1, Math.floor(Number(capacity) || 1));
  const morning = Math.ceil(safeCap / 2);
  const afternoon = Math.max(0, safeCap - morning);
  return { morning, afternoon };
}

export function validateSessionForm(params: {
  sessionMode?: string | null;
  capacity: number;
  morningCapacity?: number | null;
  afternoonCapacity?: number | null;
}): string | null {
  const cap = Number(params.capacity);
  if (!Number.isFinite(cap) || cap < 1) {
    return 'Sức chứa sự kiện tối đa phải từ 1 khách trở lên.';
  }
  if (params.sessionMode !== 'SPLIT_SESSIONS') {
    return null;
  }
  const morning = Number(params.morningCapacity ?? 0);
  const afternoon = Number(params.afternoonCapacity ?? 0);
  if (!Number.isInteger(morning) || !Number.isInteger(afternoon) || morning < 0 || afternoon < 0) {
    return 'Số lượng khách buổi sáng và buổi chiều phải là số nguyên không âm.';
  }
  if (morning + afternoon <= 0) {
    return 'Tổng số lượng khách buổi sáng và buổi chiều phải lớn hơn 0.';
  }
  if (morning + afternoon > cap) {
    return `Tổng số lượng buổi sáng (${morning}) + buổi chiều (${afternoon}) = ${morning + afternoon} không được vượt quá Max sự kiện (${cap} khách).`;
  }
  return null;
}
