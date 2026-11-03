<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import axios from 'axios';
import { Html5Qrcode } from 'html5-qrcode';
import { Activity, ArrowDownToLine, ArrowRight, Building2, CalendarDays, Check, ChevronDown, CircleUserRound, Clock3, KeyRound, LogOut, Mail, MapPin, PackageCheck, Plus, QrCode, Search, ShieldCheck, TicketCheck, Trash2, Users, X } from 'lucide-vue-next';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api/v1' });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tenant_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const token = ref(localStorage.getItem('tenant_token') || '');
const user = ref<any>(JSON.parse(localStorage.getItem('tenant_user') || 'null'));
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
const activePanel = ref<'overview' | 'attendees' | 'team'>('overview');
const scannerEvents = ref<any[]>([]);
const selectedScannerEventId = ref<number | null>(null);
const scannerResult = ref<any>(null);
const scannerError = ref('');
const scannerRunning = ref(false);
const scanBusy = ref(false);
let qrScanner: Html5Qrcode | null = null;
const search = ref('');
const showMemberModal = ref(false);
const showAssignmentModal = ref(false);
const showEventModal = ref(false);
const saving = ref(false);
const eventForm = ref({ name: '', description: '', location: '', start_at: '', end_at: '', event_package_id: '' as number | string });
const memberForm = ref({ name: '', email: '', phone: '', password: '' });
const assignment = ref({ staff_id: '', role: 'INVITER', max_invites: 50 });

const filteredAttendees = computed(() => {
  const term = search.value.trim().toLowerCase();
  if (!term) return attendees.value;
  return attendees.value.filter((item) => [item.full_name, item.email, item.phone, item.referrer_name].some((value) => String(value || '').toLowerCase().includes(term)));
});
const unassignedTeam = computed(() => team.value.filter((member) => !eventTeam.value.some((assigned) => assigned.id === member.id)));
const approvedCount = computed(() => attendees.value.filter((item) => item.registration_status === 'APPROVED').length);
const checkedInCount = computed(() => attendees.value.filter((item) => item.ticket_status === 'USED').length);
const eventReferrerCount = computed(() => eventTeam.value.filter((member) => member.is_enabled && member.can_invite).length);
const eventScannerCount = computed(() => eventTeam.value.filter((member) => member.is_enabled && member.can_scan).length);
const eventEmployeeCount = computed(() => eventTeam.value.filter((member) => member.is_enabled).length);

const explainError = (error: any) => error.response?.data?.message || error.message || 'Có lỗi xảy ra. Vui lòng thử lại.';
const packageRequestStatus = (request: any) => request.status === 'PENDING'
  ? 'Đang chờ admin xác nhận'
  : request.status === 'APPROVED'
    ? 'Đã cấp, chưa sử dụng'
    : `Bị từ chối${request.review_note ? ` · ${request.review_note}` : ''}`;
const eventPackagePrice = (event: any) => event.is_trial
  ? 'Dùng thử'
  : `${Number(event.package_price_vnd).toLocaleString('vi-VN')} ₫`;

const loadPortal = async () => {
  loading.value = true;
  errorMessage.value = '';
  try {
    const [res, usageRes] = await Promise.all([
      api.get('/tenants/portal/events'), api.get('/tenants/portal/usage'),
    ]);
    events.value = res.data.data;
    usage.value = usageRes.data.data;
    if (Number(usage.value.free_events_used) >= Number(usage.value.free_event_limit)) {
      const planRes = await api.get('/subscriptions/plans');
      plans.value = planRes.data.data;
    } else {
      plans.value = [];
    }
    if (selectedEvent.value) {
      selectedEvent.value = events.value.find((item) => item.id === selectedEvent.value.id) || events.value[0] || null;
    } else {
      selectedEvent.value = events.value[0] || null;
    }
    if (selectedEvent.value) await loadEventDetails(selectedEvent.value);
    await loadTeam();
  } catch (error: any) {
    errorMessage.value = explainError(error);
    if (error.response?.status === 401 || error.response?.status === 403) logout();
  } finally {
    loading.value = false;
  }
};

const loadEventDetails = async (event: any) => {
  selectedEvent.value = event;
  activePanel.value = 'overview';
  try {
    const [attendeeRes, teamRes] = await Promise.all([
      api.get(`/tenants/portal/events/${event.id}/attendees`),
      api.get(`/tenants/portal/events/${event.id}/team`),
    ]);
    attendees.value = attendeeRes.data.data;
    eventTeam.value = teamRes.data.data;
  } catch (error: any) {
    errorMessage.value = explainError(error);
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
    const toMysqlDate = (value: string) => value ? `${value.replace('T', ' ')}:00` : '';
    const created = await api.post('/tenants/portal/events', {
      ...eventForm.value,
      start_at: toMysqlDate(eventForm.value.start_at),
      end_at: toMysqlDate(eventForm.value.end_at),
      event_package_id: Number(eventForm.value.event_package_id) || undefined,
    });
    selectedEvent.value = { id: created.data.data.id };
    eventForm.value = { name: '', description: '', location: '', start_at: '', end_at: '', event_package_id: '' };
    showEventModal.value = false;
    activePanel.value = 'overview';
    await loadPortal();
  } catch (error: any) {
    errorMessage.value = explainError(error);
    if (['EVENT_QUOTA_EXCEEDED', 'TRIAL_PACKAGE_UNAVAILABLE'].includes(error.response?.data?.code)) await loadPortal();
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
  if (!selectedEvent.value || !window.confirm(`Đóng sự kiện “${selectedEvent.value.name}”? Sự kiện và dữ liệu vẫn được lưu.`)) return;
  try {
    await api.post(`/tenants/portal/events/${selectedEvent.value.id}/close`);
    await loadPortal();
  } catch (error: any) {
    errorMessage.value = explainError(error);
  }
};

const openEventModal = (packageId?: number) => {
  eventForm.value.event_package_id = packageId || usage.value?.available_packages?.[0]?.id || '';
  showEventModal.value = true;
};

const login = async () => {
  loginBusy.value = true;
  errorMessage.value = '';
  try {
    const res = await api.post('/auth/login', { email: email.value.trim(), password: password.value });
    const account = res.data.data.user;
    const tenantAdmin = account.type === 'TENANT_ADMIN';
    const tenantScanner = account.type === 'STAFF' && account.tenant_id && account.permissions?.includes('tickets:scan');
    if (!tenantAdmin && !tenantScanner) throw new Error('Tài khoản này chưa được cấp quyền vào cổng khách thuê hoặc quét QR.');
    token.value = res.data.data.token;
    user.value = account;
    localStorage.setItem('tenant_token', token.value);
    localStorage.setItem('tenant_user', JSON.stringify(account));
    password.value = '';
    if (tenantScanner) {
      await loadScannerEvents();
      await nextTick();
      if (selectedScannerEventId.value) await startScanner();
    } else {
      await loadPortal();
    }
  } catch (error: any) {
    errorMessage.value = explainError(error);
  } finally {
    loginBusy.value = false;
  }
};

const logout = () => {
  stopScanner();
  token.value = '';
  user.value = null;
  localStorage.removeItem('tenant_token');
  localStorage.removeItem('tenant_user');
  events.value = [];
  selectedEvent.value = null;
};

const loadScannerEvents = async () => {
  try {
    const res = await api.get('/events?scope=active');
    scannerEvents.value = res.data.data.filter((event: any) => event.my_can_scan);
    selectedScannerEventId.value = scannerEvents.value[0]?.id || null;
    if (!scannerEvents.value.length) scannerError.value = 'Tài khoản chưa được phân công quét QR cho sự kiện đang mở.';
  } catch (error: any) {
    scannerError.value = explainError(error);
  }
};

const stopScanner = () => {
  if (!qrScanner) return;
  const scanner = qrScanner;
  qrScanner = null;
  scannerRunning.value = false;
  scanner.stop().catch(() => undefined).finally(() => scanner.clear());
};

const startScanner = async () => {
  if (scannerRunning.value || !selectedScannerEventId.value) return;
  scannerError.value = '';
  scannerResult.value = null;
  try {
    qrScanner = new Html5Qrcode('tenant-qr-reader');
    await qrScanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
      (decodedText) => submitScan(decodedText),
      () => undefined
    );
    scannerRunning.value = true;
  } catch (error: any) {
    scannerError.value = error.message || 'Không thể mở camera. Hãy cấp quyền camera cho trình duyệt.';
    qrScanner?.clear();
    qrScanner = null;
  }
};

const submitScan = async (code: string) => {
  if (scanBusy.value || !selectedScannerEventId.value) return;
  scanBusy.value = true;
  try {
    const res = await api.post('/check-in/scan', {
      code,
      event_id: selectedScannerEventId.value,
      device_info: navigator.userAgent.slice(0, 220),
    });
    scannerResult.value = res.data.data;
  } catch (error: any) {
    scannerResult.value = error.response?.data?.data || { result: 'INVALID', message: explainError(error) };
  } finally {
    window.setTimeout(() => (scanBusy.value = false), 1300);
  }
};

const addTeamMember = async () => {
  saving.value = true;
  errorMessage.value = '';
  try {
    await api.post('/tenants/portal/team', memberForm.value);
    memberForm.value = { name: '', email: '', phone: '', password: '' };
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
    await api.put(`/tenants/portal/events/${selectedEvent.value.id}/team/${assignment.value.staff_id}`, {
      staff_id: Number(assignment.value.staff_id), role: assignment.value.role,
      max_invites: Number(assignment.value.max_invites), is_enabled: true,
    });
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
  if (item.can_invite && item.can_approve && item.can_scan && item.can_view_report) return 'Quản lý sự kiện';
  if (item.can_invite) return 'Mời khách';
  if (item.can_approve) return 'Duyệt khách';
  if (item.can_scan) return 'Quét QR';
  if (item.can_view_report) return 'Xem báo cáo';
  return 'Chưa phân quyền';
};

const formatDate = (value: string) => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

const exportAttendees = () => {
  const headers = ['Họ tên', 'Email', 'Điện thoại', 'Trạng thái', 'Mã vé', 'Check-in'];
  const rows = filteredAttendees.value.map((item) => [item.full_name, item.email, item.phone, item.registration_status, item.ticket_code || '', item.ticket_status === 'USED' ? 'Đã check-in' : '']);
  const csv = [headers, ...rows].map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${selectedEvent.value?.name || 'khach-moi'}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
};

onMounted(async () => {
  if (!token.value) return;
  if (user.value?.type === 'STAFF') {
    await loadScannerEvents();
    await nextTick();
    if (selectedScannerEventId.value) await startScanner();
  } else {
    loadPortal();
  }
});
onBeforeUnmount(stopScanner);
</script>

<template>
  <div v-if="!token" class="login-shell">
    <section class="login-brand">
      <div class="brand-lockup"><span class="brand-icon"><QrCode :size="22" /></span><span>KTS<span>QR</span></span></div>
      <div class="brand-copy">
        <span class="eyebrow-light">CỔNG ĐIỀU HÀNH SỰ KIỆN</span>
        <h1>Sự kiện của bạn,<br /><em>vận hành mạch lạc.</em></h1>
        <p>Quản lý khách mời, phân công đội ngũ và theo dõi check-in QR trong một không gian dành riêng cho ban tổ chức.</p>
        <div class="brand-points"><span><ShieldCheck :size="17" />Vé QR một lần, chống quét trùng</span><span><Activity :size="17" />Số liệu check-in cập nhật trực tiếp</span></div>
      </div>
      <div class="brand-foot">KTSQR · Event operations platform</div>
    </section>
    <section class="login-panel">
      <form class="login-card" @submit.prevent="login">
        <span class="eyebrow">CỔNG KHÁCH THUÊ</span>
        <h2>Đăng nhập tài khoản</h2>
        <p class="muted">Nhập thông tin được cấp bởi quản trị viên.</p>
        <div v-if="errorMessage" class="error-box">{{ errorMessage }}</div>
        <label class="control-label">Email</label>
        <div class="input-icon"><Mail :size="18" /><input v-model="email" type="email" autocomplete="username" required placeholder="ban-to-chuc@congty.vn" /></div>
        <label class="control-label">Mật khẩu</label>
        <div class="input-icon"><KeyRound :size="18" /><input v-model="password" type="password" autocomplete="current-password" required placeholder="Nhập mật khẩu" /></div>
        <button class="primary-button full-button" :disabled="loginBusy">{{ loginBusy ? 'Đang đăng nhập...' : 'Vào không gian sự kiện' }}<ArrowRight :size="17" /></button>
        <p class="login-help">Cần hỗ trợ tài khoản? Liên hệ quản trị viên hệ thống.</p>
      </form>
    </section>
  </div>

  <div v-else-if="user?.type === 'STAFF'" class="scanner-shell">
    <header class="scanner-topbar"><a class="brand-lockup" href="#"><span class="brand-icon"><QrCode :size="21" /></span><span>KTS<span>QR</span></span></a><div class="scanner-heading"><span class="eyebrow">CỔNG CHECK-IN</span><b>{{ scannerEvents.find((event) => event.id === selectedScannerEventId)?.name || 'Sự kiện được phân công' }}</b></div><button class="scanner-logout" @click="logout"><LogOut :size="16" />Đăng xuất</button></header>
    <main class="scanner-content"><div class="scanner-intro"><span class="eyebrow">XÁC THỰC VÉ QR</span><h1>Quét vé vào cổng</h1><p>Đưa mã QR vào khung hình. Hệ thống sẽ xác nhận vé và ghi nhận check-in.</p></div><div v-if="scannerEvents.length" class="scanner-event-select"><CalendarDays :size="17" /><select v-model.number="selectedScannerEventId" @change="scannerResult = null"><option v-for="event in scannerEvents" :key="event.id" :value="event.id">{{ event.name }}</option></select><ChevronDown :size="15" /></div><section class="scanner-card"><div class="scanner-camera"><div id="tenant-qr-reader"></div><div v-if="!scannerRunning" class="camera-placeholder"><QrCode :size="37" /><b>Camera sẵn sàng</b><span>Cho phép truy cập camera để bắt đầu quét vé.</span><button class="primary-button" :disabled="!selectedScannerEventId" @click="startScanner">Bật camera</button></div></div><div class="scanner-feedback" :class="scannerResult?.result === 'SUCCESS' ? 'feedback-success' : scannerResult ? 'feedback-error' : ''"><div class="feedback-mark"><Check v-if="scannerResult?.result === 'SUCCESS'" :size="22" /><X v-else-if="scannerResult" :size="22" /><QrCode v-else :size="22" /></div><div><b>{{ scannerResult?.result === 'SUCCESS' ? 'Vé hợp lệ · Đã check-in' : scannerResult ? (scannerResult.result === 'ALREADY_USED' ? 'Vé đã được sử dụng' : 'Không xác nhận được vé') : 'Sẵn sàng quét' }}</b><span>{{ scannerResult?.message || scannerResult?.attendee?.full_name || 'Phản hồi check-in sẽ hiển thị tại đây.' }}</span></div><span v-if="scanBusy" class="scan-progress"></span></div><div v-if="scannerError" class="error-box">{{ scannerError }}</div><button v-if="scannerRunning" class="secondary-button stop-camera" @click="stopScanner">Tắt camera</button></section><p class="scanner-footnote"><ShieldCheck :size="15" />Mỗi vé QR chỉ được check-in thành công một lần.</p></main>
  </div>

  <div v-else class="app-shell">
    <aside class="sidebar">
      <a class="brand-lockup sidebar-brand" href="#"><span class="brand-icon"><QrCode :size="21" /></span><span>KTS<span>QR</span></span></a>
      <div class="sidebar-caption">KHÔNG GIAN TỔ CHỨC</div>
      <button class="tenant-switch"><span class="tenant-avatar"><Building2 :size="18" /></span><span class="tenant-switch-text"><b>{{ user?.tenant_name || 'Đơn vị khách thuê' }}</b><small>Gói tổ chức sự kiện</small></span><ChevronDown :size="15" /></button>
      <div class="sidebar-caption nav-caption">VẬN HÀNH</div>
      <button @click="activePanel = 'overview'" :class="['nav-item', activePanel === 'overview' && 'nav-active']"><CalendarDays :size="18" />Tổng quan</button>
      <button @click="activePanel = 'attendees'" :class="['nav-item', activePanel === 'attendees' && 'nav-active']"><Users :size="18" />Khách mời <span v-if="attendees.length" class="nav-count">{{ attendees.length }}</span></button>
      <button @click="activePanel = 'team'" :class="['nav-item', activePanel === 'team' && 'nav-active']"><ShieldCheck :size="18" />Đội ngũ</button>
      <div class="sidebar-bottom"><div class="support-card"><span class="support-icon"><CircleUserRound :size="19" /></span><b>Ban tổ chức</b><small>Quản lý tài khoản của bạn</small></div><button class="nav-item logout-button" @click="logout"><LogOut :size="17" />Đăng xuất</button></div>
    </aside>

    <main class="main-area">
      <header class="topbar"><div class="mobile-brand"><span class="brand-icon"><QrCode :size="19" /></span>KTS<span>QR</span></div><div class="topbar-title"><span class="eyebrow">{{ selectedEvent ? 'KHÔNG GIAN SỰ KIỆN' : 'CỔNG KHÁCH THUÊ' }}</span><span class="topbar-event">{{ selectedEvent?.name || 'Chào mừng trở lại' }}</span></div><div class="topbar-user"><span class="user-initial">{{ (user?.name || 'K').slice(0, 1).toUpperCase() }}</span><span><b>{{ user?.name }}</b><small>Quản lý đơn vị</small></span></div><button class="icon-button mobile-logout" @click="logout"><LogOut :size="18" /></button></header>
      <div class="content-area">
        <div v-if="errorMessage" class="error-box page-error"><span>{{ errorMessage }}</span><button @click="errorMessage = ''"><X :size="16" /></button></div>
        <div v-if="loading" class="loading-card">Đang tải dữ liệu sự kiện...</div>
        <template v-else>
          <section v-if="user?.type === 'TENANT_ADMIN' && usage" class="surface-card quota-panel">
            <div class="quota-copy"><span class="metric-icon blue"><PackageCheck :size="19" /></span><div><span class="eyebrow">GÓI SỰ KIỆN</span><h2>{{ usage.can_create_event ? 'Sẵn sàng vận hành sự kiện' : 'Cần gói cho sự kiện tiếp theo' }}</h2><p>{{ usage.free_events_used }} / {{ usage.free_event_limit }} sự kiện dùng thử đã tạo · {{ usage.available_packages.length }} gói đã xác nhận, chưa sử dụng</p><small>Gói áp dụng riêng cho từng sự kiện. Đóng sự kiện vẫn giữ lịch sử và lượt đã dùng.</small></div></div>
            <button class="secondary-button" @click="loadPortal"><Activity :size="16" />Cập nhật</button><button class="primary-button" :disabled="!usage.can_create_event" @click="openEventModal()"><Plus :size="17" />Tạo sự kiện</button>
          </section>
          <div v-if="user?.type === 'TENANT_ADMIN' && Number(usage?.free_events_remaining) > 0 && !usage?.trial_package" class="surface-card trial-notice">Gói dùng thử chưa được cấu hình. Quản trị viên hệ thống cần thiết lập hạn mức trước khi bạn tạo sự kiện miễn phí.</div>
          <section v-if="user?.type === 'TENANT_ADMIN' && Number(usage?.free_events_used) >= Number(usage?.free_event_limit)" class="surface-card plan-panel">
            <div class="surface-heading"><div><h2>Gói cho sự kiện</h2><p>Mỗi gói cấp quyền cho một sự kiện sau khi admin xác nhận thanh toán.</p></div></div>
            <div v-if="usage.available_packages.length" class="plan-grid"><article v-for="pkg in usage.available_packages" :key="pkg.id" class="plan-option"><div class="plan-icon"><PackageCheck :size="18" /></div><b>{{ pkg.name }}</b><p>{{ pkg.max_attendees }} khách · {{ pkg.max_employees }} nhân sự · {{ pkg.max_referrers }} giới thiệu · {{ pkg.max_scanners }} soát vé</p><strong>{{ Number(pkg.price_vnd).toLocaleString('vi-VN') }} ₫</strong><small>Đã xác nhận · chưa sử dụng</small><button class="secondary-button" :disabled="saving" @click="openEventModal(pkg.id)">Tạo sự kiện bằng gói này<ArrowRight :size="15" /></button></article></div>
            <div class="surface-heading package-heading"><div><h2>Chọn gói cho sự kiện tiếp theo</h2><p>Chọn quy mô phù hợp. Admin sẽ xác nhận thanh toán trước khi bạn tạo sự kiện.</p></div></div>
            <div v-if="!plans.length" class="empty-state compact"><PackageCheck :size="25" /><span>Hiện chưa có gói sự kiện được mở bán. Vui lòng liên hệ quản trị viên.</span></div>
            <div v-else class="plan-grid"><article v-for="plan in plans" :key="plan.id" class="plan-option"><div class="plan-icon"><PackageCheck :size="18" /></div><b>{{ plan.name }}</b><p>{{ plan.description || `${plan.max_attendees} khách tham gia` }}</p><strong>{{ Number(plan.price_vnd).toLocaleString('vi-VN') }} ₫</strong><small>{{ plan.max_attendees }} khách · {{ plan.max_employees }} nhân sự · {{ plan.max_referrers }} giới thiệu · {{ plan.max_scanners }} soát vé</small><button class="secondary-button" :disabled="saving" @click="requestPlan(plan)">{{ saving ? 'Đang gửi...' : 'Yêu cầu mua gói' }}<ArrowRight :size="15" /></button></article></div>
            <div v-if="usage.package_requests.length" class="package-request-list"><p v-for="request in usage.package_requests" :key="request.id">{{ request.name }} · {{ packageRequestStatus(request) }}</p></div>
          </section>
          <template v-if="activePanel === 'team'">
            <div class="page-heading"><div><span class="eyebrow">NHÂN SỰ ĐƯỢC PHÂN QUYỀN</span><h1>Đội ngũ sự kiện</h1><p>Tạo tài khoản nhân sự, sau đó gán họ vào từng sự kiện với nhiệm vụ cụ thể.</p></div><button class="primary-button" @click="showMemberModal = true"><Plus :size="17" />Thêm nhân sự</button></div>
            <section class="surface-card">
              <div class="surface-heading"><div><h2>Nhân sự của đơn vị</h2><p>{{ team.length }} tài khoản trong đội ngũ</p></div></div>
              <div v-if="!team.length" class="empty-state"><Users :size="30" /><b>Chưa có nhân sự</b><span>Tạo tài khoản cho những người sẽ vận hành sự kiện.</span></div>
              <div v-else class="table-scroll"><table><thead><tr><th>Nhân sự</th><th>Liên hệ</th><th>Sự kiện được gán</th><th>Trạng thái</th></tr></thead><tbody><tr v-for="member in team" :key="member.id"><td><b>{{ member.name }}</b><small>{{ member.email }}</small></td><td>{{ member.phone || '—' }}</td><td>{{ member.assigned_events }}</td><td><span class="status-pill" :class="member.status === 'ACTIVE' ? 'status-green' : 'status-gray'">{{ member.status === 'ACTIVE' ? 'Hoạt động' : 'Đã khóa' }}</span></td></tr></tbody></table></div>
            </section>
            <section v-if="selectedEvent" class="surface-card"><div class="surface-heading"><div><h2>Phân công · {{ selectedEvent.name }}</h2><p>{{ eventEmployeeCount }}/{{ selectedEvent.max_employees }} nhân sự · {{ eventReferrerCount }}/{{ selectedEvent.max_referrers }} người giới thiệu · {{ eventScannerCount }}/{{ selectedEvent.max_scanners }} người soát vé.</p></div><button class="secondary-button" :disabled="eventEmployeeCount >= selectedEvent.max_employees || selectedEvent.status !== 'PUBLISHED'" @click="showAssignmentModal = true"><Plus :size="16" />Phân công</button></div><div v-if="!eventTeam.length" class="empty-state compact"><ShieldCheck :size="26" /><span>Chưa có nhân sự được phân công cho sự kiện này.</span></div><div v-else class="assignment-grid"><article v-for="member in eventTeam" :key="member.id" class="assignment-card"><div class="member-mark">{{ member.name.slice(0, 1) }}</div><div class="assignment-info"><b>{{ member.name }}</b><small>{{ member.email }}</small><span class="role-chip">{{ roleLabel(member) }}</span></div><button class="icon-button danger-icon" title="Gỡ khỏi sự kiện" @click="removeMember(member)"><Trash2 :size="16" /></button></article></div></section>
          </template>

          <template v-else-if="!selectedEvent">
            <div class="page-heading"><div><span class="eyebrow">BẢNG ĐIỀU HÀNH</span><h1>Sự kiện của bạn</h1><p>Tạo sự kiện, theo dõi khách mời và phân công đội ngũ vận hành.</p></div><button class="primary-button" :disabled="!usage?.can_create_event" @click="openEventModal()"><Plus :size="17" />Tạo sự kiện</button></div>
            <div v-if="!events.length" class="empty-large"><CalendarDays :size="36" /><h2>Chưa có sự kiện</h2><p>Tạo sự kiện đầu tiên để bắt đầu quản lý khách mời và đội ngũ check-in.</p></div>
          </template>

          <template v-else>
            <div class="page-heading event-heading"><div><span class="eyebrow">BẢNG ĐIỀU HÀNH</span><h1>{{ activePanel === 'attendees' ? 'Danh sách khách mời' : 'Tổng quan sự kiện' }}</h1><p>Theo dõi khách đăng ký, vé QR và tiến độ check-in.</p></div><div class="event-picker-wrap"><CalendarDays :size="17" /><select :value="selectedEvent.id" @change="loadEventDetails(events.find((event) => event.id === Number(($event.target as HTMLSelectElement).value)))"><option v-for="event in events" :key="event.id" :value="event.id">{{ event.name }}</option></select><ChevronDown :size="15" /></div></div>
            <div class="event-banner"><div class="event-banner-mark"><TicketCheck :size="24" /></div><div class="event-banner-copy"><span class="status-pill" :class="selectedEvent.status === 'PUBLISHED' ? 'status-green' : 'status-gray'">{{ selectedEvent.status === 'PUBLISHED' ? 'Đang mở' : selectedEvent.status }}</span><h2>{{ selectedEvent.name }}</h2><div class="event-meta"><span><MapPin :size="15" />{{ selectedEvent.location }}</span><span><Clock3 :size="15" />{{ formatDate(selectedEvent.start_at) }}</span><span>{{ selectedEvent.package_name }} · {{ eventPackagePrice(selectedEvent) }}</span></div><button v-if="selectedEvent.status === 'PUBLISHED'" class="close-event-button" @click="closeEvent">Đóng sự kiện</button></div><div class="capacity-ring"><b>{{ selectedEvent.capacity ? Math.round((attendees.length / selectedEvent.capacity) * 100) : 0 }}%</b><small>{{ attendees.length }}/{{ selectedEvent.capacity }} khách</small></div></div>

            <div class="metric-grid"><article class="metric-card"><span class="metric-icon blue"><Users :size="19" /></span><span class="metric-label">Đã đăng ký</span><b>{{ attendees.length }}</b><small>trên {{ selectedEvent.capacity }} chỗ</small></article><article class="metric-card"><span class="metric-icon green"><TicketCheck :size="19" /></span><span class="metric-label">Đã duyệt / có vé</span><b>{{ approvedCount }}</b><small>vé QR đã phát hành</small></article><article class="metric-card"><span class="metric-icon violet"><QrCode :size="19" /></span><span class="metric-label">Đã check-in</span><b>{{ checkedInCount }}</b><small>{{ approvedCount ? Math.round((checkedInCount / approvedCount) * 100) : 0 }}% khách có vé</small></article><article class="metric-card"><span class="metric-icon amber"><Users :size="19" /></span><span class="metric-label">Đội ngũ được gán</span><b>{{ eventTeam.length }}</b><small>nhân sự vận hành</small></article></div>

            <section class="surface-card attendee-card"><div class="surface-heading"><div><h2>{{ activePanel === 'attendees' ? 'Khách tham dự' : 'Khách mời gần đây' }}</h2><p>Thông tin đăng ký và trạng thái vé QR.</p></div><div class="table-actions"><div class="search-box"><Search :size="16" /><input v-model="search" placeholder="Tìm khách mời..." /></div><button class="secondary-button" @click="exportAttendees"><ArrowDownToLine :size="16" />Xuất danh sách</button></div></div><div v-if="!filteredAttendees.length" class="empty-state compact"><Users :size="26" /><span>Chưa có khách đăng ký cho sự kiện này.</span></div><div v-else class="table-scroll"><table><thead><tr><th>Khách mời</th><th>Người giới thiệu</th><th>Trạng thái đăng ký</th><th>Vé QR</th><th>Check-in</th></tr></thead><tbody><tr v-for="attendee in filteredAttendees.slice(0, activePanel === 'attendees' ? undefined : 8)" :key="attendee.registration_id"><td><b>{{ attendee.full_name }}</b><small>{{ attendee.email }} · {{ attendee.phone }}</small></td><td>{{ attendee.referrer_name || '—' }}</td><td><span class="status-pill" :class="attendee.registration_status === 'APPROVED' ? 'status-green' : 'status-amber'">{{ attendee.registration_status === 'APPROVED' ? 'Đã duyệt' : attendee.registration_status === 'REJECTED' ? 'Từ chối' : 'Đang chờ' }}</span></td><td><code>{{ attendee.ticket_code || 'Chưa phát hành' }}</code></td><td><span v-if="attendee.ticket_status === 'USED'" class="checked-state"><Check :size="14" />Đã vào cổng</span><span v-else class="muted">Chưa check-in</span></td></tr></tbody></table></div><button v-if="activePanel !== 'attendees' && attendees.length > 8" class="show-all" @click="activePanel = 'attendees'">Xem toàn bộ {{ attendees.length }} khách mời <ArrowRight :size="15" /></button></section>
          </template>
        </template>
      </div>
    </main>

    <div v-if="showMemberModal" class="modal-scrim" @click.self="showMemberModal = false"><form class="modal-card" @submit.prevent="addTeamMember"><button type="button" class="modal-close" @click="showMemberModal = false"><X :size="18" /></button><span class="eyebrow">ĐỘI NGŨ ĐƠN VỊ</span><h2>Thêm nhân sự</h2><p class="muted">Tạo tài khoản đăng nhập; sau đó phân công họ vào sự kiện.</p><label class="control-label">Họ tên</label><input v-model="memberForm.name" required class="text-control" /><label class="control-label">Email đăng nhập</label><input v-model="memberForm.email" type="email" required class="text-control" /><label class="control-label">Số điện thoại</label><input v-model="memberForm.phone" class="text-control" /><label class="control-label">Mật khẩu tạm (ít nhất 8 ký tự)</label><input v-model="memberForm.password" type="text" minlength="8" required class="text-control" /><button class="primary-button full-button" :disabled="saving">{{ saving ? 'Đang tạo...' : 'Tạo tài khoản' }}<ArrowRight :size="16" /></button></form></div>
    <div v-if="showAssignmentModal" class="modal-scrim" @click.self="showAssignmentModal = false"><form class="modal-card" @submit.prevent="assignMember"><button type="button" class="modal-close" @click="showAssignmentModal = false"><X :size="18" /></button><span class="eyebrow">{{ selectedEvent?.name }}</span><h2>Phân công nhân sự</h2><p class="muted">Chọn nhiệm vụ sẽ hiển thị trong quyền của nhân sự ở sự kiện này.</p><label class="control-label">Nhân sự</label><select v-model="assignment.staff_id" required class="text-control"><option value="" disabled>Chọn nhân sự</option><option v-for="member in unassignedTeam" :key="member.id" :value="String(member.id)">{{ member.name }} · {{ member.email }}</option></select><label class="control-label">Nhiệm vụ</label><select v-model="assignment.role" class="text-control"><option value="INVITER">Mời khách</option><option value="APPROVER">Duyệt khách</option><option value="SCANNER">Quét QR check-in</option><option value="REPORTER">Xem báo cáo</option><option value="MANAGER">Quản lý toàn bộ sự kiện</option></select><label v-if="['INVITER', 'MANAGER'].includes(assignment.role)" class="control-label">Hạn mức khách mời<input v-model.number="assignment.max_invites" type="number" min="0" class="text-control" /></label><button class="primary-button full-button" :disabled="saving || !unassignedTeam.length">{{ saving ? 'Đang lưu...' : 'Lưu phân công' }}<ArrowRight :size="16" /></button><p v-if="!unassignedTeam.length" class="muted">Tất cả nhân sự hiện có đã được gán vào sự kiện.</p></form></div>
  </div>
  <div v-if="showEventModal" class="modal-scrim" @click.self="showEventModal = false"><form class="modal-card event-create-modal" @submit.prevent="createEvent"><button type="button" class="modal-close" @click="showEventModal = false"><X :size="18" /></button><span class="eyebrow">TẠO SỰ KIỆN</span><h2>Sự kiện mới</h2><p class="muted">Mỗi sự kiện dùng một gói riêng. Gói quyết định số khách và nhân sự được phân công.</p><div v-if="Number(usage?.free_events_remaining) > 0 && usage?.trial_package" class="package-summary"><b>Gói dùng thử · còn {{ usage.free_events_remaining }} sự kiện</b><span>{{ usage.trial_package.max_attendees }} khách · {{ usage.trial_package.max_employees }} nhân sự · {{ usage.trial_package.max_referrers }} giới thiệu · {{ usage.trial_package.max_scanners }} soát vé</span></div><template v-else><label class="control-label">Gói sự kiện đã được xác nhận</label><select v-model="eventForm.event_package_id" required class="text-control"><option value="" disabled>Chọn gói đã mua</option><option v-for="pkg in usage?.available_packages || []" :key="pkg.id" :value="pkg.id">{{ pkg.name }} · {{ pkg.max_attendees }} khách · {{ Number(pkg.price_vnd).toLocaleString('vi-VN') }} ₫</option></select><p v-if="!usage?.available_packages?.length" class="muted">Chưa có gói được xác nhận. Hãy gửi yêu cầu mua gói và chờ admin duyệt.</p></template><label class="control-label">Tên sự kiện</label><input v-model="eventForm.name" required class="text-control" placeholder="Tên sự kiện" /><label class="control-label">Mô tả</label><textarea v-model="eventForm.description" class="text-control text-area-control" rows="3" /><label class="control-label">Địa điểm</label><input v-model="eventForm.location" required class="text-control" placeholder="Địa điểm tổ chức" /><div class="form-two-col"><div><label class="control-label">Bắt đầu</label><input v-model="eventForm.start_at" type="datetime-local" required class="text-control" /></div><div><label class="control-label">Kết thúc</label><input v-model="eventForm.end_at" type="datetime-local" required class="text-control" /></div></div><button class="primary-button full-button" :disabled="saving || !usage?.can_create_event || (Number(usage?.free_events_remaining) === 0 && !eventForm.event_package_id)">{{ saving ? 'Đang tạo...' : 'Tạo sự kiện' }}<ArrowRight :size="16" /></button></form></div>
</template>

<style scoped>
.package-heading{margin-top:22px;border-top:1px solid #e7edf1;padding-top:15px}
.package-request-list{display:grid;gap:6px;margin-top:14px;border-top:1px solid #e7edf1;padding-top:12px;color:#607889;font-size:11px}
.package-request-list p{margin:0}
.package-summary{display:grid;gap:5px;margin:15px 0;padding:13px;border:1px solid #d9eee8;border-radius:10px;background:#f2fbf8;color:#286754;font-size:12px}
.trial-notice{margin:0 0 15px;border:1px solid #f2dfb8;background:#fffaf0;padding:14px;color:#805e23;font-size:12px}
.close-event-button{margin-top:6px;border:1px solid #e8cccc;border-radius:7px;background:#fff;color:#9f4949;padding:5px 8px;font-size:9px;font-weight:700}
.capacity-ring small{display:block;white-space:nowrap}
</style>
