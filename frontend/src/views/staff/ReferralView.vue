<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import api from '../../api/client';
import { getSocket } from '../../api/socket';
import QRCode from 'qrcode';
import InviteCardModal from '../../components/InviteCardModal.vue';
import {
  Link2,
  QrCode,
  Camera,
  Target,
  Users,
  Ticket,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Download,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Phone,
  Mail,
  MapPin,
  RotateCw,
  Sparkles,
  Calendar,
  Building,
  ShieldCheck,
  X,
  Send,
  AlertCircle
} from 'lucide-vue-next';

const router = useRouter();

const events = ref<any[]>([]);
const selectedEventId = ref<number | null>(null);
const myLinks = ref<any[]>([]);
const registrations = ref<any[]>([]);
const filterStatus = ref<string>('');
const searchQuery = ref<string>('');
const loading = ref(false);
const showOtherLinks = ref(false);
const copiedLink = ref(false);

// Modal create link
const showCreateLinkModal = ref(false);
const staffQuota = ref<any>(null);
const quotaLoading = ref(false);
const maxRegs = ref(50);
const expireDays = ref(30);
const newlyCreatedUrl = ref('');

// QR Viewer Modal
const showQrModal = ref(false);
const qrModalTitle = ref('');
const qrModalSubtitle = ref('');
const qrModalCode = ref('');
const qrModalDataUrl = ref('');

// Reject modal state
const showRejectModal = ref(false);
const rejectingRegId = ref<number | null>(null);
const rejectReason = ref('');

// VIP Online Invitation Card Modal
const showInviteCardModal = ref(false);
const inviteCardData = ref<any>(null);

const openInviteCardGenerator = (reg?: any) => {
  const currentEvent = events.value.find((e: any) => e.id === selectedEventId.value) || events.value[0];
  const activeLink = myLinks.value.find((l: any) => l.event_id === selectedEventId.value && l.status === 'ACTIVE') || myLinks.value[0];

  if (reg) {
    inviteCardData.value = {
      attendee_name: reg.full_name || 'Khách Mời VIP',
      attendee_role: 'Khách Mời Danh Dự (VIP)',
      event_name: currentEvent?.name,
      event_location: currentEvent?.location,
      event_start_at: currentEvent?.start_at,
      qr_data: reg.ticket_code || activeLink?.invite_url || window.location.origin,
      code_label: reg.ticket_code ? `MÃ VÉ: ${reg.ticket_code}` : 'QUÉT ĐỂ ĐĂNG KÝ VÉ VIP',
    };
  } else {
    inviteCardData.value = {
      attendee_name: 'Ông / Bà [Tên Khách VIP]',
      attendee_role: 'Khách Mời Danh Dự (VIP)',
      event_name: currentEvent?.name,
      event_location: currentEvent?.location,
      event_start_at: currentEvent?.start_at,
      qr_data: activeLink?.invite_url || window.location.origin,
      code_label: 'QUÉT ĐỂ ĐĂNG KÝ THAM DỰ (VIP)',
    };
  }
  showInviteCardModal.value = true;
};

const loadEvents = async () => {
  try {
    const res = await api.get('/events', { params: { scope: 'active' } });
    events.value = res.data.data;
    if (events.value.length > 0) {
      if (!selectedEventId.value || !events.value.some((e: any) => e.id === selectedEventId.value)) {
        selectedEventId.value = events.value[0].id;
      }
    } else {
      selectedEventId.value = null;
    }
  } catch (e: any) {
    console.error(e);
  }
};

const loadQuota = async () => {
  if (!selectedEventId.value) return;
  quotaLoading.value = true;
  try {
    const res = await api.get(`/invites/quota?event_id=${selectedEventId.value}`);
    staffQuota.value = res.data.data;
    if (staffQuota.value?.max_invites) {
      maxRegs.value = staffQuota.value.max_invites;
    }
  } catch (e: any) {
    console.error(e);
  } finally {
    quotaLoading.value = false;
  }
};

const openCreateModal = async () => {
  if (selectedEvent.value && (selectedEvent.value.my_can_invite === 0 || selectedEvent.value.staff_can_invite === 0)) {
    alert('Tài khoản của bạn không được phân quyền tạo link mời cho sự kiện này.');
    return;
  }
  showCreateLinkModal.value = true;
  newlyCreatedUrl.value = '';
  await loadQuota();
};

const loadMyLinks = async () => {
  try {
    const res = await api.get('/invites/my-links');
    myLinks.value = res.data.data;
  } catch (e: any) {
    console.error(e);
  }
};

const loadRegistrations = async () => {
  try {
    const params: any = {};
    if (selectedEventId.value) params.event_id = selectedEventId.value;
    if (filterStatus.value) params.status = filterStatus.value;

    const res = await api.get('/registrations', { params });
    registrations.value = res.data.data;
  } catch (e: any) {
    console.error(e);
  }
};

const handleEventChange = async () => {
  await Promise.all([loadQuota(), loadRegistrations()]);
};

const realtimeNotice = ref<{ message: string; type: 'success' | 'info' } | null>(null);
let noticeTimer: any = null;
const showNotice = (message: string, type: 'success' | 'info' = 'success') => {
  realtimeNotice.value = { message, type };
  if (noticeTimer) clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    realtimeNotice.value = null;
  }, 7000);
};

onMounted(async () => {
  loading.value = true;
  await loadEvents();
  await Promise.all([loadMyLinks(), loadRegistrations(), loadQuota()]);
  loading.value = false;

  const socket = getSocket();

  // 1. Live guest registered via staff link
  socket.on('registration:new', (reg: any) => {
    const exists = registrations.value.some((r: any) => r.id === reg.registrationId);
    if (!exists) {
      registrations.value.unshift({
        id: reg.registrationId,
        full_name: reg.fullName,
        phone: reg.phone,
        email: reg.email,
        status: reg.status,
        created_at: reg.createdAt,
        event_name: reg.eventName,
        ticket_code: null,
        ticket_status: null,
      });
      showNotice(`⚡ Khách "${reg.fullName}" vừa đăng ký thành công qua link của bạn!`, 'info');
    }
  });

  // 2. Live guest checked in at event gate
  socket.on('referral:scanned', (scan: any) => {
    const target = registrations.value.find((r: any) => r.ticket_code === scan.code || r.phone === scan.customerPhone);
    if (target) {
      target.ticket_status = 'USED';
      target.used_at = scan.usedAt;
      showNotice(`✓ Khách "${target.full_name}" vừa check-in vào sự kiện "${scan.eventName}"!`, 'success');
    }
  });

  // 3. Live quota updated
  socket.on('quota:updated', (data: any) => {
    if (selectedEventId.value === data.eventId) {
      if (staffQuota.value) {
        staffQuota.value.max_invites = data.maxInvites;
      }
      maxRegs.value = data.maxInvites;
      showNotice(`ℹ️ Hạn mức mời khách của bạn đã được cập nhật thành ${data.maxInvites} người.`, 'info');
    }
  });
});

onUnmounted(() => {
  const socket = getSocket();
  socket.off('registration:new');
  socket.off('referral:scanned');
  socket.off('quota:updated');
  if (noticeTimer) clearTimeout(noticeTimer);
});

const handleCreateLink = async () => {
  if (!selectedEventId.value) return;
  const quota = staffQuota.value?.max_invites || maxRegs.value || 50;
  try {
    const res = await api.post('/invites', {
      event_id: selectedEventId.value,
      expires_in_days: expireDays.value,
      max_registrations: quota,
    });
    newlyCreatedUrl.value = `${window.location.origin}/invite/${res.data.data.token}`;
    await loadMyLinks();
  } catch (e: any) {
    alert(e.response?.data?.message || e.message);
  }
};

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text).then(() => {
    copiedLink.value = true;
    setTimeout(() => {
      copiedLink.value = false;
    }, 2000);
  });
};

const getInviteUrl = (token: string) => {
  return `${window.location.origin}/invite/${token}`;
};

const copyInviteLink = (token: string) => {
  copyToClipboard(getInviteUrl(token));
};

// QR Viewer Actions
const openLinkQrModal = async (link: any) => {
  const url = `${window.location.origin}/invite/${link.token}`;
  qrModalTitle.value = `Mã QR Link Mời: ${link.event_name}`;
  qrModalSubtitle.value = 'Đưa mã này cho khách hàng quét bằng camera điện thoại để mở form đăng ký';
  qrModalCode.value = url;
  qrModalDataUrl.value = await QRCode.toDataURL(url, {
    width: 360,
    margin: 2,
    color: { dark: '#0f172a', light: '#ffffff' },
  });
  showQrModal.value = true;
};

const openTicketQrModal = async (reg: any) => {
  if (!reg.ticket_code) return;
  qrModalTitle.value = `Vé QR: ${reg.full_name}`;
  qrModalSubtitle.value = `${reg.event_name} • SĐT: ${reg.phone}`;
  qrModalCode.value = reg.ticket_code;
  qrModalDataUrl.value = await QRCode.toDataURL(reg.ticket_code, {
    width: 360,
    margin: 2,
    color: { dark: '#0284c7', light: '#ffffff' },
  });
  showQrModal.value = true;
};

const downloadQrImage = () => {
  if (!qrModalDataUrl.value) return;
  const a = document.createElement('a');
  a.href = qrModalDataUrl.value;
  a.download = `KTSQR_${Date.now()}.png`;
  a.click();
};

const handleApprove = async (reg: any) => {
  const isTwoTier = reg.event_approval_mode === 'TWO_TIER';
  const confirmMsg = isTwoTier
    ? 'Xác nhận duyệt vòng 1 cho khách này? Hồ sơ sẽ được chuyển tiếp để Admin duyệt cấp vé QR.'
    : 'Xác nhận phê duyệt và cấp mã vé QR cho khách này?';
  if (!confirm(confirmMsg)) return;

  try {
    const res = await api.put(`/registrations/${reg.id}/approve`);
    await loadRegistrations();
    await loadMyLinks();
    showNotice(res.data.data.message || 'Đã duyệt khách thành công!', 'success');
  } catch (e: any) {
    alert(e.response?.data?.message || e.message);
  }
};

const openRejectModal = (regId: number) => {
  rejectingRegId.value = regId;
  rejectReason.value = 'Không đáp ứng điều kiện tham gia';
  showRejectModal.value = true;
};

const confirmReject = async () => {
  if (!rejectingRegId.value) return;
  try {
    await api.put(`/registrations/${rejectingRegId.value}/reject`, {
      reason: rejectReason.value,
    });
    showRejectModal.value = false;
    await loadRegistrations();
    showNotice('Đã từ chối đăng ký.', 'info');
  } catch (e: any) {
    alert(e.response?.data?.message || e.message);
  }
};

// Computed Properties
const selectedEvent = computed(() => events.value.find((e) => e.id === selectedEventId.value));

const currentEventLink = computed(() => {
  return myLinks.value.find((l) => l.event_id === selectedEventId.value);
});

const otherLinks = computed(() => {
  if (!currentEventLink.value) return myLinks.value;
  return myLinks.value.filter((l) => l.id !== currentEventLink.value.id);
});

const stats = computed(() => {
  const total = registrations.value.length;
  const approved = registrations.value.filter((r) => r.status === 'APPROVED').length;
  const pending = registrations.value.filter((r) => r.status === 'PENDING').length;
  const pendingAdmin = registrations.value.filter((r) => r.status === 'PENDING_ADMIN').length;
  const rejected = registrations.value.filter((r) => r.status === 'REJECTED').length;
  const quota = staffQuota.value?.max_invites || 50;
  const percent = Math.min(100, Math.round((total / quota) * 100));
  return { total, approved, pending, pendingAdmin, rejected, quota, percent };
});

const filteredRegistrations = computed(() => {
  let list = registrations.value;
  if (filterStatus.value) {
    list = list.filter((r) => r.status === filterStatus.value);
  }
  const q = searchQuery.value.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (r) =>
        (r.full_name && r.full_name.toLowerCase().includes(q)) ||
        (r.phone && r.phone.toLowerCase().includes(q)) ||
        (r.email && r.email.toLowerCase().includes(q)) ||
        (r.ticket_code && r.ticket_code.toLowerCase().includes(q)) ||
        (r.address && r.address.toLowerCase().includes(q))
    );
  }
  return list;
});
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-4 space-y-6 animate-page-in">
    <!-- Realtime Notification Toast -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="transform -translate-y-4 opacity-0 scale-95"
      enter-to-class="transform translate-y-0 opacity-100 scale-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="realtimeNotice"
        class="fixed top-5 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-[120] p-4 bg-primary-700 text-white rounded-2xl shadow-glow flex items-center justify-between gap-3 border border-primary-500"
      >
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Sparkles class="w-4 h-4 text-primary-200" />
          </div>
          <p class="text-xs font-bold leading-snug">{{ realtimeNotice.message }}</p>
        </div>
        <button
          @click="realtimeNotice = null"
          class="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/80 hover:text-white transition"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </Transition>

    <!-- Top Header & Controls -->
    <div class="card p-5 sm:p-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="chip chip-primary text-[10px] shrink-0">
            Referral Hub
          </span>
          <span v-if="selectedEvent" class="chip chip-slate text-[10px] flex items-center gap-1 max-w-[260px] sm:max-w-xs md:max-w-md truncate" :title="selectedEvent.location">
            <MapPin class="w-3 h-3 text-slate-400 shrink-0" />
            <span class="truncate">{{ selectedEvent.location }}</span>
          </span>
        </div>
        <h1 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1 truncate">
          Kênh Người Giới Thiệu
        </h1>
        <p class="text-xs text-slate-500 mt-0.5 truncate">
          Phát hành link mời chính thức, theo dõi hạn mức phân bổ & duyệt cấp vé QR
        </p>
      </div>

      <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto shrink-0">
        <!-- Event Switcher with Locked Stable Width -->
        <div class="relative w-full sm:w-64 md:w-72 lg:w-80 shrink-0">
          <select
            v-model="selectedEventId"
            @change="handleEventChange"
            class="w-full pl-3.5 pr-8 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition cursor-pointer appearance-none truncate shadow-2xs"
          >
            <option v-if="events.length === 0" :value="null" disabled>
              Không có sự kiện nào đang diễn ra
            </option>
            <option v-for="ev in events" :key="ev.id" :value="ev.id">
              {{ ev.name }}
            </option>
          </select>
          <ChevronDown class="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        <!-- Action Buttons: Solid, Unbroken Bar on Desktop, Clean Grid on Mobile -->
        <div class="grid grid-cols-3 sm:flex sm:items-center gap-2 w-full sm:w-auto shrink-0">
          <!-- Create Link Button -->
          <button
            @click="openCreateModal"
            class="btn btn-primary text-xs py-2.5 px-3 shadow-sm whitespace-nowrap flex items-center justify-center gap-1.5"
            title="Tạo link mời mới"
          >
            <Link2 class="w-3.5 h-3.5 shrink-0" />
            <span class="truncate">Tạo Link</span>
          </button>

          <!-- Create VIP Invite Card Button -->
          <button
            @click="openInviteCardGenerator()"
            class="btn text-xs font-black bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white py-2.5 px-3 shadow-sm flex items-center justify-center gap-1.5 whitespace-nowrap"
            title="Tạo thiệp mời"
          >
            <Sparkles class="w-3.5 h-3.5 text-amber-100 shrink-0" />
            <span class="truncate">Thiệp mời</span>
          </button>

          <!-- Quick Scanner Button -->
          <button
            @click="router.push('/staff/scanner')"
            class="btn text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-3 shadow-sm flex items-center justify-center gap-1.5 whitespace-nowrap"
            title="Mở máy quét QR soát vé tại cổng"
          >
            <Camera class="w-3.5 h-3.5 shrink-0" />
            <span class="truncate">Soát vé</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Quick Statistics Bar: Sleek 1-Row Strip on Mobile, 4 Cards on Desktop -->
    <!-- Mobile Strip (sm:hidden) -->
    <div class="sm:hidden bg-white border border-slate-200/90 rounded-2xl p-3 shadow-xs grid grid-cols-4 divide-x divide-slate-100 text-center">
      <div class="px-1">
        <div class="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Chỉ tiêu</div>
        <div class="text-base font-black text-slate-900 mt-0.5">{{ stats.quota }}</div>
      </div>
      <div class="px-1">
        <div class="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Đã ĐK</div>
        <div class="text-base font-black text-primary-600 mt-0.5">{{ stats.total }}</div>
      </div>
      <div class="px-1">
        <div class="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Đã cấp QR</div>
        <div class="text-base font-black text-emerald-600 mt-0.5">{{ stats.approved }}</div>
      </div>
      <div class="px-1">
        <div class="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Chờ duyệt</div>
        <div class="text-base font-black text-amber-600 mt-0.5">{{ stats.pending + stats.pendingAdmin }}</div>
      </div>
    </div>

    <!-- Desktop 4 Cards (hidden sm:grid) -->
    <div class="hidden sm:grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <!-- Stat 1: Admin Quota -->
      <div class="card p-4 space-y-1 min-h-[110px] flex flex-col justify-between">
        <div class="flex items-center justify-between text-slate-400">
          <span class="text-[11px] font-bold uppercase">Chỉ tiêu Admin</span>
          <Target class="w-4 h-4 text-primary-500" />
        </div>
        <div class="text-2xl font-black text-slate-900">
          {{ stats.quota }} <span class="text-xs font-normal text-slate-400">khách</span>
        </div>
        <div class="text-[11px] text-primary-600 font-semibold truncate">
          Gán cứng không thể vượt
        </div>
      </div>

      <!-- Stat 2: Registered Progress -->
      <div class="card p-4 space-y-1 min-h-[110px] flex flex-col justify-between">
        <div class="flex items-center justify-between text-slate-400">
          <span class="text-[11px] font-bold uppercase">Đã đăng ký</span>
          <Users class="w-4 h-4 text-indigo-500" />
        </div>
        <div class="text-2xl font-black text-primary-700">
          {{ stats.total }} <span class="text-xs font-normal text-slate-400">/ {{ stats.quota }}</span>
        </div>
        <div class="flex items-center gap-2 pt-0.5">
          <div class="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div
              class="bg-primary-600 h-full rounded-full transition-all duration-300"
              :style="{ width: `${stats.percent}%` }"
            ></div>
          </div>
          <span class="text-[10px] font-bold text-slate-500 shrink-0">{{ stats.percent }}%</span>
        </div>
      </div>

      <!-- Stat 3: Approved Tickets -->
      <div class="card p-4 space-y-1 min-h-[110px] flex flex-col justify-between">
        <div class="flex items-center justify-between text-slate-400">
          <span class="text-[11px] font-bold uppercase">Đã cấp vé QR</span>
          <Ticket class="w-4 h-4 text-emerald-500" />
        </div>
        <div class="text-2xl font-black text-emerald-600">
          {{ stats.approved }} <span class="text-xs font-normal text-slate-400">vé</span>
        </div>
        <div class="text-[11px] text-emerald-700 font-semibold truncate">
          Đủ điều kiện tham gia
        </div>
      </div>

      <!-- Stat 4: Pending Approvals -->
      <div class="card p-4 space-y-1 min-h-[110px] flex flex-col justify-between">
        <div class="flex items-center justify-between text-slate-400">
          <span class="text-[11px] font-bold uppercase">Chờ phê duyệt</span>
          <Clock class="w-4 h-4 text-amber-500" />
        </div>
        <div class="text-2xl font-black text-amber-600">
          {{ stats.pending + stats.pendingAdmin }} <span class="text-xs font-normal text-slate-400">hồ sơ</span>
        </div>
        <div class="text-[10px] text-slate-500 font-medium truncate">
          {{ stats.pending }} chờ bạn • {{ stats.pendingAdmin }} chờ Admin
        </div>
      </div>
    </div>

    <!-- Active Invite Link Hero Card (Mobile-Optimized) -->
    <div class="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white rounded-3xl p-4 sm:p-7 shadow-card relative overflow-hidden flex flex-col justify-center">
      <!-- Glow accent -->
      <div class="absolute -right-10 -bottom-10 w-72 h-72 bg-primary-500/15 rounded-full blur-3xl pointer-events-none"></div>

      <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
        <div class="space-y-1.5 sm:space-y-2 flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="px-2.5 py-0.5 bg-primary-500/20 text-primary-300 border border-primary-500/30 text-[10px] font-black rounded-lg uppercase tracking-wider flex items-center gap-1 shrink-0">
              <Link2 class="w-3 h-3" />
              Link Mời
            </span>

            <span
              v-if="currentEventLink"
              class="px-2.5 py-0.5 text-[10px] font-bold rounded-full shrink-0"
              :class="(currentEventLink.status === 'CLOSED' || currentEventLink.current_registrations >= currentEventLink.max_registrations)
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'"
            >
              {{ (currentEventLink.status === 'CLOSED' || currentEventLink.current_registrations >= currentEventLink.max_registrations)
                ? '🔒 ĐÃ ĐÓNG'
                : '🟢 ĐANG MỞ' }}
            </span>
          </div>

          <h2 class="text-base sm:text-xl font-black tracking-tight leading-snug truncate" :title="selectedEvent?.name">
            {{ selectedEvent?.name || 'Chưa chọn sự kiện' }}
          </h2>

          <div v-if="currentEventLink" class="text-xs text-slate-300 flex flex-wrap gap-x-3 gap-y-1 font-medium">
            <span>Đã ĐK: <strong class="text-white">{{ currentEventLink.current_registrations }} / {{ currentEventLink.max_registrations }}</strong> khách</span>
            <span>• Hạn: {{ new Date(currentEventLink.expires_at).toLocaleDateString('vi-VN') }}</span>
          </div>
          <div v-else class="text-xs text-slate-400">
            Bạn chưa có link mời nào cho sự kiện này.
          </div>

          <!-- Progress bar -->
          <div v-if="currentEventLink" class="w-full max-w-md pt-1">
            <div class="w-full bg-slate-800/90 border border-slate-700/60 h-1.5 rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500"
                :class="(currentEventLink.current_registrations >= currentEventLink.max_registrations) ? 'bg-rose-500' : 'bg-emerald-400'"
                :style="{ width: `${Math.min(100, Math.round((currentEventLink.current_registrations / currentEventLink.max_registrations) * 100))}%` }"
              ></div>
            </div>
          </div>
        </div>

        <!-- Actions on Mobile & Desktop -->
        <div v-if="currentEventLink" class="space-y-2 w-full md:w-auto shrink-0 pt-1 md:pt-0">
          <!-- 1-Tap Copy Button (Super prominent for thumb) -->
          <button
            @click="copyInviteLink(currentEventLink.token)"
            class="btn btn-primary w-full md:w-auto py-2.5 px-4 text-xs font-bold shadow-md flex items-center justify-center gap-2 cursor-pointer transition active:scale-95"
            :class="{ 'bg-emerald-600 hover:bg-emerald-700 border-emerald-400/40': copiedLink }"
          >
            <Check v-if="copiedLink" class="w-4 h-4 text-emerald-200" />
            <Copy v-else class="w-4 h-4" />
            <span>{{ copiedLink ? 'Đã sao chép link!' : 'Sao chép link mời gửi khách' }}</span>
          </button>

          <!-- Secondary Actions -->
          <div class="flex items-center gap-2 w-full">
            <button
              @click="openLinkQrModal(currentEventLink)"
              class="btn btn-secondary py-2 text-xs flex-1 bg-slate-800/90 text-slate-100 hover:bg-slate-700 border-slate-700 flex items-center justify-center gap-1.5"
            >
              <QrCode class="w-3.5 h-3.5 text-primary-400" />
              <span>Mã QR</span>
            </button>
            <a
              :href="getInviteUrl(currentEventLink.token)"
              target="_blank"
              class="btn btn-ghost py-2 text-xs flex-1 text-slate-300 hover:bg-slate-800 border border-slate-800 flex items-center justify-center gap-1.5"
            >
              <ExternalLink class="w-3.5 h-3.5" />
              <span>Xem form</span>
            </a>
          </div>
        </div>

        <div v-else class="shrink-0 pt-1 md:pt-0">
          <div
            v-if="selectedEvent && (selectedEvent.my_can_invite === 0 || selectedEvent.staff_can_invite === 0)"
            class="p-3 bg-amber-500/20 border border-amber-500/40 rounded-2xl text-amber-200 text-xs flex items-center gap-2 max-w-sm"
          >
            <AlertCircle class="w-4 h-4 shrink-0 text-amber-400" />
            <span>Tài khoản của bạn không được phân quyền tạo link mời cho sự kiện này.</span>
          </div>
          <button
            v-else
            @click="openCreateModal"
            class="btn btn-primary w-full md:w-auto py-2.5 px-5 text-xs shadow-md flex items-center justify-center gap-2"
          >
            <Link2 class="w-4 h-4" />
            <span>Tạo Link Mời Sự Kiện Này</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Collapsible Other Links History -->
    <div v-if="otherLinks.length > 0" class="card overflow-hidden">
      <button
        @click="showOtherLinks = !showOtherLinks"
        class="w-full p-4 text-left flex justify-between items-center hover:bg-slate-50 transition"
      >
        <div class="flex items-center gap-2 text-xs font-bold text-slate-700">
          <Link2 class="w-4 h-4 text-slate-400" />
          <span>Xem tất cả các link mời khác đã tạo ({{ otherLinks.length }} link)</span>
        </div>
        <div class="flex items-center gap-1 text-xs text-slate-400 font-bold">
          <span>{{ showOtherLinks ? 'Thu gọn' : 'Mở rộng' }}</span>
          <ChevronUp v-if="showOtherLinks" class="w-4 h-4" />
          <ChevronDown v-else class="w-4 h-4" />
        </div>
      </button>

      <div v-if="showOtherLinks" class="p-4 pt-0 border-t border-slate-100 overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="text-slate-400 border-b border-slate-100 font-semibold">
            <tr>
              <th class="py-2.5 px-3">Sự kiện</th>
              <th class="py-2.5 px-3">Đã đăng ký / Hạn mức</th>
              <th class="py-2.5 px-3">Hạn dùng</th>
              <th class="py-2.5 px-3">Trạng thái</th>
              <th class="py-2.5 px-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="l in otherLinks" :key="l.id" class="hover:bg-slate-50">
              <td class="py-2.5 px-3 font-bold text-slate-800">{{ l.event_name }}</td>
              <td class="py-2.5 px-3 font-semibold text-slate-600">
                {{ l.current_registrations }}/{{ l.max_registrations }} khách
              </td>
              <td class="py-2.5 px-3 text-slate-400">
                {{ new Date(l.expires_at).toLocaleDateString('vi-VN') }}
              </td>
              <td class="py-2.5 px-3">
                <span
                  class="chip text-[10px]"
                  :class="(l.status === 'CLOSED' || l.current_registrations >= l.max_registrations)
                    ? 'chip-danger'
                    : 'chip-success'"
                >
                  {{ (l.status === 'CLOSED' || l.current_registrations >= l.max_registrations) ? 'Đã đóng' : 'Hoạt động' }}
                </span>
              </td>
              <td class="py-2.5 px-3 text-right space-x-1.5">
                <button
                  @click="openLinkQrModal(l)"
                  class="btn btn-secondary py-1 px-2.5 text-[11px]"
                >
                  QR
                </button>
                <button
                  @click="copyInviteLink(l.token)"
                  class="btn btn-primary py-1 px-2.5 text-[11px]"
                >
                  Sao chép link
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Attendee Registrations Section -->
    <div class="card p-5 sm:p-7 space-y-5">
      <!-- Title & Search Toolbar -->
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 class="text-lg font-black text-slate-900 tracking-tight">
            Danh Sách Khách Mời Đăng Ký
          </h2>
          <p class="text-xs text-slate-500 mt-0.5">
            Quản lý khách đăng ký qua link mời của bạn & Duyệt cấp mã vé QR
          </p>
        </div>

        <!-- Universal Search Input -->
        <div class="w-full md:w-80 relative">
          <Search class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Tìm tên, SĐT, email, mã QR..."
            class="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition"
          />
          <button
            v-if="searchQuery"
            @click="searchQuery = ''"
            class="w-4 h-4 text-slate-400 hover:text-slate-600 absolute right-3 top-1/2 -translate-y-1/2"
          >
            <X class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <!-- Filter Tabs: Horizontal smooth swipe on mobile -->
      <div class="flex flex-nowrap gap-1.5 bg-slate-100 p-1.5 rounded-2xl text-xs font-bold overflow-x-auto no-scrollbar">
        <button
          @click="filterStatus = ''; loadRegistrations()"
          :class="filterStatus === '' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'"
          class="px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap"
        >
          <span>Tất cả</span>
          <span class="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700 font-bold">{{ registrations.length }}</span>
        </button>
        <button
          @click="filterStatus = 'PENDING'; loadRegistrations()"
          :class="filterStatus === 'PENDING' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600 hover:text-amber-700'"
          class="px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap"
        >
          <span class="w-2 h-2 rounded-full bg-amber-500"></span>
          <span>Chờ bạn duyệt</span>
          <span class="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800 font-bold">{{ stats.pending }}</span>
        </button>
        <button
          @click="filterStatus = 'PENDING_ADMIN'; loadRegistrations()"
          :class="filterStatus === 'PENDING_ADMIN' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-indigo-700'"
          class="px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap"
        >
          <span class="w-2 h-2 rounded-full bg-indigo-500"></span>
          <span>Chờ Admin</span>
          <span class="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 text-indigo-800 font-bold">{{ stats.pendingAdmin }}</span>
        </button>
        <button
          @click="filterStatus = 'APPROVED'; loadRegistrations()"
          :class="filterStatus === 'APPROVED' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-emerald-700'"
          class="px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap"
        >
          <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>Đã cấp QR</span>
          <span class="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold">{{ stats.approved }}</span>
        </button>
        <button
          @click="filterStatus = 'REJECTED'; loadRegistrations()"
          :class="filterStatus === 'REJECTED' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-rose-700'"
          class="px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap"
        >
          <span class="w-2 h-2 rounded-full bg-rose-500"></span>
          <span>Từ chối</span>
          <span class="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 text-rose-800 font-bold">{{ stats.rejected }}</span>
        </button>
      </div>

      <!-- Mobile Card List View -->
      <div class="md:hidden space-y-3">
        <div
          v-for="reg in filteredRegistrations"
          :key="reg.id"
          class="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-3"
        >
          <div class="flex justify-between items-start gap-2">
            <div class="flex items-start gap-2.5 min-w-0">
              <div class="w-9 h-9 rounded-xl bg-primary-100 text-primary-700 font-black text-xs flex items-center justify-center shrink-0">
                {{ (reg.full_name || 'K').charAt(0).toUpperCase() }}
              </div>
              <div class="min-w-0">
                <div class="font-extrabold text-slate-900 text-sm leading-tight truncate">{{ reg.full_name }}</div>
                <a :href="`tel:${reg.phone}`" class="text-xs font-mono font-bold text-primary-600 block mt-0.5 truncate">
                  {{ reg.phone }}
                </a>
                <div class="text-[11px] text-slate-400 truncate">{{ reg.email }}</div>
              </div>
            </div>

            <!-- Status Badge -->
            <span
              :class="{
                'chip-amber': reg.status === 'PENDING',
                'chip-primary': reg.status === 'PENDING_ADMIN',
                'chip-success': reg.status === 'APPROVED',
                'chip-danger': reg.status === 'REJECTED',
              }"
              class="chip text-[10px] shrink-0"
            >
              {{ reg.status === 'PENDING' ? 'Chờ bạn duyệt' : reg.status === 'PENDING_ADMIN' ? 'Chờ Admin' : reg.status === 'APPROVED' ? 'Đã cấp QR' : 'Từ chối' }}
            </span>
          </div>

          <div v-if="reg.address" class="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center gap-1.5">
            <MapPin class="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span class="truncate">{{ reg.address }}</span>
          </div>

          <!-- Ticket code badge on mobile -->
          <div v-if="reg.status === 'APPROVED' && reg.ticket_code" class="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200/70 flex justify-between items-center gap-2">
            <div class="min-w-0">
              <div class="text-[10px] font-bold text-emerald-700 uppercase">Mã số vé:</div>
              <div class="font-mono text-xs font-black text-emerald-950 mt-0.5 truncate">{{ reg.ticket_code }}</div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <button
                @click="openInviteCardGenerator(reg)"
                class="btn py-1.5 px-2.5 text-xs bg-amber-500 hover:bg-amber-600 text-white font-bold flex items-center gap-1 shadow-xs"
                title="Tạo thiệp mời"
              >
                <Sparkles class="w-3.5 h-3.5" />
                <span>Thiệp mời</span>
              </button>
              <button
                @click="openTicketQrModal(reg)"
                class="btn btn-primary py-1.5 px-2.5 text-xs"
              >
                <QrCode class="w-3.5 h-3.5" />
                <span>Xem QR</span>
              </button>
            </div>
          </div>

          <!-- Actions -->
          <div v-if="reg.status === 'PENDING'" class="pt-2 border-t border-slate-100 flex gap-2">
            <button
              @click="handleApprove(reg)"
              class="btn btn-primary flex-1 py-2 text-xs font-bold"
            >
              <CheckCircle2 class="w-3.5 h-3.5" />
              <span>{{ reg.event_approval_mode === 'TWO_TIER' ? 'Duyệt V1' : 'Duyệt & Cấp QR' }}</span>
            </button>
            <button
              @click="openRejectModal(reg.id)"
              class="btn btn-ghost border border-slate-200 text-slate-600 hover:text-rose-600 py-2 px-3 text-xs"
            >
              Từ chối
            </button>
          </div>
          <div v-else-if="reg.status === 'PENDING_ADMIN'" class="pt-2 border-t border-slate-100 text-[11px] text-indigo-700 font-medium">
            ℹ️ Bạn đã duyệt vòng 1. Đang chờ Admin duyệt bước cuối để phát hành vé QR.
          </div>
        </div>

        <div v-if="filteredRegistrations.length === 0" class="py-12 text-center text-slate-400 text-xs">
          Không tìm thấy lượt đăng ký nào.
        </div>
      </div>

      <!-- Desktop Table View: Rock-Solid Fixed Column Widths (Zero Layout Shifts) -->
      <div class="hidden md:block border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs bg-white">
        <div class="overflow-x-auto">
          <table class="w-full table-fixed text-left text-xs min-w-[920px]">
            <!-- Strictly Locked Column Percentages -->
            <colgroup>
              <col class="w-[23%]" />
              <col class="w-[14%]" />
              <col class="w-[17%]" />
              <col class="w-[21%]" />
              <col class="w-[11%]" />
              <col class="w-[14%]" />
            </colgroup>
            <thead class="bg-slate-50/90 text-slate-500 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
              <tr>
                <th class="py-3.5 px-4">Khách hàng</th>
                <th class="py-3.5 px-4">Số điện thoại</th>
                <th class="py-3.5 px-4">Email</th>
                <th class="py-3.5 px-4">Mã số vé QR</th>
                <th class="py-3.5 px-4 text-center">Trạng thái</th>
                <th class="py-3.5 px-4 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="reg in filteredRegistrations" :key="reg.id" class="hover:bg-slate-50/80 transition-colors">
                <!-- Col 1: Khách hàng -->
                <td class="py-3.5 px-4">
                  <div class="flex items-center gap-3 min-w-0">
                    <div class="w-8 h-8 rounded-xl bg-primary-100 text-primary-700 font-black text-xs flex items-center justify-center shrink-0">
                      {{ (reg.full_name || 'K').charAt(0).toUpperCase() }}
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="font-extrabold text-slate-900 text-sm leading-tight truncate" :title="reg.full_name">{{ reg.full_name }}</div>
                      <div class="text-[11px] text-slate-400 mt-0.5 truncate">{{ new Date(reg.created_at || Date.now()).toLocaleDateString('vi-VN') }}</div>
                    </div>
                  </div>
                </td>

                <!-- Col 2: Số điện thoại -->
                <td class="py-3.5 px-4 whitespace-nowrap">
                  <a :href="`tel:${reg.phone}`" class="font-mono font-bold text-slate-800 hover:text-primary-600 transition flex items-center gap-1.5 truncate">
                    <Phone class="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span class="truncate">{{ reg.phone }}</span>
                  </a>
                </td>

                <!-- Col 3: Email -->
                <td class="py-3.5 px-4 text-slate-600 truncate" :title="reg.email">
                  {{ reg.email }}
                </td>

                <!-- Col 4: Mã vé QR & Actions -->
                <td class="py-3.5 px-4">
                  <template v-if="reg.ticket_code">
                    <div class="flex items-center gap-1.5 overflow-hidden">
                      <span class="font-mono font-bold text-slate-800 text-[11px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg truncate max-w-[115px]" :title="reg.ticket_code">
                        {{ reg.ticket_code }}
                      </span>
                      <button
                        @click="openTicketQrModal(reg)"
                        class="btn btn-secondary py-1 px-1.5 text-[10px] shrink-0"
                        title="Xem mã QR của vé"
                      >
                        <QrCode class="w-3 h-3 text-primary-600" />
                        <span>QR</span>
                      </button>
                      <button
                        @click="openInviteCardGenerator(reg)"
                        class="btn py-1 px-1.5 text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold flex items-center gap-1 shadow-2xs shrink-0"
                        title="Tạo thiệp mời VIP có tên và ảnh của khách này"
                      >
                        <Sparkles class="w-3 h-3 text-amber-600" />
                        <span>Thiệp mời</span>
                      </button>
                    </div>
                  </template>
                  <span v-else class="text-slate-400 italic text-[11px]">Chưa cấp vé</span>
                </td>

                <!-- Col 5: Trạng thái -->
                <td class="py-3.5 px-4 text-center whitespace-nowrap">
                  <span
                    :class="{
                      'chip-amber': reg.status === 'PENDING',
                      'chip-primary': reg.status === 'PENDING_ADMIN',
                      'chip-success': reg.status === 'APPROVED',
                      'chip-danger': reg.status === 'REJECTED',
                    }"
                    class="chip text-[11px]"
                  >
                    {{ reg.status === 'PENDING' ? 'Chờ bạn duyệt' : reg.status === 'PENDING_ADMIN' ? 'Chờ Admin' : reg.status === 'APPROVED' ? 'Đã cấp QR' : 'Từ chối' }}
                  </span>
                </td>

                <!-- Col 6: Hành động (Compact & Strictly Bounded) -->
                <td class="py-3.5 px-4 text-right whitespace-nowrap">
                  <template v-if="reg.status === 'PENDING'">
                    <div class="flex items-center justify-end gap-1.5">
                      <button
                        @click="handleApprove(reg)"
                        class="btn btn-primary py-1 px-2.5 text-[11px] font-bold shadow-xs whitespace-nowrap flex items-center gap-1"
                        :title="reg.event_approval_mode === 'TWO_TIER' ? 'Duyệt hồ sơ vòng 1' : 'Duyệt & Cấp mã vé QR'"
                      >
                        <CheckCircle2 class="w-3.5 h-3.5" />
                        <span>{{ reg.event_approval_mode === 'TWO_TIER' ? 'Duyệt V1' : 'Duyệt VIP' }}</span>
                      </button>
                      <button
                        @click="openRejectModal(reg.id)"
                        class="btn btn-ghost border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50 py-1 px-2 text-[11px] font-semibold whitespace-nowrap"
                        title="Từ chối đăng ký này"
                      >
                        Từ chối
                      </button>
                    </div>
                  </template>
                  <div v-else-if="reg.status === 'PENDING_ADMIN'" class="flex items-center justify-end">
                    <span class="chip chip-primary text-[10px] font-semibold">
                      Chờ Admin
                    </span>
                  </div>
                  <div v-else class="flex items-center justify-end">
                    <span class="chip chip-slate text-[10px] font-semibold">
                      Đã xử lý
                    </span>
                  </div>
                </td>
              </tr>

              <tr v-if="filteredRegistrations.length === 0">
                <td colspan="6" class="py-12 text-center text-slate-400">
                  <Search class="w-6 h-6 mx-auto mb-1 text-slate-300" />
                  Không tìm thấy lượt đăng ký nào phù hợp.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- QR Viewer Modal -->
    <div v-if="showQrModal" class="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
      <div class="card max-w-sm w-full p-6 shadow-2xl text-center space-y-4 animate-scale-in">
        <div>
          <h3 class="text-base font-black text-slate-900">{{ qrModalTitle }}</h3>
          <p class="text-xs text-slate-500 mt-1">{{ qrModalSubtitle }}</p>
        </div>

        <div class="p-4 bg-white border-2 border-slate-100 rounded-3xl shadow-inner inline-block mx-auto">
          <img :src="qrModalDataUrl" alt="Mã QR" class="w-60 h-60 mx-auto object-contain" />
        </div>

        <div class="p-2.5 bg-slate-50 rounded-xl text-[11px] font-mono text-slate-700 break-all select-all border border-slate-200">
          {{ qrModalCode }}
        </div>

        <div class="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
          <button
            @click="copyToClipboard(qrModalCode)"
            class="btn btn-secondary text-xs py-2"
          >
            <Copy class="w-3.5 h-3.5" />
            <span>Chép</span>
          </button>
          <button
            @click="downloadQrImage"
            class="btn btn-primary text-xs py-2"
          >
            <Download class="w-3.5 h-3.5" />
            <span>Tải</span>
          </button>
          <button
            @click="showQrModal = false"
            class="btn btn-ghost border border-slate-200 text-xs py-2"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Create Link -->
    <div v-if="showCreateLinkModal" class="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
      <div class="card max-w-md w-full p-6 shadow-2xl space-y-4 animate-scale-in">
        <div>
          <h3 class="text-lg font-black text-slate-900">Tạo Link Mời Khách Mới</h3>
          <p class="text-xs text-slate-500 mt-1">
            Link mời bảo mật có chữ ký số, tự động ghi nhận lượt đăng ký của bạn.
          </p>
        </div>

        <div v-if="newlyCreatedUrl" class="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3">
          <div class="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
            <CheckCircle2 class="w-4 h-4 text-emerald-600" />
            <span>Link mời đã được tạo thành công!</span>
          </div>
          <input :value="newlyCreatedUrl" readonly class="w-full text-xs font-mono p-2.5 bg-white border border-emerald-200 rounded-xl select-all" />
          <button
            @click="copyToClipboard(newlyCreatedUrl)"
            class="btn btn-primary w-full py-2.5 text-xs shadow-md"
          >
            <Copy class="w-4 h-4" />
            <span>Sao chép gửi cho khách ngay</span>
          </button>
          <button
            @click="showCreateLinkModal = false"
            class="btn btn-ghost w-full py-2 text-xs"
          >
            Hoàn tất
          </button>
        </div>

        <form v-else @submit.prevent="handleCreateLink" class="space-y-4 text-xs">
          <!-- Admin Quota Notice Banner -->
          <div class="p-3.5 bg-primary-50/80 border border-primary-200 rounded-2xl space-y-1">
            <div class="flex items-center justify-between">
              <span class="font-bold text-primary-900 flex items-center gap-1.5">
                <Target class="w-4 h-4 text-primary-600" />
                Chỉ tiêu Admin phân bổ:
              </span>
              <span class="chip chip-primary text-xs font-black">
                {{ staffQuota?.max_invites || 50 }} khách
              </span>
            </div>
            <p class="text-[11px] text-primary-700 leading-relaxed">
              Bạn được mời tối đa <strong>{{ staffQuota?.max_invites || 50 }}</strong> khách cho sự kiện này. Khi đạt đủ số lượng, link sẽ tự động đóng.
            </p>
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Sự kiện</label>
            <select
              v-model="selectedEventId"
              @change="loadQuota"
              required
              class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-primary-500 focus:outline-none"
            >
              <option v-for="ev in events" :key="ev.id" :value="ev.id">{{ ev.name }}</option>
            </select>
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Thời hạn hiệu lực của link (Số ngày)</label>
            <input
              v-model.number="expireDays"
              type="number"
              min="1"
              max="90"
              class="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          <div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              @click="showCreateLinkModal = false"
              class="btn btn-secondary text-xs"
            >
              Đóng
            </button>
            <button
              type="submit"
              class="btn btn-primary text-xs shadow-md"
            >
              Khởi tạo Link
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Reject Confirmation (Replaces browser prompt) -->
    <div v-if="showRejectModal" class="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
      <div class="card max-w-sm w-full p-6 shadow-2xl space-y-4 animate-scale-in">
        <div class="flex items-center gap-2.5 text-rose-600">
          <div class="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center">
            <XCircle class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-black text-slate-900">Từ Chối Đăng Ký</h3>
            <p class="text-xs text-slate-500">Khách sẽ nhận thông báo không hợp lệ</p>
          </div>
        </div>

        <div class="space-y-1.5 text-xs">
          <label class="block font-bold text-slate-700">Lý do từ chối:</label>
          <textarea
            v-model="rejectReason"
            rows="3"
            placeholder="Nhập lý do từ chối..."
            class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
          ></textarea>
        </div>

        <div class="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            @click="showRejectModal = false"
            class="btn btn-secondary text-xs"
          >
            Hủy
          </button>
          <button
            type="button"
            @click="confirmReject"
            class="btn btn-danger text-xs font-bold"
          >
            Xác nhận từ chối
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL: TẠO THIỆP MỜI ONLINE VIP CHO NGƯỜI GIỚI THIỆU -->
    <InviteCardModal
      :show="showInviteCardModal"
      :cardData="inviteCardData"
      @close="showInviteCardModal = false"
    />
  </div>
</template>
