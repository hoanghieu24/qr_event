<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import api from '../../api/client';
import { getSocket } from '../../api/socket';
import InviteCardModal from '../../components/InviteCardModal.vue';
import {
  BarChart3,
  Users,
  ShieldCheck,
  Calendar,
  Ticket,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Search,
  Download,
  Plus,
  Key,
  Trash2,
  Lock,
  Unlock,
  Clock,
  MapPin,
  RotateCw,
  Building,
  Filter,
  TrendingUp,
  FileSpreadsheet,
  X,
  ChevronRight,
  User,
  Shield,
  Layers,
  Sparkles,
  ExternalLink,
  ChevronDown,
  Settings,
  Mail,
  Sliders,
  Trophy,
  Award,
  Zap,
  Activity,
  Radio,
  Check,
  UserX,
  QrCode,
  Crown,
  Copy,
  Building2,
  Phone,
  UserPlus,
  Briefcase,
  Pencil
} from 'lucide-vue-next';

const activeTab = ref<'overview' | 'users' | 'staff' | 'events' | 'settings'>('overview');
const metrics = ref<any>(null);
const staffList = ref<any[]>([]);
const permissionsList = ref<any[]>([]);
const eventsList = ref<any[]>([]);
const loading = ref(false);

// Velocity & Leaderboard State (Group 4.7 & 4.8)
const velocityData = ref<any>(null);
const leaderboardData = ref<any[]>([]);
const selectedVelocityEventId = ref<number | null>(null);
const velocityLoading = ref(false);

// VIP Online Invitation Card Generator (Master Admin)
const showAdminInviteCardModal = ref(false);
const adminCardData = ref<any>(null);

const openAdminInviteCard = (att?: any, event?: any) => {
  const ev = event || selectedEventReport.value?.event || eventsList.value[0];
  if (att) {
    adminCardData.value = {
      attendee_name: att.full_name || 'Khách Mời VIP',
      attendee_role: 'Khách Mời Danh Dự (VIP)',
      event_name: ev?.name,
      event_location: ev?.location,
      event_start_at: ev?.start_at,
      qr_data: att.ticket_code || window.location.origin,
      code_label: att.ticket_code ? `MÃ VÉ: ${att.ticket_code}` : 'QUÉT ĐỂ CHECK-IN VÉ VIP',
    };
  } else {
    adminCardData.value = {
      attendee_name: 'Ông / Bà [Khách Mời VIP]',
      attendee_role: 'Khách Mời Danh Dự (VIP)',
      event_name: ev?.name,
      event_location: ev?.location,
      event_start_at: ev?.start_at,
      qr_data: window.location.origin,
      code_label: 'QUÉT ĐỂ THAM DỰ SỰ KIỆN (VIP)',
    };
  }
  showAdminInviteCardModal.value = true;
};

// Master Admin Settings State
const systemSettings = ref<{
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_pass: string;
  smtp_from_name: string;
  email_on_approved: string;
  notify_hours_before: string;
  geofence_default_radius: string;
}>({
  smtp_host: 'smtp.gmail.com',
  smtp_port: '587',
  smtp_user: '',
  smtp_pass: '',
  smtp_from_name: 'EventGo',
  email_on_approved: '1',
  notify_hours_before: '24',
  geofence_default_radius: '500',
});
const settingsLoading = ref(false);
const settingsSaving = ref(false);
const testEmailTarget = ref('');
const testEmailSending = ref(false);
const testEmailResult = ref<{ success: boolean; message: string } | null>(null);

// Master Admin: All users state
const allUsersList = ref<any[]>([]);
const userSearch = ref('');
const userRoleFilter = ref<'ALL' | 'ADMIN' | 'TENANT' | 'STAFF' | 'CUSTOMER'>('ALL');
const userStatusFilter = ref<'ALL' | 'ACTIVE' | 'BLOCKED'>('ALL');
const showCreateUserModal = ref(false);
const newUser = ref({
  name: '',
  email: '',
  phone: '',
  type: 'STAFF' as 'ADMIN' | 'TENANT_ADMIN' | 'STAFF' | 'CUSTOMER',
  password: 'Staff@123',
});
const showResetPasswordModal = ref(false);
const selectedUserForPassword = ref<any>(null);
const newPasswordInput = ref('');
const showDeleteUserModal = ref(false);
const deleteUserTarget = ref<any>(null);
const deleteUserDeps = ref<{
  hasForeignKeyConstraint: boolean;
  hasRelatedData: boolean;
  foreignKeyItems: string[];
  cascadeItems: string[];
} | null>(null);
const deleteUserDepsLoading = ref(false);
const deleteUserPin = ref('');
const deleteUserError = ref('');
const deleteUserSubmitting = ref(false);
const deleteUserLocking = ref(false);

// Modal states
const showCreateStaffModal = ref(false);
const showCreateEventModal = ref(false);
const newStaff = ref({
  name: '',
  email: '',
  phone: '',
  password: 'Staff@123',
  permission_ids: [] as number[],
});
const newEvent = ref({
  name: '',
  description: '',
  location: '',
  start_at: '2026-10-15T08:30',
  end_at: '2026-10-15T17:30',
  capacity: 500,
  approval_mode: 'REFERRER_ONLY' as 'REFERRER_ONLY' | 'TWO_TIER' | 'AUTO',
  latitude: null as number | null,
  longitude: null as number | null,
  geofence_radius_meters: 0,
  geofence_enabled: false,
  tenant_id: null as number | null,
  plan_id: null as number | null,
  payment_status: 'PAID' as 'PAID' | 'PENDING_PAYMENT',
});

const eventFilterScope = ref<'ALL' | 'TENANT' | 'INTERNAL'>('ALL');
const tenantUsersDraft = ref<any[]>([]);
const loadingTenantUsers = ref(false);

const displayedEvents = computed(() => {
  if (eventFilterScope.value === 'TENANT') return eventsList.value.filter(e => e.tenant_id);
  if (eventFilterScope.value === 'INTERNAL') return eventsList.value.filter(e => !e.tenant_id);
  return eventsList.value;
});

const onTenantSelected = async () => {
  if (!newEvent.value.tenant_id) {
    tenantUsersDraft.value = [];
    return;
  }
  loadingTenantUsers.value = true;
  try {
    const res = await api.get(`/tenants/${newEvent.value.tenant_id}/users`);
    tenantUsersDraft.value = (res.data.data || []).map((u: any) => ({
      staff_id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      is_selected: true,
      max_invites: 50,
      can_invite: true,
      can_approve: true,
      can_scan: true,
      can_view_report: true,
    }));
  } catch (e) {
    console.error(e);
  } finally {
    loadingTenantUsers.value = false;
  }
};

const availableTenants = ref<any[]>([]);
const availablePlans = ref<any[]>([]);

const onPlanSelected = () => {
  const plan = availablePlans.value.find((p: any) => p.id === newEvent.value.plan_id);
  if (plan) {
    newEvent.value.capacity = plan.max_attendees;
    newEvent.value.payment_status = (plan.is_trial || plan.price_vnd === 0) ? 'PAID' : 'PENDING_PAYMENT';
  }
};

const confirmEventPayment = async (eventId: number) => {
  if (!confirm('Xác nhận khách thuê đã thanh toán gói cho sự kiện này?')) return;
  try {
    await api.patch(`/events/${eventId}/confirm-payment`);
    alert('Đã xác nhận thanh toán thành công!');
    await loadEvents();
  } catch (err: any) {
    alert(err.response?.data?.message || 'Lỗi khi xác nhận thanh toán');
  }
};

const showAdminEditEventModal = ref(false);
const adminEditEventForm = ref({
  id: 0,
  name: '',
  location: '',
  start_at: '',
  end_at: '',
  capacity: 500,
  description: '',
  approval_mode: 'REFERRER_ONLY'
});
const adminEditSaving = ref(false);

const openAdminEditEventModal = (ev: any) => {
  if (!ev) return;
  const toInputDate = (d: string) => {
    if (!d) return '';
    const date = new Date(d);
    return isNaN(date.getTime()) ? '' : new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };
  adminEditEventForm.value = {
    id: ev.id,
    name: ev.name || '',
    location: ev.location || '',
    start_at: toInputDate(ev.start_at),
    end_at: toInputDate(ev.end_at),
    capacity: ev.capacity || 500,
    description: ev.description || '',
    approval_mode: ev.approval_mode || 'REFERRER_ONLY'
  };
  showAdminEditEventModal.value = true;
};

const saveAdminEditEvent = async () => {
  if (!adminEditEventForm.value.name || !adminEditEventForm.value.location) {
    alert('Vui lòng điền tên và địa điểm sự kiện.');
    return;
  }
  adminEditSaving.value = true;
  try {
    const toMysqlDate = (value: string) => (value ? `${value.replace('T', ' ')}:00` : undefined);
    await api.put(`/events/${adminEditEventForm.value.id}`, {
      name: adminEditEventForm.value.name,
      location: adminEditEventForm.value.location,
      start_at: toMysqlDate(adminEditEventForm.value.start_at),
      end_at: toMysqlDate(adminEditEventForm.value.end_at),
      capacity: Number(adminEditEventForm.value.capacity),
      description: adminEditEventForm.value.description,
      approval_mode: adminEditEventForm.value.approval_mode
    });
    showAdminEditEventModal.value = false;
    await loadEvents();
  } catch (error: any) {
    alert(error.response?.data?.message || error.message);
  } finally {
    adminEditSaving.value = false;
  }
};

const getGpsCoordsForNewEvent = () => {
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        newEvent.value.latitude = parseFloat(pos.coords.latitude.toFixed(6));
        newEvent.value.longitude = parseFloat(pos.coords.longitude.toFixed(6));
        alert(`Đã lấy vị trí hiện tại: ${newEvent.value.latitude}, ${newEvent.value.longitude}`);
      },
      (err) => alert(`Không thể lấy vị trí GPS: ${err.message}`),
      { enableHighAccuracy: true }
    );
  } else {
    alert('Trình duyệt không hỗ trợ Geolocation API.');
  }
};

// Event Detail & Attendance Report Modal
const showEventDetailModal = ref(false);
const selectedEventReport = ref<any>(null);
const eventReportLoading = ref(false);
const attendeeSearch = ref('');
const attendeeFilter = ref<'all_tickets' | 'attended' | 'absent' | 'pending' | 'all'>('all_tickets');

// Staff Quota & Permissions Management Modal (Existing Events)
const showQuotaModal = ref(false);
const selectedEventForQuota = ref<any>(null);
const staffQuotasList = ref<any[]>([]);
const quotaLoading = ref(false);
const quotaSearch = ref('');
const quotaFilter = ref<'ALL' | 'ENABLED' | 'DISABLED'>('ALL');

const filteredStaffQuotasList = computed(() => {
  let list = staffQuotasList.value;
  if (quotaFilter.value === 'ENABLED') {
    list = list.filter((s) => s.is_enabled);
  } else if (quotaFilter.value === 'DISABLED') {
    list = list.filter((s) => !s.is_enabled);
  }
  if (quotaSearch.value.trim()) {
    const q = quotaSearch.value.toLowerCase().trim();
    list = list.filter(
      (s) =>
        (s.staff_name && s.staff_name.toLowerCase().includes(q)) ||
        (s.staff_email && s.staff_email.toLowerCase().includes(q)) ||
        (s.staff_phone && s.staff_phone.includes(q))
    );
  }
  return list;
});

const staffQuotasListCounts = computed(() => {
  const total = staffQuotasList.value.length;
  const enabled = staffQuotasList.value.filter((s) => s.is_enabled).length;
  const disabled = total - enabled;
  return { total, enabled, disabled };
});

// Staff Quota & Permissions Draft for Create Event Modal
export interface StaffEventPermission {
  staff_id: number;
  staff_name: string;
  staff_email: string;
  staff_phone: string;
  max_invites: number;
  is_enabled: boolean;
  can_invite: boolean;
  can_approve: boolean;
  can_scan: boolean;
  can_view_report: boolean;
}

const staffQuotasDraft = ref<StaffEventPermission[]>([]);
const defaultQuotaBulk = ref<number>(50);
const staffPermSearch = ref<string>('');
const staffPermFilter = ref<'ALL' | 'ENABLED' | 'DISABLED'>('ALL');

const filteredStaffQuotasDraft = computed(() => {
  let list = staffQuotasDraft.value;
  if (staffPermFilter.value === 'ENABLED') {
    list = list.filter((s) => s.is_enabled);
  } else if (staffPermFilter.value === 'DISABLED') {
    list = list.filter((s) => !s.is_enabled);
  }
  if (staffPermSearch.value.trim()) {
    const q = staffPermSearch.value.toLowerCase().trim();
    list = list.filter(
      (s) =>
        (s.staff_name && s.staff_name.toLowerCase().includes(q)) ||
        (s.staff_email && s.staff_email.toLowerCase().includes(q)) ||
        (s.staff_phone && s.staff_phone.includes(q))
    );
  }
  return list;
});

const staffPermCounts = computed(() => {
  const total = staffQuotasDraft.value.length;
  const enabled = staffQuotasDraft.value.filter((s) => s.is_enabled).length;
  const disabled = total - enabled;
  return { total, enabled, disabled };
});

const applyDraftBulkQuota = () => {
  if (defaultQuotaBulk.value <= 0) return;
  staffQuotasDraft.value.forEach((sq) => {
    sq.max_invites = defaultQuotaBulk.value;
  });
};

const setAllDraftPermissions = (preset: 'ALL' | 'NONE' | 'INVITE_ONLY' | 'SCAN_ONLY') => {
  staffQuotasDraft.value.forEach((sq) => {
    if (preset === 'ALL') {
      sq.is_enabled = true;
      sq.can_invite = true;
      sq.can_approve = true;
      sq.can_scan = true;
      sq.can_view_report = true;
    } else if (preset === 'NONE') {
      sq.is_enabled = false;
      sq.can_invite = false;
      sq.can_approve = false;
      sq.can_scan = false;
      sq.can_view_report = false;
    } else if (preset === 'INVITE_ONLY') {
      sq.is_enabled = true;
      sq.can_invite = true;
      sq.can_approve = false;
      sq.can_scan = false;
      sq.can_view_report = true;
    } else if (preset === 'SCAN_ONLY') {
      sq.is_enabled = true;
      sq.can_invite = false;
      sq.can_approve = false;
      sq.can_scan = true;
      sq.can_view_report = false;
    }
  });
};

const applySingleStaffPreset = (sq: StaffEventPermission, preset: 'ALL' | 'INVITE_ONLY' | 'SCAN_ONLY' | 'NONE') => {
  if (preset === 'ALL') {
    sq.is_enabled = true;
    sq.can_invite = true;
    sq.can_approve = true;
    sq.can_scan = true;
    sq.can_view_report = true;
  } else if (preset === 'INVITE_ONLY') {
    sq.is_enabled = true;
    sq.can_invite = true;
    sq.can_approve = false;
    sq.can_scan = false;
    sq.can_view_report = true;
  } else if (preset === 'SCAN_ONLY') {
    sq.is_enabled = true;
    sq.can_invite = false;
    sq.can_approve = false;
    sq.can_scan = true;
    sq.can_view_report = false;
  } else if (preset === 'NONE') {
    sq.is_enabled = false;
    sq.can_invite = false;
    sq.can_approve = false;
    sq.can_scan = false;
    sq.can_view_report = false;
  }
};

const loadVelocity = async () => {
  try {
    velocityLoading.value = true;
    const params: any = {};
    if (selectedVelocityEventId.value) params.event_id = selectedVelocityEventId.value;
    const res = await api.get('/dashboard/velocity', { params });
    velocityData.value = res.data.data;
  } catch (e: any) {
    console.error('Error loading velocity:', e);
  } finally {
    velocityLoading.value = false;
  }
};

const loadLeaderboard = async () => {
  try {
    const params: any = {};
    if (selectedVelocityEventId.value) params.event_id = selectedVelocityEventId.value;
    const res = await api.get('/dashboard/leaderboard', { params });
    leaderboardData.value = res.data.data;
  } catch (e: any) {
    console.error('Error loading leaderboard:', e);
  }
};

const loadSettings = async () => {
  try {
    settingsLoading.value = true;
    const res = await api.get('/dashboard/settings');
    if (res.data?.data) {
      const incoming = { ...res.data.data };
      if (incoming.email_on_approved === 'true') incoming.email_on_approved = '1';
      if (incoming.email_on_approved === 'false') incoming.email_on_approved = '0';
      systemSettings.value = { ...systemSettings.value, ...incoming };
    }
  } catch (e: any) {
    console.error('Error loading settings:', e);
  } finally {
    settingsLoading.value = false;
  }
};

const saveSettings = async () => {
  try {
    settingsSaving.value = true;
    await api.put('/dashboard/settings', systemSettings.value);
    alert('Đã lưu cấu hình hệ thống thành công!');
  } catch (e: any) {
    alert(e.response?.data?.message || e.message);
  } finally {
    settingsSaving.value = false;
  }
};

const testSmtpConnection = async () => {
  try {
    testEmailSending.value = true;
    testEmailResult.value = null;
    const res = await api.post('/dashboard/settings/test-email', {
      target_email: testEmailTarget.value,
      smtp_host: systemSettings.value.smtp_host,
      smtp_port: systemSettings.value.smtp_port,
      smtp_user: systemSettings.value.smtp_user,
      smtp_pass: systemSettings.value.smtp_pass,
      smtp_sender_name: systemSettings.value.smtp_from_name,
    });
    testEmailResult.value = { success: true, message: res.data.message };
  } catch (e: any) {
    testEmailResult.value = { success: false, message: e.response?.data?.message || e.message };
  } finally {
    testEmailSending.value = false;
  }
};

const loadSummary = async () => {
  try {
    const res = await api.get('/dashboard/summary');
    metrics.value = res.data.data;
  } catch (e: any) {
    console.error(e);
  }
};

const loadStaff = async () => {
  try {
    const [staffRes, permRes] = await Promise.all([
      api.get('/users/staff'),
      api.get('/users/permissions'),
    ]);
    staffList.value = staffRes.data.data;
    permissionsList.value = permRes.data.data;
  } catch (e: any) {
    console.error(e);
  }
};

const loadEvents = async () => {
  try {
    const res = await api.get('/events');
    eventsList.value = res.data.data;
  } catch (e: any) {
    console.error(e);
  }
};

const loadTenants = async () => {
  try {
    const res = await api.get('/tenants');
    availableTenants.value = res.data.data || [];
    if (availableTenants.value.length > 0 && !selectedTenantId.value) {
      selectedTenantId.value = availableTenants.value[0].id;
      await loadTenantStaffUsers(availableTenants.value[0].id);
    }
  } catch (e: any) {
    console.error(e);
  }
};

onMounted(async () => {
  loading.value = true;
  await Promise.all([
    loadSummary(),
    loadStaff(),
    loadTenants(),
    loadEvents(),
    loadAllUsers(),
    loadVelocity(),
    loadLeaderboard(),
    loadSettings(),
    loadRecentOtps(),
  ]);
  loading.value = false;

  const socket = getSocket();

  // 1. Live Check-in Scan Recorded
  socket.on('scan:recorded', (scan: any) => {
    loadVelocity();
    loadLeaderboard();
    if (metrics.value) {
      if (metrics.value.recent_scans) {
        metrics.value.recent_scans.unshift({
          id: scan.ticketId,
          scanned_at: scan.usedAt,
          result: scan.result,
          scanned_code: scan.code,
          event_name: scan.eventName,
          attendee_name: scan.customerName,
          scanner_name: scan.staffName,
        });
      }
      if (scan.result === 'SUCCESS') {
        metrics.value.total_checked_in = (metrics.value.total_checked_in || 0) + 1;
      }
    }

    if (selectedEventReport.value && selectedEventReport.value.event?.id === scan.eventId) {
      const attendees = selectedEventReport.value.attendees || [];
      const att = attendees.find((a: any) => a.ticket_id === scan.ticketId || a.ticket_code === scan.code);
      if (att && att.ticket_status !== 'USED') {
        att.ticket_status = 'USED';
        att.checked_in_at = scan.usedAt;
        att.scanner_name = scan.staffName;

        const sum = selectedEventReport.value.summary;
        if (sum) {
          sum.total_checked_in = (sum.total_checked_in || 0) + 1;
          sum.total_absent = Math.max(0, (sum.total_absent || 0) - 1);
          if (sum.total_approved > 0) {
            sum.attendance_rate = Math.round((sum.total_checked_in / sum.total_approved) * 1000) / 10;
          }
        }
      }
    }
  });

  // 2. Live New Registration
  socket.on('registration:new', (reg: any) => {
    if (selectedEventReport.value && selectedEventReport.value.event?.id === reg.eventId) {
      const exists = selectedEventReport.value.attendees?.some((a: any) => a.registration_id === reg.registrationId);
      if (!exists) {
        selectedEventReport.value.attendees.unshift({
          registration_id: reg.registrationId,
          full_name: reg.fullName,
          phone: reg.phone,
          email: reg.email,
          registration_status: reg.status,
          registered_at: reg.createdAt,
          referrer_id: reg.referrerId,
          referrer_name: reg.referrerName || 'N/A',
          ticket_id: null,
          ticket_code: null,
          ticket_status: null,
        });
        const sum = selectedEventReport.value.summary;
        if (sum) {
          sum.total_registered = (sum.total_registered || 0) + 1;
          if (reg.status === 'PENDING') {
            sum.total_pending_referrer = (sum.total_pending_referrer || 0) + 1;
          }
        }
      }
    }
  });

  // 3. Live Attendee Approved
  socket.on('attendee:approved', (data: any) => {
    if (selectedEventReport.value && selectedEventReport.value.event?.id === data.eventId) {
      const att = selectedEventReport.value.attendees?.find((a: any) => a.registration_id === data.registrationId);
      if (att) {
        att.registration_status = 'APPROVED';
        if (data.ticket) {
          att.ticket_id = data.ticket.id;
          att.ticket_code = data.ticket.code;
          att.ticket_status = data.ticket.status || 'ISSUED';
        }
        const sum = selectedEventReport.value.summary;
        if (sum) {
          sum.total_approved = (sum.total_approved || 0) + 1;
          sum.total_absent = (sum.total_absent || 0) + 1;
          sum.total_pending_admin = Math.max(0, (sum.total_pending_admin || 0) - 1);
          sum.total_pending_referrer = Math.max(0, (sum.total_pending_referrer || 0) - 1);
        }
      }
    }
  });

  // 4. Live Quota Updated
  socket.on('quota:updated', (data: any) => {
    if (selectedEventForQuota.value && selectedEventForQuota.value.id === data.eventId) {
      const sq = staffQuotasList.value.find((s: any) => s.staff_id === data.staffId);
      if (sq) {
        sq.max_invites = data.maxInvites;
      }
    }
  });

  // 5. Global Refresh
  socket.on('dashboard:refresh', () => {
    loadSummary();
    loadEvents();
  });
});

onUnmounted(() => {
  const socket = getSocket();
  socket.off('scan:recorded');
  socket.off('registration:new');
  socket.off('attendee:approved');
  socket.off('quota:updated');
  socket.off('dashboard:refresh');
});

const handleCreateStaff = async () => {
  try {
    await api.post('/users/staff', newStaff.value);
    alert('Tạo nhân viên thành công!');
    showCreateStaffModal.value = false;
    newStaff.value = { name: '', email: '', phone: '', password: 'Staff@123', permission_ids: [] };
    await loadStaff();
  } catch (e: any) {
    alert(e.response?.data?.message || e.message);
  }
};

const toggleStaffPermission = async (staff: any, permId: number) => {
  const currentIds = staff.permissions.map((p: any) => p.id);
  const exists = currentIds.includes(permId);
  const nextIds = exists ? currentIds.filter((id: number) => id !== permId) : [...currentIds, permId];

  try {
    await api.put(`/users/staff/${staff.id}/permissions`, { permission_ids: nextIds });
    await loadStaff();
  } catch (e: any) {
    alert(e.response?.data?.message || e.message);
  }
};

const toggleStaffStatus = async (staff: any) => {
  const nextStatus = staff.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
  try {
    await api.put(`/users/staff/${staff.id}/status`, { status: nextStatus });
    await loadStaff();
  } catch (e: any) {
    alert(e.response?.data?.message || e.message);
  }
};

// ==========================================
// 2. PHÂN HỆ QUẢN LÝ NHÂN SỰ (CHỦ & KHÁCH THUÊ)
// ==========================================
const staffSubTab = ref<'master' | 'tenant'>('master');
const selectedTenantId = ref<number | null>(null);
const tenantStaffList = ref<any[]>([]);
const loadingTenantStaff = ref(false);
const tenantSearchQuery = ref('');
const tenantStaffSearchQuery = ref('');

const showAddTenantStaffModal = ref(false);
const addTenantStaffMode = ref<'create' | 'existing'>('create');
const newTenantStaff = ref({
  name: '',
  email: '',
  phone: '',
  password: 'Staff@123',
  role: 'TEAM' as 'OWNER' | 'TEAM',
  user_id: undefined as number | undefined,
});
const addingTenantStaff = ref(false);
const addTenantStaffError = ref('');

const filteredTenantsForStaff = computed(() => {
  const q = tenantSearchQuery.value.trim().toLowerCase();
  if (!q) return availableTenants.value;
  return availableTenants.value.filter((t: any) =>
    [t.name, t.contact_name, t.contact_email, t.phone].some((val: any) =>
      String(val || '').toLowerCase().includes(q)
    )
  );
});

const currentSelectedTenant = computed(() => {
  if (!selectedTenantId.value) return null;
  return availableTenants.value.find((t: any) => t.id === selectedTenantId.value) || null;
});

const filteredCurrentTenantStaff = computed(() => {
  let list = tenantStaffList.value;
  if (tenantStaffSearchQuery.value.trim()) {
    const q = tenantStaffSearchQuery.value.trim().toLowerCase();
    list = list.filter((u: any) =>
      [u.name, u.email, u.phone].some((val: any) =>
        String(val || '').toLowerCase().includes(q)
      )
    );
  }
  return list;
});

const selectTenantForStaff = async (tenantId: number) => {
  selectedTenantId.value = tenantId;
  await loadTenantStaffUsers(tenantId);
};

const loadTenantStaffUsers = async (tenantId: number) => {
  loadingTenantStaff.value = true;
  try {
    const res = await api.get(`/tenants/${tenantId}/users`);
    tenantStaffList.value = res.data.data || [];
  } catch (e: any) {
    console.error(e);
  } finally {
    loadingTenantStaff.value = false;
  }
};

const toggleTenantStaffStatus = async (user: any) => {
  const nextStatus = user.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
  try {
    await api.put(`/users/${user.id}/status`, { status: nextStatus });
    if (selectedTenantId.value) {
      await loadTenantStaffUsers(selectedTenantId.value);
    }
  } catch (e: any) {
    alert(e.response?.data?.message || e.message);
  }
};

const removeTenantStaffMember = async (user: any) => {
  if (!selectedTenantId.value) return;
  if (!confirm(`Xác nhận xóa nhân sự "${user.name}" (${user.email}) khỏi công ty này?`)) return;
  try {
    await api.delete(`/tenants/${selectedTenantId.value}/users/${user.id}`);
    await loadTenantStaffUsers(selectedTenantId.value);
    const tRes = await api.get('/tenants');
    availableTenants.value = tRes.data.data || [];
  } catch (e: any) {
    alert(e.response?.data?.message || e.message);
  }
};

const openAddTenantStaffModal = () => {
  newTenantStaff.value = {
    name: '',
    email: '',
    phone: '',
    password: 'Staff@123',
    role: 'TEAM',
    user_id: undefined,
  };
  addTenantStaffMode.value = 'create';
  addTenantStaffError.value = '';
  showAddTenantStaffModal.value = true;
};

const submitAddTenantStaff = async () => {
  if (!selectedTenantId.value) return;
  addingTenantStaff.value = true;
  addTenantStaffError.value = '';
  try {
    const payload = addTenantStaffMode.value === 'existing'
      ? { email: newTenantStaff.value.email.trim() }
      : {
          name: newTenantStaff.value.name.trim(),
          email: newTenantStaff.value.email.trim(),
          phone: newTenantStaff.value.phone.trim() || undefined,
          password: newTenantStaff.value.password || 'Staff@123',
        };
    await api.post(`/tenants/${selectedTenantId.value}/users`, payload);
    showAddTenantStaffModal.value = false;
    await loadTenantStaffUsers(selectedTenantId.value);
    const tRes = await api.get('/tenants');
    availableTenants.value = tRes.data.data || [];
  } catch (e: any) {
    addTenantStaffError.value = e.response?.data?.message || e.message;
  } finally {
    addingTenantStaff.value = false;
  }
};

const openCreateEventModal = async () => {
  try {
    const [tRes, pRes] = await Promise.all([
      api.get('/tenants'),
      api.get('/subscriptions/plans')
    ]);
    availableTenants.value = tRes.data.data || [];
    availablePlans.value = pRes.data.data || [];
  } catch (e) {
    console.error(e);
  }
  showCreateEventModal.value = true;
  staffPermSearch.value = '';
  staffPermFilter.value = 'ALL';
  tenantUsersDraft.value = [];
  staffQuotasDraft.value = staffList.value
    .filter((s: any) => s.status === 'ACTIVE')
    .map((s: any) => ({
      staff_id: s.id,
      staff_name: s.name,
      staff_email: s.email,
      staff_phone: s.phone || '',
      max_invites: 50,
      is_enabled: true,
      can_invite: true,
      can_approve: true,
      can_scan: true,
      can_view_report: true,
    }));
};

const handleCreateEvent = async () => {
  try {
    const staffQuotasToSend = newEvent.value.tenant_id
      ? tenantUsersDraft.value.filter((u: any) => u.is_selected).map((u: any) => ({
          staff_id: u.staff_id,
          max_invites: u.max_invites,
          is_enabled: true,
          can_invite: u.can_invite,
          can_approve: u.can_approve,
          can_scan: u.can_scan,
          can_view_report: u.can_view_report,
        }))
      : staffQuotasDraft.value.map((sq) => ({
          staff_id: sq.staff_id,
          max_invites: sq.max_invites,
          is_enabled: sq.is_enabled,
          can_invite: sq.can_invite,
          can_approve: sq.can_approve,
          can_scan: sq.can_scan,
          can_view_report: sq.can_view_report,
        }));

    await api.post('/events', {
      ...newEvent.value,
      staff_quotas: staffQuotasToSend,
    });
    alert('Tạo sự kiện và thiết lập phân quyền tài khoản thành công!');
    showCreateEventModal.value = false;
    newEvent.value = {
      name: '',
      description: '',
      location: '',
      start_at: '2026-10-15T08:30',
      end_at: '2026-10-15T17:30',
      capacity: 500,
      approval_mode: 'REFERRER_ONLY',
      tenant_id: null,
      plan_id: null,
      payment_status: 'PAID',
      latitude: null,
      longitude: null,
      geofence_radius_meters: 0,
      geofence_enabled: false,
    };
    await loadEvents();
  } catch (e: any) {
    alert(e.response?.data?.message || e.message);
  }
};

const handleToggleEventStatus = async (ev: any) => {
  const isClosing = ev.status === 'PUBLISHED';
  const actionText = isClosing ? 'TẮT / TẠM DỪNG' : 'BẬT / MỞ LẠI';
  if (!confirm(`Bạn có chắc muốn ${actionText} sự kiện "${ev.name}"?`)) return;
  try {
    const res = await api.patch(`/events/${ev.id}/toggle-status`);
    alert(res.data.message || 'Đã cập nhật trạng thái sự kiện!');
    await Promise.all([loadEvents(), loadSummary()]);
  } catch (e: any) {
    alert(e.response?.data?.message || e.message);
  }
};

const handleDeleteEvent = async (ev: any) => {
  if (
    !confirm(
      `⚠️ CẢNH BÁO NGUY HIỂM: Bạn có chắc chắn muốn XÓA VĨNH VIỄN sự kiện "${ev.name}"?\n\nToàn bộ vé QR, link mời, lượt đăng ký và lịch sử quét liên quan sẽ bị xóa sạch.`
    )
  )
    return;
  try {
    const res = await api.delete(`/events/${ev.id}`);
    alert(res.data.message || 'Đã xóa sự kiện thành công!');
    await Promise.all([loadEvents(), loadSummary()]);
  } catch (e: any) {
    alert(e.response?.data?.message || e.message);
  }
};

const openEventDetail = async (event: any) => {
  showEventDetailModal.value = true;
  eventReportLoading.value = true;
  attendeeSearch.value = '';
  attendeeFilter.value = 'all_tickets';
  getSocket().emit('join:event', event.id);
  try {
    const res = await api.get(`/events/${event.id}/report`);
    selectedEventReport.value = res.data.data;
  } catch (e: any) {
    alert(e.response?.data?.message || e.message);
    showEventDetailModal.value = false;
  } finally {
    eventReportLoading.value = false;
  }
};

const closeEventDetail = () => {
  if (selectedEventReport.value?.event?.id) {
    getSocket().emit('leave:event', selectedEventReport.value.event.id);
  }
  showEventDetailModal.value = false;
};

const filteredAttendees = computed(() => {
  if (!selectedEventReport.value?.attendees) return [];
  let list = selectedEventReport.value.attendees;

  if (attendeeFilter.value === 'all_tickets') {
    list = list.filter((a: any) => a.ticket_id && a.registration_status === 'APPROVED');
  } else if (attendeeFilter.value === 'attended') {
    list = list.filter((a: any) => a.ticket_status === 'USED');
  } else if (attendeeFilter.value === 'absent') {
    list = list.filter((a: any) => a.ticket_status === 'ISSUED');
  } else if (attendeeFilter.value === 'pending') {
    list = list.filter((a: any) => a.registration_status === 'PENDING' || a.registration_status === 'PENDING_ADMIN');
  }

  if (attendeeSearch.value.trim()) {
    const q = attendeeSearch.value.toLowerCase().trim();
    list = list.filter((a: any) =>
      (a.full_name && a.full_name.toLowerCase().includes(q)) ||
      (a.phone && a.phone.includes(q)) ||
      (a.email && a.email.toLowerCase().includes(q)) ||
      (a.ticket_code && a.ticket_code.toLowerCase().includes(q)) ||
      (a.referrer_name && a.referrer_name.toLowerCase().includes(q))
    );
  }

  return list;
});

const adminApproveRegistration = async (regId: number) => {
  if (!confirm('Xác nhận phê duyệt và cấp vé QR cho khách này?')) return;
  try {
    await api.put(`/registrations/${regId}/approve`);
    if (selectedEventReport.value?.event?.id) {
      const res = await api.get(`/events/${selectedEventReport.value.event.id}/report`);
      selectedEventReport.value = res.data.data;
    }
    await loadEvents();
    await loadSummary();
  } catch (e: any) {
    alert(e.response?.data?.message || e.message);
  }
};

const exportToCsv = () => {
  if (!selectedEventReport.value?.attendees?.length) {
    alert('Không có dữ liệu khách để xuất báo cáo.');
    return;
  }

  const items = filteredAttendees.value;
  const headers = [
    'STT',
    'Họ và tên',
    'Số điện thoại',
    'Email',
    'Địa chỉ',
    'Người giới thiệu',
    'Trạng thái đăng ký',
    'Mã số vé QR',
    'Trạng thái tham dự',
    'Thời gian Check-in',
    'Nhân viên soát vé',
  ];

  const rows = items.map((a: any, idx: number) => [
    idx + 1,
    `"${(a.full_name || '').replace(/"/g, '""')}"`,
    `"${a.phone || ''}"`,
    `"${a.email || ''}"`,
    `"${(a.address || '').replace(/"/g, '""')}"`,
    `"${(a.referrer_name || '').replace(/"/g, '""')}"`,
    `"${a.registration_status || ''}"`,
    `"${a.ticket_code || 'Chưa cấp'}"`,
    `"${a.ticket_status === 'USED' ? 'ĐÃ CHECK-IN (ĐI)' : a.ticket_id ? 'CHƯA CHECK-IN (KHÔNG ĐI)' : 'CHƯA CÓ VÉ'}"`,
    `"${a.checked_in_at ? new Date(a.checked_in_at).toLocaleString('vi-VN') : ''}"`,
    `"${a.scanner_name || ''}"`,
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const safeName = (selectedEventReport.value.event.name || 'SuKien').replace(/[^a-zA-Z0-9_\u00C0-\u024F]/g, '_');
  link.setAttribute('download', `Bao_cao_khach_EventGo_${safeName}_${new Date().toISOString().substring(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const openStaffQuota = async (event: any) => {
  selectedEventForQuota.value = event;
  showQuotaModal.value = true;
  quotaLoading.value = true;
  quotaSearch.value = '';
  quotaFilter.value = 'ALL';
  try {
    const res = await api.get(`/events/${event.id}/staff-quotas`);
    staffQuotasList.value = res.data.data.map((st: any) => ({
      ...st,
      is_enabled: Boolean(Number(st.is_enabled)),
      can_invite: Boolean(Number(st.can_invite)),
      can_approve: Boolean(Number(st.can_approve)),
      can_scan: Boolean(Number(st.can_scan)),
      can_view_report: Boolean(Number(st.can_view_report)),
      saving: false,
    }));
  } catch (e: any) {
    alert(e.response?.data?.message || e.message);
    showQuotaModal.value = false;
  } finally {
    quotaLoading.value = false;
  }
};

const saveStaffQuota = async (staff: any) => {
  try {
    staff.saving = true;
    await api.post(`/events/${selectedEventForQuota.value.id}/staff-quotas`, {
      staff_id: staff.staff_id,
      max_invites: staff.max_invites,
      is_enabled: staff.is_enabled,
      can_invite: staff.can_invite,
      can_approve: staff.can_approve,
      can_scan: staff.can_scan,
      can_view_report: staff.can_view_report,
    });
    alert(`Đã cập nhật phân quyền và hạn mức cho nhân viên ${staff.staff_name}!`);
  } catch (e: any) {
    alert(e.response?.data?.message || e.message);
  } finally {
    staff.saving = false;
  }
};

const applyStaffQuotaListPreset = async (st: any, preset: 'ALL' | 'INVITE_ONLY' | 'SCAN_ONLY' | 'NONE') => {
  if (preset === 'ALL') {
    st.is_enabled = true;
    st.can_invite = true;
    st.can_approve = true;
    st.can_scan = true;
    st.can_view_report = true;
  } else if (preset === 'INVITE_ONLY') {
    st.is_enabled = true;
    st.can_invite = true;
    st.can_approve = false;
    st.can_scan = false;
    st.can_view_report = true;
  } else if (preset === 'SCAN_ONLY') {
    st.is_enabled = true;
    st.can_invite = false;
    st.can_approve = false;
    st.can_scan = true;
    st.can_view_report = false;
  } else if (preset === 'NONE') {
    st.is_enabled = false;
    st.can_invite = false;
    st.can_approve = false;
    st.can_scan = false;
    st.can_view_report = false;
  }
  await saveStaffQuota(st);
};

const loadAllUsers = async () => {
  try {
    const res = await api.get('/users');
    allUsersList.value = res.data.data;
  } catch (e: any) {
    console.error(e);
  }
};

const isTenantAccount = (user: any) =>
  user?.type === 'TENANT_ADMIN' || Boolean(user?.is_tenant_account);

const getUserTheme = (user: any) => {
  if (user?.type === 'ADMIN') {
    return {
      category: 'ADMIN',
      label: 'Admin hệ thống',
      avatarClass: 'bg-purple-600 text-white shadow-xs ring-2 ring-purple-200',
      badgeClass: 'bg-purple-100 text-purple-800 border border-purple-200 font-bold',
      rowClass: 'bg-purple-50/30 hover:bg-purple-50/60 border-l-4 border-l-purple-500',
      cardClass: 'border-l-4 border-l-purple-500 bg-purple-50/20',
    };
  }
  if (isTenantAccount(user)) {
    return {
      category: 'TENANT',
      label: user?.type === 'TENANT_ADMIN' ? 'Khách thuê' : 'Nhân sự Khách thuê',
      avatarClass: 'bg-amber-500 text-white shadow-xs ring-2 ring-amber-200',
      badgeClass: 'bg-amber-100 text-amber-900 border border-amber-300 font-bold',
      rowClass: 'bg-amber-50/35 hover:bg-amber-50/70 border-l-4 border-l-amber-500',
      cardClass: 'border-l-4 border-l-amber-500 bg-amber-50/25',
    };
  }
  if (user?.type === 'STAFF') {
    return {
      category: 'STAFF',
      label: 'Nhân viên nội bộ',
      avatarClass: 'bg-sky-100 text-sky-800 border border-sky-200',
      badgeClass: 'bg-sky-100 text-sky-800 border border-sky-200 font-bold',
      rowClass: 'hover:bg-slate-50',
      cardClass: '',
    };
  }
  return {
    category: 'CUSTOMER',
    label: 'Khách hàng',
    avatarClass: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
    badgeClass: 'bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold',
    rowClass: 'hover:bg-slate-50',
    cardClass: '',
  };
};

const filteredAllUsers = computed(() => {
  let list = allUsersList.value;
  if (userRoleFilter.value !== 'ALL') {
    if (userRoleFilter.value === 'TENANT') {
      list = list.filter((u: any) => isTenantAccount(u));
    } else if (userRoleFilter.value === 'STAFF') {
      list = list.filter((u: any) => u.type === 'STAFF' && !isTenantAccount(u));
    } else if (userRoleFilter.value === 'CUSTOMER') {
      list = list.filter((u: any) => u.type === 'CUSTOMER' && !isTenantAccount(u));
    } else {
      list = list.filter((u: any) => u.type === userRoleFilter.value);
    }
  }
  if (userStatusFilter.value !== 'ALL') {
    list = list.filter((u: any) => u.status === userStatusFilter.value);
  }
  if (userSearch.value.trim()) {
    const q = userSearch.value.toLowerCase().trim();
    list = list.filter((u: any) =>
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.phone && u.phone.includes(q)) ||
      (u.tenant_names && u.tenant_names.toLowerCase().includes(q))
    );
  }
  return list;
});

const handleCreateUser = async () => {
  try {
    await api.post('/users', newUser.value);
    alert('Tạo người dùng thành công!');
    showCreateUserModal.value = false;
    newUser.value = { name: '', email: '', phone: '', type: 'STAFF', password: 'Staff@123' };
    await Promise.all([loadAllUsers(), loadStaff(), loadSummary()]);
  } catch (e: any) {
    alert(e.response?.data?.message || e.message);
  }
};

const handleToggleUserStatus = async (user: any) => {
  const nextStatus = user.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
  const actionName = nextStatus === 'BLOCKED' ? 'khóa' : 'mở khóa';
  if (!confirm(`Bạn có chắc chắn muốn ${actionName} tài khoản ${user.name} (${user.email})?`)) return;
  try {
    await api.put(`/users/${user.id}/status`, { status: nextStatus });
    await Promise.all([loadAllUsers(), loadStaff()]);
  } catch (e: any) {
    alert(e.response?.data?.message || e.message);
  }
};

const handleChangeUserRole = async (user: any, newRole: string) => {
  if (user.type === newRole) return;
  if (!confirm(`Xác nhận đổi vai trò của ${user.name} sang ${newRole}?`)) return;
  try {
    await api.put(`/users/${user.id}/role`, { type: newRole });
    await Promise.all([loadAllUsers(), loadStaff()]);
  } catch (e: any) {
    alert(e.response?.data?.message || e.message);
  }
};

const openResetPasswordModal = (user: any) => {
  selectedUserForPassword.value = user;
  newPasswordInput.value = user.type === 'ADMIN' ? 'Admin@123' : 'Staff@123';
  showResetPasswordModal.value = true;
};

const handleSaveResetPassword = async () => {
  if (!selectedUserForPassword.value || !newPasswordInput.value) return;
  try {
    await api.put(`/users/${selectedUserForPassword.value.id}/reset-password`, {
      password: newPasswordInput.value,
    });
    alert(`Đã đổi mật khẩu cho ${selectedUserForPassword.value.name} thành công!`);
    showResetPasswordModal.value = false;
  } catch (e: any) {
    alert(e.response?.data?.message || e.message);
  }
};

const handleDeleteUser = async (user: any) => {
  deleteUserTarget.value = user;
  deleteUserPin.value = '';
  deleteUserError.value = '';
  deleteUserDeps.value = null;
  deleteUserDepsLoading.value = true;
  showDeleteUserModal.value = true;

  try {
    const res = await api.get(`/users/${user.id}/dependencies`);
    deleteUserDeps.value = res.data.data;
  } catch (e: any) {
    const hasLocalDeps =
      Number(user.created_tenants_count || 0) > 0 ||
      Number(user.created_events_count || 0) > 0;
    deleteUserDeps.value = {
      hasForeignKeyConstraint: hasLocalDeps,
      hasRelatedData: hasLocalDeps || Number(user.registrations_count || 0) > 0 || Number(user.links_count || 0) > 0,
      foreignKeyItems: hasLocalDeps ? ['Tài khoản đang có dữ liệu khóa phụ (khách thuê / sự kiện đã tạo).'] : [],
      cascadeItems: [],
    };
  } finally {
    deleteUserDepsLoading.value = false;
  }
};

const confirmDeleteUser = async () => {
  if (!deleteUserTarget.value) return;
  const cleanPin = deleteUserPin.value.trim();
  if (!/^\d{4}$/.test(cleanPin)) {
    deleteUserError.value = 'Vui lòng nhập đủ mật khẩu xác nhận 4 chữ số (ví dụ: xxxx) để xóa vĩnh viễn.';
    return;
  }
  deleteUserSubmitting.value = true;
  deleteUserError.value = '';
  try {
    await api.delete(`/users/${deleteUserTarget.value.id}`, { data: { pin: cleanPin } });
    showDeleteUserModal.value = false;
    deleteUserTarget.value = null;
    await Promise.all([loadAllUsers(), loadStaff(), loadSummary()]);
  } catch (e: any) {
    deleteUserError.value = e.response?.data?.message || e.message || 'Không thể xóa người dùng.';
  } finally {
    deleteUserSubmitting.value = false;
  }
};

const handleLockUserInsteadOfDelete = async () => {
  if (!deleteUserTarget.value) return;
  deleteUserLocking.value = true;
  deleteUserError.value = '';
  try {
    await api.put(`/users/${deleteUserTarget.value.id}/status`, { status: 'BLOCKED' });
    showDeleteUserModal.value = false;
    deleteUserTarget.value = null;
    await Promise.all([loadAllUsers(), loadStaff()]);
  } catch (e: any) {
    deleteUserError.value = e.response?.data?.message || e.message || 'Không thể khóa tài khoản.';
  } finally {
    deleteUserLocking.value = false;
  }
};

// ==========================================
// REALTIME OTP MONITOR & GENERATOR (Admin)
// ==========================================
const showOtpModal = ref(false);
const otpList = ref<any[]>([]);
const otpLoading = ref(false);
const otpSearchQuery = ref('');
const generateOtpTarget = ref('');
const generatingOtp = ref(false);
const copiedOtpCode = ref<string | null>(null);

const activeOtpCount = computed(() => {
  return otpList.value.filter((item) => item.is_valid).length;
});

const loadRecentOtps = async () => {
  otpLoading.value = true;
  try {
    const params: any = {};
    if (otpSearchQuery.value.trim()) {
      params.q = otpSearchQuery.value.trim();
    }
    const res = await api.get('/dashboard/recent-otps', { params });
    otpList.value = res.data.data || [];
  } catch (err: any) {
    console.error('Failed to load recent OTPs:', err);
  } finally {
    otpLoading.value = false;
  }
};

const openOtpModal = () => {
  showOtpModal.value = true;
  loadRecentOtps();
};

const handleGenerateInstantOtp = async () => {
  if (!generateOtpTarget.value.trim()) return;
  generatingOtp.value = true;
  try {
    const res = await api.post('/dashboard/generate-otp', {
      target: generateOtpTarget.value.trim(),
    });
    alert(res.data.message || 'Tạo OTP thành công!');
    generateOtpTarget.value = '';
    await loadRecentOtps();
  } catch (err: any) {
    alert(err.response?.data?.message || err.message || 'Lỗi khi tạo mã OTP');
  } finally {
    generatingOtp.value = false;
  }
};

const copyOtpToClipboard = async (code: string) => {
  try {
    await navigator.clipboard.writeText(code);
    copiedOtpCode.value = code;
    setTimeout(() => {
      if (copiedOtpCode.value === code) {
        copiedOtpCode.value = null;
      }
    }, 2000);
  } catch (e) {
    console.error('Clipboard copy failed:', e);
  }
};

const formatOtpTime = (dateStr: string) => {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return (
      d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
      ' ' +
      d.toLocaleDateString('vi-VN')
    );
  } catch {
    return dateStr;
  }
};
</script>

<template>
  <div class="mx-auto w-full min-w-0 max-w-7xl overflow-x-clip px-4 py-6 pb-4 sm:px-6 sm:py-8 lg:px-8 space-y-6 animate-page-in">
    <!-- Top Header & Tabs -->
    <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
      <div class="min-w-0 w-full">
        <div class="flex items-center gap-2">
          <span class="chip chip-primary text-[10px]">
            Master Console
          </span>
          <span class="text-xs text-slate-400 font-mono">
            EventGo Enterprise
          </span>
        </div>
        <h1 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
          Trung Tâm Quản Trị Hệ Thống
        </h1>
        <p class="text-xs text-slate-500 mt-0.5">
          Phân quyền động (RBAC), điều hành sự kiện thời gian thực & danh bạ tài khoản
        </p>
      </div>

      <div class="flex min-w-0 w-full flex-wrap items-center gap-2.5 lg:w-auto">
        <a
          href="/admin/tenants"
          class="btn border border-primary-200 bg-primary-50 text-primary-800 text-xs hover:bg-primary-100"
        >
          <Building class="w-4 h-4" />
          <span>Khách thuê</span>
        </a>
        <!-- Direct Quick OTP Button for Admin -->
        <button
          @click="openOtpModal"
          class="btn bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs py-2 px-3.5 rounded-2xl shadow-sm flex items-center gap-2 transition cursor-pointer"
          title="Xem và cấp mã xác thực OTP đăng nhập/đăng ký tức thì"
        >
          <Key class="w-4 h-4" />
          <span>Lấy Mã OTP</span>
          <span
            v-if="activeOtpCount > 0"
            class="bg-white text-amber-700 text-[10px] font-black px-1.5 py-0.5 rounded-full font-mono shadow-xs"
          >
            {{ activeOtpCount }}
          </span>
        </button>

        <!-- Segmented Navigation Tabs -->
        <div class="grid w-full min-w-0 grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1.5 text-xs font-bold lg:flex lg:w-auto lg:grid-cols-none">
          <button
            @click="activeTab = 'overview'"
            :class="activeTab === 'overview' ? 'bg-white shadow-xs text-primary-700' : 'text-slate-600 hover:text-slate-900'"
            class="flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-center transition lg:px-3.5 lg:whitespace-nowrap"
          >
            <BarChart3 class="w-3.5 h-3.5" />
            <span>Tổng quan</span>
          </button>

          <button
            @click="activeTab = 'users'"
            :class="activeTab === 'users' ? 'bg-white shadow-xs text-primary-700' : 'text-slate-600 hover:text-slate-900'"
            class="flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-center transition lg:px-3.5 lg:whitespace-nowrap"
          >
            <Users class="w-3.5 h-3.5" />
            <span>Người dùng ({{ allUsersList.length }})</span>
          </button>

          <button
            @click="activeTab = 'staff'"
            :class="activeTab === 'staff' ? 'bg-white shadow-xs text-primary-700' : 'text-slate-600 hover:text-slate-900'"
            class="flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-center transition lg:px-3.5 lg:whitespace-nowrap"
          >
            <ShieldCheck class="w-3.5 h-3.5" />
            <span>Quản lý nhân sự</span>
          </button>

          <button
            @click="activeTab = 'events'"
            :class="activeTab === 'events' ? 'bg-white shadow-xs text-primary-700' : 'text-slate-600 hover:text-slate-900'"
            class="flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-center transition lg:px-3.5 lg:whitespace-nowrap"
          >
            <Calendar class="w-3.5 h-3.5" />
            <span>Sự kiện ({{ eventsList.length }})</span>
          </button>

          <button
            @click="activeTab = 'settings'"
            :class="activeTab === 'settings' ? 'bg-white shadow-xs text-primary-700' : 'text-slate-600 hover:text-slate-900'"
            class="last:col-span-2 flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-center transition lg:last:col-span-1 lg:px-3.5 lg:whitespace-nowrap"
          >
            <Settings class="w-3.5 h-3.5" />
            <span>Cài đặt & Tích hợp</span>
          </button>
        </div>
      </div>
    </div>

    <!-- TAB 1: OVERVIEW METRICS -->
    <div v-if="activeTab === 'overview'" class="space-y-6">
      <div class="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div class="card min-w-0 p-4 space-y-2 sm:p-5">
          <div class="flex items-center justify-between text-slate-400">
            <span class="text-[11px] font-bold uppercase tracking-wider">Tổng vé phát hành</span>
            <Ticket class="w-4 h-4 text-primary-600" />
          </div>
          <div class="text-3xl font-black text-slate-900">{{ metrics?.total_tickets || 0 }}</div>
          <div class="text-[11px] text-slate-500 font-medium">Từ {{ metrics?.total_events || 0 }} sự kiện</div>
        </div>

        <div class="card min-w-0 p-4 space-y-2 sm:p-5">
          <div class="flex items-center justify-between text-emerald-600">
            <span class="text-[11px] font-bold uppercase tracking-wider">Đã Check-in</span>
            <CheckCircle2 class="w-4 h-4 text-emerald-600" />
          </div>
          <div class="text-3xl font-black text-emerald-600">{{ metrics?.total_checked_in || 0 }}</div>
          <div class="text-[11px] text-emerald-700 font-medium">1 vé chỉ quét 1 lần</div>
        </div>

        <div class="card min-w-0 p-4 space-y-2 sm:p-5">
          <div class="flex items-center justify-between text-amber-600">
            <span class="text-[11px] font-bold uppercase tracking-wider">Tranh chấp cần xử lý</span>
            <AlertTriangle class="w-4 h-4 text-amber-600" />
          </div>
          <div class="text-3xl font-black text-amber-600">{{ metrics?.pending_disputes || 0 }}</div>
          <div class="text-[11px] text-amber-700 font-medium">Ca trùng vé chờ trọng tài</div>
        </div>

        <div class="card min-w-0 p-4 space-y-2 sm:p-5">
          <div class="flex items-center justify-between text-indigo-600">
            <span class="text-[11px] font-bold uppercase tracking-wider">Đội ngũ nhân sự</span>
            <Users class="w-4 h-4 text-indigo-600" />
          </div>
          <div class="text-3xl font-black text-indigo-600">{{ metrics?.total_staff || 0 }}</div>
          <div class="text-[11px] text-indigo-700 font-medium">Phân quyền động linh hoạt</div>
        </div>
      </div>

      <!-- Recent Scan Audit Trail -->
      <div class="card p-5 sm:p-6 space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-base font-black text-slate-900">Nhật Ký Quét Mã QR (Audit Trail)</h2>
            <p class="text-xs text-slate-500">Ghi nhận thời gian thực mọi lần quét tại các cổng soát vé</p>
          </div>
          <span class="chip chip-success text-xs flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Realtime</span>
          </span>
        </div>

        <div class="border border-slate-200/90 rounded-2xl overflow-hidden bg-white shadow-xs">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50/90 text-slate-500 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                <tr>
                  <th class="py-3 px-4">Thời gian</th>
                  <th class="py-3 px-4">Mã số vé</th>
                  <th class="py-3 px-4">Khách hàng</th>
                  <th class="py-3 px-4">Nhân viên quét</th>
                  <th class="py-3 px-4">Kết quả</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="scan in metrics?.recent_scans || []" :key="scan.id" class="hover:bg-slate-50">
                  <td class="py-3 px-4 text-slate-500 font-mono">{{ new Date(scan.scanned_at).toLocaleTimeString('vi-VN') }}</td>
                  <td class="py-3 px-4 font-mono font-bold text-slate-800">{{ scan.scanned_code }}</td>
                  <td class="py-3 px-4 font-bold text-slate-900">{{ scan.attendee_name || 'N/A' }}</td>
                  <td class="py-3 px-4 text-slate-600">{{ scan.scanner_name }}</td>
                  <td class="py-3 px-4">
                    <span
                      :class="{
                        'chip-success': scan.result === 'SUCCESS',
                        'chip-amber': scan.result === 'ALREADY_USED',
                        'chip-danger': scan.result === 'INVALID',
                      }"
                      class="chip text-[10px]"
                    >
                      {{ scan.result }}
                    </span>
                  </td>
                </tr>
                <tr v-if="!metrics?.recent_scans?.length">
                  <td colspan="5" class="py-8 text-center text-slate-400">Chưa có lịch sử quét nào.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Check-in Velocity Timeline & Traffic Peak (Group 4.7) -->
      <div class="card p-5 sm:p-6 space-y-4">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div class="flex items-center gap-2">
              <Activity class="w-4 h-4 text-primary-600" />
              <h2 class="text-base font-black text-slate-900">Biểu Đồ Vận Tốc Check-in & Giờ Cao Điểm</h2>
            </div>
            <p class="text-xs text-slate-500">Phân tích lưu lượng quét qua từng khung giờ theo thời gian thực</p>
          </div>

          <div class="flex items-center gap-2 w-full sm:w-auto">
            <select
              v-model="selectedVelocityEventId"
              @change="loadVelocity(); loadLeaderboard()"
              class="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 w-full sm:w-auto"
            >
              <option :value="null">Tất cả sự kiện</option>
              <option v-for="ev in displayedEvents" :key="ev.id" :value="ev.id">{{ ev.name }}</option>
            </select>
          </div>
        </div>

        <!-- Velocity Peak Highlight Banner -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-2xl flex items-center justify-between">
            <div>
              <div class="text-[10px] font-bold text-indigo-600 uppercase">Khung giờ cao điểm nhất</div>
              <div class="text-xl font-black text-indigo-950 mt-0.5">{{ velocityData?.peak_hour || '—' }}</div>
            </div>
            <Zap class="w-7 h-7 text-indigo-500" />
          </div>

          <div class="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center justify-between">
            <div>
              <div class="text-[10px] font-bold text-emerald-600 uppercase">Lưu lượng đỉnh cao nhất</div>
              <div class="text-xl font-black text-emerald-950 mt-0.5">{{ velocityData?.peak_scans || 0 }} <span class="text-xs font-normal">lượt/h</span></div>
            </div>
            <TrendingUp class="w-7 h-7 text-emerald-500" />
          </div>

          <div class="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
            <div>
              <div class="text-[10px] font-bold text-slate-500 uppercase">Tổng khung giờ ghi nhận</div>
              <div class="text-xl font-black text-slate-900 mt-0.5">{{ velocityData?.timeline?.length || 0 }} <span class="text-xs font-normal">khung giờ</span></div>
            </div>
            <Clock class="w-7 h-7 text-slate-400" />
          </div>
        </div>

        <!-- Hourly Bars Visual Chart -->
        <div v-if="velocityData?.timeline?.length" class="p-4 bg-slate-950 rounded-2xl text-white space-y-3">
          <div class="flex flex-col gap-2 border-b border-slate-800 pb-2 text-[11px] text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <span class="min-w-0 font-bold leading-relaxed">Biểu đồ phân bố lưu lượng theo giờ (Vận tốc check-in)</span>
            <div class="flex flex-wrap gap-x-3 gap-y-1 sm:shrink-0">
              <span class="flex items-center gap-1 whitespace-nowrap"><span class="w-2.5 h-2.5 rounded bg-emerald-500"></span> Thành công</span>
              <span class="flex items-center gap-1 whitespace-nowrap"><span class="w-2.5 h-2.5 rounded bg-amber-500"></span> Trùng lặp</span>
              <span class="flex items-center gap-1 whitespace-nowrap"><span class="w-2.5 h-2.5 rounded bg-rose-500"></span> Không hợp lệ</span>
            </div>
          </div>

          <div class="flex items-end gap-2 sm:gap-3 h-48 pt-6 pb-2 px-2 overflow-x-auto">
            <div
              v-for="item in velocityData.timeline"
              :key="item.time_block"
              class="flex-1 min-w-[42px] max-w-[64px] flex flex-col items-center gap-1.5 h-full justify-end group relative"
            >
              <!-- Tooltip pill on hover -->
              <div class="absolute -top-7 opacity-0 group-hover:opacity-100 transition pointer-events-none bg-slate-800 text-[10px] font-mono font-bold text-white px-2 py-0.5 rounded shadow whitespace-nowrap z-20">
                {{ item.total_scans }} lượt (✓{{ item.success_scans }} / ⚠️{{ item.duplicate_scans }} / ✗{{ item.invalid_scans }})
              </div>

              <!-- Bar Container -->
              <div class="w-full bg-slate-800/80 rounded-t-lg flex flex-col-reverse overflow-hidden" :style="{ height: Math.max(12, Math.round(((item.total_scans || 1) / (velocityData.peak_scans || 1)) * 100)) + '%' }">
                <!-- Success portion -->
                <div class="w-full bg-emerald-500" :style="{ height: Math.round(((item.success_scans || 0) / (item.total_scans || 1)) * 100) + '%' }"></div>
                <!-- Duplicate portion -->
                <div class="w-full bg-amber-500" :style="{ height: Math.round(((item.duplicate_scans || 0) / (item.total_scans || 1)) * 100) + '%' }"></div>
                <!-- Invalid portion -->
                <div class="w-full bg-rose-500" :style="{ height: Math.round(((item.invalid_scans || 0) / (item.total_scans || 1)) * 100) + '%' }"></div>
              </div>

              <!-- Label -->
              <span class="text-[10px] font-mono text-slate-400 group-hover:text-white transition">{{ item.time_block }}</span>
            </div>
          </div>
        </div>

        <div v-else class="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl">
          Chưa có dữ liệu vận tốc quét mã trong sự kiện được chọn.
        </div>
      </div>

      <!-- Top Referrers Leaderboard (Group 4.8) -->
      <div class="card p-5 sm:p-6 space-y-4">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0">
            <div class="flex min-w-0 items-center gap-2">
              <Trophy class="w-4 h-4 text-amber-500" />
              <h2 class="min-w-0 text-base font-black text-slate-900">Bảng Xếp Hạng Người Giới Thiệu (Top Referrers)</h2>
            </div>
            <p class="text-xs text-slate-500">Tôn vinh nhân sự có số lượng khách thực tế tham dự (Show-up) cao nhất</p>
          </div>
          <span class="chip chip-amber text-xs font-bold flex items-center gap-1">
            <Award class="w-3.5 h-3.5" />
            <span>Leaderboard</span>
          </span>
        </div>

        <div class="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                <tr>
                  <th class="py-3 px-4 text-center">Thứ hạng</th>
                  <th class="py-3 px-4">Người giới thiệu</th>
                  <th class="py-3 px-4 text-center">Khách đã mời</th>
                  <th class="py-3 px-4 text-center">Vé được duyệt</th>
                  <th class="py-3 px-4 text-center">Khách đã đi (Thực tế)</th>
                  <th class="py-3 px-4 text-center">Tỷ lệ đi (Show-up)</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr
                  v-for="(refItem, index) in leaderboardData"
                  :key="refItem.referrer_id"
                  :class="index === 0 ? 'bg-amber-50/40 font-semibold' : 'hover:bg-slate-50'"
                >
                  <td class="py-3 px-4 text-center">
                    <span
                      v-if="index === 0"
                      class="w-7 h-7 rounded-full bg-amber-400 text-amber-950 font-black inline-flex items-center justify-center text-xs shadow-xs"
                      title="Quán quân"
                    >
                      🥇 1
                    </span>
                    <span
                      v-else-if="index === 1"
                      class="w-7 h-7 rounded-full bg-slate-300 text-slate-800 font-black inline-flex items-center justify-center text-xs"
                      title="Á quân"
                    >
                      🥈 2
                    </span>
                    <span
                      v-else-if="index === 2"
                      class="w-7 h-7 rounded-full bg-amber-700/20 text-amber-800 font-black inline-flex items-center justify-center text-xs"
                      title="Hạng 3"
                    >
                      🥉 3
                    </span>
                    <span v-else class="text-slate-400 font-bold text-xs font-mono">
                      #{{ index + 1 }}
                    </span>
                  </td>

                  <td class="py-3 px-4">
                    <div class="font-bold text-slate-900">{{ refItem.referrer_name }}</div>
                    <div class="text-[11px] text-slate-500 font-mono">{{ refItem.referrer_phone || refItem.referrer_email }}</div>
                  </td>

                  <td class="py-3 px-4 text-center font-bold text-slate-700">
                    {{ refItem.total_registered }}
                  </td>

                  <td class="py-3 px-4 text-center font-bold text-primary-700">
                    {{ refItem.total_approved }}
                  </td>

                  <td class="py-3 px-4 text-center font-black text-emerald-600 text-sm">
                    {{ refItem.total_attended }}
                  </td>

                  <td class="py-3 px-4 text-center">
                    <div class="flex items-center justify-center gap-2">
                      <div class="w-16 bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          class="bg-emerald-500 h-2 rounded-full"
                          :style="{ width: Math.min(100, refItem.show_up_rate) + '%' }"
                        ></div>
                      </div>
                      <span class="font-bold font-mono text-emerald-700 text-xs">{{ refItem.show_up_rate }}%</span>
                    </div>
                  </td>
                </tr>

                <tr v-if="!leaderboardData.length">
                  <td colspan="6" class="py-8 text-center text-slate-400">
                    Chưa có dữ liệu người giới thiệu cho sự kiện này.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: MASTER ADMIN USER MANAGEMENT -->
    <div v-if="activeTab === 'users'" class="space-y-6">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 class="text-xl font-black text-slate-900 tracking-tight">
            Quản Trị Người Dùng Hệ Thống
          </h2>
          <p class="text-xs text-slate-500">Quản lý tập trung tài khoản Admin, Nhân sự & Khách hàng</p>
        </div>
        <button
          @click="showCreateUserModal = true"
          class="btn btn-primary text-xs shadow-md"
        >
          <Plus class="w-3.5 h-3.5" />
          <span>Thêm người dùng mới</span>
        </button>
      </div>

      <!-- Quick Role Pills -->
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div class="card p-4 space-y-1">
          <div class="text-[10px] font-bold text-slate-400 uppercase">Tất cả</div>
          <div class="text-2xl font-black text-slate-900">{{ allUsersList.length }}</div>
          <div class="text-[10px] text-slate-500">Tài khoản</div>
        </div>
        <div class="card p-4 space-y-1 bg-purple-50/70 border-purple-200">
          <div class="text-[10px] font-bold text-purple-700 uppercase">Admin</div>
          <div class="text-2xl font-black text-purple-900">
            {{ allUsersList.filter(u => u.type === 'ADMIN').length }}
          </div>
          <div class="text-[10px] text-purple-600">Quản trị hệ thống</div>
        </div>
        <div class="card p-4 space-y-1 bg-amber-50/70 border-amber-300">
          <div class="text-[10px] font-bold text-amber-800 uppercase">Khách thuê</div>
          <div class="text-2xl font-black text-amber-950">
            {{ allUsersList.filter(u => isTenantAccount(u)).length }}
          </div>
          <div class="text-[10px] text-amber-700">Chủ & Nhân sự thuê</div>
        </div>
        <div class="card p-4 space-y-1 bg-sky-50/60 border-sky-200">
          <div class="text-[10px] font-bold text-sky-700 uppercase">Nhân viên</div>
          <div class="text-2xl font-black text-sky-900">
            {{ allUsersList.filter(u => u.type === 'STAFF' && !isTenantAccount(u)).length }}
          </div>
          <div class="text-[10px] text-sky-600">Nội bộ hệ thống</div>
        </div>
        <div class="card p-4 space-y-1 bg-emerald-50/50 border-emerald-200">
          <div class="text-[10px] font-bold text-emerald-700 uppercase">Khách hàng</div>
          <div class="text-2xl font-black text-emerald-900">
            {{ allUsersList.filter(u => u.type === 'CUSTOMER' && !isTenantAccount(u)).length }}
          </div>
          <div class="text-[10px] text-emerald-600">Khách đăng ký</div>
        </div>
      </div>

      <!-- Filters & Search Toolbar -->
      <div class="card p-3 sm:p-4 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
        <div class="flex flex-wrap gap-1.5 text-xs font-bold">
          <button
            @click="userRoleFilter = 'ALL'"
            :class="userRoleFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
            class="px-3 py-1.5 rounded-lg transition"
          >
            Tất cả
          </button>
          <button
            @click="userRoleFilter = 'ADMIN'"
            :class="userRoleFilter === 'ADMIN' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'"
            class="px-3 py-1.5 rounded-lg transition"
          >
            Admin
          </button>
          <button
            @click="userRoleFilter = 'TENANT'"
            :class="userRoleFilter === 'TENANT' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'"
            class="px-3 py-1.5 rounded-lg transition"
          >
            Khách thuê
          </button>
          <button
            @click="userRoleFilter = 'STAFF'"
            :class="userRoleFilter === 'STAFF' ? 'bg-sky-600 text-white' : 'bg-sky-50 text-sky-700 hover:bg-sky-100'"
            class="px-3 py-1.5 rounded-lg transition"
          >
            Nhân viên
          </button>
          <button
            @click="userRoleFilter = 'CUSTOMER'"
            :class="userRoleFilter === 'CUSTOMER' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'"
            class="px-3 py-1.5 rounded-lg transition"
          >
            Khách hàng
          </button>
        </div>

        <div class="flex items-center gap-2">
          <select
            v-model="userStatusFilter"
            class="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-700 focus:outline-none"
          >
            <option value="ALL">Mọi trạng thái</option>
            <option value="ACTIVE">Hoạt động</option>
            <option value="BLOCKED">Bị khóa</option>
          </select>

          <div class="relative flex-1 sm:w-60">
            <Search class="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              v-model="userSearch"
              type="text"
              placeholder="Tìm tên, SĐT, email, đơn vị..."
              class="w-full text-xs pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition"
            />
          </div>
        </div>
      </div>

      <!-- Users Desktop Table -->
      <div class="hidden md:block card overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th class="py-3.5 px-4">Người dùng</th>
                <th class="py-3.5 px-4">Thông tin liên hệ</th>
                <th class="py-3.5 px-4">Phân loại & Vai trò</th>
                <th class="py-3.5 px-4">Trạng thái</th>
                <th class="py-3.5 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="user in filteredAllUsers"
                :key="user.id"
                :class="getUserTheme(user).rowClass"
                class="transition-colors"
              >
                <td class="py-3.5 px-4">
                  <div class="flex items-center gap-3">
                    <div
                      :class="getUserTheme(user).avatarClass"
                      class="w-9 h-9 rounded-xl font-black text-xs flex items-center justify-center shrink-0 uppercase"
                    >
                      {{ user.name.slice(0, 2) }}
                    </div>
                    <div class="min-w-0">
                      <div class="font-extrabold text-slate-900 flex items-center gap-1.5 flex-wrap">
                        <span>{{ user.name }}</span>
                        <span v-if="user.id === 1" class="text-[9px] px-1.5 py-0.5 bg-purple-700 text-white rounded font-black">ROOT</span>
                      </div>
                      <div class="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span class="text-[11px] text-slate-400 font-mono">ID: #{{ user.id }}</span>
                        <span
                          v-if="user.tenant_names"
                          class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-100/90 text-amber-900 border border-amber-300 font-semibold"
                        >
                          <Building2 class="w-2.5 h-2.5 shrink-0" />
                          <span class="truncate max-w-[170px]">{{ user.tenant_names }}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </td>
                <td class="py-3.5 px-4">
                  <div class="font-medium text-slate-800">{{ user.email }}</div>
                  <div class="text-[11px] text-slate-400 font-mono">{{ user.phone || '—' }}</div>
                </td>
                <td class="py-3.5 px-4">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="chip text-[11px]" :class="getUserTheme(user).badgeClass">
                      {{ getUserTheme(user).label }}
                    </span>
                    <select
                      v-if="user.id !== 1"
                      :value="user.type"
                      @change="handleChangeUserRole(user, ($event.target as HTMLSelectElement).value)"
                      class="text-[11px] bg-white border border-slate-200 rounded px-1.5 py-0.5 font-medium text-slate-600 focus:outline-none"
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="TENANT_ADMIN">TENANT_ADMIN</option>
                      <option value="STAFF">STAFF</option>
                      <option value="CUSTOMER">CUSTOMER</option>
                    </select>
                  </div>
                </td>
                <td class="py-3.5 px-4 whitespace-nowrap">
                  <span
                    :class="user.status === 'ACTIVE' ? 'chip-success' : 'chip-danger'"
                    class="chip text-xs"
                  >
                    {{ user.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã khóa' }}
                  </span>
                </td>
                <td class="py-3.5 px-4 text-right">
                  <div class="flex items-center justify-end gap-1.5">
                    <button
                      v-if="user.type !== 'CUSTOMER'"
                      @click="openResetPasswordModal(user)"
                      class="btn btn-secondary py-1 px-2.5 text-[11px]"
                      title="Đổi mật khẩu"
                    >
                      <Key class="w-3 h-3" />
                      <span>Mật khẩu</span>
                    </button>
                    <button
                      v-if="user.id !== 1"
                      @click="handleToggleUserStatus(user)"
                      :class="user.status === 'ACTIVE' ? 'btn-secondary text-amber-700' : 'btn-secondary text-emerald-700'"
                      class="btn py-1 px-2 text-[11px]"
                    >
                      {{ user.status === 'ACTIVE' ? 'Khóa' : 'Mở' }}
                    </button>
                    <button
                      v-if="user.id !== 1"
                      @click="handleDeleteUser(user)"
                      class="btn btn-danger py-1 px-2 text-[11px]"
                      title="Xóa hoặc Khóa tài khoản"
                    >
                      <Trash2 class="w-3 h-3" />
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="filteredAllUsers.length === 0">
                <td colspan="5" class="py-8 text-center text-slate-400">
                  Không tìm thấy người dùng nào phù hợp.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Users Mobile Cards -->
      <div class="md:hidden space-y-3">
        <div
          v-for="user in filteredAllUsers"
          :key="user.id"
          :class="getUserTheme(user).cardClass"
          class="card p-4 space-y-3"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <div
                :class="getUserTheme(user).avatarClass"
                class="w-10 h-10 rounded-xl font-black text-sm flex items-center justify-center shrink-0 uppercase"
              >
                {{ user.name.slice(0, 2) }}
              </div>
              <div class="min-w-0">
                <div class="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
                  <span>{{ user.name }}</span>
                  <span v-if="user.id === 1" class="text-[9px] px-1.5 py-0.5 bg-purple-700 text-white rounded font-black">ROOT</span>
                </div>
                <div class="flex items-center gap-1.5 flex-wrap mt-0.5">
                  <span class="text-[11px] text-slate-400 font-mono">ID: #{{ user.id }}</span>
                  <span class="chip text-[10px]" :class="getUserTheme(user).badgeClass">
                    {{ getUserTheme(user).label }}
                  </span>
                </div>
                <div v-if="user.tenant_names" class="mt-1 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-semibold">
                  <Building2 class="w-2.5 h-2.5 shrink-0" />
                  <span class="truncate max-w-[200px]">{{ user.tenant_names }}</span>
                </div>
              </div>
            </div>

            <span
              :class="user.status === 'ACTIVE' ? 'chip-success' : 'chip-danger'"
              class="chip text-[10px] shrink-0"
            >
              {{ user.status === 'ACTIVE' ? 'Hoạt động' : 'Khóa' }}
            </span>
          </div>

          <div class="bg-slate-50/90 p-2.5 rounded-xl text-xs space-y-1 text-slate-600">
            <div class="flex items-center justify-between">
              <span class="text-slate-400 text-[11px]">Email:</span>
              <span class="font-medium text-slate-800 truncate ml-2">{{ user.email }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-400 text-[11px]">SĐT:</span>
              <span class="font-mono font-bold text-slate-800">{{ user.phone || 'Chưa cập nhật' }}</span>
            </div>
          </div>

          <div class="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
            <div v-if="user.id !== 1" class="flex items-center gap-1.5">
              <span class="text-[10px] text-slate-400 font-bold">Role:</span>
              <select
                :value="user.type"
                @change="handleChangeUserRole(user, ($event.target as HTMLSelectElement).value)"
                class="text-[11px] bg-white border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-700"
              >
                <option value="ADMIN">ADMIN</option>
                <option value="TENANT_ADMIN">TENANT_ADMIN</option>
                <option value="STAFF">STAFF</option>
                <option value="CUSTOMER">CUSTOMER</option>
              </select>
            </div>
            <div v-else class="text-[10px] text-purple-700 font-bold">Admin Tối Cao</div>

            <div class="flex items-center gap-1.5 ml-auto">
              <button
                v-if="user.type !== 'CUSTOMER'"
                @click="openResetPasswordModal(user)"
                class="btn btn-secondary py-1 px-2 text-xs"
              >
                <Key class="w-3 h-3" />
              </button>
              <button
                v-if="user.id !== 1"
                @click="handleToggleUserStatus(user)"
                class="btn btn-secondary py-1 px-2 text-xs"
              >
                {{ user.status === 'ACTIVE' ? 'Khóa' : 'Mở' }}
              </button>
              <button
                v-if="user.id !== 1"
                @click="handleDeleteUser(user)"
                class="btn btn-danger py-1 px-2 text-xs"
                title="Xóa hoặc Khóa tài khoản"
              >
                <Trash2 class="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 3: QUẢN LÝ NHÂN SỰ (CHIA RA NHÂN SỰ CHỦ & NHÂN SỰ KHÁCH THUÊ) -->
    <div v-if="activeTab === 'staff'" class="space-y-6">
      <!-- Staff Top Sub-Tab Switcher -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs">
        <div>
          <div class="flex items-center gap-2">
            <span class="chip chip-primary text-[10px]">Phân hệ nhân sự</span>
            <span class="text-xs text-slate-400 font-mono">Master & Tenant Teams</span>
          </div>
          <h2 class="text-lg sm:text-xl font-black text-slate-900 mt-1">
            Hệ Thống Phân Cấp & Quản Lý Đội Ngũ Nhân Sự
          </h2>
          <p class="text-xs text-slate-500">
            Tách biệt rõ ràng: 1) Nhân sự nội bộ của hệ thống chủ và 2) Đội ngũ nhân sự theo từng công ty khách thuê
          </p>
        </div>

        <!-- 2 Sub-tabs buttons -->
        <div class="inline-flex rounded-2xl bg-slate-100 p-1.5 border border-slate-200 shadow-inner shrink-0">
          <button
            type="button"
            @click="staffSubTab = 'master'"
            :class="staffSubTab === 'master' ? 'bg-white text-primary-700 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900 font-bold'"
            class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs transition cursor-pointer"
          >
            <Crown class="w-4 h-4 text-amber-500" />
            <span>1. Nhân sự chủ ({{ staffList.length }})</span>
          </button>
          <button
            type="button"
            @click="staffSubTab = 'tenant'"
            :class="staffSubTab === 'tenant' ? 'bg-white text-primary-700 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900 font-bold'"
            class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs transition cursor-pointer"
          >
            <Building2 class="w-4 h-4 text-blue-500" />
            <span>2. Nhân sự khách thuê ({{ availableTenants.length }} công ty)</span>
          </button>
        </div>
      </div>

      <!-- ============================================== -->
      <!-- SUB-TAB 1: NHÂN SỰ CHỦ (HỆ THỐNG MASTER & RBAC) -->
      <!-- ============================================== -->
      <div v-if="staffSubTab === 'master'" class="space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
          <div class="flex items-center gap-3.5">
            <div class="w-11 h-11 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200/80 flex items-center justify-center shrink-0">
              <Crown class="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 class="text-base font-black text-slate-900">Đội Ngũ Nhân Sự Hệ Thống Chủ & Phân Quyền Động</h3>
              <p class="text-xs text-slate-500 mt-0.5">Các tài khoản thuộc quyền quản lý trực tiếp của hệ thống chủ. Bật/tắt phân quyền theo thời gian thực.</p>
            </div>
          </div>
          <button
            @click="showCreateStaffModal = true"
            class="btn btn-primary text-xs shadow-xs shrink-0 flex items-center gap-1.5"
          >
            <Plus class="w-3.5 h-3.5" />
            <span>Thêm Nhân Viên Chủ</span>
          </button>
        </div>

        <!-- Master Staff Desktop Table -->
        <div class="hidden md:block card overflow-hidden border border-slate-200/90 shadow-xs">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th class="py-3.5 px-4 min-w-[180px]">Nhân sự chủ</th>
                  <th class="py-3.5 px-4 whitespace-nowrap">Vai trò nội bộ</th>
                  <th class="py-3.5 px-4 min-w-[170px]">Liên hệ</th>
                  <th class="py-3.5 px-4 whitespace-nowrap">Trạng thái</th>
                  <th class="py-3.5 px-4 min-w-[280px]">Phân quyền chi tiết (Bấm để bật/tắt)</th>
                  <th class="py-3.5 px-4 text-right whitespace-nowrap">Thao tác</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="staff in staffList" :key="staff.id" class="hover:bg-slate-50/70 transition">
                  <td class="py-4 px-4 font-black text-slate-900">
                    <div class="flex items-center gap-2.5">
                      <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary-600 to-indigo-600 text-white font-black flex items-center justify-center text-xs shadow-xs shrink-0">
                        {{ (staff.name || 'U').charAt(0).toUpperCase() }}
                      </div>
                      <div>
                        <div class="text-xs font-black text-slate-900">{{ staff.name }}</div>
                        <div class="text-[10px] text-slate-400 font-mono">ID: #{{ staff.id }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="py-4 px-4">
                    <span
                      v-if="staff.type === 'ADMIN'"
                      class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap"
                    >
                      <Crown class="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Quản trị viên</span>
                    </span>
                    <span
                      v-else
                      class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap"
                    >
                      <ShieldCheck class="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span>Nhân viên chủ</span>
                    </span>
                  </td>
                  <td class="py-4 px-4">
                    <div class="font-bold text-slate-800">{{ staff.email }}</div>
                    <div class="text-[11px] font-mono text-slate-400 mt-0.5">{{ staff.phone || '—' }}</div>
                  </td>
                  <td class="py-4 px-4">
                    <span
                      :class="staff.status === 'ACTIVE' ? 'chip-success' : 'chip-danger'"
                      class="chip text-[10px] uppercase font-bold"
                    >
                      {{ staff.status === 'ACTIVE' ? 'Hoạt động' : 'Đang khóa' }}
                    </span>
                  </td>
                  <td class="py-4 px-4">
                    <div class="flex flex-wrap gap-1.5">
                      <button
                        v-for="perm in permissionsList"
                        :key="perm.id"
                        type="button"
                        @click="toggleStaffPermission(staff, perm.id)"
                        :class="staff.permissions.some((p: any) => p.id === perm.id)
                          ? 'bg-primary-600 text-white border-primary-600 shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'"
                        class="px-2.5 py-1 border rounded-lg text-[10.5px] font-bold transition cursor-pointer"
                        :title="perm.description"
                      >
                        {{ staff.permissions.some((p: any) => p.id === perm.id) ? '✓ ' : '+ ' }}{{ perm.name }}
                      </button>
                    </div>
                  </td>
                  <td class="py-4 px-4 text-right">
                    <button
                      @click="toggleStaffStatus(staff)"
                      :class="staff.status === 'ACTIVE' ? 'btn-ghost text-rose-600 hover:bg-rose-50 border-rose-200' : 'btn-ghost text-emerald-600 hover:bg-emerald-50 border-emerald-200'"
                      class="btn border py-1.5 px-3 text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      {{ staff.status === 'ACTIVE' ? 'Khóa' : 'Mở khóa' }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Master Staff Mobile Cards -->
        <div class="md:hidden space-y-3">
          <div
            v-for="staff in staffList"
            :key="staff.id"
            class="card p-4 space-y-3 border border-slate-200 shadow-xs"
          >
            <div class="flex items-start justify-between gap-2">
              <div>
                <div class="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                  <span>{{ staff.name }}</span>
                  <span
                    v-if="staff.type === 'ADMIN'"
                    class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800"
                  >
                    ADMIN
                  </span>
                </div>
                <div class="text-xs text-slate-500 font-mono mt-0.5">{{ staff.phone || 'Chưa có SĐT' }}</div>
                <div class="text-[11px] text-slate-400">{{ staff.email }}</div>
              </div>

              <div class="flex flex-col items-end gap-1.5">
                <span
                  :class="staff.status === 'ACTIVE' ? 'chip-success' : 'chip-danger'"
                  class="chip text-[10px]"
                >
                  {{ staff.status === 'ACTIVE' ? 'Hoạt động' : 'Đang khóa' }}
                </span>
                <button
                  @click="toggleStaffStatus(staff)"
                  :class="staff.status === 'ACTIVE' ? 'text-rose-600 bg-rose-50 border border-rose-200' : 'text-emerald-600 bg-emerald-50 border border-emerald-200'"
                  class="px-2.5 py-1 rounded-lg text-xs font-bold transition"
                >
                  {{ staff.status === 'ACTIVE' ? 'Khóa' : 'Mở khóa' }}
                </button>
              </div>
            </div>

            <div class="pt-2 border-t border-slate-100">
              <div class="text-[11px] font-bold text-slate-500 mb-1.5">Phân quyền chi tiết (Bấm để gán):</div>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="perm in permissionsList"
                  :key="perm.id"
                  type="button"
                  @click="toggleStaffPermission(staff, perm.id)"
                  :class="staff.permissions.some((p: any) => p.id === perm.id)
                    ? 'bg-primary-600 text-white border-primary-600 shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200'"
                  class="px-2.5 py-1 border rounded-lg text-[10px] font-bold transition"
                >
                  {{ staff.permissions.some((p: any) => p.id === perm.id) ? '✓ ' : '+ ' }}{{ perm.name }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ============================================== -->
      <!-- SUB-TAB 2: NHÂN SỰ KHÁCH THUÊ (THEO CÔNG TY)   -->
      <!-- ============================================== -->
      <div v-if="staffSubTab === 'tenant'" class="space-y-6">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <!-- LEFT COLUMN: DANH SÁCH CÁC CÔNG TY (COL-SPAN-4) -->
          <div class="lg:col-span-4 space-y-3">
            <div class="card p-4 space-y-3.5 border border-slate-200/90 shadow-xs bg-white rounded-2xl">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <Building2 class="w-4 h-4" />
                  </div>
                  <div>
                    <h3 class="font-extrabold text-slate-900 text-xs sm:text-sm">Công Ty Khách Thuê</h3>
                    <p class="text-[10.5px] text-slate-400">Chọn công ty để xem đội ngũ</p>
                  </div>
                </div>
                <span class="px-2 py-0.5 rounded-full text-[11px] font-black bg-slate-100 text-slate-700">
                  {{ filteredTenantsForStaff.length }} đơn vị
                </span>
              </div>

              <!-- Search company box -->
              <div class="relative">
                <Search class="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  v-model="tenantSearchQuery"
                  type="text"
                  placeholder="Tìm theo tên công ty, đại diện, email..."
                  class="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary-500 transition"
                />
              </div>

              <!-- Companies list -->
              <div class="max-h-[640px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                <div
                  v-for="t in filteredTenantsForStaff"
                  :key="t.id"
                  @click="selectTenantForStaff(t.id)"
                  :class="selectedTenantId === t.id
                    ? 'border-primary-500 bg-primary-50/40 shadow-xs border-l-[4px] border-l-primary-600'
                    : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/70'"
                  class="p-3.5 rounded-xl border transition cursor-pointer text-left group"
                >
                  <div class="flex items-start gap-3">
                    <div
                      :class="selectedTenantId === t.id ? 'bg-primary-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 group-hover:bg-primary-50 group-hover:text-primary-700'"
                      class="w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 transition"
                    >
                      {{ (t.name || 'C').charAt(0).toUpperCase() }}
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center justify-between gap-1.5">
                        <div class="font-black text-xs text-slate-900 truncate group-hover:text-primary-700 transition">
                          {{ t.name }}
                        </div>
                        <span
                          :class="t.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'"
                          class="px-1.5 py-0.5 rounded text-[9px] font-bold border shrink-0 uppercase"
                        >
                          {{ t.status === 'ACTIVE' ? 'Hoạt động' : 'Đang khóa' }}
                        </span>
                      </div>
                      <div class="text-[11px] text-slate-500 flex items-center gap-1 mt-1 truncate">
                        <User class="w-3 h-3 text-slate-400 shrink-0" />
                        <span class="truncate font-medium">{{ t.contact_name }}</span>
                        <span class="text-slate-300">•</span>
                        <span class="text-slate-400 font-mono text-[10.5px] truncate">{{ t.contact_email }}</span>
                      </div>
                      <div class="flex items-center gap-2 mt-2.5 pt-2 border-t border-slate-100/90 text-[10px]">
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold bg-primary-50 text-primary-700 border border-primary-100/80">
                          <Users class="w-2.5 h-2.5" />
                          <span>{{ t.team_count || 0 }} nhân sự</span>
                        </span>
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold bg-slate-100 text-slate-600 border border-slate-200/60">
                          <Calendar class="w-2.5 h-2.5" />
                          <span>{{ t.events_count || 0 }} sự kiện</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  v-if="filteredTenantsForStaff.length === 0"
                  class="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200"
                >
                  Không tìm thấy công ty nào phù hợp
                </div>
              </div>
            </div>
          </div>

          <!-- RIGHT COLUMN: CHI TIẾT NHÂN SỰ CỦA CÔNG TY ĐƯỢC CHỌN (COL-SPAN-8) -->
          <div class="lg:col-span-8 space-y-4">
            <!-- Selected Company Banner Header (Clean, Modern, Light SaaS Style) -->
            <div
              v-if="currentSelectedTenant"
              class="card p-5 bg-white border border-slate-200/90 shadow-xs space-y-4 rounded-2xl"
            >
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div class="flex items-start gap-3.5">
                  <div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-primary-500/10">
                    <Building2 class="w-6 h-6" />
                  </div>
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <h3 class="text-base sm:text-lg font-black text-slate-900 tracking-tight truncate">
                        {{ currentSelectedTenant.name }}
                      </h3>
                      <span
                        :class="currentSelectedTenant.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'"
                        class="px-2 py-0.5 rounded-full text-[10px] font-bold border"
                      >
                        {{ currentSelectedTenant.status === 'ACTIVE' ? 'Hoạt động' : 'Đang khóa' }}
                      </span>
                    </div>
                    <div class="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-slate-500 mt-1">
                      <span class="flex items-center gap-1">
                        <User class="w-3.5 h-3.5 text-slate-400" />
                        <span>Đại diện: <b class="text-slate-700">{{ currentSelectedTenant.contact_name }}</b></span>
                      </span>
                      <span class="flex items-center gap-1 font-mono text-[11px] text-slate-600">
                        <Mail class="w-3.5 h-3.5 text-slate-400" />
                        <span>{{ currentSelectedTenant.contact_email }}</span>
                      </span>
                      <span v-if="currentSelectedTenant.phone" class="flex items-center gap-1 font-mono text-[11px] text-slate-600">
                        <Phone class="w-3.5 h-3.5 text-slate-400" />
                        <span>{{ currentSelectedTenant.phone }}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                  <button
                    @click="loadTenantStaffUsers(currentSelectedTenant.id)"
                    class="btn bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2 px-3 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                    title="Tải lại danh sách"
                  >
                    <RotateCw :class="loadingTenantStaff ? 'animate-spin' : ''" class="w-3.5 h-3.5" />
                    <span>Làm mới</span>
                  </button>
                  <button
                    @click="openAddTenantStaffModal"
                    class="btn btn-primary text-xs font-bold py-2 px-3.5 rounded-xl shadow-xs flex items-center gap-1.5"
                  >
                    <UserPlus class="w-3.5 h-3.5" />
                    <span>+ Thêm Nhân Sự Vào Đơn Vị</span>
                  </button>
                </div>
              </div>

              <!-- 4 neat stat cards -->
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div class="bg-slate-50/80 rounded-xl p-3 border border-slate-200/60">
                  <div class="text-[10.5px] font-bold text-slate-400 flex items-center gap-1">
                    <Users class="w-3 h-3 text-primary-600" />
                    <span>Tổng nhân sự</span>
                  </div>
                  <div class="text-base font-black text-slate-900 mt-1">{{ tenantStaffList.length }} thành viên</div>
                </div>
                <div class="bg-slate-50/80 rounded-xl p-3 border border-slate-200/60">
                  <div class="text-[10.5px] font-bold text-slate-400 flex items-center gap-1">
                    <Calendar class="w-3 h-3 text-indigo-600" />
                    <span>Sự kiện tổ chức</span>
                  </div>
                  <div class="text-base font-black text-slate-900 mt-1">{{ currentSelectedTenant.events_count || 0 }} sự kiện</div>
                </div>
                <div class="bg-slate-50/80 rounded-xl p-3 border border-slate-200/60">
                  <div class="text-[10.5px] font-bold text-slate-400 flex items-center gap-1">
                    <Sparkles class="w-3 h-3 text-emerald-600" />
                    <span>Gói dùng thử free</span>
                  </div>
                  <div class="text-base font-black text-emerald-600 mt-1">{{ currentSelectedTenant.free_events_used || 0 }} / 3 lần</div>
                </div>
                <div class="bg-slate-50/80 rounded-xl p-3 border border-slate-200/60">
                  <div class="text-[10.5px] font-bold text-slate-400 flex items-center gap-1">
                    <Crown class="w-3 h-3 text-amber-500" />
                    <span>Chủ sở hữu (Owner)</span>
                  </div>
                  <div class="text-xs font-black text-slate-800 mt-1.5 truncate">{{ currentSelectedTenant.owner_name || currentSelectedTenant.contact_name }}</div>
                </div>
              </div>
            </div>

            <!-- Tenant Personnel List Card -->
            <div class="card overflow-hidden border border-slate-200/90 shadow-xs bg-white rounded-2xl space-y-0">
              <div class="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100">
                <div class="flex items-center gap-2">
                  <h4 class="font-extrabold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                    <Users class="w-4 h-4 text-primary-600" />
                    <span>Đội Ngũ Nhân Sự Của Đơn Vị</span>
                  </h4>
                  <span class="px-2 py-0.5 rounded-full text-[11px] font-black bg-primary-50 text-primary-700">
                    {{ filteredCurrentTenantStaff.length }} người
                  </span>
                </div>

                <div class="relative w-full sm:w-64">
                  <Search class="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    v-model="tenantStaffSearchQuery"
                    type="text"
                    placeholder="Tìm tên, email, SĐT..."
                    class="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary-500 transition"
                  />
                </div>
              </div>

              <!-- Loading spinner -->
              <div v-if="loadingTenantStaff" class="py-12 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                <RotateCw class="w-6 h-6 animate-spin text-primary-600" />
                <span>Đang tải danh sách nhân sự của công ty...</span>
              </div>

              <!-- Empty State -->
              <div
                v-else-if="filteredCurrentTenantStaff.length === 0"
                class="p-12 text-center text-xs text-slate-500 space-y-3"
              >
                <div class="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                  <Users class="w-6 h-6" />
                </div>
                <div>
                  <div class="font-bold text-slate-700 text-sm">Chưa có nhân sự nào trong đơn vị này</div>
                  <div class="text-slate-400 text-xs mt-0.5">Bấm nút bên dưới để thêm nhân sự đầu tiên vào công ty</div>
                </div>
                <button
                  @click="openAddTenantStaffModal"
                  class="btn btn-primary text-xs shadow-xs"
                >
                  <Plus class="w-3.5 h-3.5" />
                  <span>Thêm nhân sự ngay</span>
                </button>
              </div>

              <!-- Desktop Table of Tenant Personnel (With overflow-x-auto to prevent clipping) -->
              <div v-else class="hidden md:block overflow-x-auto">
                <table class="w-full text-left text-xs">
                  <thead class="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th class="py-3 px-4 min-w-[170px]">Nhân sự</th>
                      <th class="py-3 px-4 whitespace-nowrap">Vai trò đơn vị</th>
                      <th class="py-3 px-4 min-w-[160px]">Thông tin liên hệ</th>
                      <th class="py-3 px-4 min-w-[190px]">Nhiệm vụ & Sự kiện</th>
                      <th class="py-3 px-4 whitespace-nowrap">Trạng thái</th>
                      <th class="py-3 px-4 text-right whitespace-nowrap min-w-[120px]">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    <tr
                      v-for="u in filteredCurrentTenantStaff"
                      :key="u.id"
                      class="hover:bg-slate-50/70 transition"
                    >
                      <td class="py-3.5 px-4 font-black text-slate-900">
                        <div class="flex items-center gap-2.5">
                          <div
                            :class="u.role === 'OWNER' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'"
                            class="w-8 h-8 rounded-xl font-black flex items-center justify-center text-xs shadow-xs shrink-0"
                          >
                            {{ (u.name || 'U').charAt(0).toUpperCase() }}
                          </div>
                          <div>
                            <div class="text-xs font-black text-slate-900">{{ u.name }}</div>
                            <div class="text-[10px] text-slate-400 font-mono">ID: #{{ u.id }}</div>
                          </div>
                        </div>
                      </td>

                      <td class="py-3.5 px-4">
                        <span
                          v-if="u.role === 'OWNER'"
                          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200/90 whitespace-nowrap shadow-2xs"
                        >
                          <Crown class="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Chủ đơn vị (Owner)</span>
                        </span>
                        <span
                          v-else
                          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap"
                        >
                          <User class="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>Nhân viên sự kiện</span>
                        </span>
                      </td>

                      <td class="py-3.5 px-4">
                        <div class="font-bold text-xs text-slate-800">{{ u.email }}</div>
                        <div class="text-[11px] font-mono text-slate-400 mt-0.5">{{ u.phone || '—' }}</div>
                      </td>

                      <td class="py-3.5 px-4">
                        <div class="space-y-1.5">
                          <div class="flex items-center gap-1.5 text-[10px]">
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 whitespace-nowrap">
                              💌 {{ u.invites_count || 0 }} khách
                            </span>
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 whitespace-nowrap">
                              📱 {{ u.scans_count || 0 }} quét
                            </span>
                          </div>

                          <div v-if="u.assigned_events && u.assigned_events.length > 0" class="flex flex-wrap gap-1">
                            <span
                              v-for="ev in u.assigned_events"
                              :key="ev.event_id"
                              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] bg-slate-100 text-slate-700 border border-slate-200"
                              :title="ev.event_name"
                            >
                              <Calendar class="w-2.5 h-2.5 text-slate-400" />
                              <span class="font-bold truncate max-w-[110px]">{{ ev.event_name }}</span>
                              <span v-if="ev.can_scan" class="text-emerald-600 font-bold" title="Quét vé">🔍</span>
                              <span v-if="ev.can_invite" class="text-blue-600 font-bold" title="Mời khách">✉️</span>
                              <span v-if="ev.can_approve" class="text-amber-600 font-bold" title="Duyệt vé">🛡️</span>
                            </span>
                          </div>
                          <div v-else class="text-[10px] text-slate-400 italic">
                            Chưa phân công sự kiện
                          </div>
                        </div>
                      </td>

                      <td class="py-3.5 px-4">
                        <span
                          :class="u.status === 'ACTIVE' ? 'chip-success' : 'chip-danger'"
                          class="chip text-[10px] uppercase font-bold"
                        >
                          {{ u.status === 'ACTIVE' ? 'Hoạt động' : 'Đang khóa' }}
                        </span>
                      </td>

                      <td class="py-3.5 px-4 text-right">
                        <div class="inline-flex items-center gap-1.5 justify-end whitespace-nowrap">
                          <button
                            @click="toggleTenantStaffStatus(u)"
                            :class="u.status === 'ACTIVE' ? 'text-rose-600 hover:bg-rose-50 border-rose-200' : 'text-emerald-600 hover:bg-emerald-50 border-emerald-200'"
                            class="btn border py-1.5 px-2.5 text-xs font-bold rounded-xl transition cursor-pointer"
                          >
                            {{ u.status === 'ACTIVE' ? 'Khóa' : 'Mở khóa' }}
                          </button>
                          <button
                            v-if="u.role !== 'OWNER'"
                            @click="removeTenantStaffMember(u)"
                            class="btn border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50 py-1.5 px-2 text-xs font-bold rounded-xl transition cursor-pointer"
                            title="Xóa nhân sự khỏi công ty này"
                          >
                            <Trash2 class="w-3.5 h-3.5 text-rose-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Mobile Cards of Tenant Personnel -->
              <div class="md:hidden p-4 space-y-3">
                <div
                  v-for="u in filteredCurrentTenantStaff"
                  :key="u.id"
                  class="card p-3.5 space-y-2.5 border border-slate-200 shadow-xs"
                >
                  <div class="flex items-start justify-between gap-2">
                    <div>
                      <div class="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                        <span>{{ u.name }}</span>
                        <span
                          v-if="u.role === 'OWNER'"
                          class="px-2 py-0.5 rounded text-[9.5px] font-bold bg-amber-100 text-amber-800"
                        >
                          OWNER
                        </span>
                      </div>
                      <div class="text-xs text-slate-500 font-mono mt-0.5">{{ u.phone || 'Chưa có SĐT' }}</div>
                      <div class="text-[11px] text-slate-400">{{ u.email }}</div>
                    </div>

                    <div class="flex flex-col items-end gap-1.5">
                      <span
                        :class="u.status === 'ACTIVE' ? 'chip-success' : 'chip-danger'"
                        class="chip text-[10px]"
                      >
                        {{ u.status === 'ACTIVE' ? 'Hoạt động' : 'Đang khóa' }}
                      </span>
                      <div class="flex items-center gap-1">
                        <button
                          @click="toggleTenantStaffStatus(u)"
                          :class="u.status === 'ACTIVE' ? 'text-rose-600 bg-rose-50 border border-rose-200' : 'text-emerald-600 bg-emerald-50 border border-emerald-200'"
                          class="px-2 py-1 rounded-lg text-xs font-bold border"
                        >
                          {{ u.status === 'ACTIVE' ? 'Khóa' : 'Mở' }}
                        </button>
                        <button
                          v-if="u.role !== 'OWNER'"
                          @click="removeTenantStaffMember(u)"
                          class="p-1 rounded-lg text-rose-600 hover:bg-rose-50 border border-slate-200"
                        >
                          <Trash2 class="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div class="pt-2 border-t border-slate-100 flex items-center gap-2 text-[10px]">
                    <span class="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-bold border border-emerald-100">
                      💌 {{ u.invites_count || 0 }} khách
                    </span>
                    <span class="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold border border-indigo-100">
                      📱 {{ u.scans_count || 0 }} quét
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 4: EVENTS -->
    <div v-if="activeTab === 'events'" class="space-y-6">
      <div class="flex justify-between items-center">
        <div>
          <h2 class="text-lg font-black text-slate-900">Danh Sách Sự Kiện</h2>
          <p class="text-xs text-slate-500">Quản lý nội dung, địa điểm, sức chứa và phân bổ hạn mức mời</p>
        </div>
        <div class="flex items-center gap-2">
          <button
            @click="openAdminInviteCard()"
            class="btn text-xs font-black bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-md flex items-center gap-1.5"
            title="Tạo thiệp mời"
          >
            <Sparkles class="w-3.5 h-3.5 text-amber-100" />
            <span>Tạo thiệp mời</span>
          </button>
          <button
            @click="openCreateEventModal"
            class="btn btn-primary text-xs shadow-md"
          >
            <Plus class="w-3.5 h-3.5" />
            <span>Tạo Sự Kiện Mới</span>
          </button>
        </div>
      </div>

      <!-- BỘ LỌC NGUỒN SỰ KIỆN: NỘI BỘ vs CÁC BÊN THUÊ -->
      <div class="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-fit text-xs font-bold">
        <button
          type="button"
          @click="eventFilterScope = 'ALL'"
          :class="eventFilterScope === 'ALL' ? 'bg-white text-primary-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'"
          class="px-3 py-1.5 rounded-lg transition"
        >
          Tất cả sự kiện ({{ eventsList.length }})
        </button>
        <button
          type="button"
          @click="eventFilterScope = 'TENANT'"
          :class="eventFilterScope === 'TENANT' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'"
          class="px-3 py-1.5 rounded-lg transition flex items-center gap-1"
        >
          <span>🏢 Các bên thuê mở ({{ eventsList.filter(e => e.tenant_id).length }})</span>
        </button>
        <button
          type="button"
          @click="eventFilterScope = 'INTERNAL'"
          :class="eventFilterScope === 'INTERNAL' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'"
          class="px-3 py-1.5 rounded-lg transition flex items-center gap-1"
        >
          <span>🏛️ Sự kiện nội bộ ({{ eventsList.filter(e => !e.tenant_id).length }})</span>
        </button>
      </div>

      <div v-if="displayedEvents.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <div
          v-for="ev in displayedEvents"
          :key="ev.id"
          class="card overflow-hidden flex flex-col justify-between hover:border-primary-400 transition"
        >
          <div class="p-5 sm:p-6 space-y-3">
            <div class="flex justify-between items-start gap-4">
              <div>
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span
                    :class="{
                      'bg-emerald-100 text-emerald-800 border-emerald-200': ev.status === 'PUBLISHED' && !ev.is_expired,
                      'bg-slate-100 text-slate-700 border-slate-300': ev.is_expired,
                      'bg-amber-100 text-amber-800 border-amber-300': ev.status === 'CLOSED',
                      'bg-rose-100 text-rose-800 border-rose-300': ev.status === 'CANCELLED',
                    }"
                    class="chip text-[10px] uppercase font-black border"
                  >
                    {{ ev.status === 'CLOSED' ? 'ĐÃ TẮT' : ev.is_expired ? 'ĐÃ KẾT THÚC' : 'ĐANG MỞ' }}
                  </span>
                  <span
                    :class="{
                      'chip-primary': ev.approval_mode === 'REFERRER_ONLY',
                      'chip-amber': ev.approval_mode === 'TWO_TIER',
                      'chip-success': ev.approval_mode === 'AUTO',
                    }"
                    class="chip text-[10px]"
                  >
                    {{ ev.approval_mode === 'REFERRER_ONLY' ? 'NV giới thiệu duyệt' : ev.approval_mode === 'TWO_TIER' ? 'Duyệt 2 cấp' : 'Tự động cấp QR' }}
                  </span>
                                    <span
                    v-if="ev.tenant_name"
                    class="chip bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold"
                  >
                    🏢 {{ ev.tenant_name }}
                  </span>
                  <span
                    v-if="ev.payment_status === 'PENDING_PAYMENT'"
                    class="chip bg-amber-500 text-white text-[10px] font-black"
                  >
                    ⏳ Chờ TT: {{ Number(ev.package_price_vnd).toLocaleString('vi-VN') }} ₫
                  </span>
                  <span
                    v-else-if="Number(ev.package_price_vnd) > 0"
                    class="chip bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold"
                  >
                    ✅ Đã thanh toán
                  </span>
                  <button
                    v-if="ev.payment_status === 'PENDING_PAYMENT'"
                    type="button"
                    @click="confirmEventPayment(ev.id)"
                    class="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold shadow-xs cursor-pointer"
                  >
                    Xác nhận thanh toán
                  </button>
                </div>
                <h3 class="text-base sm:text-lg font-black text-slate-900 mt-2">{{ ev.name }}</h3>
              </div>
              <div class="text-right">
                <div class="text-2xl font-black text-primary-600">{{ ev.total_checked_in }}/{{ ev.total_tickets }}</div>
                <div class="text-[10px] text-slate-400 font-medium">Đã đi / Tổng phát</div>
              </div>
            </div>

            <p class="text-xs text-slate-500 line-clamp-2 leading-relaxed">{{ ev.description }}</p>

            <div class="space-y-1.5 text-xs text-slate-600 font-medium">
              <div class="flex items-center gap-2">
                <MapPin class="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span class="truncate">{{ ev.location }}</span>
              </div>
              <div class="flex items-center gap-2">
                <Calendar class="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{{ new Date(ev.start_at).toLocaleString('vi-VN') }}</span>
              </div>
              <div class="flex items-center gap-2">
                <Users class="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Sức chứa: {{ ev.capacity }} khách</span>
              </div>
              <div v-if="ev.tenant_name" class="flex items-center gap-2">
                <Building class="w-3.5 h-3.5 text-primary-500 shrink-0" />
                <span>Khách thuê: {{ ev.tenant_name }}</span>
              </div>
            </div>
          </div>

          <div class="bg-slate-50 p-4 border-t border-slate-100 flex flex-wrap justify-between items-center gap-2 text-xs">
            <div class="flex items-center flex-wrap gap-2">
              <button
                @click="openEventDetail(ev)"
                class="btn btn-primary py-2 px-3 text-xs"
              >
                <BarChart3 class="w-3.5 h-3.5" />
                <span>Chi tiết & Điểm danh</span>
              </button>
              <button
                @click="openAdminEditEventModal(ev)"
                class="btn btn-secondary py-2 px-3 text-xs"
                title="Chỉnh sửa thông tin & sức chứa sự kiện"
              >
                <Pencil class="w-3.5 h-3.5 text-slate-600" />
                <span>Sửa</span>
              </button>
              <button
                @click="openStaffQuota(ev)"
                class="btn btn-secondary py-2 px-3 text-xs"
                title="Phân quyền tài khoản & hạn mức mời cho sự kiện này"
              >
                <ShieldCheck class="w-3.5 h-3.5 text-primary-600" />
                <span>Phân quyền & Hạn mức</span>
              </button>
              <a
                :href="`/events/${ev.id}/welcome`"
                target="_blank"
                class="btn btn-secondary py-2 px-3 text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200"
                title="Mở màn hình LED Chào mừng & Bốc thăm may mắn sân khấu"
              >
                <Crown class="w-3.5 h-3.5 text-amber-600" />
                <span>Chào mừng</span>
              </a>

              <!-- Toggle On / Off Event Button -->
              <button
                @click="handleToggleEventStatus(ev)"
                :class="ev.status === 'PUBLISHED' ? 'btn-secondary text-amber-700 hover:bg-amber-50 border-amber-200' : 'btn-secondary text-emerald-700 hover:bg-emerald-50 border-emerald-200'"
                class="btn py-2 px-2.5 text-xs font-bold"
                :title="ev.status === 'PUBLISHED' ? 'Tắt / Đóng sự kiện này (Nhân viên sẽ không thấy nữa)' : 'Bật / Mở lại sự kiện này'"
              >
                <component :is="ev.status === 'PUBLISHED' ? Lock : Unlock" class="w-3.5 h-3.5" />
                <span>{{ ev.status === 'PUBLISHED' ? 'Tắt SK' : 'Bật SK' }}</span>
              </button>

              <!-- Delete Event Button -->
              <button
                @click="handleDeleteEvent(ev)"
                class="btn btn-danger py-2 px-2.5 text-xs"
                title="Xóa vĩnh viễn sự kiện này"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
            <span class="font-bold text-slate-400 text-[11px]">ID: #{{ ev.id }}</span>
          </div>
        </div>
      </div>

      <div v-else class="card p-12 text-center text-slate-500 bg-white border border-dashed border-slate-200 rounded-2xl">
        <Calendar class="w-10 h-10 mx-auto text-slate-300 mb-2" />
        <p class="font-bold text-sm text-slate-700">Không tìm thấy sự kiện nào</p>
        <p class="text-xs text-slate-400 mt-1">Chưa có sự kiện phù hợp với bộ lọc hiện tại.</p>
      </div>
    </div>

    <!-- TAB 5: SYSTEM SETTINGS & INTEGRATIONS -->
    <div v-if="activeTab === 'settings'" class="space-y-6">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 class="text-xl font-black text-slate-900 tracking-tight">
            Cài Đặt Hệ Thống & Tích Hợp
          </h2>
          <p class="text-xs text-slate-500">Cấu hình máy chủ SMTP email gửi vé tự động & quy tắc thông báo</p>
        </div>

        <button
          @click="saveSettings"
          :disabled="settingsSaving"
          class="btn btn-primary text-xs shadow-md flex items-center gap-1.5"
        >
          <CheckCircle2 class="w-4 h-4" />
          <span>{{ settingsSaving ? 'Đang lưu...' : 'Lưu Cấu Hình Hệ Thống' }}</span>
        </button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Card 1: SMTP Email Service -->
        <div class="card p-5 sm:p-6 space-y-4">
          <div class="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div class="w-9 h-9 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
              <Mail class="w-5 h-5" />
            </div>
            <div>
              <h3 class="text-sm font-black text-slate-900">Máy Chủ Gửi Email (SMTP Service)</h3>
              <p class="text-[11px] text-slate-500">Dùng gửi mã OTP xác thực email, vé QR khi được duyệt & thông báo sự kiện</p>
            </div>
          </div>

          <div class="space-y-3.5 text-xs">
            <div class="grid grid-cols-3 gap-3">
              <div class="col-span-2">
                <label class="block font-bold text-slate-700 mb-1">Máy chủ SMTP Host</label>
                <input
                  v-model="systemSettings.smtp_host"
                  placeholder="smtp.gmail.com"
                  class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Cổng Port</label>
                <input
                  v-model="systemSettings.smtp_port"
                  placeholder="587"
                  class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Tài khoản SMTP Email (Username)</label>
              <input
                v-model="systemSettings.smtp_user"
                placeholder="noreply.eventqr@gmail.com"
                class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Mật khẩu ứng dụng (App Password)</label>
              <input
                v-model="systemSettings.smtp_pass"
                type="password"
                placeholder="••••••••••••••••"
                class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Tên người gửi hiển thị (From Name)</label>
              <input
                v-model="systemSettings.smtp_from_name"
                placeholder="EventGo Event Desk"
                class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <!-- Test SMTP Box -->
          <div class="mt-4 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <div class="text-[11px] font-bold text-slate-700 flex items-center justify-between">
              <span>Kiểm tra kết nối gửi email trực tiếp</span>
              <span class="text-[10px] text-slate-400 font-normal">Test Live</span>
            </div>
            <div class="flex gap-2">
              <input
                v-model="testEmailTarget"
                type="email"
                placeholder="Nhập email nhận thử (vd: your@email.com)"
                class="flex-1 p-2 bg-white border border-slate-200 rounded-xl text-xs"
              />
              <button
                type="button"
                @click="testSmtpConnection"
                :disabled="testEmailSending"
                class="btn btn-secondary py-2 px-3 text-xs font-bold shrink-0"
              >
                {{ testEmailSending ? 'Đang gửi...' : 'Gửi Thử' }}
              </button>
            </div>
            <div
              v-if="testEmailResult"
              :class="testEmailResult.success ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-rose-700 bg-rose-50 border-rose-200'"
              class="p-2 rounded-xl border text-[11px] font-medium mt-1"
            >
              {{ testEmailResult.message }}
            </div>
          </div>
        </div>

        <!-- Card 2: Automation & Rules -->
        <div class="card p-5 sm:p-6 space-y-4 flex flex-col justify-between">
          <div class="space-y-4">
            <div class="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div class="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Sliders class="w-5 h-5" />
              </div>
              <div>
                <h3 class="text-sm font-black text-slate-900">Quy Định Tự Động Hóa & Nhắc Nhở</h3>
                <p class="text-[11px] text-slate-500">Tự động kích hoạt khi có sự kiện và vé được duyệt</p>
              </div>
            </div>

            <div class="space-y-4 text-xs">
              <!-- Toggle 1: Auto email on approved -->
              <div class="flex items-start justify-between gap-4 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                <div>
                  <div class="font-bold text-slate-900">Tự động gửi email vé QR khi phê duyệt</div>
                  <p class="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    Khách hàng sẽ nhận được thư điện tử đính kèm thẻ vé và mã QR ngay khi được duyệt.
                  </p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    :checked="systemSettings.email_on_approved === '1'"
                    @change="systemSettings.email_on_approved = ($event.target as HTMLInputElement).checked ? '1' : '0'"
                    class="sr-only peer"
                  />
                  <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>

              <!-- Input: Reminder hours before event -->
              <div class="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <label class="block font-bold text-slate-900">
                  Thời gian nhắc nhở trước khi sự kiện bắt đầu (Giờ)
                </label>
                <div class="flex items-center gap-3">
                  <input
                    v-model="systemSettings.notify_hours_before"
                    type="number"
                    min="1"
                    max="168"
                    class="w-24 p-2 bg-white border border-slate-200 rounded-xl text-center font-bold text-sm text-primary-700"
                  />
                  <span class="text-xs text-slate-500 font-medium">giờ trước thời gian diễn ra (Mặc định: 24h)</span>
                </div>
              </div>
            </div>
          </div>

          <div class="pt-4 border-t border-slate-100 flex justify-end">
            <button
              @click="saveSettings"
              :disabled="settingsSaving"
              class="btn btn-primary text-xs w-full py-2.5 shadow-md flex items-center justify-center gap-2"
            >
              <CheckCircle2 class="w-4 h-4" />
              <span>{{ settingsSaving ? 'Đang lưu...' : 'Lưu Tất Cả Cài Đặt' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL: CHI TIẾT SỰ KIỆN & BÁO CÁO ĐIỂM DANH KHÁCH -->
    <div v-if="showEventDetailModal" class="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-[70] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div class="card max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border-slate-200 my-auto animate-scale-in">
        <!-- Dark modern header -->
        <div class="p-5 sm:p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white flex justify-between items-start gap-4">
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="px-2.5 py-0.5 bg-primary-500/20 text-primary-300 border border-primary-500/30 text-[10px] font-black rounded-lg uppercase">
                Báo cáo sự kiện
              </span>
              <span class="text-xs text-slate-400 font-mono">ID: #{{ selectedEventReport?.event?.id }}</span>
            </div>
            <h2 class="text-lg sm:text-xl font-black mt-2 leading-tight">
              {{ selectedEventReport?.event?.name }}
            </h2>
            <div class="mt-2 text-xs text-slate-300 flex flex-wrap gap-x-4 gap-y-1 font-medium">
              <span>📍 {{ selectedEventReport?.event?.location }}</span>
              <span>📅 {{ new Date(selectedEventReport?.event?.start_at).toLocaleString('vi-VN') }}</span>
              <span>👥 Sức chứa: {{ selectedEventReport?.event?.capacity }} khách</span>
            </div>
          </div>
          <button
            @click="closeEventDetail"
            class="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Body -->
        <div v-if="eventReportLoading" class="p-12 text-center text-slate-500 space-y-2">
          <RotateCw class="w-8 h-8 animate-spin mx-auto text-primary-500" />
          <p class="text-xs font-bold">Đang tải dữ liệu báo cáo chi tiết sự kiện...</p>
        </div>

        <div v-else-if="selectedEventReport" class="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          <!-- Summary Metrics Cards -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="card p-3.5 bg-primary-50/60 border-primary-200 text-center">
              <div class="text-[10px] font-bold text-primary-700 uppercase">Tổng đã cấp vé</div>
              <div class="text-2xl font-black text-primary-900 mt-1">
                {{ selectedEventReport.summary?.total_approved || 0 }}
              </div>
              <div class="text-[10px] text-primary-600 mt-0.5">Vé hợp lệ</div>
            </div>

            <div class="card p-3.5 bg-emerald-50/60 border-emerald-200 text-center">
              <div class="text-[10px] font-bold text-emerald-700 uppercase">Đã tham dự (Đã đi)</div>
              <div class="text-2xl font-black text-emerald-900 mt-1">
                {{ selectedEventReport.summary?.total_checked_in || 0 }}
              </div>
              <div class="text-[10px] text-emerald-700 font-bold mt-0.5">
                Tỷ lệ đi: {{ selectedEventReport.summary?.attendance_rate || 0 }}%
              </div>
            </div>

            <div class="card p-3.5 bg-rose-50/60 border-rose-200 text-center">
              <div class="text-[10px] font-bold text-rose-700 uppercase">Chưa đi (Vắng mặt)</div>
              <div class="text-2xl font-black text-rose-900 mt-1">
                {{ selectedEventReport.summary?.total_absent || 0 }}
              </div>
              <div class="text-[10px] text-rose-600 mt-0.5">Chưa quét mã</div>
            </div>

            <div class="card p-3.5 bg-amber-50/60 border-amber-200 text-center">
              <div class="text-[10px] font-bold text-amber-700 uppercase">Chờ phê duyệt</div>
              <div class="text-2xl font-black text-amber-900 mt-1">
                {{ (selectedEventReport.summary?.total_pending_referrer || 0) + (selectedEventReport.summary?.total_pending_admin || 0) }}
              </div>
              <div class="text-[10px] text-amber-700 mt-0.5">
                {{ selectedEventReport.summary?.total_pending_admin || 0 }} chờ Admin
              </div>
            </div>
          </div>

          <!-- Toolbar: Filters, Search, Export -->
          <div class="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
            <div class="flex bg-slate-100 p-1 rounded-xl text-xs font-bold overflow-x-auto no-scrollbar whitespace-nowrap">
              <button
                @click="attendeeFilter = 'all_tickets'"
                :class="attendeeFilter === 'all_tickets' ? 'bg-white shadow-xs text-primary-700' : 'text-slate-600'"
                class="px-3 py-1.5 rounded-lg transition"
              >
                Đã cấp vé ({{ selectedEventReport.summary?.total_approved || 0 }})
              </button>
              <button
                @click="attendeeFilter = 'attended'"
                :class="attendeeFilter === 'attended' ? 'bg-white shadow-xs text-emerald-700' : 'text-slate-600'"
                class="px-3 py-1.5 rounded-lg transition"
              >
                ✓ Đã đi ({{ selectedEventReport.summary?.total_checked_in || 0 }})
              </button>
              <button
                @click="attendeeFilter = 'absent'"
                :class="attendeeFilter === 'absent' ? 'bg-white shadow-xs text-rose-700' : 'text-slate-600'"
                class="px-3 py-1.5 rounded-lg transition"
              >
                ✗ Chưa đi ({{ selectedEventReport.summary?.total_absent || 0 }})
              </button>
              <button
                @click="attendeeFilter = 'pending'"
                :class="attendeeFilter === 'pending' ? 'bg-white shadow-xs text-amber-700' : 'text-slate-600'"
                class="px-3 py-1.5 rounded-lg transition"
              >
                ⏳ Chờ duyệt ({{ (selectedEventReport.summary?.total_pending_referrer || 0) + (selectedEventReport.summary?.total_pending_admin || 0) }})
              </button>
            </div>

            <div class="flex items-center gap-2">
              <div class="relative flex-1 sm:w-60">
                <Search class="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  v-model="attendeeSearch"
                  type="text"
                  placeholder="Tìm khách, SĐT, mã vé..."
                  class="w-full text-xs pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition"
                />
              </div>
              <button
                @click="exportToCsv"
                class="btn py-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs shrink-0 flex items-center gap-1.5"
                title="Tải file Excel / CSV"
              >
                <Download class="w-3.5 h-3.5" />
                <span>Xuất Excel</span>
              </button>
            </div>
          </div>

          <!-- Attendees Table -->
          <div class="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
            <div class="overflow-x-auto max-h-96">
              <table class="w-full text-left text-xs">
                <thead class="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th class="py-3 px-4">Khách hàng</th>
                    <th class="py-3 px-4">Người giới thiệu</th>
                    <th class="py-3 px-4">Mã vé QR</th>
                    <th class="py-3 px-4 text-center">Trạng thái tham dự</th>
                    <th class="py-3 px-4">Check-in lúc</th>
                    <th class="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr v-for="att in filteredAttendees" :key="att.registration_id" class="hover:bg-slate-50">
                    <td class="py-3 px-4">
                      <div class="font-bold text-slate-900">{{ att.full_name }}</div>
                      <div class="font-mono text-[11px] text-slate-500">{{ att.phone }}</div>
                    </td>
                    <td class="py-3 px-4">
                      <div class="font-bold text-primary-700">{{ att.referrer_name }}</div>
                      <div class="text-[10px] text-slate-400 font-mono">{{ att.referrer_phone || '—' }}</div>
                    </td>
                    <td class="py-3 px-4 font-mono">
                      <span v-if="att.ticket_code" class="chip chip-slate font-bold">
                        {{ att.ticket_code }}
                      </span>
                      <span v-else class="text-slate-400 italic text-[11px]">Chưa cấp</span>
                    </td>
                    <td class="py-3 px-4 text-center whitespace-nowrap">
                      <span
                        v-if="att.ticket_status === 'USED'"
                        class="chip chip-success text-[11px]"
                      >
                        ✓ ĐÃ THAM DỰ
                      </span>
                      <span
                        v-else-if="att.ticket_id && att.registration_status === 'APPROVED'"
                        class="chip chip-danger text-[11px]"
                      >
                        ✗ CHƯA ĐI
                      </span>
                      <span
                        v-else-if="att.registration_status === 'PENDING_ADMIN'"
                        class="chip chip-primary text-[10px]"
                      >
                        Chờ Admin duyệt
                      </span>
                      <span
                        v-else
                        class="chip chip-amber text-[10px]"
                      >
                        {{ att.registration_status }}
                      </span>
                    </td>
                    <td class="py-3 px-4 text-slate-500 text-[11px] whitespace-nowrap font-mono">
                      {{ att.checked_in_at ? new Date(att.checked_in_at).toLocaleTimeString('vi-VN') : '—' }}
                    </td>
                    <td class="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        v-if="att.ticket_code"
                        @click="openAdminInviteCard(att, selectedEventReport?.event)"
                        class="btn py-1 px-2 text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-white inline-flex items-center gap-1 shadow-xs mr-1.5"
                        title="Tạo thiệp mời VIP cho khách này"
                      >
                        <Sparkles class="w-3 h-3 text-amber-100" />
                        <span>Thiệp mời</span>
                      </button>
                      <button
                        v-if="att.registration_status === 'PENDING_ADMIN' || att.registration_status === 'PENDING'"
                        @click="adminApproveRegistration(att.registration_id)"
                        class="btn btn-primary py-1 px-2.5 text-xs font-bold"
                      >
                        Duyệt cấp vé
                      </button>
                    </td>
                  </tr>
                  <tr v-if="filteredAttendees.length === 0">
                    <td colspan="6" class="py-8 text-center text-slate-400 text-xs">
                      Không tìm thấy khách hàng nào.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL: QUẢN LÝ PHÂN QUYỀN & HẠN MỨC NHÂN VIÊN (EXISTING EVENT) -->
    <div v-if="showQuotaModal" class="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-[70] flex items-center justify-center p-4 overflow-y-auto">
      <div class="card max-w-3xl w-full p-6 shadow-2xl space-y-4 my-auto animate-scale-in">
        <div class="flex justify-between items-center pb-3 border-b border-slate-100">
          <div>
            <div class="flex items-center gap-2">
              <ShieldCheck class="w-5 h-5 text-primary-600" />
              <h3 class="text-base font-black text-slate-900">Phân Quyền & Hạn Mức Nhân Viên</h3>
            </div>
            <div class="flex items-center gap-2 mt-0.5">
              <p class="text-xs text-slate-500">Sự kiện: <span class="font-bold text-slate-800">{{ selectedEventForQuota?.name }}</span></p>
              <span v-if="selectedEventForQuota?.tenant_name || selectedEventForQuota?.tenant_id" class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary-50 text-primary-700">
                🏢 Khách thuê: {{ selectedEventForQuota.tenant_name || ('Đơn vị #' + selectedEventForQuota.tenant_id) }}
              </span>
              <span v-else class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                🏛️ Sự kiện nội bộ
              </span>
            </div>
          </div>
          <button @click="showQuotaModal = false" class="text-slate-400 hover:text-slate-600">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div v-if="quotaLoading" class="py-8 text-center text-xs text-slate-400">Đang tải danh sách tài khoản...</div>

        <div v-else class="space-y-3">
          <!-- Controls Toolbar: Search + Filter tabs -->
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <!-- Search input -->
            <div class="relative flex-1">
              <Search class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                v-model="quotaSearch"
                type="text"
                placeholder="Tìm tài khoản theo tên, email, sđt..."
                class="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-medium placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <button
                v-if="quotaSearch"
                type="button"
                @click="quotaSearch = ''"
                class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X class="w-3 h-3" />
              </button>
            </div>

            <!-- Filter tabs -->
            <div class="flex items-center gap-1 shrink-0 bg-slate-100 p-1 rounded-xl text-[10px] font-bold">
              <button
                type="button"
                @click="quotaFilter = 'ALL'"
                class="px-2 py-0.5 rounded-lg transition-colors"
                :class="quotaFilter === 'ALL' ? 'bg-primary-500 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'"
              >
                Tất cả ({{ staffQuotasListCounts.total }})
              </button>
              <button
                type="button"
                @click="quotaFilter = 'ENABLED'"
                class="px-2 py-0.5 rounded-lg transition-colors"
                :class="quotaFilter === 'ENABLED' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-700 hover:bg-emerald-50'"
              >
                Có quyền ({{ staffQuotasListCounts.enabled }})
              </button>
              <button
                type="button"
                @click="quotaFilter = 'DISABLED'"
                class="px-2 py-0.5 rounded-lg transition-colors"
                :class="quotaFilter === 'DISABLED' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-700 hover:bg-rose-50'"
              >
                Đã tắt ({{ staffQuotasListCounts.disabled }})
              </button>
            </div>
          </div>

          <!-- Staff Quotas List -->
          <div v-if="filteredStaffQuotasList.length > 0" class="divide-y divide-slate-100 max-h-96 overflow-y-auto pr-1">
            <div
              v-for="st in filteredStaffQuotasList"
              :key="st.staff_id"
              class="py-3 space-y-2"
              :class="!st.is_enabled ? 'opacity-70 bg-slate-50/50 p-2.5 rounded-xl border border-dashed border-slate-200 my-1' : ''"
            >
              <!-- Row 1: Info + Master toggle + Quick Presets + Save button -->
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-2.5 min-w-0">
                  <!-- Master toggle -->
                  <label class="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      v-model="st.is_enabled"
                      class="sr-only peer"
                    />
                    <div class="w-8 h-4 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>

                  <div class="min-w-0">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <span class="font-extrabold text-slate-900 text-xs">{{ st.staff_name }}</span>
                      <span
                        v-if="!st.is_enabled"
                        class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-200 text-slate-600"
                      >
                        Đã tắt quyền
                      </span>
                      <span
                        v-else
                        class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700"
                      >
                        Được tham gia
                      </span>
                    </div>
                    <div class="text-[11px] text-slate-500">{{ st.staff_email }} <span v-if="st.staff_phone">· {{ st.staff_phone }}</span></div>
                    <div class="text-[10px] text-primary-600 font-bold mt-0.5">
                      Đã mời: {{ st.current_registrations || 0 }} khách · {{ st.active_links_count || 0 }} link đang hoạt động
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-1.5 shrink-0">
                  <!-- Quick preset buttons -->
                  <button
                    type="button"
                    @click="applyStaffQuotaListPreset(st, 'ALL')"
                    class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 hover:bg-primary-50 hover:text-primary-600 text-slate-600"
                    title="Bật toàn bộ 4 quyền"
                  >
                    ⚡ Toàn quyền
                  </button>
                  <button
                    type="button"
                    @click="applyStaffQuotaListPreset(st, 'INVITE_ONLY')"
                    class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600"
                    title="Chỉ cho phép giới thiệu khách"
                  >
                    🔗 Chỉ mời
                  </button>
                  <button
                    type="button"
                    @click="applyStaffQuotaListPreset(st, 'SCAN_ONLY')"
                    class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 hover:bg-purple-50 hover:text-purple-600 text-slate-600"
                    title="Chỉ cho phép soát vé"
                  >
                    📷 Chỉ soát
                  </button>
                  <button
                    type="button"
                    @click="applyStaffQuotaListPreset(st, 'NONE')"
                    class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600"
                    title="Tắt quyền tài khoản này"
                  >
                    🚫 Tắt
                  </button>

                  <button
                    @click="saveStaffQuota(st)"
                    :disabled="st.saving"
                    class="btn btn-primary py-1 px-3 text-xs ml-1 shadow-xs font-bold"
                  >
                    {{ st.saving ? '...' : 'Lưu' }}
                  </button>
                </div>
              </div>

              <!-- Row 2 (if enabled): 4 chips toggles + quota input -->
              <div
                v-if="st.is_enabled"
                class="pl-10 flex flex-wrap items-center justify-between gap-2"
              >
                <div class="flex flex-wrap items-center gap-1.5">
                  <label
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer transition-colors border"
                    :class="st.can_invite ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600'"
                  >
                    <input type="checkbox" v-model="st.can_invite" class="sr-only" />
                    <span>🔗 Tạo link mời</span>
                  </label>
                  <label
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer transition-colors border"
                    :class="st.can_approve ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600'"
                  >
                    <input type="checkbox" v-model="st.can_approve" class="sr-only" />
                    <span>✅ Duyệt khách</span>
                  </label>
                  <label
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer transition-colors border"
                    :class="st.can_scan ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600'"
                  >
                    <input type="checkbox" v-model="st.can_scan" class="sr-only" />
                    <span>📷 Soát vé QR</span>
                  </label>
                  <label
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer transition-colors border"
                    :class="st.can_view_report ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600'"
                  >
                    <input type="checkbox" v-model="st.can_view_report" class="sr-only" />
                    <span>📊 Báo cáo</span>
                  </label>
                </div>

                <div class="flex items-center gap-1.5 shrink-0 ml-auto">
                  <span class="text-[10px] font-semibold text-slate-500">Hạn mức mời:</span>
                  <input
                    v-if="st.can_invite"
                    v-model.number="st.max_invites"
                    type="number"
                    min="1"
                    max="5000"
                    class="w-16 p-1 bg-slate-50 border border-slate-200 rounded-lg text-center text-xs font-bold text-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                  <span v-else class="text-[10px] text-slate-400 italic">Không mời</span>
                  <span v-if="st.can_invite" class="text-[10px] font-bold text-slate-500">khách</span>
                </div>
              </div>
            </div>
          </div>

          <div
            v-else
            class="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200"
          >
            Không tìm thấy tài khoản phù hợp với tìm kiếm "{{ quotaSearch }}"
          </div>
        </div>

        <div class="flex justify-end pt-3 border-t border-slate-100">
          <button @click="showQuotaModal = false" class="btn btn-secondary text-xs">Đóng</button>
        </div>
      </div>
    </div>

    <!-- MODAL: TẠO NHÂN VIÊN MỚI -->
    <div v-if="showCreateStaffModal" class="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div class="card max-w-lg w-full p-6 shadow-2xl space-y-4 animate-scale-in">
        <div class="flex justify-between items-center">
          <h3 class="text-base font-black text-slate-900">Tạo Tài Khoản Nhân Viên Mới</h3>
          <button @click="showCreateStaffModal = false" class="text-slate-400 hover:text-slate-600">
            <X class="w-4 h-4" />
          </button>
        </div>
        <form @submit.prevent="handleCreateStaff" class="space-y-3.5 text-xs">
          <div>
            <label class="block font-bold text-slate-700 mb-1">Họ và tên</label>
            <input v-model="newStaff.name" required class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl" />
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Email</label>
            <input v-model="newStaff.email" type="email" required class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl" />
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Số điện thoại</label>
            <input v-model="newStaff.phone" class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl" />
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Mật khẩu ban đầu</label>
            <input v-model="newStaff.password" required class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl" />
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-2">Gán quyền ban đầu:</label>
            <div class="grid grid-cols-2 gap-2">
              <label v-for="p in permissionsList" :key="p.id" class="flex items-center gap-2 p-2 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer">
                <input type="checkbox" :value="p.id" v-model="newStaff.permission_ids" class="accent-primary-600" />
                <span class="font-medium text-slate-800">{{ p.name }}</span>
              </label>
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button type="button" @click="showCreateStaffModal = false" class="btn btn-secondary text-xs">Hủy</button>
            <button type="submit" class="btn btn-primary text-xs shadow-md">Lưu nhân viên</button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL: THÊM NHÂN SỰ VÀO CÔNG TY KHÁCH THUÊ -->
    <div v-if="showAddTenantStaffModal" class="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div class="card max-w-md w-full p-6 shadow-2xl space-y-4 animate-scale-in">
        <div class="flex justify-between items-center pb-3 border-b border-slate-100">
          <div>
            <h3 class="text-base font-black text-slate-900">Thêm Nhân Sự Vào Đơn Vị</h3>
            <p class="text-xs text-slate-500 mt-0.5">Công ty: <span class="font-bold text-primary-700">{{ currentSelectedTenant?.name }}</span></p>
          </div>
          <button @click="showAddTenantStaffModal = false" class="text-slate-400 hover:text-slate-600">
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Mode switcher: create new vs add existing -->
        <div class="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
          <button
            type="button"
            @click="addTenantStaffMode = 'create'"
            :class="addTenantStaffMode === 'create' ? 'bg-white shadow-xs text-primary-700' : 'text-slate-600'"
            class="py-1.5 text-center rounded-lg transition cursor-pointer"
          >
            Tạo tài khoản mới
          </button>
          <button
            type="button"
            @click="addTenantStaffMode = 'existing'"
            :class="addTenantStaffMode === 'existing' ? 'bg-white shadow-xs text-primary-700' : 'text-slate-600'"
            class="py-1.5 text-center rounded-lg transition cursor-pointer"
          >
            Gán tài khoản đã có
          </button>
        </div>

        <form @submit.prevent="submitAddTenantStaff" class="space-y-3.5 text-xs">
          <div v-if="addTenantStaffError" class="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold">
            {{ addTenantStaffError }}
          </div>

          <template v-if="addTenantStaffMode === 'create'">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Họ và tên nhân sự <span class="text-rose-500">*</span></label>
              <input v-model="newTenantStaff.name" required placeholder="Ví dụ: Nguyễn Văn Nam" class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary-500 transition" />
            </div>
            <div>
              <label class="block font-bold text-slate-700 mb-1">Email đăng nhập <span class="text-rose-500">*</span></label>
              <input v-model="newTenantStaff.email" type="email" required placeholder="nhanvien@congty.com" class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary-500 transition" />
            </div>
            <div>
              <label class="block font-bold text-slate-700 mb-1">Số điện thoại</label>
              <input v-model="newTenantStaff.phone" placeholder="0987654321" class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary-500 transition" />
            </div>
            <div>
              <label class="block font-bold text-slate-700 mb-1">Mật khẩu ban đầu <span class="text-rose-500">*</span></label>
              <input v-model="newTenantStaff.password" required class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary-500 transition" />
              <p class="text-[10px] text-slate-400 mt-1">Mặc định: Staff@123</p>
            </div>
          </template>

          <template v-else>
            <div>
              <label class="block font-bold text-slate-700 mb-1">Nhập Email tài khoản cần thêm <span class="text-rose-500">*</span></label>
              <input v-model="newTenantStaff.email" type="email" required placeholder="user@gmail.com" class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary-500 transition" />
              <p class="text-[10px] text-slate-500 mt-1">Hệ thống sẽ liên kết tài khoản này vào đội ngũ công ty với vai trò Nhân viên sự kiện.</p>
            </div>
          </template>

          <div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button type="button" @click="showAddTenantStaffModal = false" class="btn btn-secondary text-xs">Hủy</button>
            <button type="submit" :disabled="addingTenantStaff" class="btn btn-primary text-xs shadow-md flex items-center gap-1.5">
              <RotateCw v-if="addingTenantStaff" class="w-3.5 h-3.5 animate-spin" />
              <span>{{ addingTenantStaff ? 'Đang thêm...' : 'Xác nhận thêm' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL: TẠO SỰ KIỆN MỚI -->
    <div v-if="showCreateEventModal" class="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div class="card max-w-3xl w-full p-6 shadow-2xl max-h-[92vh] overflow-y-auto space-y-4 animate-scale-in">
        <div class="flex justify-between items-center">
          <h3 class="text-base font-black text-slate-900">Tạo Sự Kiện Mới</h3>
          <button @click="showCreateEventModal = false" class="text-slate-400 hover:text-slate-600">
            <X class="w-4 h-4" />
          </button>
        </div>
        <form @submit.prevent="handleCreateEvent" class="space-y-4 text-xs">
          <!-- CHỌN ĐƠN VỊ / KHÁCH THUÊ SỞ HỮU -->
          <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <label class="block font-bold text-slate-800">
              🏢 Đơn vị / Khách thuê sở hữu gói sự kiện:
            </label>
            <select v-model="newEvent.tenant_id" @change="onTenantSelected" class="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800">
              <option :value="null">🏢 Ban tổ chức nội bộ (Admin vận hành)</option>
              <option v-for="t in availableTenants" :key="t.id" :value="t.id">
                👤 Khách thuê: {{ t.name }} ({{ t.contact_name }} - {{ t.contact_email }})
              </option>
            </select>
            <p class="text-[10px] text-slate-500">
              Chọn khách thuê để họ sở hữu và quản lý sự kiện trong cổng riêng (<code>/tenant</code>).
            </p>
            <!-- CHỌN TÀI KHOẢN ĐƯỢC HIỂN THỊ & VẬN HÀNH SỰ KIỆN -->
            <div v-if="newEvent.tenant_id" class="p-3 bg-white border border-indigo-100 rounded-xl space-y-2 mt-2">
              <div class="font-bold text-xs text-indigo-900 flex items-center justify-between">
                <span>👥 Chọn các tài khoản được hiển thị & vận hành sự kiện này:</span>
                <span v-if="loadingTenantUsers" class="text-[10px] text-slate-400">Đang tải tài khoản...</span>
              </div>
              <div v-if="!tenantUsersDraft.length && !loadingTenantUsers" class="text-[11px] text-slate-500">
                Chưa có tài khoản nào thuộc khách thuê này.
              </div>
              <div v-else class="space-y-2 max-h-48 overflow-y-auto pr-1">
                <div
                  v-for="user in tenantUsersDraft"
                  :key="user.staff_id"
                  class="p-2.5 bg-slate-50 border rounded-lg text-xs"
                  :class="user.is_selected ? 'border-indigo-300 bg-indigo-50/30' : 'border-slate-200'"
                >
                  <div class="flex items-center justify-between gap-2">
                    <label class="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                      <input type="checkbox" v-model="user.is_selected" class="rounded text-indigo-600" />
                      <span>{{ user.name }} ({{ user.email }})</span>
                      <span class="text-[9px] px-1.5 py-0.5 rounded font-bold" :class="user.role === 'OWNER' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'">
                        {{ user.role === 'OWNER' ? 'Chủ đơn vị' : 'Nhân sự' }}
                      </span>
                    </label>
                  </div>
                  <div v-if="user.is_selected" class="mt-2 pt-2 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-slate-600">
                    <label class="flex items-center gap-1 cursor-pointer">
                      <input type="checkbox" v-model="user.can_invite" class="rounded text-indigo-600" />
                      <span>Mời khách</span>
                    </label>
                    <label class="flex items-center gap-1 cursor-pointer">
                      <input type="checkbox" v-model="user.can_approve" class="rounded text-indigo-600" />
                      <span>Duyệt khách</span>
                    </label>
                    <label class="flex items-center gap-1 cursor-pointer">
                      <input type="checkbox" v-model="user.can_scan" class="rounded text-indigo-600" />
                      <span>Soát vé QR</span>
                    </label>
                    <label class="flex items-center gap-1 cursor-pointer">
                      <input type="checkbox" v-model="user.can_view_report" class="rounded text-indigo-600" />
                      <span>Xem báo cáo</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <!-- GÓI DỊCH VỤ & THANH TOÁN (KHI CHỌN KHÁCH THUÊ) -->
            <div v-if="newEvent.tenant_id" class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-200">
              <div>
                <label class="block font-bold text-primary-900 mb-1">Gói sự kiện áp dụng:</label>
                <select v-model="newEvent.plan_id" @change="onPlanSelected" class="w-full p-2 bg-white border border-primary-200 rounded-lg text-xs font-semibold">
                  <option :value="null">-- Tự định nghĩa quy mô --</option>
                  <option v-for="p in availablePlans" :key="p.id" :value="p.id">
                    {{ p.name }} ({{ p.max_attendees }} khách - {{ Number(p.price_vnd).toLocaleString('vi-VN') }} ₫) {{ p.is_trial ? '[Dùng thử]' : '' }}
                  </option>
                </select>
              </div>

              <div>
                <label class="block font-bold text-primary-900 mb-1">Trạng thái thanh toán:</label>
                <select v-model="newEvent.payment_status" class="w-full p-2 bg-white border border-primary-200 rounded-lg text-xs font-semibold">
                  <option value="PENDING_PAYMENT">⏳ Chờ khách thanh toán (Quét VietQR)</option>
                  <option value="PAID">✅ Đã thanh toán / Kích hoạt dùng ngay</option>
                </select>
              </div>
            </div>
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Tên sự kiện</label>
            <input v-model="newEvent.name" required class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold" />
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Địa điểm tổ chức</label>
            <input v-model="newEvent.location" required class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Bắt đầu</label>
              <input v-model="newEvent.start_at" type="datetime-local" required class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl" />
            </div>
            <div>
              <label class="block font-bold text-slate-700 mb-1">Kết thúc</label>
              <input v-model="newEvent.end_at" type="datetime-local" required class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl" />
            </div>
          </div>

          <div class="p-3 bg-primary-50/60 border border-primary-200 rounded-xl space-y-1">
            <div class="flex items-center justify-between">
              <label class="block font-black text-slate-800 text-xs">👥 Số lượng khách tối đa (Sức chứa) <span class="text-rose-500">*</span></label>
              <span class="text-[10px] font-bold text-primary-700 bg-white px-2 py-0.5 rounded-full border border-primary-200">Bắt buộc</span>
            </div>
            <input v-model.number="newEvent.capacity" type="number" min="1" required class="w-full p-2.5 bg-white border border-primary-300 rounded-xl font-black text-sm text-primary-800" placeholder="Ví dụ: 100, 200, 500 khách..." />
            <p class="text-[11px] text-slate-500">Giới hạn số lượng người có thể nhận vé cho sự kiện này.</p>
          </div>

          <div><p class="mt-1 text-[11px] text-slate-500">Khách thuê tự vận hành sự kiện trong cổng riêng; 3 sự kiện đầu dùng gói thử, sau đó mỗi sự kiện cần một gói đã được xác nhận.</p></div>

          <!-- Setting Phê Duyệt Vé -->
          <div>
            <label class="block font-bold text-slate-700 mb-2">Quy trình phê duyệt vé:</label>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label
                :class="newEvent.approval_mode === 'REFERRER_ONLY' ? 'border-primary-500 bg-primary-50/60 ring-2 ring-primary-500' : 'border-slate-200 hover:bg-slate-50'"
                class="p-3 border rounded-xl cursor-pointer flex flex-col justify-between transition"
              >
                <div class="flex items-center gap-2 mb-1">
                  <input type="radio" value="REFERRER_ONLY" v-model="newEvent.approval_mode" class="accent-primary-600" />
                  <span class="font-bold text-xs text-slate-900">1. Người mời duyệt</span>
                </div>
                <p class="text-[10px] text-slate-500 leading-relaxed">
                  Nhân viên giới thiệu duyệt là khách nhận vé QR ngay.
                </p>
              </label>

              <label
                :class="newEvent.approval_mode === 'TWO_TIER' ? 'border-amber-500 bg-amber-50/60 ring-2 ring-amber-500' : 'border-slate-200 hover:bg-slate-50'"
                class="p-3 border rounded-xl cursor-pointer flex flex-col justify-between transition"
              >
                <div class="flex items-center gap-2 mb-1">
                  <input type="radio" value="TWO_TIER" v-model="newEvent.approval_mode" class="accent-amber-600" />
                  <span class="font-bold text-xs text-slate-900">2. Duyệt 2 cấp</span>
                </div>
                <p class="text-[10px] text-slate-500 leading-relaxed">
                  Người mời duyệt vòng 1 ➔ Admin duyệt cuối mới cấp vé QR.
                </p>
              </label>

              <label
                :class="newEvent.approval_mode === 'AUTO' ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500' : 'border-slate-200 hover:bg-slate-50'"
                class="p-3 border rounded-xl cursor-pointer flex flex-col justify-between transition"
              >
                <div class="flex items-center gap-2 mb-1">
                  <input type="radio" value="AUTO" v-model="newEvent.approval_mode" class="accent-emerald-600" />
                  <span class="font-bold text-xs text-slate-900">3. Tự động cấp QR</span>
                </div>
                <p class="text-[10px] text-slate-500 leading-relaxed">
                  Khách đăng ký xong là hệ thống tự động xuất vé QR ngay.
                </p>
              </label>
            </div>
          </div>

          <!-- PHÂN QUYỀN & HẠN MỨC CHO TỪNG TÀI KHOẢN KHI TẠO SỰ KIỆN -->
          <div class="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <div class="flex items-center gap-2">
                  <ShieldCheck class="w-4 h-4 text-primary-600" />
                  <label class="block font-bold text-slate-900 text-xs">
                    Phân quyền & Hạn mức tài khoản tham gia
                  </label>
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-100 text-primary-700">
                    {{ staffPermCounts.enabled }}/{{ staffPermCounts.total }} có quyền
                  </span>
                </div>
                <p class="text-[11px] text-slate-500 mt-0.5">
                  Chỉ định tài khoản được tham gia, làm gì (tạo link, duyệt vé, soát vé, báo cáo) hoặc tắt quyền hoàn toàn.
                </p>
              </div>

              <!-- Nút preset nhanh hàng loạt -->
              <div v-if="staffQuotasDraft.length > 0" class="flex flex-wrap items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  @click="setAllDraftPermissions('ALL')"
                  class="btn btn-secondary py-1 px-2 text-[10px] flex items-center gap-1"
                  title="Cấp toàn quyền cho tất cả tài khoản"
                >
                  <Zap class="w-3 h-3 text-amber-500" />
                  <span>Bật tất cả</span>
                </button>
                <button
                  type="button"
                  @click="setAllDraftPermissions('NONE')"
                  class="btn btn-secondary py-1 px-2 text-[10px] text-red-600 hover:bg-red-50"
                  title="Tắt quyền tất cả (chỉ bật người cần)"
                >
                  <X class="w-3 h-3" />
                  <span>Tắt tất cả</span>
                </button>
              </div>
            </div>

            <!-- THANH TÌM KIẾM & BỘ LỌC TÀI KHOẢN -->
            <div v-if="staffQuotasDraft.length > 0" class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1 border-t border-slate-200">
              <!-- Search box -->
              <div class="relative flex-1">
                <Search class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  v-model="staffPermSearch"
                  type="text"
                  placeholder="Tìm tài khoản theo tên, email, sđt..."
                  class="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[11px] font-medium placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <button
                  v-if="staffPermSearch"
                  type="button"
                  @click="staffPermSearch = ''"
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X class="w-3 h-3" />
                </button>
              </div>

              <!-- Filter tabs -->
              <div class="flex items-center gap-1 shrink-0 bg-white p-1 rounded-xl border border-slate-200 text-[10px] font-bold">
                <button
                  type="button"
                  @click="staffPermFilter = 'ALL'"
                  class="px-2 py-0.5 rounded-lg transition-colors"
                  :class="staffPermFilter === 'ALL' ? 'bg-primary-500 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'"
                >
                  Tất cả ({{ staffPermCounts.total }})
                </button>
                <button
                  type="button"
                  @click="staffPermFilter = 'ENABLED'"
                  class="px-2 py-0.5 rounded-lg transition-colors"
                  :class="staffPermFilter === 'ENABLED' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-700 hover:bg-emerald-50'"
                >
                  Có quyền ({{ staffPermCounts.enabled }})
                </button>
                <button
                  type="button"
                  @click="staffPermFilter = 'DISABLED'"
                  class="px-2 py-0.5 rounded-lg transition-colors"
                  :class="staffPermFilter === 'DISABLED' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-700 hover:bg-rose-50'"
                >
                  Đã tắt ({{ staffPermCounts.disabled }})
                </button>
              </div>

              <!-- Quick bulk quota input -->
              <div class="flex items-center gap-1 shrink-0 bg-white p-1 rounded-xl border border-slate-200">
                <span class="text-[10px] font-bold text-slate-500 pl-1">Hạn mức:</span>
                <input
                  v-model.number="defaultQuotaBulk"
                  type="number"
                  min="1"
                  max="5000"
                  class="w-14 p-0.5 bg-slate-50 border border-slate-200 rounded text-center text-xs font-bold"
                />
                <button
                  type="button"
                  @click="applyDraftBulkQuota"
                  class="btn btn-primary py-0.5 px-2 text-[10px]"
                >
                  Gán
                </button>
              </div>
            </div>

            <!-- DANH SÁCH TÀI KHOẢN VỚI CÁC QUYỀN GỌN GÀNG -->
            <div v-if="filteredStaffQuotasDraft.length > 0" class="space-y-2 max-h-64 overflow-y-auto pr-1">
              <div
                v-for="sq in filteredStaffQuotasDraft"
                :key="sq.staff_id"
                class="p-2.5 rounded-xl border transition-all duration-150"
                :class="sq.is_enabled ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-100/70 border-dashed border-slate-300 opacity-75'"
              >
                <!-- Dòng trên: Thông tin tài khoản + Master Toggle + Quick Presets -->
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2.5 min-w-0">
                    <!-- Master Toggle Bật/Tắt sự kiện cho người này -->
                    <label class="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        v-model="sq.is_enabled"
                        class="sr-only peer"
                      />
                      <div class="w-8 h-4 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>

                    <div class="min-w-0">
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="font-bold text-slate-900 text-xs truncate">{{ sq.staff_name }}</span>
                        <span
                          v-if="!sq.is_enabled"
                          class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-200 text-slate-600"
                        >
                          Tắt tham gia
                        </span>
                        <span
                          v-else
                          class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700"
                        >
                          Được tham gia
                        </span>
                      </div>
                      <div class="text-[10px] text-slate-400 truncate flex items-center gap-2">
                        <span>{{ sq.staff_email }}</span>
                        <span v-if="sq.staff_phone">· {{ sq.staff_phone }}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Quick Presets for this staff -->
                  <div class="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      @click="applySingleStaffPreset(sq, 'ALL')"
                      class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 hover:bg-primary-50 hover:text-primary-600 text-slate-600 transition-colors"
                      title="Bật toàn bộ 4 quyền"
                    >
                      ⚡ Toàn quyền
                    </button>
                    <button
                      type="button"
                      @click="applySingleStaffPreset(sq, 'INVITE_ONLY')"
                      class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 transition-colors"
                      title="Chỉ cho phép giới thiệu khách"
                    >
                      🔗 Chỉ mời
                    </button>
                    <button
                      type="button"
                      @click="applySingleStaffPreset(sq, 'SCAN_ONLY')"
                      class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 hover:bg-purple-50 hover:text-purple-600 text-slate-600 transition-colors"
                      title="Chỉ cho phép quét vé"
                    >
                      📷 Chỉ soát
                    </button>
                    <button
                      type="button"
                      @click="applySingleStaffPreset(sq, 'NONE')"
                      class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 transition-colors"
                      title="Tắt quyền tài khoản này"
                    >
                      🚫 Tắt
                    </button>
                  </div>
                </div>

                <!-- Dòng dưới (khi bật): 4 công tắc quyền chi tiết + Hạn mức mời -->
                <div
                  v-if="sq.is_enabled"
                  class="mt-2 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2"
                >
                  <!-- 4 chips toggles -->
                  <div class="flex flex-wrap items-center gap-1.5">
                    <!-- Quyền 1: Tạo link mời -->
                    <label
                      class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors border"
                      :class="sq.can_invite ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600'"
                    >
                      <input type="checkbox" v-model="sq.can_invite" class="sr-only" />
                      <span>🔗 Tạo link mời</span>
                    </label>

                    <!-- Quyền 2: Duyệt khách -->
                    <label
                      class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors border"
                      :class="sq.can_approve ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600'"
                    >
                      <input type="checkbox" v-model="sq.can_approve" class="sr-only" />
                      <span>✅ Duyệt khách</span>
                    </label>

                    <!-- Quyền 3: Soát vé QR -->
                    <label
                      class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors border"
                      :class="sq.can_scan ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600'"
                    >
                      <input type="checkbox" v-model="sq.can_scan" class="sr-only" />
                      <span>📷 Soát vé QR</span>
                    </label>

                    <!-- Quyền 4: Xem báo cáo -->
                    <label
                      class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors border"
                      :class="sq.can_view_report ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600'"
                    >
                      <input type="checkbox" v-model="sq.can_view_report" class="sr-only" />
                      <span>📊 Báo cáo</span>
                    </label>
                  </div>

                  <!-- Hạn mức mời -->
                  <div class="flex items-center gap-1.5 shrink-0 ml-auto">
                    <span class="text-[10px] font-semibold text-slate-500">Hạn mức mời:</span>
                    <input
                      v-if="sq.can_invite"
                      v-model.number="sq.max_invites"
                      type="number"
                      min="1"
                      max="5000"
                      class="w-14 p-1 bg-slate-50 border border-slate-200 rounded-lg text-center text-xs font-bold text-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                    <span v-else class="text-[10px] text-slate-400 italic">Không mời</span>
                    <span v-if="sq.can_invite" class="text-[10px] font-bold text-slate-500">khách</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Empty state when searching with no results -->
            <div
              v-else-if="staffQuotasDraft.length > 0"
              class="py-6 text-center text-xs text-slate-400 bg-white rounded-xl border border-dashed border-slate-200"
            >
              Không tìm thấy tài khoản phù hợp với từ khóa "{{ staffPermSearch }}"
            </div>
            <div
              v-else
              class="py-4 text-center text-xs text-slate-400 italic"
            >
              Chưa có tài khoản nhân viên nào hoạt động trong hệ thống.
            </div>
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Mô tả sự kiện</label>
            <textarea v-model="newEvent.description" rows="2" class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"></textarea>
          </div>

          <div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button type="button" @click="showCreateEventModal = false" class="btn btn-secondary text-xs">Hủy</button>
            <button type="submit" class="btn btn-primary text-xs shadow-md">Tạo sự kiện</button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL: SỬA THÔNG TIN & SỨC CHỨA SỰ KIỆN (ADMIN) -->
    <div v-if="showAdminEditEventModal" class="modal-backdrop">
      <div class="modal-content max-w-lg">
        <div class="flex justify-between items-center mb-4">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
              <Pencil class="w-4 h-4" />
            </div>
            <div>
              <h3 class="text-base font-black text-slate-900">Sửa thông tin sự kiện</h3>
              <p class="text-xs text-slate-500">Cập nhật tên, địa điểm, sức chứa tối đa</p>
            </div>
          </div>
          <button @click="showAdminEditEventModal = false" class="text-slate-400 hover:text-slate-600">
            <X class="w-5 h-5" />
          </button>
        </div>

        <form @submit.prevent="saveAdminEditEvent" class="space-y-4">
          <div>
            <label class="block font-bold text-slate-700 text-xs mb-1">Tên sự kiện <span class="text-rose-500">*</span></label>
            <input v-model="adminEditEventForm.name" required class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900" />
          </div>

          <div>
            <label class="block font-bold text-slate-700 text-xs mb-1">Địa điểm tổ chức <span class="text-rose-500">*</span></label>
            <input v-model="adminEditEventForm.location" required class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900" />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block font-bold text-slate-700 text-xs mb-1">Thời gian bắt đầu <span class="text-rose-500">*</span></label>
              <input v-model="adminEditEventForm.start_at" type="datetime-local" required class="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900" />
            </div>
            <div>
              <label class="block font-bold text-slate-700 text-xs mb-1">Thời gian kết thúc <span class="text-rose-500">*</span></label>
              <input v-model="adminEditEventForm.end_at" type="datetime-local" required class="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900" />
            </div>
          </div>

          <!-- SỨC CHỨA TỐI ĐA -->
          <div class="p-3.5 bg-primary-50/60 border border-primary-200 rounded-xl space-y-1.5">
            <div class="flex items-center justify-between">
              <label class="block text-xs font-black text-slate-900">
                👥 Số lượng khách tối đa (Sức chứa) <span class="text-rose-500">*</span>
              </label>
              <span class="text-[11px] font-bold text-primary-700 bg-white px-2 py-0.5 rounded-full border border-primary-200 shadow-2xs">
                Hiện tại: {{ adminEditEventForm.capacity }} khách
              </span>
            </div>
            <input
              v-model.number="adminEditEventForm.capacity"
              type="number"
              min="1"
              required
              class="w-full p-2.5 bg-white border border-primary-300 rounded-xl text-sm font-black text-primary-800"
              placeholder="Nhập số lượng khách tối đa"
            />
            <p class="text-[11px] text-slate-600">
              Giới hạn số lượng người có thể nhận vé cho sự kiện này.
            </p>
          </div>

          <div>
            <label class="block font-bold text-slate-700 text-xs mb-1">Mô tả sự kiện</label>
            <textarea v-model="adminEditEventForm.description" rows="2" class="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700"></textarea>
          </div>

          <div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button type="button" @click="showAdminEditEventModal = false" class="btn btn-secondary text-xs">Hủy</button>
            <button type="submit" :disabled="adminEditSaving" class="btn btn-primary text-xs shadow-md flex items-center gap-1.5">
              <Check class="w-4 h-4" />
              <span>{{ adminEditSaving ? 'Đang lưu...' : 'Lưu thay đổi' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL: TẠO NGƯỜI DÙNG MỚI (MASTER ADMIN) -->
    <div v-if="showCreateUserModal" class="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-[80] flex items-center justify-center p-4 overflow-y-auto">
      <div class="card max-w-md w-full p-6 shadow-2xl space-y-4 my-auto animate-scale-in">
        <div class="flex justify-between items-center pb-3 border-b border-slate-100">
          <h3 class="text-base font-black text-slate-900">Thêm Người Dùng Hệ Thống Mới</h3>
          <button @click="showCreateUserModal = false" class="text-slate-400 hover:text-slate-600">
            <X class="w-4 h-4" />
          </button>
        </div>
        <form @submit.prevent="handleCreateUser" class="space-y-3.5 text-xs">
          <div>
            <label class="block font-bold text-slate-700 mb-1">Họ và tên</label>
            <input v-model="newUser.name" required placeholder="Nguyễn Văn A" class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Email</label>
            <input v-model="newUser.email" type="email" required placeholder="user@domain.com" class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Số điện thoại</label>
            <input v-model="newUser.phone" placeholder="0901234567" class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono" />
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Vai trò (Role)</label>
            <select v-model="newUser.type" class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800">
              <option value="ADMIN">Quản trị viên (ADMIN)</option>
              <option value="TENANT_ADMIN">Khách thuê / Chủ đơn vị (TENANT_ADMIN)</option>
              <option value="STAFF">Nhân viên (STAFF)</option>
              <option value="CUSTOMER">Khách hàng (CUSTOMER)</option>
            </select>
          </div>
          <div v-if="newUser.type !== 'CUSTOMER'">
            <label class="block font-bold text-slate-700 mb-1">Mật khẩu khởi tạo</label>
            <input v-model="newUser.password" required class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono" />
          </div>

          <div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button type="button" @click="showCreateUserModal = false" class="btn btn-secondary text-xs">Hủy</button>
            <button type="submit" class="btn btn-primary text-xs shadow-md">Lưu người dùng</button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL: ĐẶT LẠI MẬT KHẨU -->
    <div v-if="showResetPasswordModal" class="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-[80] flex items-center justify-center p-4">
      <div class="card max-w-sm w-full p-6 shadow-2xl space-y-4 animate-scale-in">
        <div class="flex justify-between items-center pb-3 border-b border-slate-100">
          <div>
            <h3 class="text-base font-black text-slate-900">Đặt Lại Mật Khẩu</h3>
            <p class="text-xs text-slate-500">{{ selectedUserForPassword?.name }}</p>
          </div>
          <button @click="showResetPasswordModal = false" class="text-slate-400 hover:text-slate-600">
            <X class="w-4 h-4" />
          </button>
        </div>

        <form @submit.prevent="handleSaveResetPassword" class="space-y-4 text-xs">
          <div>
            <label class="block font-bold text-slate-700 mb-1">Mật khẩu mới</label>
            <input v-model="newPasswordInput" required minlength="6" placeholder="Nhập mật khẩu..." class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm" />
          </div>

          <div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button type="button" @click="showResetPasswordModal = false" class="btn btn-secondary text-xs">Hủy</button>
            <button type="submit" class="btn btn-primary text-xs shadow-md">Lưu mật khẩu mới</button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL: XÓA HOẶC KHÓA TÀI KHOẢN (KIỂM TRA KHÓA PHỤ + MẬT KHẨU 4 SỐ) -->
    <div v-if="showDeleteUserModal && deleteUserTarget" class="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-[85] flex items-center justify-center p-4 overflow-y-auto">
      <div class="card max-w-md w-full p-6 shadow-2xl space-y-4 my-auto animate-scale-in">
        <div class="flex justify-between items-start gap-3 pb-3 border-b border-slate-100">
          <div class="flex items-center gap-3 min-w-0">
            <div
              :class="getUserTheme(deleteUserTarget).avatarClass"
              class="w-10 h-10 rounded-xl font-black text-xs flex items-center justify-center shrink-0 uppercase"
            >
              {{ deleteUserTarget.name.slice(0, 2) }}
            </div>
            <div class="min-w-0">
              <h3 class="text-base font-black text-slate-900 truncate">Xử Lý Tài Khoản #{{ deleteUserTarget.id }}</h3>
              <p class="text-xs text-slate-500 truncate">{{ deleteUserTarget.name }} · {{ deleteUserTarget.email }}</p>
            </div>
          </div>
          <button @click="showDeleteUserModal = false" class="text-slate-400 hover:text-slate-600 p-1">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div v-if="deleteUserDepsLoading" class="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
          <RotateCw class="w-4 h-4 animate-spin text-primary-600 shrink-0" />
          <span>Đang kiểm tra khóa phụ và dữ liệu liên kết...</span>
        </div>

        <template v-else-if="deleteUserDeps">
          <div
            v-if="deleteUserDeps.hasForeignKeyConstraint"
            class="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs space-y-2 text-amber-950"
          >
            <div class="flex items-center gap-1.5 font-black text-amber-900">
              <AlertTriangle class="w-4 h-4 text-amber-600 shrink-0" />
              <span>Tài khoản này đang có khóa phụ dữ liệu</span>
            </div>
            <ul class="list-disc pl-4 space-y-1 text-[11px] text-amber-900">
              <li v-for="(item, idx) in deleteUserDeps.foreignKeyItems" :key="'fk-' + idx">{{ item }}</li>
              <li v-for="(item, idx) in deleteUserDeps.cascadeItems" :key="'cs-' + idx">{{ item }}</li>
            </ul>
            <p class="text-[11px] text-amber-800 pt-1 border-t border-amber-200/80">
              <strong>Khuyên dùng:</strong> Chọn <b>Khóa tài khoản</b> để chặn đăng nhập mà giữ nguyên lịch sử. Nếu vẫn muốn <b>Xóa luôn</b>, hệ thống sẽ tự chuyển quyền đứng tên khóa phụ sang Admin hiện tại và dọn dữ liệu liên quan.
            </p>
          </div>

          <div
            v-else-if="deleteUserDeps.hasRelatedData"
            class="rounded-xl border border-orange-200 bg-orange-50/80 p-3.5 text-xs space-y-2 text-orange-950"
          >
            <div class="flex items-center gap-1.5 font-bold text-orange-900">
              <AlertTriangle class="w-4 h-4 text-orange-600 shrink-0" />
              <span>Tài khoản có dữ liệu hoạt động liên quan</span>
            </div>
            <ul class="list-disc pl-4 space-y-1 text-[11px] text-orange-900">
              <li v-for="(item, idx) in deleteUserDeps.cascadeItems" :key="'cs2-' + idx">{{ item }}</li>
            </ul>
            <p class="text-[11px] text-orange-800">
              Bạn có thể chọn <b>Khóa tài khoản</b> để bảo toàn dữ liệu, hoặc nhập mật khẩu 4 số để xóa vĩnh viễn.
            </p>
          </div>

          <div
            v-else
            class="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600"
          >
            Tài khoản này chưa phát sinh khóa phụ hay sự kiện/vé liên quan. Nếu không muốn xóa, bạn có thể nhấn <b>Khóa tài khoản</b>.
          </div>
        </template>

        <form @submit.prevent="confirmDeleteUser" class="space-y-3 text-xs">
          <div>
            <label class="block font-bold text-slate-700 mb-1">
              Mật khẩu 4 số xác nhận XÓA VĨNH VIỄN
            </label>
            <input
              v-model="deleteUserPin"
              type="password"
              inputmode="numeric"
              maxlength="4"
              autocomplete="off"
              placeholder="Nhập mã PIN 4 số..."
              class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm tracking-[0.35em] text-center focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div v-if="deleteUserError" class="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-[11px] font-semibold text-rose-700">
            {{ deleteUserError }}
          </div>

          <div class="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              @click="showDeleteUserModal = false"
              class="btn btn-secondary text-xs"
            >
              Hủy
            </button>
            <button
              v-if="deleteUserTarget.status === 'ACTIVE'"
              type="button"
              :disabled="deleteUserLocking || deleteUserSubmitting"
              @click="handleLockUserInsteadOfDelete"
              class="btn bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-xs font-bold"
            >
              <Lock class="w-3.5 h-3.5" />
              <span>{{ deleteUserLocking ? 'Đang khóa...' : 'Khóa (Không xóa)' }}</span>
            </button>
            <span
              v-else
              class="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-lg"
            >
              Tài khoản đã khóa
            </span>
            <button
              type="submit"
              :disabled="deleteUserSubmitting || deleteUserLocking || deleteUserDepsLoading || deleteUserPin.trim().length !== 4"
              class="btn btn-danger text-xs shadow-md disabled:opacity-50"
            >
              <Trash2 class="w-3.5 h-3.5" />
              <span>{{ deleteUserSubmitting ? 'Đang xóa...' : 'Xóa vĩnh viễn' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL: TẠO THIỆP MỜI ONLINE VIP CHO ADMIN -->
    <InviteCardModal
      :show="showAdminInviteCardModal"
      :cardData="adminCardData"
      @close="showAdminInviteCardModal = false"
    />

    <!-- MODAL: TRUNG TÂM TRA CỨU & CẤP MÃ OTP ADMIN -->
    <div v-if="showOtpModal" class="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-[80] flex items-center justify-center p-4">
      <div class="card max-w-3xl w-full p-6 shadow-2xl space-y-4 animate-scale-in max-h-[90vh] flex flex-col">
        <!-- Header -->
        <div class="flex justify-between items-start pb-3 border-b border-slate-100">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shadow-xs shrink-0">
              <Key class="w-5 h-5" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-base font-black text-slate-900">Trung Tâm Cấp & Lấy Mã OTP Tức Thì</h3>
                <span class="badge bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {{ activeOtpCount }} Mã Còn Hạn
                </span>
              </div>
              <p class="text-xs text-slate-500">
                Tra cứu nhanh mã OTP khách hàng hoặc cấp mã mới khẩn cấp khi người dùng không nhận được email/SMS
              </p>
            </div>
          </div>
          <button @click="showOtpModal = false" class="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Quick Generator & Search Bar -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <!-- Generator -->
          <form @submit.prevent="handleGenerateInstantOtp" class="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3 flex flex-col justify-between gap-2">
            <span class="text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
              <Zap class="w-3.5 h-3.5 text-amber-600" /> Cấp mã mới tức thì (Hiệu lực 10 phút)
            </span>
            <div class="flex gap-2">
              <input
                v-model="generateOtpTarget"
                type="text"
                placeholder="Nhập Email hoặc SĐT..."
                required
                class="flex-1 px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-none"
              />
              <button
                type="submit"
                :disabled="generatingOtp || !generateOtpTarget.trim()"
                class="btn bg-amber-600 hover:bg-amber-700 text-white text-xs px-3 py-1.5 rounded-lg font-bold shrink-0 shadow-xs flex items-center gap-1 disabled:opacity-50 cursor-pointer"
              >
                <RotateCw v-if="generatingOtp" class="w-3.5 h-3.5 animate-spin" />
                <span>{{ generatingOtp ? 'Đang tạo...' : 'Tạo Mã' }}</span>
              </button>
            </div>
          </form>

          <!-- Search & Refresh -->
          <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-between gap-2">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                <Search class="w-3.5 h-3.5 text-slate-500" /> Tra cứu danh sách OTP
              </span>
              <button
                @click="loadRecentOtps"
                :disabled="otpLoading"
                class="text-[11px] text-primary-600 hover:text-primary-800 font-bold flex items-center gap-1 cursor-pointer"
                title="Làm mới"
              >
                <RotateCw class="w-3 h-3" :class="{ 'animate-spin': otpLoading }" />
                <span>Làm mới</span>
              </button>
            </div>
            <div class="relative">
              <input
                v-model="otpSearchQuery"
                @input="loadRecentOtps"
                type="text"
                placeholder="Tìm theo email, SĐT, tên, hoặc mã OTP..."
                class="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-primary-500 outline-none"
              />
              <Search class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
          </div>
        </div>

        <!-- Table List (Scrollable) -->
        <div class="flex-1 overflow-y-auto border border-slate-100 rounded-xl max-h-[380px]">
          <div v-if="otpLoading" class="p-8 text-center text-slate-400 text-xs">
            <RotateCw class="w-6 h-6 animate-spin mx-auto mb-2 text-primary-600" />
            Đang tải danh sách mã OTP...
          </div>
          <div v-else-if="otpList.length === 0" class="p-8 text-center text-slate-400 text-xs">
            <Key class="w-8 h-8 mx-auto mb-2 text-slate-300" />
            Không có mã OTP nào trong hệ thống khớp với tìm kiếm.
          </div>
          <table v-else class="w-full text-left text-xs">
            <thead class="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] sticky top-0 border-b border-slate-100">
              <tr>
                <th class="py-2.5 px-3">Tài khoản / Người nhận</th>
                <th class="py-2.5 px-3">Vai trò</th>
                <th class="py-2.5 px-3 text-center">Mã OTP</th>
                <th class="py-2.5 px-3">Trạng thái</th>
                <th class="py-2.5 px-3">Hết hạn lúc</th>
                <th class="py-2.5 px-3 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="otp in otpList"
                :key="otp.id"
                class="hover:bg-slate-50/80 transition"
                :class="{ 'bg-amber-50/30': otp.is_valid }"
              >
                <td class="py-2.5 px-3">
                  <div class="font-bold text-slate-900">{{ otp.name || 'Chưa đặt tên' }}</div>
                  <div class="text-[11px] text-slate-500 font-mono">{{ otp.email || otp.phone }}</div>
                </td>
                <td class="py-2.5 px-3">
                  <span
                    class="badge text-[9px] font-black uppercase px-2 py-0.5 rounded-md"
                    :class="{
                      'bg-purple-100 text-purple-700': otp.type === 'ADMIN',
                      'bg-blue-100 text-blue-700': otp.type === 'STAFF',
                      'bg-emerald-100 text-emerald-700': otp.type === 'CUSTOMER'
                    }"
                  >
                    {{ otp.type }}
                  </span>
                </td>
                <td class="py-2.5 px-3 text-center">
                  <div class="inline-flex items-center gap-1.5 bg-slate-900 text-amber-400 font-mono font-black text-sm px-3 py-1 rounded-lg tracking-widest shadow-xs">
                    {{ otp.otp_code }}
                  </div>
                </td>
                <td class="py-2.5 px-3">
                  <span
                    v-if="otp.is_valid"
                    class="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full"
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Còn {{ Math.ceil(otp.seconds_left / 60) }} phút
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full"
                  >
                    Đã hết hạn
                  </span>
                </td>
                <td class="py-2.5 px-3 text-slate-500 text-[11px] font-mono">
                  {{ formatOtpTime(otp.otp_expires_at) }}
                </td>
                <td class="py-2.5 px-3 text-right">
                  <button
                    @click="copyOtpToClipboard(otp.otp_code)"
                    class="btn btn-secondary text-xs py-1 px-2.5 rounded-lg inline-flex items-center gap-1 hover:border-amber-400 cursor-pointer"
                    :class="copiedOtpCode === otp.otp_code ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : ''"
                  >
                    <Check v-if="copiedOtpCode === otp.otp_code" class="w-3.5 h-3.5 text-emerald-600" />
                    <Copy v-else class="w-3.5 h-3.5 text-slate-600" />
                    <span>{{ copiedOtpCode === otp.otp_code ? 'Đã chép!' : 'Chép mã' }}</span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Footer -->
        <div class="flex justify-between items-center pt-3 border-t border-slate-100 text-xs text-slate-500">
          <div class="flex items-center gap-1">
            <ShieldCheck class="w-3.5 h-3.5 text-emerald-600" />
            <span>Mã OTP được bảo mật và chỉ cấp quyền quản trị viên tối cao kiểm soát</span>
          </div>
          <button @click="showOtpModal = false" class="btn btn-secondary text-xs px-4 cursor-pointer">
            Đóng
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
