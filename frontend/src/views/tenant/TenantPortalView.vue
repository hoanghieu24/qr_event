<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, reactive, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Html5Qrcode } from 'html5-qrcode';
import api from '../../api/client';
import { useAuthStore } from '../../stores/auth';
import { isTenantMode, isAdminMode } from '../../utils/portalMode';
import InviteCardModal from '../../components/InviteCardModal.vue';
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  CircleUserRound,
  Clock3,
  KeyRound,
  LogOut,
  Mail,
  MapPin,
  PackageCheck,
  Plus,
  QrCode,
  Search,
  ShieldCheck,
  TicketCheck,
  Trash2,
  Users,
  X,
  ArrowLeft,
  Tag,
  CreditCard,
  Copy,
  Sparkles,
  Camera,
  Link2,
  UserCheck,
  Edit3,
  AlertTriangle,
  Clock,
  BarChart3,
  Loader2,
  RefreshCw,
  Keyboard,
  Scale,
  Send,
  Share2,
  Maximize2,
  Play,
  Download,
  Volume2,
  VolumeX
} from 'lucide-vue-next';
import QRCode from 'qrcode';
import { playScanSound, unlockAudio, isSoundEnabled } from '../../utils/scannerSound';

import './portal-features.css';
import './tenant-style.css';

const router = useRouter();
const authStore = useAuthStore();

const token = ref(localStorage.getItem('tenant_token') || localStorage.getItem('token') || '');
const user = ref<any>(JSON.parse(localStorage.getItem('tenant_user') || localStorage.getItem('user') || 'null'));
const email = ref('');
const password = ref('');
const loginBusy = ref(false);
const loading = ref(false);
const errorMessage = ref('');
const events = ref<any[]>([]);
const selectedEvent = ref<any>(null);
const attendees = ref<any[]>([]);
const team = ref<any[]>([]);
const eventTeam = ref<any[]>([]);
const usage = ref<any>(null);
const plans = ref<any[]>([]);
const activePanel = ref<'overview' | 'invites' | 'attendees' | 'team' | 'scanner' | 'disputes'>('overview');
const manualScanCode = ref('');
const scannerEvents = ref<any[]>([]);
const selectedScannerEventId = ref<number | null>(null);
const scannerResult = ref<any>(null);
const scannerError = ref('');
const scannerRunning = ref(false);
const scanBusy = ref(false);
let qrScanner: Html5Qrcode | null = null;
let lastScannedCode = '';
let lastScannedTime = 0;

// Dispute State (Gửi giải trình & Xử lý tranh chấp vé đã quét)
const showDisputeModal = ref(false);
const disputeSubmitting = ref(false);
const disputeSent = ref(false);
const disputeForm = ref({
  claimant_name: '',
  claimant_phone: '',
  explanation: '',
});
const disputesList = ref<any[]>([]);
const loadingDisputes = ref(false);

// Staff Workspace State
const staffTab = ref<'invite' | 'approve' | 'scan' | 'report' | 'disputes'>('invite');
const staffEvents = ref<any[]>([]);
const selectedStaffEventId = ref<number | null>(null);
const staffInviteLink = ref<any>(null);
const staffQuota = ref<any>(null);
const staffRegistrations = ref<any[]>([]);
const staffInviteQrUrl = ref('');
const copiedInviteLink = ref(false);
const showZoomQrModal = ref(false);
const loadingStaffData = ref(false);
const approvalFilterStatus = ref<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
const approvalSearch = ref('');

// Tenant Admin Invites & QR & VIP Invitation Card State
const tenantEventInvites = ref<any[]>([]);
const tenantActiveInviteLink = ref<any>(null);
const loadingTenantInvites = ref(false);
const tenantInviteQrUrl = ref('');
const copiedTenantInviteLink = ref(false);
const showTenantZoomQrModal = ref(false);
const showTenantInviteModal = ref(false);
const newInviteForm = reactive({
  referrer_id: '',
  max_registrations: 1000,
  expires_in_days: 60,
});
const creatingInvite = ref(false);

// VIP Online Invitation Card Modal State for Tenant Admin
const showAdminInviteCardModal = ref(false);
const adminCardData = ref<any>(null);

const staffSelectedEvent = computed(() => {
  return staffEvents.value.find((e) => e.id === selectedStaffEventId.value) || staffEvents.value[0] || null;
});

const staffCanInvite = computed(() => {
  return (
    staffEvents.value.some((e) => e.my_can_invite) ||
    Boolean(user.value?.permissions?.includes('invite:create'))
  );
});

const staffCanApprove = computed(() => {
  return (
    staffEvents.value.some((e) => e.my_can_approve || e.my_can_invite) ||
    Boolean(user.value?.permissions?.includes('registrations:approve')) ||
    Boolean(user.value?.permissions?.includes('invite:create'))
  );
});

const staffCanScan = computed(() => {
  return (
    staffEvents.value.some((e) => e.my_can_scan) ||
    Boolean(user.value?.permissions?.includes('tickets:scan'))
  );
});

const staffCanReport = computed(() => {
  return (
    staffEvents.value.some((e) => e.my_can_view_report) ||
    Boolean(user.value?.permissions?.includes('reports:view'))
  );
});

const staffRoleTitle = computed(() => {
  const e = staffSelectedEvent.value;
  const canInv = e ? Boolean(e.my_can_invite) : staffCanInvite.value;
  const canApp = e ? Boolean(e.my_can_approve) : staffCanApprove.value;
  const canScn = e ? Boolean(e.my_can_scan) : staffCanScan.value;
  const canRep = e ? Boolean(e.my_can_view_report) : staffCanReport.value;

  if (canInv && canApp && canScn && canRep) return 'Quản lý toàn bộ';
  const roles: string[] = [];
  if (canInv) roles.push('Người mời khách');
  if (canApp) roles.push('Người duyệt khách');
  if (canScn) roles.push('Người soát vé');
  if (canRep) roles.push('Người xem báo cáo');
  return roles.join(' · ') || 'Nhân sự sự kiện';
});

const filteredApprovalRegistrations = computed(() => {
  let list = staffRegistrations.value;
  if (approvalFilterStatus.value !== 'ALL') {
    list = list.filter((r) => r.status === approvalFilterStatus.value);
  }
  const q = approvalSearch.value.trim().toLowerCase();
  if (q) {
    list = list.filter((r) =>
      [r.full_name, r.phone, r.email, r.referrer_name, r.ticket_code].some((v) =>
        String(v || '').toLowerCase().includes(q)
      )
    );
  }
  return list;
});
const search = ref('');
const showMemberModal = ref(false);
const showAssignmentModal = ref(false);
const showEventModal = ref(false);
const showPaymentModal = ref(false);
const paymentModalData = ref<any>(null);
const paymentInfo = ref<any>({
  bank_code: 'MB',
  bank_name: 'MBBank',
  bank_account: '0386771868',
  bank_account_name: 'KTS QR EVENT',
  bank_qr_template: 'compact2'
});
const copiedKey = ref('');

const copyToClipboard = async (text: string, key: string) => {
  try {
    await navigator.clipboard.writeText(text);
    copiedKey.value = key;
    setTimeout(() => { copiedKey.value = ''; }, 2000);
  } catch (e) {
    console.error(e);
  }
};

const openPaymentModal = (ev: any) => {
  paymentModalData.value = {
    eventId: ev.id,
    eventName: ev.name,
    packageName: ev.package_name || 'Gói sự kiện',
    amount: Number(ev.package_price_vnd) || 0
  };
  showPaymentModal.value = true;
};

const saving = ref(false);
const staffAssignmentsDraft = ref<any[]>([]);

const initStaffAssignments = () => {
  staffAssignmentsDraft.value = team.value.map((m: any) => ({
    staff_id: m.id,
    name: m.name,
    email: m.email,
    is_selected: false,
    role: 'MANAGER',
    max_invites: 50,
    can_invite: true,
    can_approve: true,
    can_scan: true,
    can_view_report: true,
  }));
};

const onMemberRoleChange = (member: any) => {
  if (member.role === 'INVITER') {
    member.can_invite = true;
    member.can_approve = true; // Người mời có quyền duyệt khách
    member.can_scan = false;
    member.can_view_report = false;
  } else if (member.role === 'APPROVER') {
    member.can_invite = false;
    member.can_approve = true;
    member.can_scan = false;
    member.can_view_report = false;
  } else if (member.role === 'SCANNER') {
    member.can_invite = false;
    member.can_approve = false;
    member.can_scan = true;
    member.can_view_report = false;
  } else if (member.role === 'REPORTER') {
    member.can_invite = false;
    member.can_approve = false;
    member.can_scan = false;
    member.can_view_report = true;
  } else if (member.role === 'MANAGER') {
    member.can_invite = true;
    member.can_approve = true;
    member.can_scan = true;
    member.can_view_report = true;
  }
};

const eventForm = ref({
  name: '',
  description: '',
  location: '',
  map_url: '',
  info_url: '',
  start_at: '',
  end_at: '',
  registration_deadline: '',
  capacity: 500 as number | '',
  approval_mode: 'REFERRER_ONLY' as 'REFERRER_ONLY' | 'TWO_TIER' | 'AUTO',
  event_package_id: '' as number | string
});

const selectedPackageMaxAttendees = computed(() => {
  const pkgId = eventForm.value.event_package_id;
  if (pkgId === 'trial') return usage.value?.trial_package?.max_attendees || 500;
  if (typeof pkgId === 'number') {
    const pkg = usage.value?.available_packages?.find((p: any) => p.id === pkgId);
    if (pkg) return pkg.max_attendees || 500;
  }
  if (typeof pkgId === 'string' && pkgId.startsWith('plan_')) {
    const pId = Number(pkgId.replace('plan_', ''));
    const plan = plans.value?.find((p: any) => p.id === pId);
    if (plan) return plan.max_attendees || 500;
  }
  return usage.value?.trial_package?.max_attendees || 500;
});

const showEditEventModal = ref(false);
const editEventForm = ref({
  id: 0,
  name: '',
  location: '',
  map_url: '',
  info_url: '',
  start_at: '',
  end_at: '',
  registration_deadline: '',
  capacity: 500,
  description: '',
  approval_mode: 'REFERRER_ONLY'
});
const maxEditCapacity = ref(500);

const openEditEventModal = (ev: any) => {
  if (!ev) return;
  const toInputDate = (d: string) => {
    if (!d) return '';
    const date = new Date(d);
    return isNaN(date.getTime()) ? '' : new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };
  editEventForm.value = {
    id: ev.id,
    name: ev.name || '',
    location: ev.location || '',
    map_url: ev.map_url || '',
    info_url: ev.info_url || '',
    start_at: toInputDate(ev.start_at),
    end_at: toInputDate(ev.end_at),
    registration_deadline: toInputDate(ev.registration_deadline),
    capacity: ev.capacity || 500,
    description: ev.description || '',
    approval_mode: ev.approval_mode || 'REFERRER_ONLY'
  };
  maxEditCapacity.value = ev.max_attendees || (ev.is_trial ? usage.value?.trial_package?.max_attendees : 500) || 500;
  showEditEventModal.value = true;
};

const saveEditEvent = async () => {
  if (!editEventForm.value.name || !editEventForm.value.location) {
    alert('Vui lòng điền tên và địa điểm sự kiện.');
    return;
  }
  saving.value = true;
  errorMessage.value = '';
  try {
    const toMysqlDate = (value: string) => (value ? `${value.replace('T', ' ')}:00` : undefined);
    await api.put(`/tenants/portal/events/${editEventForm.value.id}`, {
      name: editEventForm.value.name,
      location: editEventForm.value.location,
      map_url: editEventForm.value.map_url || null,
      info_url: editEventForm.value.info_url || null,
      start_at: toMysqlDate(editEventForm.value.start_at),
      end_at: toMysqlDate(editEventForm.value.end_at),
      registration_deadline: toMysqlDate(editEventForm.value.registration_deadline) || null,
      capacity: Number(editEventForm.value.capacity),
      description: editEventForm.value.description,
      approval_mode: editEventForm.value.approval_mode
    });
    showEditEventModal.value = false;
    await loadPortal();
  } catch (error: any) {
    errorMessage.value = explainError(error);
  } finally {
    saving.value = false;
  }
};
const memberForm = ref({ name: '', email: '', phone: '', password: '' });
const memberTab = ref<'search' | 'create'>('search');
const staffSearchTerm = ref('');
const staffSearchResults = ref<any[]>([]);
const isSearchingStaff = ref(false);
let staffSearchDebounceTimer: any = null;

const onStaffSearchInput = () => {
  clearTimeout(staffSearchDebounceTimer);
  const q = staffSearchTerm.value.trim();
  if (q.length < 2) {
    staffSearchResults.value = [];
    isSearchingStaff.value = false;
    return;
  }
  isSearchingStaff.value = true;
  staffSearchDebounceTimer = setTimeout(async () => {
    try {
      const res = await api.get('/tenants/portal/search-users', { params: { term: q } });
      staffSearchResults.value = res.data.data || [];
    } catch (e) {
      console.error(e);
      staffSearchResults.value = [];
    } finally {
      isSearchingStaff.value = false;
    }
  }, 250);
};

const addExistingStaff = async (u: any) => {
  saving.value = true;
  errorMessage.value = '';
  try {
    await api.post('/tenants/portal/team', { user_id: u.id });
    showMemberModal.value = false;
    staffSearchTerm.value = '';
    staffSearchResults.value = [];
    await loadTeam();
  } catch (error: any) {
    errorMessage.value = explainError(error);
  } finally {
    saving.value = false;
  }
};
const assignment = ref({ staff_id: '', role: 'INVITER', max_invites: 50 });

const filteredAttendees = computed(() => {
  const term = search.value.trim().toLowerCase();
  return attendees.value.filter((item) => {
    const matchesSearch = !term || [item.full_name, item.email, item.phone, item.referrer_name, item.ticket_code].some((value) =>
      String(value || '').toLowerCase().includes(term)
    );
    if (!matchesSearch) return false;
    if (attendeeFilter.value === 'PENDING') {
      return item.registration_status === 'PENDING' || item.registration_status === 'PENDING_ADMIN';
    }
    if (attendeeFilter.value === 'APPROVED') {
      return item.registration_status === 'APPROVED' && item.ticket_status !== 'USED';
    }
    if (attendeeFilter.value === 'USED') {
      return item.ticket_status === 'USED';
    }
    return true;
  });
});
const unassignedTeam = computed(() =>
  team.value.filter((member) => !eventTeam.value.some((assigned) => assigned.id === member.id))
);
const attendeeFilter = ref<'ALL' | 'PENDING' | 'APPROVED' | 'USED'>('ALL');

const pendingCount = computed(
  () => attendees.value.filter((item) => item.registration_status === 'PENDING' || item.registration_status === 'PENDING_ADMIN').length
);

const approvedCount = computed(
  () => attendees.value.filter((item) => item.registration_status === 'APPROVED').length
);
const checkedInCount = computed(
  () => attendees.value.filter((item) => item.ticket_status === 'USED').length
);
const eventReferrerCount = computed(
  () => eventTeam.value.filter((member) => member.is_enabled && member.can_invite).length
);
const eventScannerCount = computed(
  () => eventTeam.value.filter((member) => member.is_enabled && member.can_scan).length
);
const eventEmployeeCount = computed(
  () => eventTeam.value.filter((member) => member.is_enabled).length
);

const explainError = (error: any) =>
  error.response?.data?.message || error.message || 'Có lỗi xảy ra. Vui lòng thử lại.';
const packageRequestStatus = (request: any) =>
  request.status === 'PENDING'
    ? 'Đang chờ admin xác nhận'
    : request.status === 'APPROVED'
      ? 'Đã cấp, chưa sử dụng'
      : `Bị từ chối${request.review_note ? ` · ${request.review_note}` : ''}`;
const eventPackagePrice = (event: any) =>
  event.is_trial
    ? 'Dùng thử'
    : `${Number(event.package_price_vnd).toLocaleString('vi-VN')} ₫`;

const loadPortal = async () => {
  loading.value = true;
  errorMessage.value = '';
  try {
    const [res, usageRes] = await Promise.all([
      api.get('/tenants/portal/events'),
      api.get('/tenants/portal/usage')
    ]);
    events.value = res.data.data;
    usage.value = usageRes.data.data;
    try {
      const planRes = await api.get('/subscriptions/plans');
      plans.value = planRes.data.data || [];
    } catch (e) {
      plans.value = [];
    }
    if (usage.value?.payment_info) {
      paymentInfo.value = usage.value.payment_info;
    }
    if (selectedEvent.value) {
      selectedEvent.value =
        events.value.find((item) => item.id === selectedEvent.value.id) || events.value[0] || null;
    } else {
      selectedEvent.value = events.value[0] || null;
    }
    scannerEvents.value = events.value.filter((ev: any) => ev.status === 'PUBLISHED');
    if (!selectedScannerEventId.value && scannerEvents.value.length > 0) {
      selectedScannerEventId.value = scannerEvents.value[0].id;
    }
    if (selectedEvent.value) await loadEventDetails(selectedEvent.value);
    await loadTeam();
    await loadDisputes();
  } catch (error: any) {
    errorMessage.value = explainError(error);
    if (error.response?.status === 401 || error.response?.status === 403) logout();
  } finally {
    loading.value = false;
  }
};

const loadEventDetails = async (event: any) => {
  if (!event) return;
  selectedEvent.value = event;
  activePanel.value = 'overview';

  // Khởi chạy nạp link mời & mã QR ngay lập tức cho mobile và desktop
  if (event.id) {
    loadTenantEventInvites(event.id);
  }

  try {
    const [attendeeRes, teamRes] = await Promise.allSettled([
      api.get(`/tenants/portal/events/${event.id}/attendees`),
      api.get(`/tenants/portal/events/${event.id}/team`)
    ]);
    if (attendeeRes.status === 'fulfilled') {
      attendees.value = attendeeRes.value.data.data || [];
    }
    if (teamRes.status === 'fulfilled') {
      eventTeam.value = teamRes.value.data.data || [];
    }
  } catch (error: any) {
    errorMessage.value = explainError(error);
  }
};

const loadTenantEventInvites = async (eventId: number) => {
  if (!eventId) return;
  loadingTenantInvites.value = true;
  try {
    const res = await api.get(`/tenants/portal/events/${eventId}/invites`);
    let invites = res.data.data || [];
    
    // Tìm link active hoặc lấy link đầu tiên
    let active = invites.find((l: any) => l.status === 'ACTIVE') || invites[0];
    
    // Fallback: nếu backend chưa có link nào, tự động gọi tạo link
    if (!active) {
      try {
        const createRes = await api.post(`/tenants/portal/events/${eventId}/invites`, {
          max_registrations: selectedEvent.value?.capacity || 1000,
          expires_in_days: 60,
        });
        active = createRes.data?.data;
        if (active) {
          invites.unshift(active);
        }
      } catch (e) {
        console.warn('Auto create tenant invite link error:', e);
      }
    }

    if (active) {
      active.invite_url = active.token
        ? `${window.location.origin}/invite/${active.token}`
        : (active.invite_url || active.url || `${window.location.origin}/invite/event_${eventId}`);
      tenantActiveInviteLink.value = active;
      try {
        tenantInviteQrUrl.value = await QRCode.toDataURL(active.invite_url, { width: 300, margin: 2 });
      } catch (qrErr) {
        console.warn('QRCode.toDataURL error:', qrErr);
      }
    } else {
      // Fallback dự phòng để mobile/desktop luôn luôn có link và QR ngay tức khắc
      const fallbackUrl = `${window.location.origin}/invite/event_${eventId}`;
      tenantActiveInviteLink.value = { invite_url: fallbackUrl, token: `event_${eventId}`, status: 'ACTIVE' };
      try {
        tenantInviteQrUrl.value = await QRCode.toDataURL(fallbackUrl, { width: 300, margin: 2 });
      } catch (_) {}
    }

    tenantEventInvites.value = invites.map((inv: any) => ({
      ...inv,
      invite_url: inv.token ? `${window.location.origin}/invite/${inv.token}` : (inv.invite_url || inv.url || ''),
    }));
  } catch (e) {
    console.warn('loadTenantEventInvites error:', e);
    if (eventId) {
      const fallbackUrl = `${window.location.origin}/invite/event_${eventId}`;
      tenantActiveInviteLink.value = { invite_url: fallbackUrl, token: `event_${eventId}`, status: 'ACTIVE' };
      try {
        tenantInviteQrUrl.value = await QRCode.toDataURL(fallbackUrl, { width: 300, margin: 2 });
      } catch (_) {}
    }
  } finally {
    loadingTenantInvites.value = false;
  }
};

// Luôn tự động nạp link và mã QR khi chuyển sự kiện hoặc mở trang
watch(
  () => selectedEvent.value?.id,
  (newId) => {
    if (newId) {
      loadTenantEventInvites(newId);
    }
  },
  { immediate: true }
);

const copyTenantInviteLink = async (url?: string) => {
  const targetUrl = url || tenantActiveInviteLink.value?.invite_url;
  if (!targetUrl) return;
  await navigator.clipboard.writeText(targetUrl);
  copiedTenantInviteLink.value = true;
  setTimeout(() => {
    copiedTenantInviteLink.value = false;
  }, 2000);
};

const shareTenantInviteLink = async (url?: string) => {
  const targetUrl = url || tenantActiveInviteLink.value?.invite_url;
  if (!targetUrl) return;
  const eventName = selectedEvent.value?.name || 'Sự kiện';
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: `Thư mời tham dự: ${eventName}`,
        text: `Trân trọng kính mời bạn tham gia ${eventName}. Đăng ký nhận vé QR tại: ${targetUrl}`,
        url: targetUrl,
      });
    } catch (e) {
      // User cancelled
    }
  } else {
    await copyTenantInviteLink(targetUrl);
  }
};

const openAdminInviteCard = (att?: any) => {
  const ev = selectedEvent.value;
  const link = tenantActiveInviteLink.value;
  if (att) {
    adminCardData.value = {
      attendee_name: att.full_name || 'Kính mời Quý Khách',
      attendee_role: 'Khách Mời Danh Dự (VIP)',
      event_name: ev?.name,
      event_location: ev?.location,
      event_start_at: ev?.start_at,
      qr_data: att.ticket_code || link?.invite_url || window.location.origin,
      code_label: att.ticket_code ? `MÃ VÉ: ${att.ticket_code}` : 'QUÉT ĐỂ ĐĂNG KÝ (VIP)',
    };
  } else {
    adminCardData.value = {
      attendee_name: 'Kính mời Quý Khách',
      attendee_role: 'Khách Mời Danh Dự (VIP)',
      event_name: ev?.name,
      event_location: ev?.location,
      event_start_at: ev?.start_at,
      qr_data: link?.invite_url || window.location.origin,
      code_label: 'QUÉT ĐỂ ĐĂNG KÝ THAM DỰ (VIP)',
    };
  }
  showAdminInviteCardModal.value = true;
};

const handleCreateTenantInvite = async () => {
  if (!selectedEvent.value) return;
  creatingInvite.value = true;
  try {
    await api.post(`/tenants/portal/events/${selectedEvent.value.id}/invites`, {
      referrer_id: newInviteForm.referrer_id ? Number(newInviteForm.referrer_id) : undefined,
      max_registrations: Number(newInviteForm.max_registrations || 1000),
      expires_in_days: Number(newInviteForm.expires_in_days || 60),
    });
    showTenantInviteModal.value = false;
    newInviteForm.referrer_id = '';
    newInviteForm.max_registrations = 1000;
    newInviteForm.expires_in_days = 60;
    await loadTenantEventInvites(selectedEvent.value.id);
  } catch (e: any) {
    alert(e.response?.data?.message || e.message);
  } finally {
    creatingInvite.value = false;
  }
};

const loadTeam = async () => {
  try {
    const res = await api.get('/tenants/portal/team');
    team.value = res.data.data;
  } catch (error: any) {
    errorMessage.value = explainError(error);
  }
};

const createEvent = async () => {
  saving.value = true;
  errorMessage.value = '';
  try {
    const toMysqlDate = (value: string) => (value ? `${value.replace('T', ' ')}:00` : '');
    const pkgParam = eventForm.value.event_package_id;
    let eventPackageId: any = undefined;
    let planId: any = undefined;
    if (typeof pkgParam === 'number') {
      eventPackageId = pkgParam;
    } else if (typeof pkgParam === 'string' && pkgParam.startsWith('plan_')) {
      planId = pkgParam.replace('plan_', '');
    }
    const selectedAssignments = staffAssignmentsDraft.value
      .filter((sa: any) => sa.is_selected)
      .map((sa: any) => ({
        staff_id: sa.staff_id,
        role: sa.role,
        max_invites: sa.max_invites,
        can_invite: sa.can_invite,
        can_approve: sa.can_approve,
        can_scan: sa.can_scan,
        can_view_report: sa.can_view_report,
      }));
    const res = await api.post('/tenants/portal/events', {
      name: eventForm.value.name,
      description: eventForm.value.description,
      location: eventForm.value.location,
      map_url: eventForm.value.map_url || null,
      info_url: eventForm.value.info_url || null,
      start_at: toMysqlDate(eventForm.value.start_at),
      end_at: toMysqlDate(eventForm.value.end_at),
      registration_deadline: toMysqlDate(eventForm.value.registration_deadline) || null,
      capacity: Number(eventForm.value.capacity) || selectedPackageMaxAttendees.value,
      approval_mode: eventForm.value.approval_mode,
      event_package_id: eventPackageId,
      plan_id: planId,
      staff_assignments: selectedAssignments
    });
    const created = res.data.data;
    selectedEvent.value = { id: created.id };
    eventForm.value = {
      name: '',
      description: '',
      location: '',
      map_url: '',
      info_url: '',
      start_at: '',
      end_at: '',
      registration_deadline: '',
      capacity: 500,
      approval_mode: 'REFERRER_ONLY',
      event_package_id: ''
    };
    showEventModal.value = false;
    activePanel.value = 'overview';
    await loadPortal();
    if (created.payment_status === 'PENDING_PAYMENT') {
      openPaymentModal(created);
    }
  } catch (error: any) {
    errorMessage.value = explainError(error);
  } finally {
    saving.value = false;
  }
};

const requestPlan = async (plan: any) => {
  saving.value = true;
  errorMessage.value = '';
  try {
    await api.post('/subscriptions/portal/requests', { plan_id: plan.id });
    await loadPortal();
  } catch (error: any) {
    errorMessage.value = explainError(error);
  } finally {
    saving.value = false;
  }
};

const closeEvent = async () => {
  if (
    !selectedEvent.value ||
    !window.confirm(`Đóng sự kiện “${selectedEvent.value.name}”? Sự kiện và dữ liệu vẫn được lưu.`)
  )
    return;
  try {
    await api.post(`/tenants/portal/events/${selectedEvent.value.id}/close`);
    await loadPortal();
  } catch (error: any) {
    errorMessage.value = explainError(error);
  }
};

const reopenEvent = async () => {
  if (!selectedEvent.value) return;
  if (!window.confirm(`Mở lại sự kiện “${selectedEvent.value.name}”? Khách mời sẽ có thể tiếp tục nhận link và đăng ký vé.`))
    return;
  try {
    await api.post(`/tenants/portal/events/${selectedEvent.value.id}/reopen`);
    await loadPortal();
    if (selectedEvent.value?.id) {
      await loadTenantEventInvites(selectedEvent.value.id);
    }
    alert('Đã mở lại sự kiện thành công! Link mời và mã QR đã sẵn sàng hoạt động.');
  } catch (error: any) {
    errorMessage.value = explainError(error);
  }
};

const openEventModal = (packageId?: number | string) => {
  eventForm.value.approval_mode = 'REFERRER_ONLY';
  if (packageId) {
    eventForm.value.event_package_id = packageId;
  } else if (Number(usage.value?.free_events_remaining) > 0 && usage.value?.trial_package) {
    eventForm.value.event_package_id = 'trial';
  } else if (usage.value?.available_packages?.length) {
    eventForm.value.event_package_id = usage.value.available_packages[0].id;
  } else if (plans.value?.length) {
    eventForm.value.event_package_id = 'plan_' + plans.value[0].id;
  }
  eventForm.value.capacity = selectedPackageMaxAttendees.value;
  initStaffAssignments();
  showEventModal.value = true;
};

const login = async () => {
  loginBusy.value = true;
  errorMessage.value = '';
  try {
    const res = await api.post('/auth/login', {
      email: email.value.trim(),
      password: password.value
    });
    const account = res.data.data.user;
    const tenantAdmin = account.type === 'TENANT_ADMIN';
    const isTenantStaff = account.type === 'STAFF';
    if (!tenantAdmin && !isTenantStaff)
      throw new Error('Tài khoản này chưa được cấp quyền vào cổng khách thuê hoặc không gian nhân sự.');

    token.value = res.data.data.token;
    user.value = account;

    localStorage.setItem('tenant_token', token.value);
    localStorage.setItem('tenant_user', JSON.stringify(account));
    localStorage.setItem('token', token.value);
    localStorage.setItem('user', JSON.stringify(account));

    password.value = '';
    if (isTenantStaff) {
      await loadStaffPortal();
    } else {
      await loadPortal();
    }
  } catch (error: any) {
    errorMessage.value = explainError(error);
  } finally {
    loginBusy.value = false;
  }
};

const isTenantRegister = ref(false);
const tenantRegForm = ref({
  name: '',
  contact_name: '',
  email: '',
  phone: '',
  password: ''
});
const tenantRegBusy = ref(false);

const registerTenantAccount = async () => {
  errorMessage.value = '';
  if (!tenantRegForm.value.name.trim() || !tenantRegForm.value.email.trim() || !tenantRegForm.value.password) {
    errorMessage.value = 'Vui lòng điền đủ tên đơn vị, email và mật khẩu.';
    return;
  }
  if (tenantRegForm.value.password.length < 8) {
    errorMessage.value = 'Mật khẩu cần ít nhất 8 ký tự.';
    return;
  }
  tenantRegBusy.value = true;
  try {
    const res = await api.post('/tenants/register', tenantRegForm.value);
    const { token: t, user: u } = res.data.data;
    token.value = t;
    user.value = u;
    localStorage.setItem('tenant_token', t);
    localStorage.setItem('tenant_user', JSON.stringify(u));
    localStorage.setItem('token', t);
    localStorage.setItem('user', JSON.stringify(u));
    await loadPortal();
  } catch (error: any) {
    errorMessage.value = explainError(error);
  } finally {
    tenantRegBusy.value = false;
  }
};

const logout = () => {
  stopScanner();
  token.value = '';
  user.value = null;
  localStorage.removeItem('tenant_token');
  localStorage.removeItem('tenant_user');
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  events.value = [];
  selectedEvent.value = null;
  staffEvents.value = [];
  staffInviteLink.value = null;
  staffRegistrations.value = [];
  authStore.logout();
  router.push('/khach');
};

const loadStaffPortal = async () => {
  loadingStaffData.value = true;
  try {
    const res = await api.get('/events?scope=active');
    staffEvents.value = res.data.data || [];

    // Filter events staff can scan
    scannerEvents.value = staffEvents.value.filter((event: any) => event.my_can_scan);
    selectedScannerEventId.value = scannerEvents.value[0]?.id || null;

    if (staffEvents.value.length > 0) {
      if (!selectedStaffEventId.value || !staffEvents.value.some((e) => e.id === selectedStaffEventId.value)) {
        selectedStaffEventId.value = staffEvents.value[0].id;
      }
    }

    // Determine initial tab based on permissions
    if (staffCanApprove.value && !staffCanInvite.value && !staffCanScan.value) {
      staffTab.value = 'approve';
    } else if (staffCanInvite.value && !staffCanApprove.value && !staffCanScan.value) {
      staffTab.value = 'invite';
    } else if (staffCanScan.value && !staffCanInvite.value && !staffCanApprove.value) {
      staffTab.value = 'scan';
    } else if (staffCanApprove.value) {
      staffTab.value = 'approve';
    } else if (staffCanInvite.value) {
      staffTab.value = 'invite';
    } else if (staffCanScan.value) {
      staffTab.value = 'scan';
    } else if (staffCanReport.value) {
      staffTab.value = 'report';
    } else {
      staffTab.value = 'approve';
    }

    if (selectedStaffEventId.value) {
      await loadStaffInviteDetails(selectedStaffEventId.value);
    }
    await loadDisputes();
  } catch (err: any) {
    console.error('loadStaffPortal error:', err);
  } finally {
    loadingStaffData.value = false;
  }
};

const loadStaffInviteDetails = async (eventId: number) => {
  try {
    const [linksRes, quotaRes, regsRes] = await Promise.all([
      api.get('/invites/my-links').catch(() => ({ data: { data: [] } })),
      api.get(`/invites/quota?event_id=${eventId}`).catch(() => ({ data: { data: null } })),
      api.get(`/registrations?event_id=${eventId}`).catch(() => ({ data: { data: [] } })),
    ]);

    const links = linksRes.data?.data || [];
    let link = links.find((l: any) => l.event_id === eventId && l.status === 'ACTIVE');
    if (!link && staffSelectedEvent.value?.my_can_invite) {
      try {
        const createRes = await api.post('/invites', { event_id: eventId, max_registrations: 50, expire_days: 30 });
        link = createRes.data?.data;
      } catch (e) {
        console.warn('Auto create invite link error:', e);
      }
    }

    if (!link && eventId) {
      link = {
        event_id: eventId,
        invite_url: `${window.location.origin}/invite/event_${eventId}`,
        token: `event_${eventId}`,
        status: 'ACTIVE'
      };
    }

    if (link) {
      const origin = window.location.origin;
      link.invite_url = link.token ? `${origin}/invite/${link.token}` : (link.invite_url || link.url || `${origin}/invite/event_${eventId}`);
    }

    staffInviteLink.value = link || null;
    staffQuota.value = quotaRes.data?.data || null;
    staffRegistrations.value = regsRes.data?.data || [];

    if (link?.invite_url) {
      staffInviteQrUrl.value = await QRCode.toDataURL(link.invite_url, { width: 300, margin: 2 });
    } else {
      staffInviteQrUrl.value = '';
    }
  } catch (e) {
    console.error('loadStaffInviteDetails error:', e);
    if (eventId && !staffInviteLink.value) {
      const fallbackUrl = `${window.location.origin}/invite/event_${eventId}`;
      staffInviteLink.value = { event_id: eventId, invite_url: fallbackUrl, token: `event_${eventId}`, status: 'ACTIVE' };
      try {
        staffInviteQrUrl.value = await QRCode.toDataURL(fallbackUrl, { width: 300, margin: 2 });
      } catch (_) {}
    }
  }
};

const copyStaffInviteLink = async () => {
  if (!staffInviteLink.value?.invite_url) return;
  await navigator.clipboard.writeText(staffInviteLink.value.invite_url);
  copiedInviteLink.value = true;
  setTimeout(() => {
    copiedInviteLink.value = false;
  }, 2000);
};

const shareStaffInviteLink = async () => {
  if (!staffInviteLink.value?.invite_url) return;
  const eventName = staffSelectedEvent.value?.name || 'Sự kiện';
  const url = staffInviteLink.value.invite_url;
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: `Thư mời tham dự: ${eventName}`,
        text: `Trân trọng kính mời bạn tham gia ${eventName}. Đăng ký nhận vé QR tại: ${url}`,
        url,
      });
    } catch (e) {
      // User cancelled share dialog
    }
  } else {
    await copyStaffInviteLink();
  }
};

const approveStaffGuest = async (regId: number) => {
  try {
    await api.put(`/registrations/${regId}/approve`);
    if (selectedStaffEventId.value) {
      await loadStaffInviteDetails(selectedStaffEventId.value);
    }
    await loadDisputes();
  } catch (err: any) {
    alert(err.response?.data?.message || 'Không thể duyệt khách này.');
  }
};

const rejectStaffGuest = async (reg: any) => {
  const reason = prompt(`Nhập lý do từ chối đăng ký của "${reg.full_name}":`, 'Không đáp ứng điều kiện tham gia');
  if (reason === null) return;
  try {
    await api.put(`/registrations/${reg.id}/reject`, { reason });
    if (selectedStaffEventId.value) {
      await loadStaffInviteDetails(selectedStaffEventId.value);
    }
    await loadDisputes();
  } catch (err: any) {
    alert(err.response?.data?.message || 'Không thể từ chối khách này.');
  }
};

const approveAllPending = async () => {
  const pending = staffRegistrations.value.filter((r) => r.status === 'PENDING');
  if (!pending.length) {
    alert('Không có khách nào đang chờ duyệt.');
    return;
  }
  if (!confirm(`Xác nhận duyệt vé & cấp mã QR hàng loạt cho ${pending.length} khách đang chờ?`)) return;
  try {
    for (const r of pending) {
      await api.put(`/registrations/${r.id}/approve`);
    }
    alert(`Đã duyệt thành công ${pending.length} khách!`);
    if (selectedStaffEventId.value) {
      await loadStaffInviteDetails(selectedStaffEventId.value);
    }
    await loadDisputes();
  } catch (err: any) {
    alert(err.response?.data?.message || 'Có lỗi xảy ra khi duyệt.');
    if (selectedStaffEventId.value) {
      await loadStaffInviteDetails(selectedStaffEventId.value);
    }
  }
};

const exportStaffAttendees = () => {
  const headers = ['Họ tên', 'Email', 'Điện thoại', 'Người giới thiệu', 'Trạng thái duyệt', 'Mã vé', 'Check-in'];
  const rows = staffRegistrations.value.map((item) => [
    item.full_name,
    item.email || '',
    item.phone || '',
    item.referrer_name || '',
    item.status === 'APPROVED' ? 'Đã duyệt' : item.status === 'REJECTED' ? 'Từ chối' : 'Chờ duyệt',
    item.ticket_code || '',
    item.ticket_status === 'USED' ? 'Đã check-in' : 'Chưa check-in'
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `danh-sach-${staffSelectedEvent.value?.name || 'su-kien'}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
};

const onStaffEventChange = async () => {
  if (selectedStaffEventId.value) {
    await loadStaffInviteDetails(selectedStaffEventId.value);
  }
};

const loadScannerEvents = async () => {
  try {
    const res = await api.get('/events?scope=active');
    scannerEvents.value = res.data.data.filter((event: any) => event.my_can_scan || authStore.isTenantAdmin || authStore.isAdmin);
    selectedScannerEventId.value = scannerEvents.value[0]?.id || null;
    if (!scannerEvents.value.length)
      scannerError.value = 'Tài khoản chưa được phân công quét QR cho sự kiện đang mở.';
  } catch (error: any) {
    scannerError.value = explainError(error);
  }
};

let activeScannerCleanup: (() => void) | null = null;

const stopScanner = () => {
  if (activeScannerCleanup) {
    try {
      activeScannerCleanup();
    } catch {}
    activeScannerCleanup = null;
  }
  if (qrScanner) {
    const scanner = qrScanner;
    qrScanner = null;
    try {
      scanner.stop().catch(() => undefined).finally(() => {
        try { scanner.clear(); } catch {}
      });
    } catch {
      try { scanner.clear(); } catch {}
    }
  }
  scannerRunning.value = false;
};

const toggleSound = () => {
  isSoundEnabled.value = !isSoundEnabled.value;
  if (isSoundEnabled.value) {
    unlockAudio();
    playScanSound('SUCCESS');
  }
};

const playScanTone = (type: 'SUCCESS' | 'ALREADY_USED' | 'INVALID') => {
  playScanSound(type);
};

const startScanner = async () => {
  unlockAudio();
  if (scannerRunning.value || !selectedScannerEventId.value) return;
  scannerError.value = '';
  scannerResult.value = null;
  stopScanner();

  try {
    await nextTick();
    const readerEl = document.getElementById('tenant-qr-reader');
    if (!readerEl) {
      throw new Error('Không tìm thấy khung hiển thị camera.');
    }
    readerEl.innerHTML = '';

    // Hidden container for Html5Qrcode ZXing/BarcodeDetector decoder shim
    let hiddenDecoderEl = document.getElementById('tenant-qr-decoder-hidden');
    if (!hiddenDecoderEl) {
      hiddenDecoderEl = document.createElement('div');
      hiddenDecoderEl.id = 'tenant-qr-decoder-hidden';
      hiddenDecoderEl.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:10px;height:10px;overflow:hidden;pointer-events:none;opacity:0;';
      document.body.appendChild(hiddenDecoderEl);
    }
    const decoderInstance = new Html5Qrcode('tenant-qr-decoder-hidden', {
      verbose: false,
      experimentalFeatures: { useBarCodeDetectorIfSupported: true },
    } as any);
    const qrShim = (decoderInstance as any).qrcode;

    let nativeDetector: any = null;
    try {
      if ('BarcodeDetector' in window) {
        nativeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      }
    } catch {}

    // Request camera MediaStream directly without creating/playing a <video> element yet
    let mediaStream: MediaStream;
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
    } catch {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: true,
      });
    }

    const videoTrack = mediaStream.getVideoTracks()[0];
    if (!videoTrack) {
      mediaStream.getTracks().forEach((t) => t.stop());
      throw new Error('Không tìm thấy luồng video từ camera.');
    }

    // Visible live preview canvas inside .scanner-camera (never triggers iOS native fullscreen video player)
    const previewCanvas = document.createElement('canvas');
    previewCanvas.className = 'scanner-live-canvas';
    previewCanvas.style.cssText = 'width:100%;height:100%;display:block;pointer-events:none;';
    readerEl.appendChild(previewCanvas);
    const previewCtx = previewCanvas.getContext('2d', { alpha: false });

    // Offscreen canvas to normalize mobile portrait sensor rotation (90 deg clockwise on iOS WebKit VideoFrame)
    const orientCanvas = document.createElement('canvas');
    const orientCtx = orientCanvas.getContext('2d', { alpha: false });

    // Offscreen 420x420 square canvas for undistorted multi-scale QR decoding
    const scanCanvas = document.createElement('canvas');
    scanCanvas.width = 420;
    scanCanvas.height = 420;
    const scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });

    let scannerActive = true;
    let isDecoding = false;
    let lastDecodeTime = 0;
    let frameIndex = 0;
    const scales = [0.72, 0.42, 0.94];
    let workerInstance: Worker | null = null;
    let workerBlobUrl: string | null = null;
    let clonedWorkerTrack: MediaStreamTrack | null = null;
    let rafId: number | null = null;
    let fallbackVideoEl: HTMLVideoElement | null = null;

    activeScannerCleanup = () => {
      scannerActive = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (workerInstance) {
        try { workerInstance.postMessage({ type: 'stop' }); } catch {}
        try { workerInstance.terminate(); } catch {}
        workerInstance = null;
      }
      if (workerBlobUrl) {
        try { URL.revokeObjectURL(workerBlobUrl); } catch {}
        workerBlobUrl = null;
      }
      if (clonedWorkerTrack) {
        try { clonedWorkerTrack.stop(); } catch {}
        clonedWorkerTrack = null;
      }
      if (fallbackVideoEl) {
        try { fallbackVideoEl.pause(); } catch {}
        try { fallbackVideoEl.srcObject = null; } catch {}
        try { fallbackVideoEl.remove(); } catch {}
        fallbackVideoEl = null;
      }
      try {
        mediaStream.getTracks().forEach((t) => t.stop());
      } catch {}
      try {
        readerEl.innerHTML = '';
      } catch {}
    };

    const decodeCurrentScanCanvas = async (): Promise<string | null> => {
      if (nativeDetector) {
        try {
          const barcodes = await nativeDetector.detect(scanCanvas);
          if (barcodes && barcodes.length > 0 && barcodes[0]?.rawValue) {
            return String(barcodes[0].rawValue);
          }
        } catch {}
      }
      if (qrShim && typeof qrShim.decodeAsync === 'function') {
        try {
          const res = await qrShim.decodeAsync(scanCanvas);
          if (res?.text) return String(res.text);
        } catch {}
        if (scanCtx) {
          try {
            scanCtx.save();
            scanCtx.translate(scanCanvas.width, 0);
            scanCtx.scale(-1, 1);
            scanCtx.drawImage(scanCanvas, 0, 0);
            scanCtx.restore();
            const flippedRes = await qrShim.decodeAsync(scanCanvas);
            if (flippedRes?.text) return String(flippedRes.text);
          } catch {}
        }
      }
      return null;
    };

    const isMobileDevice =
      /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    const renderAndScanFrame = (source: any) => {
      if (!scannerActive || !source) return;
      const rawW = source.codedWidth || source.displayWidth || source.videoWidth || source.width || 0;
      const rawH = source.codedHeight || source.displayHeight || source.videoHeight || source.height || 0;
      if (!rawW || !rawH) return;

      let rotationDeg = 0;
      if (isMobileDevice && window.innerHeight > window.innerWidth && rawW > rawH) {
        rotationDeg = 90;
      } else if (typeof source.rotation === 'number' && (source.rotation === 90 || source.rotation === 180 || source.rotation === 270)) {
        rotationDeg = source.rotation;
      }

      let frameToDraw: any = source;
      let sw = rawW;
      let sh = rawH;

      if (rotationDeg !== 0 && orientCtx) {
        if (rotationDeg === 90 || rotationDeg === 270) {
          sw = rawH;
          sh = rawW;
        } else {
          sw = rawW;
          sh = rawH;
        }
        if (orientCanvas.width !== sw || orientCanvas.height !== sh) {
          orientCanvas.width = sw;
          orientCanvas.height = sh;
        }
        orientCtx.save();
        orientCtx.setTransform(1, 0, 0, 1, 0, 0);
        orientCtx.translate(sw / 2, sh / 2);
        orientCtx.rotate((rotationDeg * Math.PI) / 180);
        orientCtx.drawImage(source, -rawW / 2, -rawH / 2, rawW, rawH);
        orientCtx.restore();
        frameToDraw = orientCanvas;
      }

      const cw = readerEl.clientWidth || 320;
      const ch = readerEl.clientHeight || 270;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetW = Math.max(1, Math.round(cw * dpr));
      const targetH = Math.max(1, Math.round(ch * dpr));
      if (previewCanvas.width !== targetW || previewCanvas.height !== targetH) {
        previewCanvas.width = targetW;
        previewCanvas.height = targetH;
      }

      if (previewCtx) {
        const coverScale = Math.max(targetW / sw, targetH / sh);
        const cropW = targetW / coverScale;
        const cropH = targetH / coverScale;
        const cropX = (sw - cropW) / 2;
        const cropY = (sh - cropH) / 2;
        previewCtx.drawImage(frameToDraw, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);
      }

      const now = performance.now();
      if (!isDecoding && now - lastDecodeTime >= 50 && scanCtx) {
        isDecoding = true;
        lastDecodeTime = now;
        const scale = scales[frameIndex % scales.length];
        frameIndex++;
        const minDim = Math.min(sw, sh);
        const cropSize = Math.max(120, Math.floor(minDim * scale));
        const sx = Math.floor((sw - cropSize) / 2);
        const sy = Math.floor((sh - cropSize) / 2);
        scanCtx.setTransform(1, 0, 0, 1, 0, 0);
        scanCtx.drawImage(frameToDraw, sx, sy, cropSize, cropSize, 0, 0, 420, 420);

        decodeCurrentScanCanvas()
          .then((decodedText) => {
            if (decodedText && scannerActive) {
              submitScan(decodedText);
            }
          })
          .finally(() => {
            isDecoding = false;
          });
      }
    };

    // Tier 1: Try Dedicated Worker MediaStreamTrackProcessor (Zero <video> element! Supported on iOS 18+ Safari/WKWebView/Zalo)
    const tryStartWorkerPipeline = (): Promise<boolean> => {
      return new Promise((resolve) => {
        let settled = false;
        const finish = (ok: boolean) => {
          if (settled) return;
          settled = true;
          resolve(ok);
        };
        try {
          if (typeof Worker === 'undefined' || typeof videoTrack.clone !== 'function') {
            finish(false);
            return;
          }
          const workerCode = `
            let running = true;
            let waitingAck = false;
            self.onmessage = async (e) => {
              const msg = e.data;
              if (!msg) return;
              if (msg.type === 'ack') {
                waitingAck = false;
                return;
              }
              if (msg.type === 'stop') {
                running = false;
                return;
              }
              if (msg.track) {
                try {
                  if (typeof MediaStreamTrackProcessor === 'undefined') {
                    self.postMessage({ type: 'unsupported' });
                    return;
                  }
                  const processor = new MediaStreamTrackProcessor({ track: msg.track });
                  const reader = processor.readable.getReader();
                  while (running) {
                    const { value: frame, done } = await reader.read();
                    if (done || !frame || !running) {
                      if (frame && typeof frame.close === 'function') frame.close();
                      break;
                    }
                    if (waitingAck) {
                      if (typeof frame.close === 'function') frame.close();
                    } else {
                      waitingAck = true;
                      self.postMessage({ type: 'frame', frame }, [frame]);
                    }
                  }
                } catch (err) {
                  self.postMessage({ type: 'error', message: String(err) });
                }
              }
            };
          `;
          const blob = new Blob([workerCode], { type: 'application/javascript' });
          workerBlobUrl = URL.createObjectURL(blob);
          workerInstance = new Worker(workerBlobUrl);
          clonedWorkerTrack = videoTrack.clone();

          const timeoutId = window.setTimeout(() => {
            finish(false);
          }, 700);

          workerInstance.onmessage = (ev) => {
            const data = ev.data;
            if (!data) return;
            if (data.type === 'unsupported' || data.type === 'error') {
              clearTimeout(timeoutId);
              finish(false);
              return;
            }
            if (data.type === 'frame' && data.frame) {
              clearTimeout(timeoutId);
              finish(true);
              try {
                renderAndScanFrame(data.frame);
              } finally {
                try { data.frame.close(); } catch {}
                if (scannerActive && workerInstance) {
                  try { workerInstance.postMessage({ type: 'ack' }); } catch {}
                }
              }
            }
          };
          workerInstance.onerror = () => {
            clearTimeout(timeoutId);
            finish(false);
          };

          workerInstance.postMessage({ track: clonedWorkerTrack }, [clonedWorkerTrack as any]);
        } catch {
          finish(false);
        }
      });
    };

    // Tier 2: Try Main-Thread MediaStreamTrackProcessor or ImageCapture.grabFrame() (Zero <video> element!)
    const tryStartMainThreadZeroVideoPipeline = async (): Promise<boolean> => {
      if (typeof (window as any).MediaStreamTrackProcessor === 'function') {
        try {
          const processor = new (window as any).MediaStreamTrackProcessor({ track: videoTrack });
          const reader = processor.readable.getReader();
          const first = await Promise.race([
            reader.read(),
            new Promise<any>((r) => setTimeout(() => r(null), 600)),
          ]);
          if (first && first.value) {
            try {
              renderAndScanFrame(first.value);
            } finally {
              try { first.value.close(); } catch {}
            }
            (async () => {
              while (scannerActive) {
                try {
                  const { value: frame, done } = await reader.read();
                  if (done || !frame || !scannerActive) {
                    if (frame) try { frame.close(); } catch {}
                    break;
                  }
                  try {
                    renderAndScanFrame(frame);
                  } finally {
                    try { frame.close(); } catch {}
                  }
                } catch {
                  break;
                }
              }
            })();
            return true;
          }
        } catch {}
      }

      if (typeof (window as any).ImageCapture === 'function') {
        try {
          const imageCapture = new (window as any).ImageCapture(videoTrack);
          if (typeof imageCapture.grabFrame === 'function') {
            const firstBitmap = await Promise.race([
              imageCapture.grabFrame(),
              new Promise<any>((r) => setTimeout(() => r(null), 600)),
            ]);
            if (firstBitmap) {
              try {
                renderAndScanFrame(firstBitmap);
              } finally {
                try { firstBitmap.close?.(); } catch {}
              }
              const pumpGrabFrame = async () => {
                while (scannerActive) {
                  try {
                    const bmp = await imageCapture.grabFrame();
                    if (!scannerActive) {
                      try { bmp.close?.(); } catch {}
                      break;
                    }
                    try {
                      renderAndScanFrame(bmp);
                    } finally {
                      try { bmp.close?.(); } catch {}
                    }
                    await new Promise((r) => requestAnimationFrame(() => r(null)));
                  } catch {
                    await new Promise((r) => setTimeout(r, 40));
                  }
                }
              };
              pumpGrabFrame();
              return true;
            }
          }
        } catch {}
      }

      return false;
    };

    scannerRunning.value = true;

    const workerOk = await tryStartWorkerPipeline();
    if (!workerOk && scannerActive) {
      // Clean up unused worker resources
      if (workerInstance) {
        try { workerInstance.terminate(); } catch {}
        workerInstance = null;
      }
      if (workerBlobUrl) {
        try { URL.revokeObjectURL(workerBlobUrl); } catch {}
        workerBlobUrl = null;
      }
      if (clonedWorkerTrack) {
        try { clonedWorkerTrack.stop(); } catch {}
        clonedWorkerTrack = null;
      }

      const mainZeroVideoOk = await tryStartMainThreadZeroVideoPipeline();
      if (!mainZeroVideoOk && scannerActive) {
        // Tier 3 Fallback: Inline <video> with strict playsinline/webkit-playsinline attributes
        const video = document.createElement('video');
        fallbackVideoEl = video;
        video.defaultMuted = true;
        video.muted = true;
        video.playsInline = true;
        video.autoplay = true;
        video.controls = false;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.setAttribute('x5-playsinline', 'true');
        video.setAttribute('x5-video-player-type', 'h5-page');
        video.setAttribute('muted', 'true');
        video.setAttribute('autoplay', 'true');
        video.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0.01;pointer-events:none;left:0;top:0;z-index:-1;';
        readerEl.appendChild(video);
        video.srcObject = mediaStream;

        await new Promise<void>((resolve) => {
          let done = false;
          const finish = () => {
            if (done) return;
            done = true;
            resolve();
          };
          video.onloadedmetadata = () => finish();
          setTimeout(finish, 400);
        });

        if (video.paused && video.videoWidth === 0) {
          try {
            await video.play();
          } catch {}
        }

        const pumpVideo = () => {
          if (!scannerActive || !fallbackVideoEl) return;
          if (fallbackVideoEl.videoWidth > 0 && fallbackVideoEl.videoHeight > 0) {
            renderAndScanFrame(fallbackVideoEl);
          }
          rafId = requestAnimationFrame(pumpVideo);
        };
        rafId = requestAnimationFrame(pumpVideo);
      }
    }
  } catch (error: any) {
    stopScanner();
    scannerError.value = error.message || 'Không thể mở camera. Hãy cấp quyền camera cho trình duyệt.';
  }
};

const submitScan = async (code: string, isManual = false) => {
  if ((!isManual && scanBusy.value) || !selectedScannerEventId.value) return;
  const cleanCode = code.trim();
  if (!cleanCode) return;
  const now = Date.now();
  if (!isManual && cleanCode === lastScannedCode && now - lastScannedTime < 3000) {
    return;
  }
  lastScannedCode = cleanCode;
  lastScannedTime = now;
  scanBusy.value = true;
  disputeSent.value = false;

  try {
    const res = await api.post('/check-in/scan', {
      code: cleanCode,
      event_id: selectedScannerEventId.value,
      device_info: navigator.userAgent.slice(0, 220)
    });
    scannerResult.value = res.data.data;
    playScanTone(res.data.data?.result || 'SUCCESS');
    manualScanCode.value = '';
  } catch (error: any) {
    const data = error.response?.data?.data;
    if (data) {
      scannerResult.value = data;
      playScanTone(data.result || 'ALREADY_USED');
    } else {
      scannerResult.value = {
        result: 'INVALID',
        message: error.response?.data?.message || explainError(error) || 'Không xác nhận được vé'
      };
      playScanTone('INVALID');
    }
  } finally {
    if (isManual) {
      scanBusy.value = false;
    } else {
      window.setTimeout(() => {
        scanBusy.value = false;
      }, 1500);
    }
  }
};

const loadDisputes = async () => {
  loadingDisputes.value = true;
  try {
    const res = await api.get('/disputes');
    disputesList.value = res.data?.data || [];
  } catch {
    disputesList.value = [];
  } finally {
    loadingDisputes.value = false;
  }
};

const openDisputeModal = () => {
  if (!scannerResult.value) return;
  disputeForm.value = {
    claimant_name: scannerResult.value.attendee?.full_name || '',
    claimant_phone: scannerResult.value.attendee?.phone || '',
    explanation: '',
  };
  showDisputeModal.value = true;
};

const submitDisputeForm = async () => {
  if (!scannerResult.value?.scan_log_id || !scannerResult.value?.ticket?.id) return;
  if (!disputeForm.value.claimant_name.trim() || !disputeForm.value.claimant_phone.trim() || !disputeForm.value.explanation.trim()) {
    return;
  }
  disputeSubmitting.value = true;
  try {
    await api.post('/disputes', {
      scan_log_id: scannerResult.value.scan_log_id,
      ticket_id: scannerResult.value.ticket.id,
      claimant_name: disputeForm.value.claimant_name.trim(),
      claimant_phone: disputeForm.value.claimant_phone.trim(),
      explanation: disputeForm.value.explanation.trim(),
    });
    disputeSent.value = true;
    showDisputeModal.value = false;
    await loadDisputes();
  } catch (error: any) {
    alert(error.response?.data?.message || explainError(error) || 'Không thể gửi giải trình.');
  } finally {
    disputeSubmitting.value = false;
  }
};

const resolveDisputeItem = async (item: any, decision: 'ALLOW' | 'DENY') => {
  const notePrompt = decision === 'ALLOW'
    ? `Xác nhận CHO PHÉP khách "${item.claimant_name}" vào cổng thủ công? (Ghi chú nếu có):`
    : `Xác nhận TỪ CHỐI giải trình của "${item.claimant_name}"? (Lý do từ chối):`;
  const defaultNote = decision === 'ALLOW'
    ? 'Đã đối chiếu giấy tờ tùy thân hợp lệ, cho phép vào cổng'
    : 'Thông tin không khớp với hồ sơ đăng ký gốc';
  const note = prompt(notePrompt, defaultNote);
  if (note === null) return;
  try {
    await api.put(`/disputes/${item.id}/resolve`, {
      decision,
      decision_note: note,
    });
    await loadDisputes();
  } catch (error: any) {
    alert(error.response?.data?.message || explainError(error) || 'Không thể xử lý tranh chấp.');
  }
};

const addTeamMember = async () => {
  saving.value = true;
  errorMessage.value = '';
  try {
    await api.post('/tenants/portal/team', memberForm.value);
    memberForm.value = { name: '', email: '', phone: '', password: '' };
    staffSearchTerm.value = '';
    staffSearchResults.value = [];
    showMemberModal.value = false;
    await loadTeam();
  } catch (error: any) {
    errorMessage.value = explainError(error);
  } finally {
    saving.value = false;
  }
};

const assignMember = async () => {
  if (!selectedEvent.value || !assignment.value.staff_id) return;
  saving.value = true;
  errorMessage.value = '';
  try {
    await api.put(
      `/tenants/portal/events/${selectedEvent.value.id}/team/${assignment.value.staff_id}`,
      {
        staff_id: Number(assignment.value.staff_id),
        role: assignment.value.role,
        max_invites: Number(assignment.value.max_invites),
        is_enabled: true
      }
    );
    showAssignmentModal.value = false;
    assignment.value = { staff_id: '', role: 'INVITER', max_invites: 50 };
    await loadEventDetails(selectedEvent.value);
  } catch (error: any) {
    errorMessage.value = explainError(error);
  } finally {
    saving.value = false;
  }
};

const removeMember = async (member: any) => {
  if (!selectedEvent.value || !window.confirm(`Gỡ ${member.name} khỏi sự kiện này?`)) return;
  try {
    await api.delete(`/tenants/portal/events/${selectedEvent.value.id}/team/${member.id}`);
    await loadEventDetails(selectedEvent.value);
  } catch (error: any) {
    errorMessage.value = explainError(error);
  }
};

const roleLabel = (item: any) => {
  if (item.can_invite && item.can_approve && item.can_scan && item.can_view_report)
    return 'Quản lý sự kiện';
  if (item.can_invite) return 'Mời khách';
  if (item.can_approve) return 'Duyệt khách';
  if (item.can_scan) return 'Quét QR';
  if (item.can_view_report) return 'Xem báo cáo';
  return 'Chưa phân quyền';
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value)
  );

const approveTenantAttendee = async (registrationId: number) => {
  try {
    await api.put(`/registrations/${registrationId}/approve`);
    if (selectedEvent.value) await loadEventDetails(selectedEvent.value);
  } catch (error: any) {
    errorMessage.value = explainError(error);
  }
};

const rejectTenantAttendee = async (attendee: any) => {
  const reason = window.prompt(`Nhập lý do từ chối đăng ký của "${attendee.full_name}":`, 'Không đáp ứng điều kiện tham gia');
  if (reason === null) return;
  try {
    await api.put(`/registrations/${attendee.registration_id}/reject`, { reason });
    if (selectedEvent.value) await loadEventDetails(selectedEvent.value);
  } catch (error: any) {
    errorMessage.value = explainError(error);
  }
};

const exportAttendees = () => {
  const headers = ['Họ tên', 'Email', 'Điện thoại', 'Trạng thái', 'Mã vé', 'Check-in'];
  const rows = filteredAttendees.value.map((item) => [
    item.full_name,
    item.email,
    item.phone,
    item.registration_status,
    item.ticket_code || '',
    item.ticket_status === 'USED' ? 'Đã check-in' : ''
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${selectedEvent.value?.name || 'khach-moi'}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
};

onMounted(async () => {
  // If user is already logged in as TENANT_ADMIN or staff, load immediately
  if (user.value && (user.value.type === 'TENANT_ADMIN' || user.value.type === 'STAFF')) {
    if (user.value?.type === 'STAFF') {
      await loadStaffPortal();
    } else {
      await loadPortal();
    }
  } else {
    // Nếu chưa đăng nhập hoặc không phải ban tổ chức -> chuyển về trang khách
    router.replace('/khach');
  }
});

onBeforeUnmount(stopScanner);
</script>

<template>
  <div v-if="!token || (user?.type !== 'TENANT_ADMIN' && user?.type !== 'STAFF')" class="min-h-[100dvh] flex items-center justify-center bg-slate-50">
    <div class="flex flex-col items-center gap-3 text-slate-500">
      <Loader2 class="h-8 w-8 animate-spin text-primary-600" />
      <span class="text-sm font-semibold">Đang chuyển về trang của khách...</span>
    </div>
  </div>

  <div v-else-if="user?.type === 'STAFF'" class="min-h-screen bg-slate-50 text-slate-800 font-sans pb-24 md:pb-16">
    <!-- Topbar -->
    <header class="sticky top-0 z-40 bg-white border-b border-slate-200 px-3 sm:px-8 h-16 flex items-center justify-between gap-2 shadow-xs">
      <div class="flex items-center gap-2 shrink-0">
        <a class="brand-lockup flex items-center gap-1.5" href="#">
          <img src="/logo-transparent.png" alt="EventGo.vn" class="h-8 w-auto object-contain" />
        </a>
        <div class="hidden sm:block h-6 w-px bg-slate-200 mx-1"></div>
        <div class="hidden sm:flex flex-col">
          <span class="text-[10px] font-bold uppercase tracking-wider text-primary-700">Không gian Nhân sự Sự kiện</span>
          <b class="text-xs text-slate-800 truncate max-w-[220px]">{{ staffSelectedEvent?.name || user?.tenant_name || 'Đội ngũ sự kiện' }}</b>
        </div>
        <span class="sm:hidden text-xs font-bold text-slate-800 truncate max-w-[150px]">
          {{ staffSelectedEvent?.name || 'Sự kiện' }}
        </span>
      </div>

      <!-- Tab Switcher on Desktop (Mời khách / Duyệt khách / Quét QR / Báo cáo / Tranh chấp) -->
      <div class="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
        <button
          v-if="staffCanInvite"
          type="button"
          @click="staffTab = 'invite'"
          class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition select-none cursor-pointer"
          :class="staffTab === 'invite' ? 'bg-white text-primary-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'"
        >
          <Users :size="13" />
          <span>Mời khách</span>
        </button>
        <button
          v-if="staffCanApprove"
          type="button"
          @click="staffTab = 'approve'"
          class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition select-none cursor-pointer"
          :class="staffTab === 'approve' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'"
        >
          <UserCheck :size="13" />
          <span>Duyệt khách</span>
          <span v-if="staffRegistrations.filter(r => r.status === 'PENDING').length" class="ml-0.5 px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px]">
            {{ staffRegistrations.filter(r => r.status === 'PENDING').length }}
          </span>
        </button>
        <button
          v-if="staffCanScan"
          type="button"
          @click="staffTab = 'scan'"
          class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition select-none cursor-pointer"
          :class="staffTab === 'scan' ? 'bg-white text-primary-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'"
        >
          <Camera :size="13" />
          <span>Quét vé QR</span>
        </button>
        <button
          v-if="staffCanReport"
          type="button"
          @click="staffTab = 'report'"
          class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition select-none cursor-pointer"
          :class="staffTab === 'report' ? 'bg-white text-primary-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'"
        >
          <BarChart3 :size="13" />
          <span>Báo cáo</span>
        </button>
        <button
          v-if="staffCanApprove || disputesList.length > 0"
          type="button"
          @click="loadDisputes(); staffTab = 'disputes'"
          class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition select-none cursor-pointer"
          :class="staffTab === 'disputes' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'"
        >
          <Scale :size="13" />
          <span>Tranh chấp</span>
          <span v-if="disputesList.filter(d => d.decision === 'PENDING').length" class="ml-0.5 px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px]">
            {{ disputesList.filter(d => d.decision === 'PENDING').length }}
          </span>
        </button>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <div class="hidden md:flex flex-col text-right">
          <span class="text-xs font-bold text-slate-800">{{ user?.name }}</span>
          <span class="text-[10px] text-slate-500 font-medium">{{ staffRoleTitle }}</span>
        </div>
        <button class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-rose-600 transition cursor-pointer" @click="logout">
          <LogOut :size="15" />
          <span class="hidden sm:inline">Đăng xuất</span>
        </button>
      </div>
    </header>

    <main class="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
      <!-- Empty State when staff is not assigned to any events yet -->
      <section v-if="!staffEvents.length" class="card p-8 bg-white rounded-2xl border border-slate-200 text-center max-w-lg mx-auto mt-12 shadow-xs">
        <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
          <Clock3 :size="32" />
        </div>
        <h2 class="text-xl font-bold text-slate-900">Tài khoản chưa được gán vào sự kiện</h2>
        <p class="text-sm text-slate-500 mt-2 leading-relaxed">
          Xin chào <b>{{ user?.name }}</b>! Email <b>{{ user?.email }}</b> của bạn đã được đăng ký thành công trên hệ thống.
        </p>
        <div class="my-4 p-3 bg-slate-50 rounded-xl text-xs text-slate-600 border border-slate-200/60 leading-relaxed">
          Hãy thông báo email <code class="font-bold text-primary-700 bg-white px-2 py-0.5 rounded border border-slate-200">{{ user?.email }}</code> cho Ban tổ chức (Khách thuê) để họ tìm và thêm bạn vào đội ngũ sự kiện.
        </div>
        <button type="button" class="primary-button" style="margin: 0 auto; display: inline-flex; align-items: center; gap: 6px;" :disabled="loadingStaffData" @click="loadStaffPortal">
          <Activity :size="16" /> {{ loadingStaffData ? 'Đang kiểm tra...' : 'Kiểm tra lại / Làm mới' }}
        </button>
      </section>

      <!-- TAB 1: MỜI KHÁCH & QUẢN LÝ VÉ MỜI -->
      <section v-else-if="staffTab === 'invite'" class="space-y-6">
        <!-- Event Selector & Hub Header -->
        <div class="card p-5 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center rounded-full bg-primary-50 px-2.5 py-0.5 text-[11px] font-bold text-primary-700 border border-primary-200">
                💌 Kênh Người Mời Khách
              </span>
              <span v-if="staffSelectedEvent" class="text-xs text-slate-500">
                · {{ staffSelectedEvent.location || 'Địa điểm sự kiện' }}
              </span>
            </div>
            <h1 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
              Phát hành vé & Mời khách
            </h1>
            <p class="text-xs text-slate-500 mt-0.5">
              Gửi link đăng ký hoặc mã QR cho khách của bạn. Theo dõi hạn mức và lượt check-in thực tế.
            </p>
          </div>

          <!-- Switch event if staff has multiple events -->
          <div v-if="staffEvents.length > 1" class="w-full sm:w-auto shrink-0">
            <label class="text-[11px] font-bold text-slate-500 block mb-1">Chọn sự kiện:</label>
            <div class="relative">
              <select
                v-model.number="selectedStaffEventId"
                @change="onStaffEventChange"
                class="w-full sm:w-60 pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option v-for="ev in staffEvents" :key="ev.id" :value="ev.id">
                  {{ ev.name }}
                </option>
              </select>
              <ChevronDown :size="14" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <!-- Quota & Stats Cards -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          <div class="card p-3 sm:p-4 bg-white rounded-2xl border border-slate-200 text-center shadow-2xs">
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Hạn mức mời</span>
            <p class="text-xl sm:text-2xl font-black text-slate-900 mt-0.5 sm:mt-1">{{ staffQuota?.max_invites ?? staffSelectedEvent?.my_max_invites ?? 50 }}</p>
            <span class="text-[10px] text-slate-400">suất tối đa</span>
          </div>
          <div class="card p-3 sm:p-4 bg-white rounded-2xl border border-slate-200 text-center shadow-2xs">
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Đã đăng ký</span>
            <p class="text-xl sm:text-2xl font-black text-primary-700 mt-0.5 sm:mt-1">{{ staffRegistrations.length }}</p>
            <span class="text-[10px] text-primary-600">khách nhận link</span>
          </div>
          <div class="card p-3 sm:p-4 bg-white rounded-2xl border border-slate-200 text-center shadow-2xs">
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Đã duyệt vé</span>
            <p class="text-xl sm:text-2xl font-black text-emerald-600 mt-0.5 sm:mt-1">{{ staffRegistrations.filter(r => r.status === 'APPROVED').length }}</p>
            <span class="text-[10px] text-emerald-600">sẵn sàng tham gia</span>
          </div>
          <div class="card p-3 sm:p-4 bg-white rounded-2xl border border-slate-200 text-center shadow-2xs">
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Đã Check-in</span>
            <p class="text-xl sm:text-2xl font-black text-indigo-600 mt-0.5 sm:mt-1">{{ staffRegistrations.filter(r => r.ticket_status === 'USED').length }}</p>
            <span class="text-[10px] text-indigo-500">đã vào cổng</span>
          </div>
        </div>

        <!-- Link mời cá nhân & Mã QR chia sẻ (Tối ưu giao diện Mobile & Máy tính) -->
        <div class="grid gap-4 sm:gap-6 md:grid-cols-2">
          <!-- Hộp Link Mời -->
          <div class="card p-4 sm:p-5 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
            <div>
              <div class="flex items-center gap-2.5">
                <div class="grid h-8 w-8 place-items-center rounded-lg bg-primary-100 text-primary-700 shrink-0">
                  <Link2 :size="16" />
                </div>
                <div>
                  <h3 class="font-bold text-slate-900 text-sm">Link mời tham dự cá nhân</h3>
                  <p class="text-[11px] sm:text-xs text-slate-500">Gửi link này cho khách qua Zalo, Messenger, SMS</p>
                </div>
              </div>

              <div class="mt-3.5 p-2.5 sm:p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <p class="text-xs font-mono text-slate-700 break-all select-all font-semibold flex-1">
                  {{ staffInviteLink?.invite_url || 'Đang tạo link mời cá nhân...' }}
                </p>
                <button
                  type="button"
                  @click="copyStaffInviteLink"
                  title="Sao chép link"
                  class="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-primary-700 hover:border-primary-300 transition shrink-0 cursor-pointer shadow-2xs"
                >
                  <Check v-if="copiedInviteLink" :size="15" class="text-emerald-600" />
                  <Copy v-else :size="15" />
                </button>
              </div>
            </div>

            <!-- Các nút thao tác trên Mobile & Desktop -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                @click="copyStaffInviteLink"
                :disabled="!staffInviteLink?.invite_url"
                class="btn btn-primary justify-center py-2.5 text-xs font-bold gap-1.5 cursor-pointer shadow-xs active:scale-98 transition"
              >
                <Check v-if="copiedInviteLink" :size="15" />
                <Copy v-else :size="15" />
                <span>{{ copiedInviteLink ? 'Đã sao chép link!' : 'Sao chép link' }}</span>
              </button>

              <button
                type="button"
                @click="shareStaffInviteLink"
                :disabled="!staffInviteLink?.invite_url"
                class="btn btn-secondary justify-center py-2.5 text-xs font-bold gap-1.5 cursor-pointer text-primary-700 border-primary-200 hover:bg-primary-50 active:scale-98 transition"
              >
                <Share2 :size="15" />
                <span>Chia sẻ Zalo/SMS</span>
              </button>

              <router-link
                to="/staff/referral"
                class="btn btn-secondary justify-center py-2.5 text-xs font-bold gap-1.5 whitespace-nowrap text-slate-700 hover:text-slate-900 border-slate-200"
              >
                <Sparkles :size="15" class="text-amber-500" />
                <span>Thiệp VIP & Thêm</span>
              </router-link>
            </div>
          </div>

          <!-- Hộp Mã QR Quét Đăng Ký -->
          <div class="card p-4 sm:p-5 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center justify-center text-center space-y-3">
            <div>
              <h3 class="font-bold text-slate-900 text-sm">Mã QR Mời Đăng Ký Trực Tiếp</h3>
              <p class="text-[11px] sm:text-xs text-slate-500 max-w-xs mt-0.5">Đưa khách quét mã bằng Camera điện thoại hoặc Zalo để vào trang đăng ký</p>
            </div>
            
            <div 
              @click="showZoomQrModal = true"
              class="p-3 bg-white rounded-xl border-2 border-dashed border-slate-200 shadow-inner cursor-pointer hover:border-primary-400 transition group relative"
              title="Chạm để phóng to mã QR cho khách quét"
            >
              <img v-if="staffInviteQrUrl" :src="staffInviteQrUrl" alt="Mã QR mời khách" class="w-36 h-36 sm:w-40 sm:h-40 object-contain rounded-lg" />
              <div v-else class="w-36 h-36 sm:w-40 sm:h-40 grid place-items-center text-xs text-slate-400">
                Đang tạo mã QR...
              </div>
              <span class="absolute bottom-1.5 right-1.5 bg-slate-900/80 text-white rounded px-1.5 py-0.5 text-[10px] opacity-80 group-hover:opacity-100 flex items-center gap-1 shadow-xs pointer-events-none">
                <Maximize2 :size="11" /> Phóng to
              </span>
            </div>

            <div class="flex items-center gap-3 pt-0.5">
              <button
                type="button"
                @click="showZoomQrModal = true"
                class="text-xs font-bold text-slate-700 hover:text-primary-700 inline-flex items-center gap-1 cursor-pointer"
              >
                <Maximize2 :size="13" /> Phóng to cho khách quét
              </button>
              <span class="text-slate-300">|</span>
              <a
                v-if="staffInviteQrUrl"
                :href="staffInviteQrUrl"
                :download="`qr-moi-khach-${staffSelectedEvent?.id || 'event'}.png`"
                class="text-xs font-bold text-primary-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <ArrowDownToLine :size="13" /> Tải ảnh QR
              </a>
            </div>
          </div>
        </div>

        <!-- Danh sách khách mời đã đăng ký (Hỗ trợ hiển thị dạng thẻ đẹp trên Mobile) -->
        <div class="card overflow-hidden bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div class="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Users :size="17" class="text-primary-700" />
              <h3 class="font-bold text-slate-900 text-sm sm:text-base">Danh sách khách bạn đã mời ({{ staffRegistrations.length }})</h3>
            </div>
            <button
              v-if="selectedStaffEventId"
              type="button"
              @click="loadStaffInviteDetails(selectedStaffEventId)"
              class="text-xs text-primary-700 hover:underline font-semibold cursor-pointer"
            >
              Làm mới
            </button>
          </div>

          <div v-if="!staffRegistrations.length" class="p-8 text-center text-slate-400 text-xs">
            Chưa có khách nào đăng ký qua link mời của bạn. Hãy sao chép link ở trên và gửi cho khách mời!
          </div>

          <div v-else>
            <!-- Giao diện Mobile: Hiển thị dạng Thẻ (Cards) -->
            <div class="sm:hidden divide-y divide-slate-100">
              <div v-for="reg in staffRegistrations" :key="reg.id" class="p-3.5 space-y-2">
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <h4 class="font-bold text-slate-900 text-sm">{{ reg.full_name }}</h4>
                    <span class="text-[11px] font-mono font-bold text-primary-700" v-if="reg.ticket_code">
                      Vé: {{ reg.ticket_code }}
                    </span>
                  </div>
                  <span
                    v-if="reg.ticket_status === 'USED'"
                    class="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200 shrink-0"
                  >
                    ✓ Đã Check-in
                  </span>
                  <span
                    v-else-if="reg.status === 'APPROVED'"
                    class="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 shrink-0"
                  >
                    ✓ Đã duyệt
                  </span>
                  <span
                    v-else-if="reg.status === 'REJECTED'"
                    class="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200 shrink-0"
                  >
                    ✕ Từ chối
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200 shrink-0"
                  >
                    ⏳ Chờ duyệt
                  </span>
                </div>

                <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                  <a v-if="reg.phone" :href="`tel:${reg.phone}`" class="text-primary-700 font-semibold hover:underline">
                    📞 {{ reg.phone }}
                  </a>
                  <span v-if="reg.email" class="text-slate-400 truncate max-w-[200px]">
                    ✉️ {{ reg.email }}
                  </span>
                </div>

                <div
                  v-if="reg.status === 'PENDING' && (staffSelectedEvent?.my_can_approve || staffSelectedEvent?.my_can_invite || user?.permissions?.includes('registrations:approve'))"
                  class="pt-1 flex justify-end"
                >
                  <button
                    type="button"
                    @click="approveStaffGuest(reg.id)"
                    class="btn btn-primary py-1 px-3 text-xs font-bold"
                  >
                    Duyệt vé ngay
                  </button>
                </div>
              </div>
            </div>

            <!-- Giao diện Desktop: Bảng Table đầy đủ -->
            <div class="hidden sm:block divide-y divide-slate-100 overflow-x-auto">
              <table class="w-full text-left text-xs">
                <thead class="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                  <tr>
                    <th class="py-2.5 px-4">Họ và tên</th>
                    <th class="py-2.5 px-4">Số điện thoại</th>
                    <th class="py-2.5 px-4">Email</th>
                    <th class="py-2.5 px-4">Mã vé</th>
                    <th class="py-2.5 px-4 text-center">Trạng thái</th>
                    <th class="py-2.5 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr v-for="reg in staffRegistrations" :key="reg.id" class="hover:bg-slate-50/70 transition">
                    <td class="py-3 px-4 font-bold text-slate-800">{{ reg.full_name }}</td>
                    <td class="py-3 px-4 text-slate-600">{{ reg.phone || '—' }}</td>
                    <td class="py-3 px-4 text-slate-500">{{ reg.email || '—' }}</td>
                    <td class="py-3 px-4 font-mono font-bold text-primary-700">{{ reg.ticket_code || 'Chưa cấp' }}</td>
                    <td class="py-3 px-4 text-center">
                      <span
                        v-if="reg.ticket_status === 'USED'"
                        class="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200"
                      >
                        ✓ Đã Check-in
                      </span>
                      <span
                        v-else-if="reg.status === 'APPROVED'"
                        class="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200"
                      >
                        ✓ Đã duyệt
                      </span>
                      <span
                        v-else-if="reg.status === 'REJECTED'"
                        class="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200"
                      >
                        ✕ Từ chối
                      </span>
                      <span
                        v-else
                        class="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200"
                      >
                        ⏳ Chờ duyệt
                      </span>
                    </td>
                    <td class="py-3 px-4 text-right">
                      <button
                        v-if="reg.status === 'PENDING' && (staffSelectedEvent?.my_can_approve || staffSelectedEvent?.my_can_invite || user?.permissions?.includes('registrations:approve'))"
                        type="button"
                        @click="approveStaffGuest(reg.id)"
                        class="px-2.5 py-1 rounded-md bg-primary-50 text-primary-700 hover:bg-primary-100 font-bold text-[11px] border border-primary-200 cursor-pointer"
                      >
                        Duyệt vé
                      </button>
                      <span v-else class="text-slate-400 text-[11px]">—</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <!-- TAB 2: DUYỆT KHÁCH (KÊNH PHÊ DUYỆT VÉ) -->
      <section v-else-if="staffTab === 'approve'" class="space-y-6">
        <!-- Hub Header -->
        <div class="card p-5 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                ✅ Kênh Phê Duyệt Vé
              </span>
              <span v-if="staffSelectedEvent" class="text-xs text-slate-500">
                · {{ staffSelectedEvent.name }} ({{ staffSelectedEvent.location || 'Địa điểm' }})
              </span>
            </div>
            <h1 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
              Phê duyệt khách & Cấp vé QR
            </h1>
            <p class="text-xs text-slate-500 mt-0.5">
              Xem xét hồ sơ khách đăng ký tham dự. Bấm "Duyệt vé" để kích hoạt và gửi mã vé QR chính thức tới khách.
            </p>
          </div>

          <!-- Switch event if multiple -->
          <div v-if="staffEvents.length > 1" class="w-full sm:w-auto shrink-0">
            <label class="text-[11px] font-bold text-slate-500 block mb-1">Chọn sự kiện:</label>
            <div class="relative">
              <select
                v-model.number="selectedStaffEventId"
                @change="onStaffEventChange"
                class="w-full sm:w-60 pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option v-for="ev in staffEvents" :key="ev.id" :value="ev.id">
                  {{ ev.name }}
                </option>
              </select>
              <ChevronDown :size="14" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <!-- Thẻ thống kê duyệt -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="card p-4 bg-white rounded-2xl border border-slate-200 text-center">
            <span class="text-[10px] font-bold uppercase tracking-wider text-amber-600">⏳ Chờ duyệt</span>
            <p class="text-2xl font-black text-amber-600 mt-1">{{ staffRegistrations.filter(r => r.status === 'PENDING').length }}</p>
            <span class="text-[10px] text-slate-400">cần xử lý ngay</span>
          </div>
          <div class="card p-4 bg-white rounded-2xl border border-slate-200 text-center">
            <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-600">✅ Đã cấp vé</span>
            <p class="text-2xl font-black text-emerald-600 mt-1">{{ staffRegistrations.filter(r => r.status === 'APPROVED').length }}</p>
            <span class="text-[10px] text-slate-400">vé QR hoạt động</span>
          </div>
          <div class="card p-4 bg-white rounded-2xl border border-slate-200 text-center">
            <span class="text-[10px] font-bold uppercase tracking-wider text-indigo-600">🚪 Đã check-in</span>
            <p class="text-2xl font-black text-indigo-600 mt-1">{{ staffRegistrations.filter(r => r.ticket_status === 'USED').length }}</p>
            <span class="text-[10px] text-slate-400">đã vào cổng</span>
          </div>
          <div class="card p-4 bg-white rounded-2xl border border-slate-200 text-center">
            <span class="text-[10px] font-bold uppercase tracking-wider text-rose-500">✕ Từ chối</span>
            <p class="text-2xl font-black text-rose-600 mt-1">{{ staffRegistrations.filter(r => r.status === 'REJECTED').length }}</p>
            <span class="text-[10px] text-slate-400">không đủ điều kiện</span>
          </div>
        </div>

        <!-- Bộ lọc & Danh sách khách cần duyệt -->
        <div class="card overflow-hidden bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4 p-4 sm:p-5">
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <!-- Filter Pills -->
            <div class="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                @click="approvalFilterStatus = 'ALL'"
                class="px-3 py-1.5 rounded-lg text-xs font-bold transition select-none cursor-pointer"
                :class="approvalFilterStatus === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
              >
                Tất cả ({{ staffRegistrations.length }})
              </button>
              <button
                type="button"
                @click="approvalFilterStatus = 'PENDING'"
                class="px-3 py-1.5 rounded-lg text-xs font-bold transition select-none cursor-pointer flex items-center gap-1"
                :class="approvalFilterStatus === 'PENDING' ? 'bg-amber-500 text-white shadow-xs' : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'"
              >
                <span>⏳ Chờ duyệt</span>
                <span class="px-1.5 py-0.2 bg-white/30 rounded-full text-[10px]">
                  {{ staffRegistrations.filter(r => r.status === 'PENDING').length }}
                </span>
              </button>
              <button
                type="button"
                @click="approvalFilterStatus = 'APPROVED'"
                class="px-3 py-1.5 rounded-lg text-xs font-bold transition select-none cursor-pointer"
                :class="approvalFilterStatus === 'APPROVED' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'"
              >
                ✅ Đã duyệt ({{ staffRegistrations.filter(r => r.status === 'APPROVED').length }})
              </button>
              <button
                type="button"
                @click="approvalFilterStatus = 'REJECTED'"
                class="px-3 py-1.5 rounded-lg text-xs font-bold transition select-none cursor-pointer"
                :class="approvalFilterStatus === 'REJECTED' ? 'bg-rose-600 text-white shadow-xs' : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'"
              >
                ✕ Từ chối ({{ staffRegistrations.filter(r => r.status === 'REJECTED').length }})
              </button>
            </div>

            <!-- Quick Action: Duyệt tất cả -->
            <div class="flex items-center gap-2">
              <button
                v-if="staffRegistrations.some(r => r.status === 'PENDING')"
                type="button"
                @click="approveAllPending"
                class="btn btn-primary text-xs py-2 px-3 font-bold gap-1 cursor-pointer"
              >
                <Check :size="14" />
                <span>Duyệt tất cả chờ ({{ staffRegistrations.filter(r => r.status === 'PENDING').length }})</span>
              </button>
              <button
                v-if="selectedStaffEventId"
                type="button"
                @click="loadStaffInviteDetails(selectedStaffEventId)"
                class="text-xs text-slate-500 hover:text-slate-800 font-semibold px-2 py-1.5 border border-slate-200 rounded-lg cursor-pointer"
              >
                Làm mới
              </button>
            </div>
          </div>

          <!-- Search box -->
          <div class="relative">
            <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              v-model="approvalSearch"
              type="text"
              placeholder="Tìm theo tên khách, số điện thoại, email hoặc người giới thiệu..."
              class="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <!-- Table -->
          <div v-if="!filteredApprovalRegistrations.length" class="p-8 text-center text-slate-400 text-xs">
            Không tìm thấy đăng ký nào phù hợp với bộ lọc hiện tại.
          </div>

          <div v-else>
            <!-- Giao diện Mobile: Hiển thị Thẻ Khách Duyệt (Cards) -->
            <div class="sm:hidden divide-y divide-slate-100">
              <div v-for="reg in filteredApprovalRegistrations" :key="reg.id" class="p-3.5 space-y-2.5">
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <h4 class="font-bold text-slate-900 text-sm">{{ reg.full_name }}</h4>
                    <div class="flex items-center gap-2 mt-0.5">
                      <span class="text-[11px] font-mono font-bold text-primary-700" v-if="reg.ticket_code">
                        Vé: {{ reg.ticket_code }}
                      </span>
                      <span class="text-[11px] text-slate-500">
                        {{ reg.referrer_name ? `qua: ${reg.referrer_name}` : 'Khách vãng lai' }}
                      </span>
                    </div>
                  </div>
                  <span
                    v-if="reg.ticket_status === 'USED'"
                    class="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200 shrink-0"
                  >
                    ✓ Đã Check-in
                  </span>
                  <span
                    v-else-if="reg.status === 'APPROVED'"
                    class="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 shrink-0"
                  >
                    ✓ Đã duyệt
                  </span>
                  <span
                    v-else-if="reg.status === 'REJECTED'"
                    class="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200 shrink-0"
                  >
                    ✕ Từ chối
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200 shrink-0 animate-pulse"
                  >
                    ⏳ Chờ duyệt
                  </span>
                </div>

                <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                  <a v-if="reg.phone" :href="`tel:${reg.phone}`" class="text-primary-700 font-semibold hover:underline">
                    📞 {{ reg.phone }}
                  </a>
                  <span v-if="reg.email" class="text-slate-400 truncate max-w-[200px]">
                    ✉️ {{ reg.email }}
                  </span>
                </div>

                <div v-if="reg.status === 'PENDING'" class="pt-1 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    @click="rejectStaffGuest(reg)"
                    class="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-rose-600 border border-slate-200 font-bold text-xs"
                  >
                    Từ chối
                  </button>
                  <button
                    type="button"
                    @click="approveStaffGuest(reg.id)"
                    class="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
                  >
                    Duyệt vé ngay
                  </button>
                </div>
                <div v-else-if="reg.status === 'APPROVED' && reg.ticket_status !== 'USED'" class="pt-1 flex justify-end">
                  <button
                    type="button"
                    @click="rejectStaffGuest(reg)"
                    class="text-[11px] text-slate-400 hover:text-rose-600 underline"
                  >
                    Thu hồi vé
                  </button>
                </div>
              </div>
            </div>

            <!-- Giao diện Desktop: Bảng Table đầy đủ -->
            <div class="hidden sm:block overflow-x-auto rounded-xl border border-slate-100">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                <tr>
                  <th class="py-2.5 px-4">Khách đăng ký</th>
                  <th class="py-2.5 px-4">Số điện thoại</th>
                  <th class="py-2.5 px-4">Người giới thiệu</th>
                  <th class="py-2.5 px-4">Mã vé QR</th>
                  <th class="py-2.5 px-4 text-center">Trạng thái</th>
                  <th class="py-2.5 px-4 text-right">Hành động duyệt</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="reg in filteredApprovalRegistrations" :key="reg.id" class="hover:bg-slate-50/70 transition">
                  <td class="py-3 px-4">
                    <p class="font-bold text-slate-900">{{ reg.full_name }}</p>
                    <p class="text-[11px] text-slate-500">{{ reg.email || 'Không có email' }}</p>
                  </td>
                  <td class="py-3 px-4 text-slate-700 font-mono">{{ reg.phone || '—' }}</td>
                  <td class="py-3 px-4 text-slate-600">
                    <span class="inline-flex items-center gap-1 font-semibold text-slate-800">
                      {{ reg.referrer_name || 'Khách vãng lai' }}
                    </span>
                  </td>
                  <td class="py-3 px-4 font-mono font-bold text-primary-700">
                    {{ reg.ticket_code || 'Chưa cấp' }}
                  </td>
                  <td class="py-3 px-4 text-center">
                    <span
                      v-if="reg.ticket_status === 'USED'"
                      class="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200"
                    >
                      ✓ Đã Check-in
                    </span>
                    <span
                      v-else-if="reg.status === 'APPROVED'"
                      class="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200"
                    >
                      ✓ Đã duyệt
                    </span>
                    <span
                      v-else-if="reg.status === 'REJECTED'"
                      class="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200"
                    >
                      ✕ Từ chối
                    </span>
                    <span
                      v-else
                      class="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200 animate-pulse"
                    >
                      ⏳ Chờ duyệt
                    </span>
                  </td>
                  <td class="py-3 px-4 text-right">
                    <div v-if="reg.status === 'PENDING'" class="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        @click="approveStaffGuest(reg.id)"
                        class="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-xs transition flex items-center gap-1 cursor-pointer"
                        title="Duyệt và cấp vé QR ngay"
                      >
                        <Check :size="13" />
                        <span>Duyệt vé</span>
                      </button>
                      <button
                        type="button"
                        @click="rejectStaffGuest(reg)"
                        class="px-2 py-1.5 rounded-lg bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 font-semibold text-[11px] transition cursor-pointer"
                        title="Từ chối yêu cầu này"
                      >
                        <X :size="13" />
                        <span>Từ chối</span>
                      </button>
                    </div>
                    <div v-else-if="reg.status === 'APPROVED' && reg.ticket_status !== 'USED'" class="flex items-center justify-end">
                      <button
                        type="button"
                        @click="rejectStaffGuest(reg)"
                        class="text-[11px] text-slate-400 hover:text-rose-600 transition cursor-pointer underline"
                      >
                        Thu hồi vé
                      </button>
                    </div>
                    <span v-else class="text-slate-400 text-[11px]">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
            </div>
          </div>
        </div>
      </section>

      <!-- TAB 3: QUÉT VÉ QR VÀO CỔNG -->
      <section v-else-if="staffTab === 'scan'" class="space-y-6">
        <div class="card p-5 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span class="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
              📷 Cổng Soát Vé Check-in
            </span>
            <h1 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
              Quét vé vào cổng
            </h1>
            <p class="text-xs text-slate-500 mt-0.5">
              Đưa mã QR trên vé của khách vào khung hình camera để xác thực và check-in.
            </p>
          </div>

          <div v-if="scannerEvents.length" class="w-full sm:w-auto shrink-0">
            <label class="text-[11px] font-bold text-slate-500 block mb-1">Sự kiện soát vé:</label>
            <div class="relative">
              <select
                v-model.number="selectedScannerEventId"
                @change="scannerResult = null"
                class="w-full sm:w-60 pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option v-for="event in scannerEvents" :key="event.id" :value="event.id">{{ event.name }}</option>
              </select>
              <ChevronDown :size="14" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <section class="scanner-card">
          <div class="scanner-camera">
            <div id="tenant-qr-reader"></div>

            <!-- Placeholder khi chưa bật camera -->
            <div v-if="!scannerRunning" class="camera-placeholder">
              <QrCode :size="37" />
              <b>Camera sẵn sàng</b>
              <span>Cho phép truy cập camera để bắt đầu quét vé.</span>
              <button class="primary-button" :disabled="!selectedScannerEventId" @click="startScanner">
                Bật camera
              </button>
            </div>

            <!-- Ô VUÔNG KHUNG NGẮM CĂN MÃ QR KHI BẬT CAMERA -->
            <div v-if="scannerRunning" class="scanner-reticle-overlay">
              <div class="scanner-reticle-box">
                <span class="corner top-left"></span>
                <span class="corner top-right"></span>
                <span class="corner bottom-left"></span>
                <span class="corner bottom-right"></span>
              </div>
            </div>
          </div>

          <div
            class="scanner-feedback"
            :class="scannerResult?.result === 'SUCCESS' ? 'feedback-success' : scannerResult?.result === 'ALREADY_USED' ? 'feedback-warning' : scannerResult ? 'feedback-error' : ''"
          >
            <div class="feedback-mark">
              <Check v-if="scannerResult?.result === 'SUCCESS'" :size="22" />
              <AlertTriangle v-else-if="scannerResult?.result === 'ALREADY_USED'" :size="22" />
              <X v-else-if="scannerResult" :size="22" />
              <QrCode v-else :size="22" />
            </div>
            <div class="feedback-text">
              <b>{{
                scannerResult?.result === 'SUCCESS'
                  ? 'Vé hợp lệ · Đã check-in thành công'
                  : scannerResult?.result === 'ALREADY_USED'
                    ? 'MÃ QR ĐÃ ĐƯỢC CHECK-IN TRƯỚC ĐÓ!'
                    : scannerResult
                      ? 'Không xác nhận được vé'
                      : 'Sẵn sàng quét'
              }}</b>
              <span v-if="!scannerResult">Phản hồi check-in sẽ hiển thị tại đây.</span>
              <span v-else-if="scannerResult.result === 'SUCCESS'">
                Khách: <strong>{{ scannerResult.attendee?.full_name || 'Khách mời' }}</strong>
                <template v-if="scannerResult.attendee?.phone"> ({{ scannerResult.attendee.phone }})</template>
                <template v-if="scannerResult.referrer?.name"> • Người mời: <strong>{{ scannerResult.referrer.name }}</strong></template>
              </span>
              <span v-else-if="scannerResult.result === 'ALREADY_USED'">
                Khách: <strong>{{ scannerResult.attendee?.full_name || 'Khách mời' }}</strong>
                <template v-if="scannerResult.attendee?.phone"> ({{ scannerResult.attendee.phone }})</template>
                <template v-if="scannerResult.ticket?.used_at">
                  • Quét lần 1 lúc {{ new Date(scannerResult.ticket.used_at).toLocaleTimeString('vi-VN') }} ngày {{ new Date(scannerResult.ticket.used_at).toLocaleDateString('vi-VN') }}
                </template>
                <template v-if="scannerResult.ticket?.first_scanner">
                  bởi <strong>{{ scannerResult.ticket.first_scanner }}</strong>
                </template>
                <div class="mt-2">
                  <button
                    v-if="!disputeSent && scannerResult.scan_log_id && scannerResult.ticket?.id"
                    type="button"
                    @click="openDisputeModal"
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] shadow-xs transition cursor-pointer"
                  >
                    <Scale :size="13" />
                    <span>Gửi giải trình tranh chấp</span>
                  </button>
                  <span
                    v-else-if="disputeSent"
                    class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[11px]"
                  >
                    <Check :size="13" />
                    <span>Đã gửi biên bản giải trình chờ xử lý</span>
                  </span>
                </div>
              </span>
              <span v-else>
                {{ scannerResult.message || 'Mã vé không tồn tại hoặc không thuộc sự kiện này.' }}
              </span>
            </div>
            <span v-if="scanBusy" class="scan-progress"></span>
          </div>

          <div v-if="scannerError" class="error-box">{{ scannerError }}</div>

          <div class="flex items-center gap-2 pt-1">
            <input
              v-model="manualScanCode"
              type="text"
              placeholder="Hoặc nhập mã vé thủ công (VD: TKT-8-...)"
              class="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              @keyup.enter="manualScanCode.trim() && submitScan(manualScanCode, true)"
            />
            <button
              type="button"
              class="primary-button"
              style="min-height: 36px; padding: 0 14px; font-size: 11px;"
              :disabled="!manualScanCode.trim() || !selectedScannerEventId || scanBusy"
              @click="submitScan(manualScanCode, true)"
            >
              Kiểm tra mã
            </button>
          </div>

          <div class="flex items-center justify-between gap-2 pt-1 text-xs">
            <button
              type="button"
              @click="toggleSound"
              class="sound-badge-btn"
              :class="isSoundEnabled ? 'active' : 'muted'"
              title="Bật/Tắt âm thanh quét vé"
            >
              <Volume2 v-if="isSoundEnabled" :size="15" />
              <VolumeX v-else :size="15" />
              <span>{{ isSoundEnabled ? 'Âm thanh: Đang bật' : 'Âm thanh: Đang tắt' }}</span>
            </button>
            <span class="text-[11px] text-slate-400 font-medium">Bíp & rung khi check-in</span>
          </div>

          <button v-if="scannerRunning" class="secondary-button stop-camera" @click="stopScanner">
            Tắt camera
          </button>
        </section>
        <p class="scanner-footnote"><ShieldCheck :size="15" />Mỗi vé QR chỉ được check-in thành công một lần.</p>
      </section>

      <!-- TAB 4: BÁO CÁO TIẾN ĐỘ & CHECK-IN -->
      <section v-else-if="staffTab === 'report'" class="space-y-6">
        <div class="card p-5 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span class="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700 border border-indigo-200">
              📊 Báo Cáo Tiến Độ
            </span>
            <h1 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
              Báo cáo & Thống kê sự kiện
            </h1>
            <p class="text-xs text-slate-500 mt-0.5">
              Theo dõi trực quan tỷ lệ đăng ký, phê duyệt và check-in thực tế tại cổng.
            </p>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="exportStaffAttendees"
              class="btn btn-secondary text-xs py-2 px-3 font-bold gap-1.5 cursor-pointer"
            >
              <ArrowDownToLine :size="15" />
              <span>Xuất danh sách (CSV)</span>
            </button>
          </div>
        </div>

        <!-- Thống kê tổng quan -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="card p-4 bg-white rounded-2xl border border-slate-200 text-center">
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tổng khách đăng ký</span>
            <p class="text-2xl font-black text-slate-900 mt-1">{{ staffRegistrations.length }}</p>
            <span class="text-[10px] text-slate-400">hồ sơ đã ghi nhận</span>
          </div>
          <div class="card p-4 bg-white rounded-2xl border border-slate-200 text-center">
            <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Đã phát hành vé</span>
            <p class="text-2xl font-black text-emerald-600 mt-1">{{ staffRegistrations.filter(r => r.status === 'APPROVED').length }}</p>
            <span class="text-[10px] text-emerald-600">{{ staffRegistrations.length ? Math.round((staffRegistrations.filter(r => r.status === 'APPROVED').length / staffRegistrations.length) * 100) : 0 }}% tỷ lệ duyệt</span>
          </div>
          <div class="card p-4 bg-white rounded-2xl border border-slate-200 text-center">
            <span class="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Đã vào cổng</span>
            <p class="text-2xl font-black text-indigo-600 mt-1">{{ staffRegistrations.filter(r => r.ticket_status === 'USED').length }}</p>
            <span class="text-[10px] text-indigo-600">{{ staffRegistrations.filter(r => r.status === 'APPROVED').length ? Math.round((staffRegistrations.filter(r => r.ticket_status === 'USED').length / staffRegistrations.filter(r => r.status === 'APPROVED').length) * 100) : 0 }}% khách có vé đã đến</span>
          </div>
          <div class="card p-4 bg-white rounded-2xl border border-slate-200 text-center">
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Chưa đến</span>
            <p class="text-2xl font-black text-slate-600 mt-1">{{ staffRegistrations.filter(r => r.status === 'APPROVED' && r.ticket_status !== 'USED').length }}</p>
            <span class="text-[10px] text-slate-400">khách có vé chưa quét</span>
          </div>
        </div>

        <!-- Bảng danh sách check-in -->
        <div class="card overflow-hidden bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-3">
          <h3 class="font-bold text-slate-900 text-sm">Khách đã check-in thành công</h3>
          <div v-if="!staffRegistrations.filter(r => r.ticket_status === 'USED').length" class="p-8 text-center text-slate-400 text-xs">
            Chưa có khách nào check-in vào cổng sự kiện này.
          </div>
          <div v-else class="overflow-x-auto rounded-xl border border-slate-100">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                <tr>
                  <th class="py-2.5 px-4">Khách tham dự</th>
                  <th class="py-2.5 px-4">Số điện thoại</th>
                  <th class="py-2.5 px-4">Người giới thiệu</th>
                  <th class="py-2.5 px-4">Mã vé</th>
                  <th class="py-2.5 px-4 text-center">Thời gian check-in</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="reg in staffRegistrations.filter(r => r.ticket_status === 'USED')" :key="reg.id">
                  <td class="py-3 px-4 font-bold text-slate-900">{{ reg.full_name }}</td>
                  <td class="py-3 px-4 text-slate-700 font-mono">{{ reg.phone || '—' }}</td>
                  <td class="py-3 px-4 text-slate-600">{{ reg.referrer_name || 'Khách vãng lai' }}</td>
                  <td class="py-3 px-4 font-mono font-bold text-primary-700">{{ reg.ticket_code }}</td>
                  <td class="py-3 px-4 text-center">
                    <span class="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200">
                      {{ reg.ticket_used_at ? formatDate(reg.ticket_used_at) : 'Đã check-in' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- TAB 5: XỬ LÝ TRANH CHẤP VÉ -->
      <section v-else-if="staffTab === 'disputes'" class="space-y-6">
        <div class="card p-5 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span class="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
              ⚖️ Ban Trọng Tài & Tranh Chấp Vé
            </span>
            <h1 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
              Giải trình & Xử lý vé quét trùng
            </h1>
            <p class="text-xs text-slate-500 mt-0.5">
              Danh sách biên bản giải trình từ cổng soát vé khi phát hiện mã QR đã check-in trước đó.
            </p>
          </div>
          <button type="button" @click="loadDisputes" class="btn btn-secondary text-xs py-2 px-3 font-bold gap-1.5 cursor-pointer">
            <RefreshCw :size="14" />
            <span>Làm mới</span>
          </button>
        </div>

        <div class="card overflow-hidden bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5">
          <div v-if="!disputesList.length" class="p-8 text-center text-slate-400 text-xs">
            Hiện chưa có biên bản tranh chấp vé nào.
          </div>
          <div v-else class="space-y-3">
            <div
              v-for="d in disputesList"
              :key="d.id"
              class="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div class="space-y-1 text-xs">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-mono font-bold text-primary-700 bg-white px-2 py-0.5 rounded border border-slate-200">{{ d.ticket_code }}</span>
                  <span class="font-bold text-slate-800">{{ d.event_name }}</span>
                  <span
                    class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                    :class="d.decision === 'ALLOW' ? 'bg-emerald-100 text-emerald-700' : d.decision === 'DENY' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'"
                  >
                    {{ d.decision === 'ALLOW' ? '✓ Cho phép vào cổng' : d.decision === 'DENY' ? '✕ Từ chối' : '⏳ Chờ xử lý' }}
                  </span>
                </div>
                <p class="text-slate-600">
                  Khách đăng ký gốc: <b>{{ d.original_attendee_name }}</b> ({{ d.original_phone || '—' }})
                  • Người khiếu nại tại cổng: <b>{{ d.claimant_name }}</b> ({{ d.claimant_phone }})
                </p>
                <p class="text-slate-700 bg-amber-50/80 border border-amber-200/80 rounded-lg px-2.5 py-1.5">
                  <b>Lý do giải trình:</b> {{ d.explanation }}
                  <span v-if="d.recorder_name" class="text-slate-500"> (Gửi bởi: {{ d.recorder_name }})</span>
                </p>
                <p v-if="d.decision_note" class="text-slate-500 italic">
                  <b>Quyết định ({{ d.decider_name || 'Quản lý' }}):</b> {{ d.decision_note }}
                </p>
              </div>

              <div v-if="d.decision === 'PENDING' && staffCanApprove" class="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  @click="resolveDisputeItem(d, 'ALLOW')"
                  class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer"
                >
                  ✓ Cho vào cổng
                </button>
                <button
                  type="button"
                  @click="resolveDisputeItem(d, 'DENY')"
                  class="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold text-xs cursor-pointer"
                >
                  ✕ Từ chối
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- THANH ĐIỀU HƯỚNG DƯỚI CÙNG TRÊN MOBILE CHO NHÂN SỰ (STAFF) -->
    <nav class="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 flex items-center justify-around py-1.5 px-2 shadow-lg pb-safe">
      <button
        v-if="staffCanInvite"
        type="button"
        @click="staffTab = 'invite'"
        class="flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition cursor-pointer"
        :class="staffTab === 'invite' ? 'text-primary-700 bg-primary-50/80 font-bold' : 'text-slate-500 hover:text-slate-800 font-medium'"
      >
        <Users :size="18" />
        <span class="text-[10px] mt-0.5">Mời khách</span>
      </button>

      <button
        v-if="staffCanApprove"
        type="button"
        @click="staffTab = 'approve'"
        class="flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition cursor-pointer relative"
        :class="staffTab === 'approve' ? 'text-emerald-700 bg-emerald-50/80 font-bold' : 'text-slate-500 hover:text-slate-800 font-medium'"
      >
        <UserCheck :size="18" />
        <span class="text-[10px] mt-0.5">Duyệt khách</span>
        <span v-if="staffRegistrations.filter(r => r.status === 'PENDING').length" class="absolute top-0 right-2 px-1 py-0.2 bg-amber-500 text-white rounded-full text-[9px] font-mono leading-none">
          {{ staffRegistrations.filter(r => r.status === 'PENDING').length }}
        </span>
      </button>

      <button
        v-if="staffCanScan"
        type="button"
        @click="staffTab = 'scan'"
        class="flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition cursor-pointer"
        :class="staffTab === 'scan' ? 'text-primary-700 bg-primary-50/80 font-bold' : 'text-slate-500 hover:text-slate-800 font-medium'"
      >
        <Camera :size="18" />
        <span class="text-[10px] mt-0.5">Quét vé</span>
      </button>

      <button
        v-if="staffCanReport"
        type="button"
        @click="staffTab = 'report'"
        class="flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition cursor-pointer"
        :class="staffTab === 'report' ? 'text-indigo-700 bg-indigo-50/80 font-bold' : 'text-slate-500 hover:text-slate-800 font-medium'"
      >
        <BarChart3 :size="18" />
        <span class="text-[10px] mt-0.5">Báo cáo</span>
      </button>

      <button
        v-if="staffCanApprove || disputesList.length > 0"
        type="button"
        @click="loadDisputes(); staffTab = 'disputes'"
        class="flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition cursor-pointer relative"
        :class="staffTab === 'disputes' ? 'text-amber-700 bg-amber-50/80 font-bold' : 'text-slate-500 hover:text-slate-800 font-medium'"
      >
        <Scale :size="18" />
        <span class="text-[10px] mt-0.5">Tranh chấp</span>
        <span v-if="disputesList.filter(d => d.decision === 'PENDING').length" class="absolute top-0 right-2 px-1 py-0.2 bg-amber-500 text-white rounded-full text-[9px] font-mono leading-none">
          {{ disputesList.filter(d => d.decision === 'PENDING').length }}
        </span>
      </button>
    </nav>
  </div>

  <div v-else class="app-shell">
    <aside class="sidebar">
      <a class="brand-lockup sidebar-brand" href="#">
        <img src="/logo-transparent.png" alt="EventGo.vn" class="h-8 w-auto object-contain" />
      </a>
      <div class="sidebar-caption">KHÔNG GIAN TỔ CHỨC</div>
      <button class="tenant-switch">
        <span class="tenant-avatar"><Building2 :size="18" /></span>
        <span class="tenant-switch-text">
          <b>{{ user?.tenant_name || 'Đơn vị khách thuê' }}</b>
          <small>Gói tổ chức sự kiện</small>
        </span>
        <ChevronDown :size="15" />
      </button>
      <div class="sidebar-caption nav-caption">VẬN HÀNH</div>
      <button
        @click="activePanel = 'overview'"
        :class="['nav-item', activePanel === 'overview' && 'nav-active']"
      >
        <CalendarDays :size="18" />Tổng quan
      </button>
      <button
        @click="activePanel = 'invites'"
        :class="['nav-item', activePanel === 'invites' && 'nav-active']"
      >
        <Sparkles :size="18" />Thư mời & Link QR
      </button>
      <button
        @click="activePanel = 'attendees'"
        :class="['nav-item', activePanel === 'attendees' && 'nav-active']"
      >
        <Users :size="18" />Khách mời
        <span v-if="attendees.length" class="nav-count">{{ attendees.length }}</span>
      </button>
      <button
        @click="stopScanner(); activePanel = 'team'"
        :class="['nav-item', activePanel === 'team' && 'nav-active']"
      >
        <ShieldCheck :size="18" />Đội ngũ
      </button>
      <button
        @click="selectedScannerEventId = selectedEvent?.id || scannerEvents[0]?.id || null; activePanel = 'scanner'"
        :class="['nav-item', activePanel === 'scanner' && 'nav-active']"
      >
        <Camera :size="18" />Soát vé QR
      </button>
      <button
        @click="stopScanner(); loadDisputes(); activePanel = 'disputes'"
        :class="['nav-item', activePanel === 'disputes' && 'nav-active']"
      >
        <Scale :size="18" />Tranh chấp vé
        <span v-if="disputesList.filter(d => d.decision === 'PENDING').length" class="nav-count">
          {{ disputesList.filter(d => d.decision === 'PENDING').length }}
        </span>
      </button>
      <div class="sidebar-bottom">
        <div class="support-card">
          <span class="support-icon"><CircleUserRound :size="19" /></span>
          <b>Ban tổ chức</b><small>{{ user?.name || user?.email }}</small>
        </div>
        <button class="nav-item logout-button" @click="logout"><LogOut :size="17" />Đăng xuất</button>
      </div>
    </aside>

    <main class="main-area">
      <header class="topbar">
        <div class="mobile-brand">
          <img src="/logo-transparent.png" alt="EventGo.vn" class="h-7 w-auto object-contain" />
        </div>
        <div class="topbar-title">
          <span class="eyebrow">{{ selectedEvent ? 'KHÔNG GIAN SỰ KIỆN' : 'CỔNG KHÁCH THUÊ' }}</span>
          <span class="topbar-event">{{ selectedEvent?.name || 'Chào mừng trở lại' }}</span>
        </div>
        <div class="topbar-user">
          <span class="user-initial">{{ (user?.name || 'K').slice(0, 1).toUpperCase() }}</span>
          <span><b>{{ user?.name }}</b><small>Quản lý đơn vị</small></span>
        </div>
        <button class="icon-button mobile-logout" @click="logout"><LogOut :size="18" /></button>
      </header>

      <div class="content-area pb-24 md:pb-8">
        <div v-if="errorMessage" class="error-box page-error">
          <span>{{ errorMessage }}</span><button @click="errorMessage = ''"><X :size="16" /></button>
        </div>
        <div v-if="loading" class="loading-card">Đang tải dữ liệu sự kiện...</div>
        <template v-else>
          <section v-if="user?.type === 'TENANT_ADMIN' && usage" class="surface-card quota-panel">
            <div class="quota-copy">
              <span class="metric-icon blue"><PackageCheck :size="19" /></span>
              <div>
                <span class="eyebrow">GÓI SỰ KIỆN</span>
                <h2>{{ usage.can_create_event ? 'Sẵn sàng vận hành sự kiện' : 'Cần gói cho sự kiện tiếp theo' }}</h2>
                <p>
                  {{ usage.free_events_used }} / {{ usage.free_event_limit }} sự kiện dùng thử đã tạo ·
                  {{ usage.available_packages.length }} gói đã xác nhận, chưa sử dụng
                </p>
                <small>Gói áp dụng riêng cho từng sự kiện. Đóng sự kiện vẫn giữ lịch sử và lượt đã dùng.</small>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button class="secondary-button" @click="loadPortal"><Activity :size="16" />Cập nhật</button>
              <button class="primary-button" :disabled="!usage.can_create_event" @click="openEventModal()">
                <Plus :size="17" />Tạo sự kiện
              </button>
            </div>
          </section>

          <div
            v-if="user?.type === 'TENANT_ADMIN' && Number(usage?.free_events_remaining) > 0 && !usage?.trial_package"
            class="surface-card trial-notice"
          >
            Gói dùng thử chưa được cấu hình. Quản trị viên hệ thống cần thiết lập hạn mức trước khi bạn tạo sự kiện miễn phí.
          </div>

          <section
            v-if="user?.type === 'TENANT_ADMIN' && Number(usage?.free_events_used) >= Number(usage?.free_event_limit)"
            class="surface-card plan-panel"
          >
            <div class="surface-heading">
              <div>
                <h2>Gói cho sự kiện</h2>
                <p>Mỗi gói cấp quyền cho một sự kiện sau khi admin xác nhận thanh toán.</p>
              </div>
            </div>
            <div v-if="usage.available_packages.length" class="plan-grid">
              <article v-for="pkg in usage.available_packages" :key="pkg.id" class="plan-option">
                <div class="plan-icon"><PackageCheck :size="18" /></div>
                <b>{{ pkg.name }}</b>
                <p>
                  {{ pkg.max_attendees }} khách · {{ pkg.max_employees }} nhân sự · {{ pkg.max_referrers }} giới thiệu · {{ pkg.max_scanners }} soát vé
                </p>
                <strong>{{ Number(pkg.price_vnd).toLocaleString('vi-VN') }} ₫</strong>
                <small>Đã xác nhận · chưa sử dụng</small>
                <button class="secondary-button" :disabled="saving" @click="openEventModal(pkg.id)">
                  Tạo sự kiện bằng gói này<ArrowRight :size="15" />
                </button>
              </article>
            </div>
            <div class="surface-heading package-heading">
              <div>
                <h2>Chọn gói cho sự kiện tiếp theo</h2>
                <p>Chọn quy mô phù hợp. Admin sẽ xác nhận thanh toán trước khi bạn tạo sự kiện.</p>
              </div>
            </div>
            <div v-if="!plans.length" class="empty-state compact">
              <PackageCheck :size="25" />
              <span>Hiện chưa có gói sự kiện được mở bán. Vui lòng liên hệ quản trị viên.</span>
            </div>
            <div v-else class="plan-grid">
              <article v-for="plan in plans" :key="plan.id" class="plan-option">
                <div class="plan-icon"><PackageCheck :size="18" /></div>
                <b>{{ plan.name }}</b>
                <p>{{ plan.description || `${plan.max_attendees} khách tham gia` }}</p>
                <strong>{{ Number(plan.price_vnd).toLocaleString('vi-VN') }} ₫</strong>
                <small>
                  {{ plan.max_attendees }} khách · {{ plan.max_employees }} nhân sự · {{ plan.max_referrers }} giới thiệu · {{ plan.max_scanners }} soát vé
                </small>
                <button class="secondary-button" :disabled="saving" @click="requestPlan(plan)">
                  {{ saving ? 'Đang gửi...' : 'Yêu cầu mua gói' }}<ArrowRight :size="15" />
                </button>
              </article>
            </div>
            <div v-if="usage.package_requests.length" class="package-request-list">
              <p v-for="request in usage.package_requests" :key="request.id">
                {{ request.name }} · {{ packageRequestStatus(request) }}
              </p>
            </div>
          </section>

          <template v-if="activePanel === 'scanner'">
            <div class="page-heading">
              <div>
                <span class="eyebrow">CỔNG SOÁT VÉ TRỰC TIẾP</span>
                <h1>Quét vé QR vào cổng</h1>
                <p>Đưa mã QR trên vé của khách vào ô vuông khung ngắm camera để xác thực và check-in.</p>
              </div>
              <div v-if="events.length" class="event-picker-wrap">
                <CalendarDays :size="17" />
                <select v-model.number="selectedScannerEventId" @change="scannerResult = null">
                  <option v-for="ev in events" :key="ev.id" :value="ev.id">{{ ev.name }}</option>
                </select>
                <ChevronDown :size="15" />
              </div>
            </div>

            <section class="scanner-card" style="max-width: 560px; margin: 0 auto;">
              <div class="scanner-camera">
                <div id="tenant-qr-reader"></div>

                <div v-if="!scannerRunning" class="camera-placeholder">
                  <QrCode :size="37" />
                  <b>Camera sẵn sàng</b>
                  <span>Cho phép truy cập camera để bắt đầu quét vé.</span>
                  <button class="primary-button" :disabled="!selectedScannerEventId" @click="startScanner">
                    Bật camera
                  </button>
                </div>

                <div v-if="scannerRunning" class="scanner-reticle-overlay">
                  <div class="scanner-reticle-box">
                    <span class="corner top-left"></span>
                    <span class="corner top-right"></span>
                    <span class="corner bottom-left"></span>
                    <span class="corner bottom-right"></span>
                  </div>
                </div>
              </div>

              <div
                class="scanner-feedback"
                :class="scannerResult?.result === 'SUCCESS' ? 'feedback-success' : scannerResult?.result === 'ALREADY_USED' ? 'feedback-warning' : scannerResult ? 'feedback-error' : ''"
              >
                <div class="feedback-mark">
                  <Check v-if="scannerResult?.result === 'SUCCESS'" :size="22" />
                  <AlertTriangle v-else-if="scannerResult?.result === 'ALREADY_USED'" :size="22" />
                  <X v-else-if="scannerResult" :size="22" />
                  <QrCode v-else :size="22" />
                </div>
                <div class="feedback-text">
                  <b>{{
                    scannerResult?.result === 'SUCCESS'
                      ? 'Vé hợp lệ · Đã check-in thành công'
                      : scannerResult?.result === 'ALREADY_USED'
                        ? 'MÃ QR ĐÃ ĐƯỢC CHECK-IN TRƯỚC ĐÓ!'
                        : scannerResult
                          ? 'Không xác nhận được vé'
                          : 'Sẵn sàng quét'
                  }}</b>
                  <span v-if="!scannerResult">Phản hồi check-in sẽ hiển thị tại đây.</span>
                  <span v-else-if="scannerResult.result === 'SUCCESS'">
                    Khách: <strong>{{ scannerResult.attendee?.full_name || 'Khách mời' }}</strong>
                    <template v-if="scannerResult.attendee?.phone"> ({{ scannerResult.attendee.phone }})</template>
                    <template v-if="scannerResult.referrer?.name"> • Người mời: <strong>{{ scannerResult.referrer.name }}</strong></template>
                  </span>
                  <span v-else-if="scannerResult.result === 'ALREADY_USED'">
                    Khách: <strong>{{ scannerResult.attendee?.full_name || 'Khách mời' }}</strong>
                    <template v-if="scannerResult.attendee?.phone"> ({{ scannerResult.attendee.phone }})</template>
                    <template v-if="scannerResult.ticket?.used_at">
                      • Quét lần 1 lúc {{ new Date(scannerResult.ticket.used_at).toLocaleTimeString('vi-VN') }} ngày {{ new Date(scannerResult.ticket.used_at).toLocaleDateString('vi-VN') }}
                    </template>
                    <template v-if="scannerResult.ticket?.first_scanner">
                      bởi <strong>{{ scannerResult.ticket.first_scanner }}</strong>
                    </template>
                    <div class="mt-2">
                      <button
                        v-if="!disputeSent && scannerResult.scan_log_id && scannerResult.ticket?.id"
                        type="button"
                        @click="openDisputeModal"
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] shadow-xs transition cursor-pointer"
                      >
                        <Scale :size="13" />
                        <span>Gửi giải trình tranh chấp</span>
                      </button>
                      <span
                        v-else-if="disputeSent"
                        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[11px]"
                      >
                        <Check :size="13" />
                        <span>Đã gửi biên bản giải trình chờ xử lý</span>
                      </span>
                    </div>
                  </span>
                  <span v-else>
                    {{ scannerResult.message || 'Mã vé không tồn tại hoặc không thuộc sự kiện này.' }}
                  </span>
                </div>
                <span v-if="scanBusy" class="scan-progress"></span>
              </div>

              <div v-if="scannerError" class="error-box">{{ scannerError }}</div>

              <div class="flex items-center gap-2 pt-1">
                <input
                  v-model="manualScanCode"
                  type="text"
                  placeholder="Hoặc nhập mã vé thủ công (VD: TKT-8-...)"
                  class="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  @keyup.enter="manualScanCode.trim() && submitScan(manualScanCode, true)"
                />
                <button
                  type="button"
                  class="primary-button"
                  style="min-height: 36px; padding: 0 14px; font-size: 11px;"
                  :disabled="!manualScanCode.trim() || !selectedScannerEventId || scanBusy"
                  @click="submitScan(manualScanCode, true)"
                >
                  Kiểm tra mã
                </button>
              </div>

              <div class="flex items-center justify-between gap-2 pt-1 text-xs">
            <button
              type="button"
              @click="toggleSound"
              class="sound-badge-btn"
              :class="isSoundEnabled ? 'active' : 'muted'"
              title="Bật/Tắt âm thanh quét vé"
            >
              <Volume2 v-if="isSoundEnabled" :size="15" />
              <VolumeX v-else :size="15" />
              <span>{{ isSoundEnabled ? 'Âm thanh: Đang bật' : 'Âm thanh: Đang tắt' }}</span>
            </button>
            <span class="text-[11px] text-slate-400 font-medium">Bíp & rung khi check-in</span>
          </div>

          <button v-if="scannerRunning" class="secondary-button stop-camera" @click="stopScanner">
                Tắt camera
              </button>
            </section>
            <p class="scanner-footnote"><ShieldCheck :size="15" />Mỗi vé QR chỉ được check-in thành công một lần.</p>
          </template>

          <template v-else-if="activePanel === 'disputes'">
            <div class="page-heading">
              <div>
                <span class="eyebrow">BAN TRỌNG TÀI SỰ KIỆN</span>
                <h1>Xử lý tranh chấp vé QR</h1>
                <p>Xem xét các ca quét trùng mã QR tại cổng và quyết định cho phép hoặc từ chối vào cổng thủ công.</p>
              </div>
              <button class="secondary-button" @click="loadDisputes">
                <RefreshCw :size="15" />Làm mới
              </button>
            </div>

            <section class="surface-card" style="padding: 18px;">
              <div v-if="!disputesList.length" class="empty-state compact">
                <Scale :size="26" />
                <span>Chưa có biên bản giải trình tranh chấp vé nào.</span>
              </div>
              <div v-else class="space-y-3">
                <div
                  v-for="d in disputesList"
                  :key="d.id"
                  class="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div class="space-y-1 text-xs">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="font-mono font-bold text-primary-700 bg-white px-2 py-0.5 rounded border border-slate-200">{{ d.ticket_code }}</span>
                      <span class="font-bold text-slate-800">{{ d.event_name }}</span>
                      <span
                        class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                        :class="d.decision === 'ALLOW' ? 'bg-emerald-100 text-emerald-700' : d.decision === 'DENY' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'"
                      >
                        {{ d.decision === 'ALLOW' ? '✓ Cho phép vào cổng' : d.decision === 'DENY' ? '✕ Từ chối' : '⏳ Chờ xử lý' }}
                      </span>
                    </div>
                    <p class="text-slate-600">
                      Khách đăng ký gốc: <b>{{ d.original_attendee_name }}</b> ({{ d.original_phone || '—' }})
                      • Người khiếu nại tại cổng: <b>{{ d.claimant_name }}</b> ({{ d.claimant_phone }})
                    </p>
                    <p class="text-slate-700 bg-amber-50/80 border border-amber-200/80 rounded-lg px-2.5 py-1.5">
                      <b>Lý do giải trình:</b> {{ d.explanation }}
                      <span v-if="d.recorder_name" class="text-slate-500"> (Gửi bởi: {{ d.recorder_name }})</span>
                    </p>
                    <p v-if="d.decision_note" class="text-slate-500 italic">
                      <b>Quyết định ({{ d.decider_name || 'Ban tổ chức' }}):</b> {{ d.decision_note }}
                    </p>
                  </div>

                  <div v-if="d.decision === 'PENDING'" class="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      @click="resolveDisputeItem(d, 'ALLOW')"
                      class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer"
                    >
                      ✓ Cho vào cổng
                    </button>
                    <button
                      type="button"
                      @click="resolveDisputeItem(d, 'DENY')"
                      class="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold text-xs cursor-pointer"
                    >
                      ✕ Từ chối
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </template>

          <template v-else-if="activePanel === 'team'">
            <div class="page-heading">
              <div>
                <span class="eyebrow">NHÂN SỰ ĐƯỢC PHÂN QUYỀN</span>
                <h1>Đội ngũ sự kiện</h1>
                <p>Tạo tài khoản nhân sự, sau đó gán họ vào từng sự kiện với nhiệm vụ cụ thể.</p>
              </div>
              <button class="primary-button" @click="showMemberModal = true">
                <Plus :size="17" />Thêm nhân sự
              </button>
            </div>
            <section class="surface-card">
              <div class="surface-heading">
                <div>
                  <h2>Nhân sự của đơn vị</h2>
                  <p>{{ team.length }} tài khoản trong đội ngũ</p>
                </div>
              </div>
              <div v-if="!team.length" class="empty-state">
                <Users :size="30" />
                <b>Chưa có nhân sự</b>
                <span>Tạo tài khoản cho những người sẽ vận hành sự kiện.</span>
              </div>
              <div v-else>
                <!-- Mobile Cards for Team -->
                <div class="sm:hidden divide-y divide-slate-100 p-2 space-y-2">
                  <div v-for="member in team" :key="member.id" class="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                    <div class="flex items-center justify-between">
                      <b class="text-sm font-bold text-slate-900">{{ member.name }}</b>
                      <span class="status-pill text-[10px]" :class="member.status === 'ACTIVE' ? 'status-green' : 'status-gray'">
                        {{ member.status === 'ACTIVE' ? 'Hoạt động' : 'Đã khóa' }}
                      </span>
                    </div>
                    <div class="text-xs text-slate-500 font-mono">{{ member.email }}</div>
                    <div class="text-xs text-slate-600 flex items-center justify-between pt-1.5 border-t border-slate-100">
                      <span>SĐT: {{ member.phone || '—' }}</span>
                      <span class="text-primary-700 font-bold">{{ member.assigned_events }} sự kiện</span>
                    </div>
                  </div>
                </div>

                <!-- Desktop Table -->
                <div class="hidden sm:block table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Nhân sự</th>
                        <th>Liên hệ</th>
                        <th>Sự kiện được gán</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="member in team" :key="member.id">
                        <td><b>{{ member.name }}</b><small>{{ member.email }}</small></td>
                        <td>{{ member.phone || '—' }}</td>
                        <td>{{ member.assigned_events }}</td>
                        <td>
                          <span class="status-pill" :class="member.status === 'ACTIVE' ? 'status-green' : 'status-gray'">
                            {{ member.status === 'ACTIVE' ? 'Hoạt động' : 'Đã khóa' }}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
            <section v-if="selectedEvent" class="surface-card">
              <div class="surface-heading">
                <div>
                  <h2>Phân công · {{ selectedEvent.name }}</h2>
                  <p>
                    {{ eventEmployeeCount }}/{{ selectedEvent.max_employees }} nhân sự · {{ eventReferrerCount }}/{{ selectedEvent.max_referrers }} người giới thiệu · {{ eventScannerCount }}/{{ selectedEvent.max_scanners }} người soát vé.
                  </p>
                </div>
                <button
                  class="secondary-button"
                  :disabled="eventEmployeeCount >= selectedEvent.max_employees || selectedEvent.status !== 'PUBLISHED'"
                  @click="errorMessage = ''; showAssignmentModal = true"
                >
                  <Plus :size="16" />Phân công
                </button>
              </div>
              <div v-if="!eventTeam.length" class="empty-state compact">
                <ShieldCheck :size="26" />
                <span>Chưa có nhân sự được phân công cho sự kiện này.</span>
              </div>
              <div v-else class="assignment-grid">
                <article v-for="member in eventTeam" :key="member.id" class="assignment-card">
                  <div class="member-mark">{{ member.name.slice(0, 1) }}</div>
                  <div class="assignment-info">
                    <b>{{ member.name }}</b>
                    <small>{{ member.email }}</small>
                    <span class="role-chip">{{ roleLabel(member) }}</span>
                  </div>
                  <button class="icon-button danger-icon" title="Gỡ khỏi sự kiện" @click="removeMember(member)">
                    <Trash2 :size="16" />
                  </button>
                </article>
              </div>
            </section>
          </template>

          <template v-else-if="!selectedEvent">
            <div class="page-heading">
              <div>
                <span class="eyebrow">BẢNG ĐIỀU HÀNH</span>
                <h1>Sự kiện của bạn</h1>
                <p>Tạo sự kiện, theo dõi khách mời và phân công đội ngũ vận hành.</p>
              </div>
              <button class="primary-button" :disabled="!usage?.can_create_event" @click="openEventModal()">
                <Plus :size="17" />Tạo sự kiện
              </button>
            </div>
            <div v-if="!events.length" class="empty-large">
              <CalendarDays :size="36" />
              <h2>Chưa có sự kiện</h2>
              <p>Tạo sự kiện đầu tiên để bắt đầu quản lý khách mời và đội ngũ check-in.</p>
            </div>
          </template>

          <template v-else>
            <!-- ========================================== -->
            <!-- 1. TAB: TỔNG QUAN (OVERVIEW) -->
            <!-- ========================================== -->
            <template v-if="activePanel === 'overview'">
              <div class="page-heading event-heading">
                <div>
                  <span class="eyebrow">BẢNG ĐIỀU HÀNH</span>
                  <h1>Tổng quan sự kiện</h1>
                  <p>Theo dõi tiến độ, số liệu khách mời và phát hành vé.</p>
                </div>
                <div class="event-picker-wrap">
                  <CalendarDays :size="17" />
                  <select
                    :value="selectedEvent.id"
                    @change="loadEventDetails(events.find((event) => event.id === Number(($event.target as HTMLSelectElement).value)))"
                  >
                    <option v-for="event in events" :key="event.id" :value="event.id">{{ event.name }}</option>
                  </select>
                  <ChevronDown :size="15" />
                </div>
              </div>

              <!-- BANNER CHỜ THANH TOÁN GÓI -->
              <div v-if="selectedEvent.payment_status === 'PENDING_PAYMENT'" class="payment-alert-card">
                <div class="payment-alert-left">
                  <div class="payment-alert-icon">⏳</div>
                  <div>
                    <div class="payment-alert-title">Sự kiện đang chờ thanh toán gói {{ selectedEvent.package_name || 'dịch vụ' }}</div>
                    <p class="payment-alert-desc">
                      Gói sự kiện có chi phí <b>{{ Number(selectedEvent.package_price_vnd).toLocaleString('vi-VN') }} ₫</b> chưa được xác nhận thanh toán. Vui lòng thanh toán để mở khóa quyền mời khách và quét mã check-in.
                    </p>
                  </div>
                </div>
                <button type="button" class="payment-alert-btn" @click="openPaymentModal(selectedEvent)">
                  <CreditCard :size="16" />
                  <span>Thanh toán ngay (VietQR)</span>
                </button>
              </div>

              <!-- THẺ TÓM TẮT SỰ KIỆN -->
              <div class="event-banner">
                <div class="event-banner-mark"><TicketCheck :size="24" /></div>
                <div class="event-banner-copy">
                  <span class="status-pill" :class="selectedEvent.status === 'PUBLISHED' ? 'status-green' : 'status-gray'">
                    {{ selectedEvent.status === 'PUBLISHED' ? 'Đang mở' : selectedEvent.status }}
                  </span>
                  <span
                    v-if="selectedEvent.payment_status === 'PENDING_PAYMENT'"
                    class="status-pill status-amber cursor-pointer"
                    title="Bấm để quét mã thanh toán"
                    @click="openPaymentModal(selectedEvent)"
                  >
                    ⏳ Chờ thanh toán ({{ Number(selectedEvent.package_price_vnd).toLocaleString('vi-VN') }} ₫)
                  </span>
                  <span
                    v-else-if="Number(selectedEvent.package_price_vnd) > 0"
                    class="status-pill status-green"
                  >
                    ✅ Đã thanh toán
                  </span>
                  <span
                    v-if="selectedEvent.approval_mode"
                    class="status-pill"
                    :class="{
                      'status-blue': selectedEvent.approval_mode === 'REFERRER_ONLY',
                      'status-amber': selectedEvent.approval_mode === 'TWO_TIER',
                      'status-green': selectedEvent.approval_mode === 'AUTO',
                    }"
                  >
                    {{ selectedEvent.approval_mode === 'REFERRER_ONLY' ? '1. Người mời duyệt' : selectedEvent.approval_mode === 'TWO_TIER' ? '2. Duyệt 2 cấp' : '3. Tự động cấp QR' }}
                  </span>
                  <h2>{{ selectedEvent.name }}</h2>
                  <div class="event-meta">
                    <span><MapPin :size="15" />{{ selectedEvent.location }}</span>
                    <span><Clock3 :size="15" />{{ formatDate(selectedEvent.start_at) }}</span>
                    <span>{{ selectedEvent.package_name }} · {{ eventPackagePrice(selectedEvent) }}</span>
                  </div>
                  <div class="flex items-center gap-2 mt-3">
                    <button type="button" class="px-2.5 py-1.5 rounded-lg border border-white/30 text-xs font-bold text-white hover:bg-white/10 flex items-center gap-1.5 transition cursor-pointer" @click="openEditEventModal(selectedEvent)">
                      <Edit3 :size="13" /> Sửa thông tin
                    </button>
                    <button v-if="selectedEvent.status === 'PUBLISHED'" class="close-event-button" @click="closeEvent">
                      Đóng sự kiện
                    </button>
                    <button v-else-if="selectedEvent.status === 'CLOSED'" class="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white flex items-center gap-1.5 transition cursor-pointer" @click="reopenEvent">
                      <Play :size="13" /> Mở lại sự kiện
                    </button>
                  </div>
                </div>
                <div class="capacity-ring">
                  <b>{{ selectedEvent.capacity ? Math.round((attendees.length / selectedEvent.capacity) * 100) : 0 }}%</b>
                  <small>{{ attendees.length }}/{{ selectedEvent.capacity }} khách</small>
                </div>
              </div>

              <!-- LỐI TẮT THAO TÁC NHANH MOBILE (QUICK ACTIONS) -->
              <div class="grid grid-cols-3 gap-2.5 my-3">
                <button
                  type="button"
                  @click="selectedScannerEventId = selectedEvent?.id || null; activePanel = 'scanner'"
                  class="p-3 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/80 border border-emerald-200/90 text-emerald-950 flex flex-col items-center justify-center gap-1.5 transition shadow-2xs hover:shadow-xs active:scale-98 cursor-pointer"
                >
                  <div class="p-2 rounded-xl bg-emerald-600 text-white shadow-2xs">
                    <Camera :size="18" />
                  </div>
                  <span class="text-[11px] font-bold">Soát vé QR</span>
                </button>

                <button
                  type="button"
                  @click="activePanel = 'invites'"
                  class="p-3 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50/80 border border-amber-200/90 text-amber-950 flex flex-col items-center justify-center gap-1.5 transition shadow-2xs hover:shadow-xs active:scale-98 cursor-pointer"
                >
                  <div class="p-2 rounded-xl bg-amber-500 text-white shadow-2xs">
                    <Sparkles :size="18" />
                  </div>
                  <span class="text-[11px] font-bold">Thư mời & QR</span>
                </button>

                <button
                  type="button"
                  @click="activePanel = 'attendees'"
                  class="p-3 rounded-2xl bg-gradient-to-br from-indigo-50 to-sky-50/80 border border-indigo-200/90 text-indigo-950 flex flex-col items-center justify-center gap-1.5 transition shadow-2xs hover:shadow-xs active:scale-98 cursor-pointer"
                >
                  <div class="p-2 rounded-xl bg-indigo-600 text-white shadow-2xs">
                    <Users :size="18" />
                  </div>
                  <span class="text-[11px] font-bold">Khách mời</span>
                </button>
              </div>

              <!-- 4 CHỈ SỐ THỐNG KÊ (2x2 GRID) -->
              <div class="metric-grid">
                <article class="metric-card">
                  <span class="metric-icon blue"><Users :size="19" /></span>
                  <span class="metric-label">Đã đăng ký</span>
                  <b>{{ attendees.length }}</b>
                  <small>trên {{ selectedEvent.capacity }} chỗ</small>
                </article>
                <article class="metric-card">
                  <span class="metric-icon green"><TicketCheck :size="19" /></span>
                  <span class="metric-label">Đã duyệt / có vé</span>
                  <b>{{ approvedCount }}</b>
                  <small>vé QR đã phát hành</small>
                </article>
                <article class="metric-card">
                  <span class="metric-icon violet"><QrCode :size="19" /></span>
                  <span class="metric-label">Đã check-in</span>
                  <b>{{ checkedInCount }}</b>
                  <small>{{ approvedCount ? Math.round((checkedInCount / approvedCount) * 100) : 0 }}% khách có vé</small>
                </article>
                <article class="metric-card">
                  <span class="metric-icon amber"><Users :size="19" /></span>
                  <span class="metric-label">Đội ngũ được gán</span>
                  <b>{{ eventTeam.length }}</b>
                  <small>nhân sự vận hành</small>
                </article>
              </div>

              <!-- THẺ THƯ MỜI & LINK QR (COMPACT & BEAUTIFUL) -->
              <section class="card p-4 sm:p-5 bg-gradient-to-br from-white via-slate-50 to-indigo-50/40 rounded-3xl border border-slate-200/90 shadow-2xs space-y-3.5">
                <div class="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div class="flex items-center gap-2">
                    <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-50 border border-primary-200 text-primary-700 text-xs font-bold">
                      <Sparkles :size="13" class="text-primary-600" />
                      Kênh Mời & Mã QR Chính Thức
                    </span>
                  </div>
                  <button
                    type="button"
                    @click="activePanel = 'invites'"
                    class="text-xs font-bold text-primary-600 hover:text-primary-800 flex items-center gap-1 cursor-pointer"
                  >
                    Xem chi tiết <ArrowRight :size="13" />
                  </button>
                </div>

                <div class="grid sm:grid-cols-[130px_1fr] gap-3.5 items-center">
                  <!-- QR Code Mini Box -->
                  <div class="flex flex-col items-center gap-2 p-2.5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                    <div
                      @click="showTenantZoomQrModal = true"
                      class="relative p-1 bg-white rounded-xl cursor-pointer hover:scale-102 transition group"
                      title="Chạm để phóng to mã QR"
                    >
                      <img
                        v-if="tenantInviteQrUrl"
                        :src="tenantInviteQrUrl"
                        alt="Mã QR Mời"
                        class="w-28 h-28 object-contain rounded-lg"
                      />
                      <div v-else class="w-28 h-28 flex flex-col items-center justify-center text-slate-400 text-xs text-center p-2">
                        <span v-if="loadingTenantInvites">Đang tạo...</span>
                        <button v-else type="button" @click.stop="selectedEvent?.id && loadTenantEventInvites(selectedEvent.id)" class="text-primary-600 font-bold underline">Tạo QR</button>
                      </div>
                      <div v-if="tenantInviteQrUrl" class="absolute inset-0 bg-primary-900/60 rounded-xl opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[11px] font-bold gap-1 pointer-events-none">
                        <Maximize2 :size="13" /> Phóng to
                      </div>
                    </div>
                    <button
                      type="button"
                      @click="showTenantZoomQrModal = true"
                      :disabled="!tenantInviteQrUrl"
                      class="w-full py-1 px-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                    >
                      <Maximize2 :size="11" /> Phóng to QR
                    </button>
                  </div>

                  <!-- Link Box & Actions -->
                  <div class="space-y-2.5">
                    <div>
                      <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                        Link đăng ký tham dự chính thức
                      </span>
                      <div class="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-xl shadow-2xs">
                        <span class="pl-2 text-slate-400 shrink-0"><Link2 :size="14" /></span>
                        <input
                          readonly
                          :value="tenantActiveInviteLink?.invite_url || (loadingTenantInvites ? 'Đang tạo link mời...' : 'Đang lấy link...')"
                          class="flex-1 text-xs font-mono font-bold text-primary-700 bg-transparent border-0 outline-none select-all truncate py-1.5"
                        />
                        <button
                          type="button"
                          @click="copyTenantInviteLink()"
                          :disabled="!tenantActiveInviteLink?.invite_url"
                          class="px-3 py-1.5 rounded-lg bg-primary-700 hover:bg-primary-800 text-white text-xs font-bold flex items-center gap-1 shrink-0 transition cursor-pointer"
                        >
                          <Check v-if="copiedTenantInviteLink" :size="13" />
                          <Copy v-else :size="13" />
                          <span>{{ copiedTenantInviteLink ? 'Đã chép' : 'Sao chép' }}</span>
                        </button>
                      </div>
                    </div>

                    <div class="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        @click="shareTenantInviteLink()"
                        :disabled="!tenantActiveInviteLink?.invite_url"
                        class="py-2 px-2.5 rounded-xl bg-white border border-slate-200 hover:border-primary-300 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer"
                      >
                        <Share2 :size="13" class="text-primary-600" />
                        <span>Chia sẻ Zalo/SMS</span>
                      </button>
                      <button
                        type="button"
                        @click="openAdminInviteCard()"
                        class="py-2 px-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                      >
                        <Sparkles :size="13" />
                        <span>Tạo thiệp VIP</span>
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              <!-- KHÁCH MỜI GẦN ĐÂY (TOP 4) -->
              <section class="surface-card attendee-card">
                <div class="surface-heading">
                  <div>
                    <h2>Khách mời đăng ký gần đây</h2>
                    <p>Cập nhật lượt đăng ký và trạng thái vé mới nhất.</p>
                  </div>
                  <button class="secondary-button" @click="activePanel = 'attendees'">
                    Xem tất cả ({{ attendees.length }}) <ArrowRight :size="14" />
                  </button>
                </div>
                <div v-if="!attendees.length" class="empty-state compact">
                  <Users :size="24" />
                  <span>Chưa có khách đăng ký cho sự kiện này.</span>
                </div>
                <div v-else class="divide-y divide-slate-100">
                  <div
                    v-for="attendee in attendees.slice(0, 4)"
                    :key="attendee.registration_id"
                    class="p-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition"
                  >
                    <div>
                      <b class="text-xs font-bold text-slate-800 block">{{ attendee.full_name }}</b>
                      <span class="text-[11px] text-slate-500 font-mono">{{ attendee.phone || attendee.email }}</span>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      <span
                        class="status-pill text-[10px]"
                        :class="attendee.registration_status === 'APPROVED' ? 'status-green' : attendee.registration_status === 'REJECTED' ? 'status-gray' : 'status-amber'"
                      >
                        {{ attendee.registration_status === 'APPROVED' ? 'Đã duyệt' : attendee.registration_status === 'REJECTED' ? 'Từ chối' : 'Chờ duyệt' }}
                      </span>
                      <button
                        type="button"
                        @click="openAdminInviteCard(attendee)"
                        class="p-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold hover:bg-amber-100 cursor-pointer"
                        title="Tạo thiệp VIP"
                      >
                        <Sparkles :size="12" class="text-amber-600" />
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </template>

            <!-- ========================================== -->
            <!-- 2. TAB: THƯ MỜI & MÃ QR (INVITES) -->
            <!-- ========================================== -->
            <template v-else-if="activePanel === 'invites'">
              <div class="page-heading event-heading">
                <div>
                  <span class="eyebrow">KÊNH PHÁT HÀNH</span>
                  <h1>Thư mời & Mã QR Sự Kiện</h1>
                  <p>Chia sẻ link mời, xuất ảnh QR hoặc tạo thiệp VIP trang trọng gửi khách quý.</p>
                </div>
                <div class="event-picker-wrap">
                  <CalendarDays :size="17" />
                  <select
                    :value="selectedEvent.id"
                    @change="loadEventDetails(events.find((event) => event.id === Number(($event.target as HTMLSelectElement).value)))"
                  >
                    <option v-for="event in events" :key="event.id" :value="event.id">{{ event.name }}</option>
                  </select>
                  <ChevronDown :size="15" />
                </div>
              </div>

              <!-- THẺ HERO MÃ QR & LINK MỜI CAO CẤP -->
              <section class="card p-4 sm:p-6 bg-gradient-to-br from-white via-slate-50 to-indigo-50/50 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
                <div class="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div class="flex items-center gap-2">
                    <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-50 border border-primary-200 text-primary-700 text-xs font-bold">
                      <Sparkles :size="13" class="text-primary-600" />
                      Mã QR & Link Mời Chính Thức
                    </span>
                  </div>

                  <button
                    type="button"
                    @click="showTenantInviteModal = true"
                    class="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                  >
                    <Plus :size="14" />
                    <span>Tạo link mới</span>
                  </button>
                </div>

                <div class="grid sm:grid-cols-[170px_1fr] gap-4 items-center">
                  <!-- QR Code Centerpiece -->
                  <div class="flex flex-col items-center gap-2.5 p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                    <div
                      @click="showTenantZoomQrModal = true"
                      class="relative p-1 bg-white rounded-xl cursor-pointer hover:scale-102 transition group"
                      title="Chạm để phóng to mã QR"
                    >
                      <img
                        v-if="tenantInviteQrUrl"
                        :src="tenantInviteQrUrl"
                        alt="Mã QR Mời"
                        class="w-32 h-32 sm:w-36 sm:h-36 object-contain rounded-lg"
                      />
                      <div v-else class="w-32 h-32 sm:w-36 sm:h-36 flex flex-col items-center justify-center text-slate-400 text-xs text-center p-2">
                        <span v-if="loadingTenantInvites">Đang tạo QR...</span>
                        <button v-else type="button" @click.stop="selectedEvent?.id && loadTenantEventInvites(selectedEvent.id)" class="text-primary-600 font-bold underline">
                          Tạo QR ngay
                        </button>
                      </div>
                      <div v-if="tenantInviteQrUrl" class="absolute inset-0 bg-primary-900/60 rounded-xl opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold gap-1 pointer-events-none">
                        <Maximize2 :size="14" /> Phóng to
                      </div>
                    </div>

                    <div class="flex items-center gap-1.5 w-full">
                      <button
                        type="button"
                        @click="showTenantZoomQrModal = true"
                        :disabled="!tenantInviteQrUrl"
                        class="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                      >
                        <Maximize2 :size="12" /> Phóng to
                      </button>
                      <a
                        v-if="tenantInviteQrUrl"
                        :href="tenantInviteQrUrl"
                        :download="`QR-${selectedEvent?.name || 'sukien'}.png`"
                        class="flex-1 py-1.5 px-2 bg-primary-50 hover:bg-primary-100 text-primary-700 border border-primary-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition text-center cursor-pointer"
                      >
                        <Download :size="12" /> Tải về
                      </a>
                    </div>
                  </div>

                  <!-- Link Box & Features -->
                  <div class="space-y-3">
                    <div>
                      <span class="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
                        Đường link mời chính thức
                      </span>
                      <div class="flex items-center gap-2 p-1 bg-white border border-slate-200 rounded-2xl shadow-2xs">
                        <span class="pl-2.5 text-slate-400 shrink-0"><Link2 :size="15" /></span>
                        <input
                          readonly
                          :value="tenantActiveInviteLink?.invite_url || (loadingTenantInvites ? 'Đang tạo link mời...' : 'Đang lấy link...')"
                          class="flex-1 text-xs font-mono font-bold text-primary-700 bg-transparent border-0 outline-none select-all truncate py-1.5"
                        />
                        <button
                          type="button"
                          @click="copyTenantInviteLink()"
                          :disabled="!tenantActiveInviteLink?.invite_url"
                          class="px-3.5 py-2 rounded-xl bg-primary-700 hover:bg-primary-800 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 transition cursor-pointer"
                        >
                          <Check v-if="copiedTenantInviteLink" :size="13" />
                          <Copy v-else :size="13" />
                          <span>{{ copiedTenantInviteLink ? 'Đã chép!' : 'Sao chép' }}</span>
                        </button>
                      </div>
                    </div>

                    <div class="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        @click="shareTenantInviteLink()"
                        :disabled="!tenantActiveInviteLink?.invite_url"
                        class="py-2.5 px-3 rounded-2xl bg-white border border-slate-200 hover:border-primary-300 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer"
                      >
                        <Share2 :size="14" class="text-primary-600" />
                        <span>Chia sẻ Zalo/SMS</span>
                      </button>

                      <button
                        type="button"
                        @click="openAdminInviteCard()"
                        class="py-2.5 px-3 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                      >
                        <Sparkles :size="14" />
                        <span>Tạo thiệp VIP</span>
                      </button>
                    </div>

                    <div class="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900">
                      <Sparkles :size="15" class="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <b>Mẹo:</b> Bấm <strong>Tạo thiệp VIP</strong> để hệ thống tự động sinh thiệp mời online trang trọng có tên khách và mã QR riêng gửi tặng từng đối tác, khách quý.
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Danh sách các link mời đã tạo -->
                <div v-if="tenantEventInvites.length > 1" class="pt-3 border-t border-slate-100">
                  <span class="text-xs font-bold text-slate-700 block mb-2">Tất cả các link mời của sự kiện này ({{ tenantEventInvites.length }} link):</span>
                  <div class="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-2xs">
                    <div v-for="link in tenantEventInvites" :key="link.id" class="p-3 flex items-center justify-between text-xs gap-3 hover:bg-slate-50 transition">
                      <div class="min-w-0">
                        <span class="font-bold text-slate-800">{{ link.referrer_name }}</span>
                        <span class="text-slate-400 text-[11px] ml-1.5 font-mono">#{{ link.token }}</span>
                      </div>
                      <div class="flex items-center gap-3 shrink-0">
                        <span class="text-[11px] text-slate-500 font-semibold">{{ link.total_registered || 0 }} khách đã đăng ký</span>
                        <button type="button" @click="copyTenantInviteLink(link.invite_url)" class="text-primary-600 font-bold hover:underline text-[11px] cursor-pointer">
                          Sao chép
                        </button>
                        <button type="button" @click="shareTenantInviteLink(link.invite_url)" class="text-slate-600 font-semibold hover:text-slate-900 text-[11px] cursor-pointer">
                          Chia sẻ
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </template>

            <!-- ========================================== -->
            <!-- 3. TAB: KHÁCH MỜI (ATTENDEES) -->
            <!-- ========================================== -->
            <template v-else-if="activePanel === 'attendees'">
              <div class="page-heading event-heading">
                <div>
                  <span class="eyebrow">QUẢN LÝ THAM DỰ</span>
                  <h1>Danh sách khách mời ({{ attendees.length }})</h1>
                  <p>Tra cứu thông tin, duyệt vé và theo dõi trạng thái check-in của từng khách.</p>
                </div>
                <div class="event-picker-wrap">
                  <CalendarDays :size="17" />
                  <select
                    :value="selectedEvent.id"
                    @change="loadEventDetails(events.find((event) => event.id === Number(($event.target as HTMLSelectElement).value)))"
                  >
                    <option v-for="event in events" :key="event.id" :value="event.id">{{ event.name }}</option>
                  </select>
                  <ChevronDown :size="15" />
                </div>
              </div>

              <section class="surface-card attendee-card">
                <div class="surface-heading space-y-3">
                  <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full">
                    <div class="search-box flex-1">
                      <Search :size="16" />
                      <input v-model="search" placeholder="Tìm theo tên, số điện thoại, mã vé..." />
                    </div>
                    <button class="secondary-button shrink-0" @click="exportAttendees">
                      <ArrowDownToLine :size="16" />Xuất Excel/CSV
                    </button>
                  </div>

                  <!-- TABS LỌC TRẠNG THÁI TOUCH-FRIENDLY CHO MOBILE -->
                  <div class="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs w-full">
                    <button
                      type="button"
                      @click="attendeeFilter = 'ALL'"
                      class="px-3 py-1.5 rounded-full font-bold transition whitespace-nowrap cursor-pointer shrink-0"
                      :class="attendeeFilter === 'ALL' ? 'bg-primary-700 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
                    >
                      Tất cả ({{ attendees.length }})
                    </button>

                    <button
                      type="button"
                      @click="attendeeFilter = 'PENDING'"
                      class="px-3 py-1.5 rounded-full font-bold transition whitespace-nowrap cursor-pointer shrink-0"
                      :class="attendeeFilter === 'PENDING' ? 'bg-amber-500 text-white shadow-xs' : 'bg-amber-50 text-amber-700 border border-amber-200'"
                    >
                      Chờ duyệt ({{ pendingCount }})
                    </button>

                    <button
                      type="button"
                      @click="attendeeFilter = 'APPROVED'"
                      class="px-3 py-1.5 rounded-full font-bold transition whitespace-nowrap cursor-pointer shrink-0"
                      :class="attendeeFilter === 'APPROVED' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'"
                    >
                      Đã duyệt vé ({{ approvedCount }})
                    </button>

                    <button
                      type="button"
                      @click="attendeeFilter = 'USED'"
                      class="px-3 py-1.5 rounded-full font-bold transition whitespace-nowrap cursor-pointer shrink-0"
                      :class="attendeeFilter === 'USED' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'"
                    >
                      Đã vào cổng ({{ checkedInCount }})
                    </button>
                  </div>
                </div>

                <div v-if="!filteredAttendees.length" class="empty-state compact py-10">
                  <Users :size="28" />
                  <span>Không tìm thấy khách mời phù hợp với bộ lọc.</span>
                </div>
                <div v-else>
                  <!-- Giao diện Mobile cho Khách Mời (Thẻ Cards hiện đại) -->
                  <div class="sm:hidden divide-y divide-slate-100 p-2 space-y-2">
                    <div
                      v-for="attendee in filteredAttendees"
                      :key="attendee.registration_id"
                      class="p-3.5 space-y-2.5 bg-white rounded-2xl border border-slate-200 shadow-2xs"
                    >
                      <div class="flex items-start justify-between gap-2">
                        <div>
                          <b class="text-sm font-bold text-slate-900 block">{{ attendee.full_name }}</b>
                          <span class="text-xs text-slate-500 font-mono">{{ attendee.phone || attendee.email }}</span>
                        </div>
                        <span
                          class="status-pill text-[10px]"
                          :class="attendee.registration_status === 'APPROVED' ? 'status-green' : attendee.registration_status === 'REJECTED' ? 'status-gray' : 'status-amber'"
                        >
                          {{ attendee.registration_status === 'APPROVED' ? 'Đã duyệt' : attendee.registration_status === 'REJECTED' ? 'Từ chối' : attendee.registration_status === 'PENDING_ADMIN' ? 'Chờ BTC duyệt' : 'Đang chờ' }}
                        </span>
                      </div>

                      <div class="flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-2 rounded-xl">
                        <span>Mã vé: <code class="font-mono font-bold text-primary-700">{{ attendee.ticket_code || 'Chưa có' }}</code></span>
                        <span v-if="attendee.ticket_status === 'USED'" class="text-indigo-600 font-bold text-[11px] flex items-center gap-1">
                          <Check :size="12" /> Đã vào cổng
                        </span>
                        <span v-else class="text-slate-400 text-[11px]">Chưa check-in</span>
                      </div>

                      <div class="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          class="px-2.5 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 font-bold text-xs flex items-center gap-1 cursor-pointer"
                          title="Tạo thiệp VIP gửi khách này"
                          @click="openAdminInviteCard(attendee)"
                        >
                          <Sparkles :size="12" class="text-amber-600" />
                          <span>Thiệp VIP</span>
                        </button>
                        <button
                          v-if="attendee.registration_status === 'PENDING' || attendee.registration_status === 'PENDING_ADMIN'"
                          type="button"
                          class="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 font-bold text-xs cursor-pointer"
                          @click="rejectTenantAttendee(attendee)"
                        >
                          Từ chối
                        </button>
                        <button
                          v-if="attendee.registration_status === 'PENDING' || attendee.registration_status === 'PENDING_ADMIN'"
                          type="button"
                          class="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-xs cursor-pointer"
                          @click="approveTenantAttendee(attendee.registration_id)"
                        >
                          Duyệt vé
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Desktop Table -->
                  <div class="hidden sm:block table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Khách mời</th>
                          <th>Người giới thiệu</th>
                          <th>Trạng thái đăng ký</th>
                          <th>Vé QR</th>
                          <th>Check-in</th>
                          <th>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="attendee in filteredAttendees"
                          :key="attendee.registration_id"
                        >
                          <td><b>{{ attendee.full_name }}</b><small>{{ attendee.email }} · {{ attendee.phone }}</small></td>
                          <td>{{ attendee.referrer_name || '—' }}</td>
                          <td>
                            <span class="status-pill" :class="attendee.registration_status === 'APPROVED' ? 'status-green' : attendee.registration_status === 'REJECTED' ? 'status-gray' : 'status-amber'">
                              {{ attendee.registration_status === 'APPROVED' ? 'Đã duyệt' : attendee.registration_status === 'REJECTED' ? 'Từ chối' : attendee.registration_status === 'PENDING_ADMIN' ? 'Chờ BTC duyệt' : 'Đang chờ' }}
                            </span>
                          </td>
                          <td><code>{{ attendee.ticket_code || 'Chưa phát hành' }}</code></td>
                          <td>
                            <span v-if="attendee.ticket_status === 'USED'" class="checked-state"><Check :size="14" />Đã vào cổng</span>
                            <span v-else class="muted">Chưa check-in</span>
                          </td>
                          <td>
                            <div class="flex items-center gap-1.5">
                              <button
                                type="button"
                                class="px-2 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[10px] hover:bg-amber-100 flex items-center gap-1 cursor-pointer"
                                title="Tạo thiệp VIP gửi khách này"
                                @click="openAdminInviteCard(attendee)"
                              >
                                <Sparkles :size="11" class="text-amber-600" />
                                <span>Thiệp VIP</span>
                              </button>
                              <template v-if="attendee.registration_status === 'PENDING' || attendee.registration_status === 'PENDING_ADMIN'">
                                <button
                                  type="button"
                                  class="px-2.5 py-1 rounded-md bg-emerald-600 text-white font-bold text-[10px] hover:bg-emerald-700 cursor-pointer"
                                  @click="approveTenantAttendee(attendee.registration_id)"
                                >
                                  Duyệt vé
                                </button>
                                <button
                                  type="button"
                                  class="px-2 py-1 rounded-md bg-rose-50 text-rose-600 border border-rose-200 font-bold text-[10px] hover:bg-rose-100 cursor-pointer"
                                  @click="rejectTenantAttendee(attendee)"
                                >
                                  Từ chối
                                </button>
                              </template>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </template>
          </template>
        </template>
      </div>
    </main>

    <!-- THANH ĐIỀU HƯỚNG DƯỚI CÙNG TRÊN MOBILE CHO BAN TỔ CHỨC (TENANT ADMIN) -->
    <nav class="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 flex items-center justify-around py-1.5 px-2 shadow-lg pb-safe">
      <button
        type="button"
        @click="activePanel = 'overview'"
        class="flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition cursor-pointer"
        :class="activePanel === 'overview' ? 'text-primary-700 bg-primary-50/80 font-bold' : 'text-slate-500 hover:text-slate-800 font-medium'"
      >
        <CalendarDays :size="18" />
        <span class="text-[10px] mt-0.5">Tổng quan</span>
      </button>

      <button
        type="button"
        @click="activePanel = 'invites'"
        class="flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition cursor-pointer"
        :class="activePanel === 'invites' ? 'text-amber-700 bg-amber-50/80 font-bold' : 'text-slate-500 hover:text-slate-800 font-medium'"
      >
        <Sparkles :size="18" />
        <span class="text-[10px] mt-0.5">Thư mời</span>
      </button>

      <button
        type="button"
        @click="activePanel = 'attendees'"
        class="flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition cursor-pointer relative"
        :class="activePanel === 'attendees' ? 'text-sky-700 bg-sky-50/80 font-bold' : 'text-slate-500 hover:text-slate-800 font-medium'"
      >
        <Users :size="18" />
        <span class="text-[10px] mt-0.5">Khách mời</span>
        <span v-if="attendees.length" class="absolute top-0 right-1.5 px-1 py-0.2 bg-primary-600 text-white rounded-full text-[9px] font-mono leading-none">
          {{ attendees.length }}
        </span>
      </button>

      <button
        type="button"
        @click="stopScanner(); activePanel = 'team'"
        class="flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition cursor-pointer"
        :class="activePanel === 'team' ? 'text-purple-700 bg-purple-50/80 font-bold' : 'text-slate-500 hover:text-slate-800 font-medium'"
      >
        <ShieldCheck :size="18" />
        <span class="text-[10px] mt-0.5">Đội ngũ</span>
      </button>

      <button
        type="button"
        @click="selectedScannerEventId = selectedEvent?.id || scannerEvents[0]?.id || null; activePanel = 'scanner'"
        class="flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition cursor-pointer"
        :class="activePanel === 'scanner' ? 'text-emerald-700 bg-emerald-50/80 font-bold' : 'text-slate-500 hover:text-slate-800 font-medium'"
      >
        <Camera :size="18" />
        <span class="text-[10px] mt-0.5">Soát vé</span>
      </button>
    </nav>

    <div v-if="showMemberModal" class="modal-scrim" @click.self="showMemberModal = false">
      <div class="modal-card" style="max-width: 540px;">
        <button type="button" class="modal-close" @click="showMemberModal = false"><X :size="18" /></button>
        <span class="eyebrow">ĐỘI NGŨ ĐƠN VỊ</span>
        <h2>Thêm nhân sự</h2>
        <p class="muted">Tìm email nhân viên đã có tài khoản trên hệ thống hoặc cấp mới tài khoản.</p>

        <!-- Tabs: Tìm theo Email / Cấp mới -->
        <div style="display: flex; gap: 8px; margin: 16px 0; background: #f1f5f9; padding: 4px; border-radius: 10px;">
          <button
            type="button"
            :style="{
              flex: 1,
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: memberTab === 'search' ? '#ffffff' : 'transparent',
              color: memberTab === 'search' ? '#0f172a' : '#64748b',
              boxShadow: memberTab === 'search' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
            }"
            @click="memberTab = 'search'"
          >
            🔍 Tìm theo Email / SĐT
          </button>
          <button
            type="button"
            :style="{
              flex: 1,
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: memberTab === 'create' ? '#ffffff' : 'transparent',
              color: memberTab === 'create' ? '#0f172a' : '#64748b',
              boxShadow: memberTab === 'create' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
            }"
            @click="memberTab = 'create'"
          >
            ➕ Cấp tài khoản mới
          </button>
        </div>

        <!-- SEARCH TAB -->
        <div v-if="memberTab === 'search'">
          <label class="control-label">Nhập Email, Số điện thoại hoặc Tên nhân sự</label>
          <div style="position: relative; margin-bottom: 12px;">
            <input
              v-model="staffSearchTerm"
              type="text"
              class="text-control"
              placeholder="VD: nhanvien@gmail.com, 0988..."
              autofocus
              @input="onStaffSearchInput"
            />
            <Loader2 v-if="isSearchingStaff" class="spin" style="position: absolute; right: 12px; top: 12px; width: 18px; height: 18px; color: #64748b;" />
          </div>

          <!-- Results list -->
          <div v-if="staffSearchResults.length > 0" style="max-height: 260px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;">
            <div
              v-for="u in staffSearchResults"
              :key="u.id"
              style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 10px; background: #fafafa;"
            >
              <div style="min-width: 0; flex: 1;">
                <div style="font-weight: 600; color: #0f172a; font-size: 14px;">{{ u.name }}</div>
                <div style="font-size: 12px; color: #64748b; display: flex; gap: 8px; align-items: center; margin-top: 2px;">
                  <span>✉ {{ u.email }}</span>
                  <span v-if="u.phone">📞 {{ u.phone }}</span>
                </div>
              </div>

              <div>
                <span v-if="u.is_already_member" style="font-size: 12px; color: #16a34a; font-weight: 600; background: #dcfce7; padding: 4px 8px; border-radius: 6px;">
                  ✓ Đã trong đội ngũ
                </span>
                <button
                  v-else
                  type="button"
                  class="primary-button"
                  style="padding: 6px 12px; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;"
                  :disabled="saving"
                  @click="addExistingStaff(u)"
                >
                  <Plus :size="14" /> Thêm ngay
                </button>
              </div>
            </div>
          </div>

          <div v-else-if="staffSearchTerm.trim().length >= 2 && !isSearchingStaff" style="padding: 24px 12px; text-align: center; color: #64748b; font-size: 13px; background: #f8fafc; border-radius: 8px; margin-bottom: 16px;">
            Không tìm thấy người dùng nào khớp với "{{ staffSearchTerm }}".
            <div style="margin-top: 10px;">
              <button
                type="button"
                class="secondary-button"
                style="padding: 6px 14px; font-size: 12px;"
                @click="memberTab = 'create'; memberForm.email = staffSearchTerm"
              >
                👉 Cấp tài khoản mới cho email này
              </button>
            </div>
          </div>

          <div v-else style="padding: 16px; text-align: center; color: #94a3b8; font-size: 13px;">
            Nhập ít nhất 2 ký tự email để tra cứu nhân sự có sẵn trong hệ thống.
          </div>
        </div>

        <!-- CREATE NEW TAB -->
        <form v-else @submit.prevent="addTeamMember">
          <label class="control-label">Họ tên nhân sự</label>
          <input v-model="memberForm.name" required class="text-control" placeholder="Nguyễn Văn A" />
          <label class="control-label">Email đăng nhập</label>
          <input v-model="memberForm.email" type="email" required class="text-control" placeholder="nhansu@email.com" />
          <label class="control-label">Số điện thoại</label>
          <input v-model="memberForm.phone" class="text-control" placeholder="0912..." />
          <label class="control-label">Mật khẩu tạm (ít nhất 8 ký tự)</label>
          <input v-model="memberForm.password" type="text" minlength="8" required class="text-control" placeholder="Tối thiểu 8 ký tự" />
          <div style="margin-top: 16px;">
            <button class="primary-button full-button" :disabled="saving">
              {{ saving ? 'Đang tạo...' : 'Tạo & Cấp tài khoản' }}<ArrowRight :size="16" />
            </button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="showAssignmentModal" class="modal-scrim" @click.self="showAssignmentModal = false">
      <form class="modal-card" @submit.prevent="assignMember">
        <button type="button" class="modal-close" @click="showAssignmentModal = false"><X :size="18" /></button>
        <span class="eyebrow">{{ selectedEvent?.name }}</span>
        <h2>Phân công nhân sự</h2>
        <p class="muted">Chọn nhiệm vụ sẽ hiển thị trong quyền của nhân sự ở sự kiện này.</p>
        <div v-if="errorMessage" class="error-banner" style="margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
          <AlertTriangle :size="16" class="shrink-0 text-rose-500" />
          <span style="font-size: 13px; color: #e11d48; font-weight: 500;">{{ errorMessage }}</span>
        </div>
        <label class="control-label">Nhân sự</label>
        <select v-model="assignment.staff_id" required class="text-control">
          <option value="" disabled>Chọn nhân sự</option>
          <option v-for="member in unassignedTeam" :key="member.id" :value="String(member.id)">
            {{ member.name }} · {{ member.email }}
          </option>
        </select>
        <label class="control-label">Nhiệm vụ</label>
        <select v-model="assignment.role" class="text-control">
          <option value="INVITER">Mời khách</option>
          <option value="APPROVER">Duyệt khách</option>
          <option value="SCANNER">Quét QR check-in</option>
          <option value="REPORTER">Xem báo cáo</option>
          <option value="MANAGER">Quản lý toàn bộ sự kiện</option>
        </select>
        <label v-if="['INVITER', 'MANAGER'].includes(assignment.role)" class="control-label">
          Hạn mức khách mời
          <input v-model.number="assignment.max_invites" type="number" min="0" class="text-control" />
        </label>
        <button class="primary-button full-button" :disabled="saving || !unassignedTeam.length">
          {{ saving ? 'Đang lưu...' : 'Lưu phân công' }}<ArrowRight :size="16" />
        </button>
        <p v-if="!unassignedTeam.length" class="muted">Tất cả nhân sự hiện có đã được gán vào sự kiện.</p>
      </form>
    </div>
  </div>

  <!-- MODAL: KHỞI TẠO SỰ KIỆN MỚI (REDESIGNED) -->
  <div v-if="showEventModal" class="modal-scrim" @click.self="showEventModal = false">
    <div class="modal-card event-create-modal">
      <div class="modal-header-modern">
        <div class="flex items-center gap-3">
          <div class="modal-icon-badge">
            <CalendarDays :size="24" />
          </div>
          <div>
            <span class="modal-eyebrow">TỔ CHỨC SỰ KIỆN MỚI</span>
            <h2 class="modal-title">Khởi tạo sự kiện</h2>
          </div>
        </div>
        <button type="button" class="modal-close-modern" @click="showEventModal = false">
          <X :size="19" />
        </button>
      </div>

      <p class="modal-subtitle">
        Lựa chọn gói dịch vụ để xác định quy mô khách tham gia và phân bổ nhân sự cho sự kiện của bạn.
      </p>

      <form @submit.prevent="createEvent" class="modern-form space-y-5">
        <!-- BƯỚC 1: CHỌN GÓI SỰ KIỆN -->
        <div class="form-section">
          <div class="form-section-title">
            <span class="step-num">1</span>
            <span>Chọn gói tổ chức sự kiện</span>
          </div>

          <div class="package-selection-grid">
            <!-- Option Gói dùng thử -->
            <label
              v-if="Number(usage?.free_events_remaining) > 0 && usage?.trial_package"
              class="pkg-card"
              :class="{ 'pkg-card-selected': eventForm.event_package_id === 'trial' }"
            >
              <input type="radio" value="trial" v-model="eventForm.event_package_id" @change="eventForm.capacity = selectedPackageMaxAttendees" class="sr-only" />
              <div class="pkg-header">
                <span class="pkg-tag-free">🎁 Miễn phí</span>
                <span class="pkg-price-free">0 ₫</span>
              </div>
              <div class="pkg-name">{{ usage.trial_package.name }}</div>
              <div class="pkg-stats">
                <span>👥 {{ usage.trial_package.max_attendees }} khách tối đa</span>
                <span>👤 {{ usage.trial_package.max_employees }} nhân sự</span>
                <span>🔍 {{ usage.trial_package.max_scanners }} soát vé</span>
              </div>
              <div class="pkg-badge-remaining">Còn {{ usage.free_events_remaining }} sự kiện thử</div>
            </label>

            <!-- Option Gói đã mua trước -->
            <label
              v-for="pkg in usage?.available_packages || []"
              :key="'avail_' + pkg.id"
              class="pkg-card"
              :class="{ 'pkg-card-selected': eventForm.event_package_id === pkg.id }"
            >
              <input type="radio" :value="pkg.id" v-model="eventForm.event_package_id" @change="eventForm.capacity = selectedPackageMaxAttendees" class="sr-only" />
              <div class="pkg-header">
                <span class="pkg-tag-paid">Đã mua</span>
                <span class="pkg-price-paid">Sẵn sàng</span>
              </div>
              <div class="pkg-name">{{ pkg.name }}</div>
              <div class="pkg-stats">
                <span>👥 {{ pkg.max_attendees }} khách</span>
                <span>👤 {{ pkg.max_employees }} nhân sự</span>
                <span>🔍 {{ pkg.max_scanners }} soát vé</span>
              </div>
            </label>

            <!-- Option Các gói mở bán -->
            <label
              v-for="plan in plans.filter(p => !p.is_trial && Number(p.price_vnd) > 0)"
              :key="'plan_' + plan.id"
              class="pkg-card"
              :class="{ 'pkg-card-selected': eventForm.event_package_id === 'plan_' + plan.id }"
            >
              <input type="radio" :value="'plan_' + plan.id" v-model="eventForm.event_package_id" @change="eventForm.capacity = selectedPackageMaxAttendees" class="sr-only" />
              <div class="pkg-header">
                <span class="pkg-tag-buy">Gói mua mới</span>
                <span class="pkg-price-amount">{{ Number(plan.price_vnd).toLocaleString('vi-VN') }} ₫</span>
              </div>
              <div class="pkg-name">{{ plan.name }}</div>
              <div class="pkg-stats">
                <span>👥 {{ plan.max_attendees }} khách</span>
                <span>👤 {{ plan.max_employees }} nhân sự</span>
                <span>🔍 {{ plan.max_scanners }} soát vé</span>
              </div>
              <div class="pkg-note-payment">⚡ Quét VietQR sau khi tạo</div>
            </label>
          </div>
        </div>

        <!-- BƯỚC 2: THÔNG TIN SỰ KIỆN -->
        <div class="form-section">
          <div class="form-section-title">
            <span class="step-num">2</span>
            <span>Thông tin chi tiết sự kiện</span>
          </div>

          <div class="space-y-3.5">
            <div>
              <label class="modern-label">Tên sự kiện <span class="required">*</span></label>
              <div class="modern-input-wrap">
                <Tag :size="16" class="input-icon-left" />
                <input v-model="eventForm.name" required class="modern-input" placeholder="Ví dụ: Lễ Ra Mắt Sản Phẩm Mới 2026" />
              </div>
            </div>

            <div>
              <label class="modern-label">Địa điểm tổ chức <span class="required">*</span></label>
              <div class="modern-input-wrap">
                <MapPin :size="16" class="input-icon-left" />
                <input v-model="eventForm.location" required class="modern-input" placeholder="Ví dụ: Trung Tâm Hội Nghị Quốc Gia, Hà Nội" />
              </div>
            </div>

            <div>
              <label class="modern-label flex items-center justify-between">
                <span>Link Google Maps / Định vị chỉ đường</span>
                <span class="text-[11px] text-slate-400 font-normal">Tùy chọn</span>
              </label>
              <div class="modern-input-wrap">
                <Link2 :size="16" class="input-icon-left text-slate-400" />
                <input v-model="eventForm.map_url" class="modern-input" placeholder="Dán link Google Maps hoặc vị trí để khách bấm xem chỉ đường" />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="modern-label">Thời gian bắt đầu sự kiện <span class="required">*</span></label>
                <div class="modern-input-wrap">
                  <Clock3 :size="16" class="input-icon-left" />
                  <input v-model="eventForm.start_at" type="datetime-local" required class="modern-input" />
                </div>
              </div>
              <div>
                <label class="modern-label">Thời gian kết thúc sự kiện <span class="required">*</span></label>
                <div class="modern-input-wrap">
                  <Clock3 :size="16" class="input-icon-left" />
                  <input v-model="eventForm.end_at" type="datetime-local" required class="modern-input" />
                </div>
              </div>
            </div>

            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="modern-label mb-0">Hạn chót tiếp nhận đăng ký</label>
                <span class="text-[11px] text-slate-400 font-normal">Tự động đóng cổng khi hết hạn</span>
              </div>
              <div class="modern-input-wrap">
                <Clock :size="16" class="input-icon-left text-slate-400" />
                <input v-model="eventForm.registration_deadline" type="datetime-local" class="modern-input" />
              </div>
              <p class="text-[11px] text-slate-500 mt-1">
                Thời điểm hệ thống tự động khóa nhận đăng ký mới (mặc định nếu để trống sẽ tự động khóa khi sự kiện bắt đầu).
              </p>
            </div>

            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="modern-label mb-0">Số lượng khách tối đa (Sức chứa) <span class="required">*</span></label>
                <span class="text-[11px] font-bold text-primary-700 bg-primary-50 px-2.5 py-0.5 rounded-full border border-primary-200">
                  Tối đa của gói: {{ selectedPackageMaxAttendees }} khách
                </span>
              </div>
              <div class="modern-input-wrap">
                <Users :size="16" class="input-icon-left text-slate-400" />
                <input
                  v-model.number="eventForm.capacity"
                  type="number"
                  min="1"
                  :max="selectedPackageMaxAttendees"
                  required
                  class="modern-input font-bold text-slate-900"
                  :placeholder="`Nhập số khách tối đa (1 - ${selectedPackageMaxAttendees})`"
                />
              </div>
              <p class="text-[11px] text-slate-500 mt-1">
                Giới hạn số lượng khách đăng ký tối đa cho sự kiện này (không vượt quá hạn mức gói đã chọn: <b>{{ selectedPackageMaxAttendees }} người</b>).
              </p>
            </div>

            <div>
              <label class="modern-label">Mô tả sự kiện (không bắt buộc)</label>
              <textarea v-model="eventForm.description" class="modern-textarea" rows="2" placeholder="Ghi chú thêm về nội dung, trang phục hoặc lịch trình..."></textarea>
            </div>

            <div>
              <label class="modern-label flex items-center justify-between">
                <span>Link bài viết / Giới thiệu sự kiện</span>
                <span class="text-[11px] text-slate-400 font-normal">Tùy chọn</span>
              </label>
              <div class="modern-input-wrap">
                <Link2 :size="16" class="input-icon-left text-slate-400" />
                <input v-model="eventForm.info_url" class="modern-input" placeholder="Ví dụ: Link bài viết fanpage, website, tài liệu giới thiệu chương trình..." />
              </div>
            </div>

            <div>
              <label class="modern-label font-bold text-slate-700 mb-2 block">
                Quy trình phê duyệt vé:
              </label>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <label
                  :class="eventForm.approval_mode === 'REFERRER_ONLY' ? 'border-primary-500 bg-primary-50/70 ring-2 ring-primary-500 font-bold' : 'border-slate-200 hover:bg-slate-50'"
                  class="p-3 border rounded-xl cursor-pointer flex flex-col justify-between transition select-none"
                >
                  <div class="flex items-center gap-2 mb-1">
                    <input type="radio" value="REFERRER_ONLY" v-model="eventForm.approval_mode" class="accent-primary-600" />
                    <span class="text-xs text-slate-900 font-bold">1. Người mời duyệt</span>
                  </div>
                  <p class="text-[10px] text-slate-500 leading-relaxed font-normal">
                    Nhân viên giới thiệu duyệt là khách nhận vé QR ngay.
                  </p>
                </label>

                <label
                  :class="eventForm.approval_mode === 'TWO_TIER' ? 'border-amber-500 bg-amber-50/70 ring-2 ring-amber-500 font-bold' : 'border-slate-200 hover:bg-slate-50'"
                  class="p-3 border rounded-xl cursor-pointer flex flex-col justify-between transition select-none"
                >
                  <div class="flex items-center gap-2 mb-1">
                    <input type="radio" value="TWO_TIER" v-model="eventForm.approval_mode" class="accent-amber-600" />
                    <span class="text-xs text-slate-900 font-bold">2. Duyệt 2 cấp</span>
                  </div>
                  <p class="text-[10px] text-slate-500 leading-relaxed font-normal">
                    Người mời duyệt vòng 1 → Ban tổ chức duyệt cuối mới cấp vé QR.
                  </p>
                </label>

                <label
                  :class="eventForm.approval_mode === 'AUTO' ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500 font-bold' : 'border-slate-200 hover:bg-slate-50'"
                  class="p-3 border rounded-xl cursor-pointer flex flex-col justify-between transition select-none"
                >
                  <div class="flex items-center gap-2 mb-1">
                    <input type="radio" value="AUTO" v-model="eventForm.approval_mode" class="accent-emerald-600" />
                    <span class="text-xs text-slate-900 font-bold">3. Tự động cấp QR</span>
                  </div>
                  <p class="text-[10px] text-slate-500 leading-relaxed font-normal">
                    Khách đăng ký xong là hệ thống tự động xuất vé QR ngay.
                  </p>
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- BƯỚC 3: PHÂN CÔNG NHÂN SỰ & QUYỀN HẠN (CHỌN XEM NGƯỜI ĐÓ ĐƯỢC LÀM GÌ) -->
        <div class="form-section">
          <div class="form-section-title">
            <span class="step-num">3</span>
            <span>Phân công nhân sự & Quyền hạn (Chọn xem ai được làm gì)</span>
          </div>

          <div v-if="!team.length" class="text-xs text-slate-500 py-2">
            Chưa có nhân sự nào trong đội ngũ. Bạn có thể tạo thêm tài khoản nhân sự sau trong tab "Đội ngũ".
          </div>

          <div v-else class="space-y-2.5">
            <p class="text-[11px] text-slate-500 mb-2">
              Tick chọn nhân sự sẽ tham gia sự kiện và thiết lập quyền hạn cụ thể (Mời khách, Soát vé, Duyệt vé...):
            </p>
            <div
              v-for="member in staffAssignmentsDraft"
              :key="member.staff_id"
              class="p-3 bg-white border rounded-xl transition-all"
              :class="member.is_selected ? 'border-primary-500 bg-primary-50/20 shadow-xs' : 'border-slate-200'"
            >
              <div class="flex items-center justify-between gap-3">
                <label class="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                  <input type="checkbox" v-model="member.is_selected" class="rounded text-primary-600 focus:ring-primary-500 h-4 w-4" />
                  <div>
                    <div class="font-bold text-xs text-slate-900">{{ member.name }}</div>
                    <div class="text-[10px] text-slate-500">{{ member.email }}</div>
                  </div>
                </label>

                <div v-if="member.is_selected" class="flex items-center gap-2">
                  <select
                    v-model="member.role"
                    @change="onMemberRoleChange(member)"
                    class="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                  >
                    <option value="MANAGER">🌟 Quản lý toàn bộ</option>
                    <option value="INVITER">🎟️ Người mời khách</option>
                    <option value="APPROVER">📑 Người duyệt khách</option>
                    <option value="SCANNER">📷 Người soát vé QR</option>
                    <option value="REPORTER">📊 Xem báo cáo</option>
                    <option value="CUSTOM">⚙️ Tùy chỉnh quyền</option>
                  </select>
                </div>
              </div>

              <!-- Chi tiết quyền khi được tick chọn -->
              <div v-if="member.is_selected" class="mt-3 pt-2.5 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <label class="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" v-model="member.can_invite" class="rounded text-primary-600" />
                  <span>Mời khách</span>
                </label>
                <label class="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" v-model="member.can_approve" class="rounded text-primary-600" />
                  <span>Duyệt khách</span>
                </label>
                <label class="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" v-model="member.can_scan" class="rounded text-primary-600" />
                  <span>Soát vé QR</span>
                </label>
                <label class="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" v-model="member.can_view_report" class="rounded text-primary-600" />
                  <span>Xem báo cáo</span>
                </label>
                <div v-if="member.can_invite" class="col-span-2 sm:col-span-4 mt-1 flex items-center gap-2">
                  <span class="text-slate-500">Hạn mức vé mời:</span>
                  <input type="number" min="1" v-model.number="member.max_invites" class="w-16 p-1 bg-white border border-slate-200 rounded text-center text-xs font-bold" />
                  <span class="text-[10px] text-slate-400">vé</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Nút hành động -->
        <div class="modal-footer-modern">
          <button type="button" class="btn-cancel" @click="showEventModal = false">
            Hủy bỏ
          </button>
          <button
            type="submit"
            class="btn-submit"
            :disabled="saving || !eventForm.name || !eventForm.location || !eventForm.start_at || !eventForm.end_at || !eventForm.event_package_id"
          >
            <span v-if="saving">Đang khởi tạo...</span>
            <span v-else class="flex items-center gap-2">
              Khởi tạo sự kiện ngay <ArrowRight :size="17" />
            </span>
          </button>
        </div>
      </form>
    </div>
  </div>

  <!-- MODAL: CHỈNH SỬA THÔNG TIN & SỨC CHỨA SỰ KIỆN -->
  <div v-if="showEditEventModal" class="modal-scrim" @click.self="showEditEventModal = false">
    <div class="modal-card max-w-lg bg-white rounded-2xl p-6 shadow-2xl border border-slate-200">
      <div class="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
            <Edit3 :size="18" />
          </div>
          <div>
            <h3 class="font-black text-slate-900 text-base">Cập nhật thông tin sự kiện</h3>
            <p class="text-xs text-slate-500">Tùy chỉnh tên, sức chứa tối đa và quy trình duyệt</p>
          </div>
        </div>
        <button type="button" class="text-slate-400 hover:text-slate-700 cursor-pointer" @click="showEditEventModal = false">
          <X :size="18" />
        </button>
      </div>

      <form @submit.prevent="saveEditEvent" class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Tên sự kiện <span class="text-rose-500">*</span></label>
          <input v-model="editEventForm.name" required class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900" />
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Địa điểm tổ chức <span class="text-rose-500">*</span></label>
          <input v-model="editEventForm.location" required class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900" />
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Link Google Maps / Định vị chỉ đường (tùy chọn)</label>
          <input v-model="editEventForm.map_url" placeholder="Dán link Google Maps hoặc vị trí chỉ đường" class="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900" />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Thời gian bắt đầu sự kiện <span class="text-rose-500">*</span></label>
            <input v-model="editEventForm.start_at" type="datetime-local" required class="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Thời gian kết thúc sự kiện <span class="text-rose-500">*</span></label>
            <input v-model="editEventForm.end_at" type="datetime-local" required class="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900" />
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="block text-xs font-bold text-slate-700 mb-0">Hạn chót tiếp nhận đăng ký</label>
            <span class="text-[10px] text-slate-400">Tự động khóa cổng khi hết hạn</span>
          </div>
          <input v-model="editEventForm.registration_deadline" type="datetime-local" class="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900" />
          <p class="text-[10px] text-slate-500 mt-1">
            Hệ thống sẽ tự động đóng nhận đăng ký sau thời điểm này (nếu để trống sẽ tự đóng khi sự kiện bắt đầu).
          </p>
        </div>

        <!-- SỨC CHỨA TỐI ĐA -->
        <div class="p-3.5 bg-primary-50/60 border border-primary-100 rounded-xl space-y-1.5">
          <div class="flex items-center justify-between">
            <label class="block text-xs font-black text-slate-900">
              👥 Số lượng khách tối đa (Sức chứa)
            </label>
            <span class="text-[11px] font-bold text-primary-700 bg-white px-2 py-0.5 rounded-full border border-primary-200 shadow-2xs">
              Gói cho phép tối đa: {{ maxEditCapacity }} khách
            </span>
          </div>
          <div class="relative">
            <input
              v-model.number="editEventForm.capacity"
              type="number"
              min="1"
              :max="maxEditCapacity"
              required
              class="w-full p-2.5 bg-white border border-primary-200 rounded-xl text-sm font-black text-primary-800"
            />
          </div>
          <p class="text-[11px] text-slate-600">
            Hạn mức số lượng khách có thể nhận vé cho sự kiện này (tối đa theo gói: <b>{{ maxEditCapacity }} khách</b>).
          </p>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Mô tả sự kiện</label>
          <textarea v-model="editEventForm.description" rows="2" class="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700"></textarea>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Link bài viết / Giới thiệu sự kiện (tùy chọn)</label>
          <input v-model="editEventForm.info_url" placeholder="Ví dụ: Link bài viết fanpage, website, tài liệu..." class="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900" />
        </div>

        <div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button type="button" @click="showEditEventModal = false" class="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer">
            Hủy
          </button>
          <button type="submit" :disabled="saving" class="px-4 py-2 rounded-xl text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 shadow-xs cursor-pointer flex items-center gap-1.5">
            <Check :size="14" />
            <span>{{ saving ? 'Đang lưu...' : 'Lưu thay đổi' }}</span>
          </button>
        </div>
      </form>
    </div>
  </div>

  <!-- MODAL: THANH TOÁN VIETQR -->
  <div v-if="showPaymentModal" class="modal-scrim" @click.self="showPaymentModal = false">
    <div class="modal-card payment-modal-card">
      <div class="modal-header-modern">
        <div class="flex items-center gap-3">
          <div class="modal-icon-badge badge-amber">
            <CreditCard :size="24" />
          </div>
          <div>
            <span class="modal-eyebrow text-amber-600">THANH TOÁN GÓI DỊCH VỤ</span>
            <h2 class="modal-title">Quét mã VietQR để kích hoạt</h2>
          </div>
        </div>
        <button type="button" class="modal-close-modern" @click="showPaymentModal = false">
          <X :size="20" />
        </button>
      </div>

      <div class="payment-modal-body">
        <!-- Cột trái: Mã QR -->
        <div class="qr-col">
          <div class="qr-frame">
            <img
              :src="`https://img.vietqr.io/image/${paymentInfo.bank_code || 'MB'}-${paymentInfo.bank_account || '0386771868'}-${paymentInfo.bank_qr_template || 'compact2'}.png?amount=${paymentModalData?.amount || 0}&addInfo=${encodeURIComponent('TTSK ' + (paymentModalData?.eventId || ''))}&accountName=${encodeURIComponent(paymentInfo.bank_account_name || 'KTS QR EVENT')}`"
              alt="Mã VietQR thanh toán"
              class="vietqr-img"
            />
          </div>
          <p class="qr-hint">Mở app ngân hàng bất kỳ để quét mã chuyển khoản tức thì</p>
        </div>

        <!-- Cột phải: Thông tin chuyển khoản -->
        <div class="details-col">
          <div class="payment-summary-box">
            <div class="summary-row">
              <span class="summary-label">Sự kiện:</span>
              <strong class="summary-val">{{ paymentModalData?.eventName }}</strong>
            </div>
            <div class="summary-row">
              <span class="summary-label">Gói dịch vụ:</span>
              <span class="summary-val">{{ paymentModalData?.packageName }}</span>
            </div>
          </div>

          <div class="bank-info-box">
            <div class="bank-field">
              <span class="bf-label">Ngân hàng thụ hưởng:</span>
              <b class="bf-value">{{ paymentInfo.bank_name }} ({{ paymentInfo.bank_code }})</b>
            </div>

            <div class="bank-field">
              <span class="bf-label">Chủ tài khoản:</span>
              <b class="bf-value uppercase">{{ paymentInfo.bank_account_name }}</b>
            </div>

            <div class="bank-field highlight-field">
              <div>
                <span class="bf-label">Số tài khoản:</span>
                <b class="bf-value text-base font-mono tracking-wider">{{ paymentInfo.bank_account }}</b>
              </div>
              <button
                type="button"
                class="copy-pill"
                @click="copyToClipboard(paymentInfo.bank_account, 'account')"
              >
                <Check v-if="copiedKey === 'account'" :size="14" class="text-emerald-600" />
                <Copy v-else :size="14" />
                <span>{{ copiedKey === 'account' ? 'Đã chép' : 'Sao chép' }}</span>
              </button>
            </div>

            <div class="bank-field highlight-field">
              <div>
                <span class="bf-label">Số tiền thanh toán:</span>
                <b class="bf-value text-lg text-emerald-700 font-extrabold">{{ Number(paymentModalData?.amount || 0).toLocaleString('vi-VN') }} ₫</b>
              </div>
              <button
                type="button"
                class="copy-pill"
                @click="copyToClipboard(String(paymentModalData?.amount || 0), 'amount')"
              >
                <Check v-if="copiedKey === 'amount'" :size="14" class="text-emerald-600" />
                <Copy v-else :size="14" />
                <span>{{ copiedKey === 'amount' ? 'Đã chép' : 'Sao chép' }}</span>
              </button>
            </div>

            <div class="bank-field highlight-field field-content">
              <div>
                <span class="bf-label">Nội dung chuyển khoản (bắt buộc):</span>
                <b class="bf-value text-base text-primary-700 font-mono font-black">TTSK {{ paymentModalData?.eventId }}</b>
              </div>
              <button
                type="button"
                class="copy-pill"
                @click="copyToClipboard('TTSK ' + paymentModalData?.eventId, 'content')"
              >
                <Check v-if="copiedKey === 'content'" :size="14" class="text-emerald-600" />
                <Copy v-else :size="14" />
                <span>{{ copiedKey === 'content' ? 'Đã chép' : 'Sao chép' }}</span>
              </button>
            </div>
          </div>

          <div class="payment-notice">
            <span class="notice-icon">ℹ️</span>
            <span>Sau khi chuyển khoản, quản trị viên sẽ xác nhận và tự động kích hoạt sự kiện cho bạn.</span>
          </div>

          <button type="button" class="btn-submit full-button" @click="showPaymentModal = false">
            Tôi đã hoàn tất chuyển khoản
          </button>
        </div>
      </div>
    </div>

  </div>

  <!-- MODAL: GỬI BIÊN BẢN GIẢI TRÌNH TRANH CHẤP VÉ -->
  <div v-if="showDisputeModal" class="modal-scrim" @click.self="showDisputeModal = false">
    <div class="modal-card" style="max-width: 480px;">
      <div class="modal-header-modern">
        <div class="flex items-center gap-3">
          <div class="modal-icon-badge badge-amber">
            <Scale :size="22" />
          </div>
          <div>
            <span class="modal-eyebrow text-amber-600">XỬ LÝ VÉ ĐÃ QUÉT TRƯỚC ĐÓ</span>
            <h2 class="modal-title" style="font-size: 19px;">Gửi biên bản giải trình</h2>
          </div>
        </div>
        <button type="button" class="modal-close-modern" @click="showDisputeModal = false">
          <X :size="18" />
        </button>
      </div>

      <p class="text-xs text-slate-500 mb-3">
        Mã vé <b class="font-mono text-amber-700">{{ scannerResult?.ticket?.code }}</b> đã được quét lúc
        <b>{{ scannerResult?.ticket?.used_at ? new Date(scannerResult.ticket.used_at).toLocaleTimeString('vi-VN') : '' }}</b>.
        Ghi nhận thông tin khách đang đứng tại cổng để Ban tổ chức quyết định.
      </p>

      <form class="space-y-3" @submit.prevent="submitDisputeForm">
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Họ tên người đang xuất trình vé *</label>
          <input
            v-model="disputeForm.claimant_name"
            type="text"
            required
            placeholder="Nhập họ tên khách tại cổng..."
            class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Số điện thoại liên hệ *</label>
          <input
            v-model="disputeForm.claimant_phone"
            type="tel"
            required
            placeholder="0912..."
            class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Lý do giải trình / Xác minh tại cổng *</label>
          <div class="flex flex-wrap gap-1.5 mb-2">
            <button
              type="button"
              @click="disputeForm.explanation = 'Khách xuất trình CCCD/điện thoại chính chủ trùng khớp tên trên vé.'"
              class="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold cursor-pointer"
            >
              + Có CCCD chính chủ
            </button>
            <button
              type="button"
              @click="disputeForm.explanation = 'Nhân viên soát vé tại cổng vô tình quét đúp 2 lần liên tiếp.'"
              class="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold cursor-pointer"
            >
              + Nhân viên quét đúp 2 lần
            </button>
            <button
              type="button"
              @click="disputeForm.explanation = 'Nghi ngờ lộ ảnh chụp màn hình mã QR cho người khác vào trước.'"
              class="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold cursor-pointer"
            >
              + Nghi lộ ảnh QR
            </button>
          </div>
          <textarea
            v-model="disputeForm.explanation"
            rows="3"
            required
            placeholder="Mô tả tình huống tại cổng (VD: Khách có CCCD trùng tên đăng ký)..."
            class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          ></textarea>
        </div>

        <div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            @click="showDisputeModal = false"
            class="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="submit"
            :disabled="disputeSubmitting"
            class="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <Send :size="13" />
            <span>{{ disputeSubmitting ? 'Đang gửi...' : 'Gửi giải trình' }}</span>
          </button>
        </div>
      </form>
    </div>
  </div>

  <!-- MODAL: PHÓNG TO MÃ QR ĐỂ KHÁCH QUÉT TRỰC TIẾP TRÊN MOBILE -->
  <div v-if="showZoomQrModal" class="modal-scrim" @click.self="showZoomQrModal = false">
    <div class="modal-card max-w-sm w-full mx-4 text-center p-6 bg-white rounded-3xl shadow-2xl relative">
      <button
        type="button"
        class="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition cursor-pointer"
        @click="showZoomQrModal = false"
      >
        <X :size="18" />
      </button>

      <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-50 text-primary-700 text-xs font-bold mb-2">
        <Sparkles :size="13" />
        <span>Mã QR Mời Trực Tiếp</span>
      </div>

      <h3 class="text-base font-bold text-slate-900 mb-0.5">
        {{ staffSelectedEvent?.name || 'Sự kiện' }}
      </h3>
      <p class="text-[11px] text-slate-500 mb-4">
        Đưa điện thoại để khách quét camera trực tiếp hoặc quét bằng Zalo
      </p>

      <div class="bg-white p-3 rounded-2xl border-2 border-dashed border-primary-200 inline-block shadow-xs mb-4">
        <img
          v-if="staffInviteQrUrl"
          :src="staffInviteQrUrl"
          alt="QR Code Zoom"
          class="w-60 h-60 sm:w-64 sm:h-64 object-contain mx-auto"
        />
        <div v-else class="w-60 h-60 flex items-center justify-center text-slate-400 text-xs">
          Đang tạo mã QR...
        </div>
      </div>

      <div class="flex flex-col sm:flex-row gap-2">
        <a
          v-if="staffInviteQrUrl"
          :href="staffInviteQrUrl"
          :download="`QR-Moi-${staffSelectedEvent?.name || 'sukien'}.png`"
          class="btn btn-secondary flex-1 py-2.5 text-xs font-bold justify-center gap-1.5 cursor-pointer"
        >
          <Download :size="14" />
          <span>Lưu ảnh về máy</span>
        </a>
        <button
          type="button"
          @click="shareStaffInviteLink"
          class="btn btn-primary flex-1 py-2.5 text-xs font-bold justify-center gap-1.5 cursor-pointer"
        >
          <Share2 :size="14" />
          <span>Chia sẻ Zalo/SMS</span>
        </button>
      </div>
    </div>
  </div>

  <!-- MODAL: THIẾT KẾ & TẠO THƯ MỜI / THIỆP VIP ONLINE CHO ADMIN / BAN TỔ CHỨC -->
  <InviteCardModal
    :show="showAdminInviteCardModal"
    :cardData="adminCardData"
    @close="showAdminInviteCardModal = false"
  />

  <!-- MODAL: PHÓNG TO MÃ QR CỦA BAN TỔ CHỨC (ADMIN) -->
  <div v-if="showTenantZoomQrModal" class="modal-scrim" @click.self="showTenantZoomQrModal = false">
    <div class="modal-card max-w-sm w-full mx-4 text-center p-6 bg-white rounded-3xl shadow-2xl relative">
      <button
        type="button"
        class="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition cursor-pointer"
        @click="showTenantZoomQrModal = false"
      >
        <X :size="18" />
      </button>

      <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-50 text-primary-700 text-xs font-bold mb-2">
        <Sparkles :size="13" />
        <span>Mã QR Sự Kiện Chính Thức</span>
      </div>

      <h3 class="text-base font-bold text-slate-900 mb-0.5">
        {{ selectedEvent?.name || 'Sự kiện' }}
      </h3>
      <p class="text-[11px] text-slate-500 mb-4">
        Khách dùng Camera điện thoại hoặc Zalo để quét mã và đăng ký tham dự
      </p>

      <div class="bg-white p-3 rounded-2xl border-2 border-dashed border-primary-200 inline-block shadow-xs mb-4">
        <img
          v-if="tenantInviteQrUrl"
          :src="tenantInviteQrUrl"
          alt="QR Code Zoom"
          class="w-60 h-60 sm:w-64 sm:h-64 object-contain mx-auto"
        />
        <div v-else class="w-60 h-60 flex items-center justify-center text-slate-400 text-xs">
          Đang tạo mã QR...
        </div>
      </div>

      <div class="flex flex-col sm:flex-row gap-2">
        <a
          v-if="tenantInviteQrUrl"
          :href="tenantInviteQrUrl"
          :download="`QR-${selectedEvent?.name || 'sukien'}.png`"
          class="btn btn-secondary flex-1 py-2.5 text-xs font-bold justify-center gap-1.5 cursor-pointer"
        >
          <Download :size="14" />
          <span>Tải ảnh QR về máy</span>
        </a>
        <button
          type="button"
          @click="shareTenantInviteLink()"
          class="btn btn-primary flex-1 py-2.5 text-xs font-bold justify-center gap-1.5 cursor-pointer"
        >
          <Share2 :size="14" />
          <span>Chia sẻ Zalo/SMS</span>
        </button>
      </div>
    </div>
  </div>

  <!-- MODAL: TẠO THÊM LINK MỜI SỰ KIỆN CHO BAN TỔ CHỨC -->
  <div v-if="showTenantInviteModal" class="modal-scrim" @click.self="showTenantInviteModal = false">
    <div class="modal-card max-w-md w-full mx-4 p-6 bg-white rounded-3xl shadow-2xl relative">
      <button
        type="button"
        class="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition cursor-pointer"
        @click="showTenantInviteModal = false"
      >
        <X :size="18" />
      </button>

      <span class="text-[11px] font-bold uppercase tracking-wider text-primary-700 block mb-1">KÊNH MỜI KHÁCH</span>
      <h2 class="text-lg font-bold text-slate-900 mb-1">Tạo link mời & mã QR mới</h2>
      <p class="text-xs text-slate-500 mb-4">
        Tạo thêm đường link riêng cho chiến dịch truyền thông (Facebook, Zalo, Đối tác...)
      </p>

      <form @submit.prevent="handleCreateTenantInvite" class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Số lượng khách đăng ký tối đa qua link này</label>
          <input
            v-model.number="newInviteForm.max_registrations"
            type="number"
            min="1"
            max="10000"
            required
            class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <small class="text-[11px] text-slate-400">Ví dụ: 100, 500 hoặc 1000 khách</small>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Thời hạn hiệu lực của link (số ngày)</label>
          <input
            v-model.number="newInviteForm.expires_in_days"
            type="number"
            min="1"
            max="365"
            required
            class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <small class="text-[11px] text-slate-400">Mặc định: 60 ngày</small>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            @click="showTenantInviteModal = false"
            class="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="submit"
            :disabled="creatingInvite"
            class="btn btn-primary px-4 py-2 text-xs font-bold cursor-pointer"
          >
            {{ creatingInvite ? 'Đang tạo...' : 'Tạo link ngay' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.scanner-reticle-overlay {
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
}
.scanner-reticle-box {
  width: 210px;
  height: 210px;
  position: relative;
  border: 1.5px solid rgba(16, 185, 129, 0.45);
  border-radius: 16px;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.25);
}
.scanner-reticle-box .corner {
  position: absolute;
  width: 18px;
  height: 18px;
}
.scanner-reticle-box .top-left {
  top: -2px;
  left: -2px;
  border-top: 3px solid #10b981;
  border-left: 3px solid #10b981;
  border-top-left-radius: 8px;
}
.scanner-reticle-box .top-right {
  top: -2px;
  right: -2px;
  border-top: 3px solid #10b981;
  border-right: 3px solid #10b981;
  border-top-right-radius: 8px;
}
.scanner-reticle-box .bottom-left {
  bottom: -2px;
  left: -2px;
  border-bottom: 3px solid #10b981;
  border-left: 3px solid #10b981;
  border-bottom-left-radius: 8px;
}
.scanner-reticle-box .bottom-right {
  bottom: -2px;
  right: -2px;
  border-bottom: 3px solid #10b981;
  border-right: 3px solid #10b981;
  border-bottom-right-radius: 8px;
}
.feedback-warning {
  border-color: #fed7aa !important;
  background: #fffbeb !important;
}
.feedback-warning .feedback-mark {
  background: #fef3c7 !important;
  color: #d97706 !important;
}
.feedback-text {
  display: grid;
  gap: 3px;
  min-width: 0;
}
.feedback-text > b {
  color: #395363;
  font-size: 11px;
}
.feedback-text > span {
  color: #81919b;
  font-size: 10px;
  line-height: 1.4;
  word-break: break-word;
}
.feedback-warning .feedback-text > b {
  color: #92400e;
}
.feedback-warning .feedback-text > span {
  color: #b45309;
}
.feedback-success .feedback-text > b {
  color: #166534;
}
.feedback-success .feedback-text > span {
  color: #15803d;
}
.feedback-error .feedback-text > b {
  color: #991b1b;
}
.feedback-error .feedback-text > span {
  color: #b91c1c;
}

.package-heading {
  margin-top: 22px;
  border-top: 1px solid #e7edf1;
  padding-top: 15px;
}
.package-request-list {
  display: grid;
  gap: 6px;
  margin-top: 14px;
  border-top: 1px solid #e7edf1;
  padding-top: 12px;
  color: #607889;
  font-size: 11px;
}
.package-request-list p {
  margin: 0;
}
.package-summary {
  display: grid;
  gap: 5px;
  margin: 15px 0;
  padding: 13px;
  border: 1px solid #d9eee8;
  border-radius: 10px;
  background: #f2fbf8;
  color: #286754;
  font-size: 12px;
}
.trial-notice {
  margin: 0 0 15px;
  border: 1px solid #f2dfb8;
  background: #fffaf0;
  padding: 14px;
  color: #805e23;
  font-size: 12px;
}
.close-event-button {
  margin-top: 6px;
  border: 1px solid #e8cccc;
  border-radius: 7px;
  background: #fff;
  color: #9f4949;
  padding: 5px 8px;
  font-size: 9px;
  font-weight: 700;
}
.capacity-ring small {
  display: block;
  white-space: nowrap;
}
.sound-badge-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}
.sound-badge-btn.active {
  background: #ecfdf5;
  color: #059669;
  border: 1px solid #a7f3d0;
}
.sound-badge-btn.active:hover {
  background: #d1fae5;
}
.sound-badge-btn.muted {
  background: #f8fafc;
  color: #94a3b8;
  border: 1px solid #e2e8f0;
}
.sound-badge-btn.muted:hover {
  background: #f1f5f9;
}
</style>
