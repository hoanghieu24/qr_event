<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import api from '../../api/client';
import { getSocket } from '../../api/socket';
import {
  requestNotificationPermission,
  showBrowserNotification,
  checkUpcomingEventReminders
} from '../../utils/notifications';
import { formatSessionLabel, sessionBadgeClasses } from '../../utils/eventSessions';
import {
  QrCode,
  Maximize2,
  Download,
  Printer,
  Calendar,
  MapPin,
  User,
  UserCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  X,
  Layers,
  Sparkles,
  Copy,
  Check,
  SunMedium,
  RotateCw,
  Ticket,
  Share2,
  Bell,
  MessageCircle,
  Smartphone,
  ArrowRight
} from 'lucide-vue-next';
import { isGuestMode } from '../../utils/portalMode';

const ticketsList = ref<any[]>([]);
const pendingList = ref<any[]>([]);
const selectedIndex = ref(0);
const loading = ref(true);
const error = ref('');
const showZoomModal = ref(false);
const zoomIndex = ref(0);
const viewMode = ref<'card' | 'all_qr'>('card');
const realtimeNotice = ref<{ message: string; type: 'success' | 'info' } | null>(null);
const copiedCode = ref(false);
const hasNotificationSupport = ref(
  typeof window !== 'undefined' && 'Notification' in window
);
const notificationAllowed = ref(
  typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
);

let noticeTimer: any = null;
const showNotice = (message: string, type: 'success' | 'info' = 'success') => {
  realtimeNotice.value = { message, type };
  if (noticeTimer) clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    realtimeNotice.value = null;
  }, 7000);
};

const activeTicket = computed(() => {
  if (ticketsList.value.length === 0) return null;
  return ticketsList.value[selectedIndex.value] || ticketsList.value[0];
});

const zoomedTicket = computed(() => {
  if (ticketsList.value.length === 0) return null;
  return ticketsList.value[zoomIndex.value] || ticketsList.value[0];
});

const loadTickets = async () => {
  loading.value = true;
  error.value = '';
  try {
    const res = await api.get('/tickets/my-ticket');
    const data = res.data.data;
    if (data) {
      if (Array.isArray(data)) {
        ticketsList.value = data;
        pendingList.value = [];
      } else if (data.tickets) {
        ticketsList.value = data.tickets;
        pendingList.value = data.pending || [];
      } else if (data.code) {
        ticketsList.value = [data];
        pendingList.value = [];
      }
    } else {
      ticketsList.value = [];
      pendingList.value = [];
    }

    const firstIssuedIdx = ticketsList.value.findIndex((t: any) => t.status === 'ISSUED');
    if (firstIssuedIdx !== -1) {
      selectedIndex.value = firstIssuedIdx;
    } else {
      selectedIndex.value = 0;
    }

    // Check upcoming event reminders for phone
    checkUpcomingEventReminders(ticketsList.value);
  } catch (err: any) {
    if (err.response?.status === 404) {
      ticketsList.value = [];
      pendingList.value = [];
    } else {
      error.value = err.response?.data?.message || err.message;
    }
  } finally {
    loading.value = false;
  }
};

const selectTicket = (idx: number) => {
  selectedIndex.value = idx;
  viewMode.value = 'card';
};

const openZoomModal = (idx?: number) => {
  zoomIndex.value = typeof idx === 'number' ? idx : selectedIndex.value;
  showZoomModal.value = true;
};

const nextZoomTicket = () => {
  if (zoomIndex.value < ticketsList.value.length - 1) {
    zoomIndex.value++;
  } else {
    zoomIndex.value = 0;
  }
};

const prevZoomTicket = () => {
  if (zoomIndex.value > 0) {
    zoomIndex.value--;
  } else {
    zoomIndex.value = ticketsList.value.length - 1;
  }
};

const nextTicket = () => {
  if (selectedIndex.value < ticketsList.value.length - 1) {
    selectedIndex.value++;
  } else {
    selectedIndex.value = 0;
  }
};

const prevTicket = () => {
  if (selectedIndex.value > 0) {
    selectedIndex.value--;
  } else {
    selectedIndex.value = ticketsList.value.length - 1;
  }
};

const handlePrint = () => {
  window.print();
};

const copyTicketCode = (code: string) => {
  if (!code) return;
  navigator.clipboard.writeText(code).then(() => {
    copiedCode.value = true;
    setTimeout(() => {
      copiedCode.value = false;
    }, 2000);
  });
};

const handleEnableNotifications = async () => {
  const granted = await requestNotificationPermission();
  notificationAllowed.value = granted;
  if (granted) {
    showBrowserNotification('🔔 Đã bật thông báo thành công!', {
      body: 'Hệ thống EventGo sẽ nhắc nhở bạn khi vé được duyệt và khi sắp đến ngày diễn ra sự kiện.',
    });
  }
};

const shareViaSms = () => {
  if (!activeTicket.value) return;
  const text = encodeURIComponent(
    `Vé tham dự sự kiện "${activeTicket.value.event_name}". Mã số vé: ${activeTicket.value.code}. Link xem vé: ${window.location.origin}/my-ticket`
  );
  window.open(`sms:?body=${text}`);
};

const shareViaZalo = () => {
  if (!activeTicket.value) return;
  const shareUrl = encodeURIComponent(`${window.location.origin}/my-ticket`);
  window.open(`https://zalo.me/share?url=${shareUrl}`, '_blank');
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const formatTime = (dateStr?: string) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

onMounted(() => {
  loadTickets();

  const socket = getSocket();

  // 1. Ticket check-in scan in real-time
  socket.on('ticket:status_changed', (data: any) => {
    const target = ticketsList.value.find((t: any) => t.code === data.code || t.id === data.ticketId);
    if (target) {
      target.status = 'USED';
      target.used_at = data.usedAt || new Date().toISOString();
      const msg = `✓ Vé "${target.event_name}" của bạn vừa được check-in thành công tại cổng soát vé!`;
      showNotice(msg, 'success');
      showBrowserNotification('🎉 Check-in thành công!', { body: msg });
    }
  });

  // 2. New ticket issued in real-time
  socket.on('ticket:issued', (newTicket: any) => {
    const exists = ticketsList.value.some((t: any) => t.id === newTicket.id || t.code === newTicket.code);
    if (!exists) {
      ticketsList.value.unshift(newTicket);
      pendingList.value = pendingList.value.filter((p: any) => p.event_id !== newTicket.event_id);
      const msg = `🎟️ Vé sự kiện "${newTicket.event_name}" đã được phê duyệt và sẵn sàng sử dụng!`;
      showNotice(msg, 'success');
      showBrowserNotification('🎟️ Vé sự kiện đã được phê duyệt!', {
        body: `Vé "${newTicket.event_name}" của bạn đã sẵn sàng. Mở ứng dụng để xem mã vé QR.`,
      });
      checkUpcomingEventReminders(ticketsList.value);
    }
  });
});

onUnmounted(() => {
  const socket = getSocket();
  socket.off('ticket:status_changed');
  socket.off('ticket:issued');
  if (noticeTimer) clearTimeout(noticeTimer);
});
</script>

<template>
  <div class="max-w-xl mx-auto px-4 py-4 sm:py-8 pb-4 space-y-5 animate-page-in">
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
        class="fixed top-5 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-[120] p-4 bg-emerald-600 text-white rounded-2xl shadow-glow flex items-center justify-between gap-3 border border-emerald-400"
      >
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Sparkles class="w-4 h-4 text-emerald-100" />
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

    <!-- Notification Permission Reminder Banner (Web App Push) -->
    <div
      v-if="!notificationAllowed && hasNotificationSupport"
      class="card p-3 sm:p-3.5 bg-indigo-50/80 border-indigo-200 flex items-center justify-between gap-3"
    >
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
          <Bell class="w-4 h-4" />
        </div>
        <div>
          <div class="text-xs font-bold text-indigo-950">Bật thông báo nhắc nhở sự kiện</div>
          <div class="text-[11px] text-indigo-700">Nhận thông báo khi vé được duyệt & khi sắp đến giờ sự kiện</div>
        </div>
      </div>
      <button
        @click="handleEnableNotifications"
        class="btn btn-primary py-1.5 px-3 text-xs shrink-0 whitespace-nowrap shadow-xs"
      >
        Bật ngay
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="card p-10 text-center space-y-3">
      <div class="w-14 h-14 mx-auto rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center shadow-inner animate-pulse">
        <Ticket class="w-7 h-7" />
      </div>
      <p class="text-sm font-bold text-slate-800">Đang tải danh sách vé điện tử...</p>
      <p class="text-xs text-slate-400">Đồng bộ mã QR bảo mật từ hệ thống EventGo</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="card p-6 text-center border-rose-200 bg-rose-50/50 space-y-3">
      <div class="w-12 h-12 mx-auto rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
        <AlertCircle class="w-6 h-6" />
      </div>
      <div class="font-bold text-sm text-rose-900">{{ error }}</div>
      <button @click="loadTickets" class="btn btn-primary text-xs mx-auto">
        <RotateCw class="w-3.5 h-3.5" />
        Thử tải lại
      </button>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="ticketsList.length === 0 && pendingList.length === 0"
      class="card p-8 sm:p-12 text-center space-y-4"
    >
      <div class="w-16 h-16 mx-auto rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center shadow-inner">
        <Clock class="w-8 h-8" />
      </div>
      <div>
        <h2 class="text-lg font-black text-slate-900">Chưa có vé nào được cấp</h2>
        <p class="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
          Bạn chưa đăng ký tham gia sự kiện nào hoặc đăng ký của bạn đang được người giới thiệu / ban tổ chức xem xét.
        </p>
      </div>
      <router-link to="/" class="btn btn-primary text-xs shadow-md">
        Khám phá sự kiện ngay
      </router-link>
    </div>

    <!-- Main Content -->
    <div v-else class="space-y-4">
      <!-- Top Bar: Title & View Mode Switcher -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Vé Của Tôi</h1>
            <span class="chip chip-primary">
              {{ ticketsList.length }} vé
            </span>
          </div>
          <p class="text-xs text-slate-500 mt-0.5">
            Xuất trình mã QR tại cổng để quét check-in vào sự kiện
          </p>
        </div>

        <!-- Mode Switcher -->
        <div v-if="ticketsList.length > 1" class="flex bg-slate-100 p-1 rounded-xl text-xs font-bold shrink-0 w-full sm:w-auto">
          <button
            @click="viewMode = 'card'"
            :class="viewMode === 'card' ? 'bg-white shadow-xs text-primary-700' : 'text-slate-600'"
            class="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg transition flex items-center justify-center gap-1.5"
          >
            <Ticket class="w-3.5 h-3.5" />
            <span>Thẻ ví</span>
          </button>
          <button
            @click="viewMode = 'all_qr'"
            :class="viewMode === 'all_qr' ? 'bg-white shadow-xs text-primary-700' : 'text-slate-600'"
            class="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg transition flex items-center justify-center gap-1.5"
          >
            <Layers class="w-3.5 h-3.5" />
            <span>Tất cả ({{ ticketsList.length }})</span>
          </button>
        </div>
      </div>

      <!-- Horizontal Event Switcher Pills -->
      <div v-if="ticketsList.length > 1" class="space-y-2">
        <div class="flex items-center justify-between text-[11px] font-bold text-slate-500 px-1">
          <span>Chọn sự kiện cần xuất trình:</span>
          <span class="text-primary-600 font-extrabold">{{ selectedIndex + 1 }} / {{ ticketsList.length }}</span>
        </div>

        <div class="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar scroll-smooth">
          <button
            v-for="(t, idx) in ticketsList"
            :key="t.id"
            @click="selectTicket(idx)"
            :class="selectedIndex === idx
              ? 'bg-slate-950 text-white shadow-lift ring-2 ring-primary-500'
              : 'bg-white text-slate-700 border border-slate-200/90 hover:bg-slate-50'"
            class="p-3 rounded-2xl text-left transition shrink-0 w-60 sm:w-64 flex flex-col justify-between"
          >
            <div class="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
              <div class="flex items-center gap-1.5">
                <span
                  :class="selectedIndex === idx ? 'bg-primary-500 text-white' : 'bg-slate-100 text-slate-600'"
                  class="px-2 py-0.5 rounded-md text-[10px] font-black"
                >
                  #{{ idx + 1 }}
                </span>
                <span
                  v-if="t.session_type && t.session_type !== 'FULL_DAY'"
                  class="px-2 py-0.5 rounded-md border text-[10px] font-bold"
                  :class="sessionBadgeClasses(t.session_type)"
                >
                  {{ formatSessionLabel(t.session_type) }}
                </span>
              </div>

              <span
                v-if="t.status === 'ISSUED'"
                class="chip chip-success text-[10px] py-0.5"
              >
                ● HỢP LỆ
              </span>
              <span
                v-else
                class="chip chip-slate text-[10px] py-0.5"
              >
                ✓ ĐÃ DÙNG
              </span>
            </div>

            <div class="font-extrabold text-xs line-clamp-2 leading-snug mb-2">
              {{ t.event_name }}
            </div>

            <div class="text-[10px] opacity-75 flex items-center gap-1 font-medium">
              <Calendar class="w-3 h-3 shrink-0" />
              <span>{{ formatDate(t.event_start_at) }}</span>
            </div>
          </button>
        </div>
      </div>

      <!-- VIEW MODE 1: APPLE WALLET PASS CARD -->
      <div v-if="viewMode === 'card' && activeTicket" class="space-y-4">
        <div class="bg-white rounded-3xl shadow-card border border-slate-200/90 overflow-hidden relative print:border-none print:shadow-none transition-all">
          <!-- Top Pass Header (Modern Dark Gradient) -->
          <div class="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white p-5 sm:p-6 relative overflow-hidden">
            <div class="absolute -right-8 -top-8 w-36 h-36 bg-primary-500/15 rounded-full blur-2xl pointer-events-none"></div>

            <div class="flex justify-between items-center mb-3 relative z-10 gap-2 flex-wrap">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="px-2.5 py-1 bg-white/10 backdrop-blur-md text-primary-300 font-black text-[10px] rounded-lg tracking-wider uppercase border border-white/10 flex items-center gap-1">
                  <Ticket class="w-3 h-3" />
                  EventGo PASS
                </span>
                <span
                  v-if="activeTicket.session_type && activeTicket.session_type !== 'FULL_DAY'"
                  class="px-2.5 py-1 rounded-lg text-[10px] font-black border"
                  :class="activeTicket.session_type === 'MORNING' ? 'bg-amber-400/20 text-amber-200 border-amber-400/40' : 'bg-indigo-400/20 text-indigo-200 border-indigo-400/40'"
                >
                  {{ formatSessionLabel(activeTicket.session_type) }}
                </span>
                <span v-if="ticketsList.length > 1" class="text-[11px] text-slate-400 font-mono">
                  #{{ selectedIndex + 1 }}/{{ ticketsList.length }}
                </span>
              </div>

              <span
                :class="activeTicket.status === 'ISSUED' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30' : 'bg-slate-800 text-slate-400 border-slate-700'"
                class="px-3 py-1 rounded-full text-[11px] font-black border backdrop-blur-md flex items-center gap-1.5 shadow-xs"
              >
                <span v-if="activeTicket.status === 'ISSUED'" class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>{{ activeTicket.status === 'ISSUED' ? 'SẴN SÀNG QUÉT' : 'ĐÃ CHECK-IN' }}</span>
              </span>
            </div>

            <!-- Event Name -->
            <h2 class="text-lg sm:text-xl font-black tracking-tight text-white leading-snug relative z-10 line-clamp-2">
              {{ activeTicket.event_name }}
            </h2>

            <!-- Event meta details -->
            <div class="mt-3 text-xs text-slate-300 space-y-1.5 relative z-10 font-medium">
              <div class="flex items-center gap-2">
                <MapPin class="w-3.5 h-3.5 text-primary-400 shrink-0" />
                <span class="truncate">{{ activeTicket.event_location || 'Địa điểm cập nhật sau' }}</span>
              </div>
              <div class="flex items-center gap-2">
                <Calendar class="w-3.5 h-3.5 text-primary-400 shrink-0" />
                <span>{{ formatDate(activeTicket.event_start_at) }} lúc {{ formatTime(activeTicket.event_start_at) }}</span>
              </div>
            </div>
          </div>

          <!-- Perforated Tear/Cut Line with cut notches -->
          <div class="relative bg-white py-2 flex items-center justify-between">
            <div class="w-5 h-5 rounded-full bg-slate-100 -ml-2.5 shadow-inner border border-slate-200"></div>
            <div class="border-b-2 border-dashed border-slate-200 flex-1 mx-2"></div>
            <div class="w-5 h-5 rounded-full bg-slate-100 -mr-2.5 shadow-inner border border-slate-200"></div>
          </div>

          <!-- Ticket Pass Body (QR Code Area) -->
          <div class="p-5 sm:p-7 bg-white text-center space-y-5">
            <div class="flex flex-col items-center justify-center">
              <div
                @click="openZoomModal()"
                class="p-4 sm:p-5 bg-white border-2 rounded-3xl inline-block cursor-pointer transition-all duration-200 relative group"
                :class="activeTicket.status === 'ISSUED'
                  ? 'border-primary-200 hover:border-primary-500 hover:shadow-lift ring-4 ring-primary-50'
                  : 'border-slate-300 hover:border-slate-400'"
              >
                <img
                  :src="activeTicket.qr_image"
                  :alt="`QR ${activeTicket.code}`"
                  class="w-52 h-52 sm:w-60 sm:h-60 object-contain mx-auto"
                />

                <div class="absolute inset-0 bg-slate-950/40 rounded-3xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition backdrop-blur-xs">
                  <span class="bg-white text-slate-900 text-xs font-black px-3.5 py-2 rounded-full shadow-lg flex items-center gap-1.5">
                    <Maximize2 class="w-3.5 h-3.5 text-primary-600" />
                    Chạm để phóng to
                  </span>
                </div>
              </div>

              <!-- Ticket Code + Copy Button -->
              <div class="mt-3.5 flex items-center gap-2">
                <span class="font-mono text-sm sm:text-base font-black tracking-widest text-slate-800 bg-slate-100 px-3.5 py-1 rounded-xl border border-slate-200">
                  {{ activeTicket.code }}
                </span>
                <button
                  @click="copyTicketCode(activeTicket.code)"
                  class="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition border border-transparent hover:border-primary-200"
                  :title="copiedCode ? 'Đã sao chép' : 'Sao chép mã vé'"
                >
                  <Check v-if="copiedCode" class="w-4 h-4 text-emerald-600" />
                  <Copy v-else class="w-4 h-4" />
                </button>
              </div>

              <p class="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                <SunMedium class="w-3.5 h-3.5 text-amber-500" />
                <span>Chạm vào QR để mở sáng toàn màn hình khi đến cửa</span>
              </p>
            </div>

            <!-- Attendee Details Grid -->
            <div class="bg-slate-50/80 rounded-2xl p-4 text-xs text-left grid grid-cols-2 gap-3 border border-slate-100">
              <div>
                <div class="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                  <User class="w-3 h-3" />
                  Khách tham dự
                </div>
                <div class="font-extrabold text-slate-900 text-sm mt-0.5 truncate">{{ activeTicket.full_name }}</div>
                <div class="text-slate-500 font-mono text-[11px] mt-0.5">{{ activeTicket.phone }}</div>
              </div>

              <div>
                <div class="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                  <UserCheck class="w-3 h-3" />
                  Người giới thiệu
                </div>
                <div class="font-extrabold text-primary-700 text-sm mt-0.5 truncate">{{ activeTicket.referrer_name }}</div>
                <div class="text-emerald-600 text-[10px] font-bold mt-0.5 flex items-center gap-1">
                  <CheckCircle2 class="w-3 h-3" />
                  Đã duyệt vé
                </div>
              </div>
            </div>

            <!-- Status Notice -->
            <div
              v-if="activeTicket.status === 'ISSUED'"
              class="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 text-left"
            >
              <CheckCircle2 class="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Vé hợp lệ. Mã QR dùng 1 lần duy nhất để check-in tại cổng sự kiện.</span>
            </div>
            <div
              v-else
              class="p-3 bg-slate-100 rounded-2xl border border-slate-200 text-slate-600 text-xs text-left flex items-center gap-2"
            >
              <Clock class="w-4 h-4 text-slate-400 shrink-0" />
              <span>Đã check-in vào lúc: <strong>{{ new Date(activeTicket.used_at).toLocaleString('vi-VN') }}</strong></span>
            </div>
          </div>
        </div>

        <!-- Flipping Navigation (when multiple tickets) -->
        <div v-if="ticketsList.length > 1" class="flex items-center justify-between gap-3 p-2 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <button
            @click="prevTicket"
            class="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1"
          >
            <ChevronLeft class="w-4 h-4" />
            <span>Vé trước</span>
          </button>

          <div class="flex items-center gap-1.5">
            <button
              v-for="(_, idx) in ticketsList"
              :key="idx"
              @click="selectTicket(idx)"
              :class="selectedIndex === idx ? 'w-5 bg-primary-600' : 'w-2 bg-slate-300'"
              class="h-2 rounded-full cursor-pointer transition-all duration-200"
              :aria-label="`Vé số ${idx + 1}`"
            ></button>
          </div>

          <button
            @click="nextTicket"
            class="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1"
          >
            <span>Vé tiếp</span>
            <ChevronRight class="w-4 h-4" />
          </button>
        </div>

        <!-- Quick Share Bar (Zalo, SMS, Copy) -->
        <div class="card p-3 flex items-center justify-between gap-2 text-xs">
          <span class="text-slate-500 font-bold hidden sm:inline">Chia sẻ vé:</span>
          <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              @click="shareViaZalo"
              class="btn btn-secondary py-2 px-3 text-xs flex-1 sm:flex-initial flex items-center justify-center gap-1.5"
              title="Chia sẻ qua Zalo"
            >
              <MessageCircle class="w-3.5 h-3.5 text-blue-500" />
              <span>Zalo</span>
            </button>
            <button
              @click="shareViaSms"
              class="btn btn-secondary py-2 px-3 text-xs flex-1 sm:flex-initial flex items-center justify-center gap-1.5"
              title="Gửi qua SMS"
            >
              <Smartphone class="w-3.5 h-3.5 text-emerald-500" />
              <span>SMS</span>
            </button>
            <button
              @click="copyTicketCode(activeTicket.code)"
              class="btn btn-secondary py-2 px-3 text-xs flex-1 sm:flex-initial flex items-center justify-center gap-1.5"
            >
              <Copy class="w-3.5 h-3.5 text-primary-500" />
              <span>{{ copiedCode ? 'Đã sao chép' : 'Chép mã' }}</span>
            </button>
          </div>
        </div>

        <!-- Main Action Buttons -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 print:hidden">
          <button
            @click="openZoomModal()"
            class="btn btn-primary py-3 text-xs shadow-md"
          >
            <Maximize2 class="w-4 h-4" />
            <span>Phóng to mã QR</span>
          </button>

          <a
            :href="activeTicket.qr_image"
            :download="`ve-eventgo-${activeTicket.code}.png`"
            class="btn btn-secondary py-3 text-xs"
          >
            <Download class="w-4 h-4" />
            <span>Tải ảnh mã QR</span>
          </a>

          <button
            @click="handlePrint"
            class="btn btn-dark py-3 text-xs"
          >
            <Printer class="w-4 h-4" />
            <span>In vé / Lưu PDF</span>
          </button>
        </div>
      </div>

      <!-- VIEW MODE 2: ALL QR CODES GRID VIEW -->
      <div v-else-if="viewMode === 'all_qr'" class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            v-for="(t, idx) in ticketsList"
            :key="t.id"
            class="card p-5 hover:border-primary-400 transition flex flex-col justify-between space-y-4"
          >
            <div>
              <div class="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <div class="flex items-center gap-1.5">
                  <span class="chip chip-primary text-[10px]">
                    Vé #{{ idx + 1 }}
                  </span>
                  <span
                    v-if="t.session_type && t.session_type !== 'FULL_DAY'"
                    class="px-2 py-0.5 rounded-full border text-[10px] font-bold"
                    :class="sessionBadgeClasses(t.session_type)"
                  >
                    {{ formatSessionLabel(t.session_type) }}
                  </span>
                </div>

                <span
                  :class="t.status === 'ISSUED' ? 'chip-success' : 'chip-slate'"
                  class="chip text-[10px]"
                >
                  {{ t.status === 'ISSUED' ? '● HỢP LỆ' : '✓ ĐÃ CHECK-IN' }}
                </span>
              </div>

              <h3 class="font-black text-slate-900 text-sm leading-snug line-clamp-2">
                {{ t.event_name }}
              </h3>

              <div class="text-[11px] text-slate-500 mt-1.5 space-y-0.5 font-medium">
                <div class="truncate flex items-center gap-1">
                  <MapPin class="w-3 h-3 text-slate-400 shrink-0" />
                  <span class="truncate">{{ t.event_location }}</span>
                </div>
                <div class="flex items-center gap-1">
                  <Calendar class="w-3 h-3 text-slate-400 shrink-0" />
                  <span>{{ formatDate(t.event_start_at) }}</span>
                </div>
              </div>
            </div>

            <div
              @click="openZoomModal(idx)"
              class="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center cursor-pointer hover:bg-slate-100 transition group"
            >
              <img
                :src="t.qr_image"
                :alt="`QR ${t.code}`"
                class="w-40 h-40 object-contain mx-auto"
              />
              <div class="font-mono text-xs font-black text-slate-800 mt-2">
                {{ t.code }}
              </div>
              <div class="text-[10px] text-primary-600 font-bold mt-1 group-hover:underline flex items-center justify-center gap-1">
                <Maximize2 class="w-3 h-3" />
                <span>Chạm để phóng to</span>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
              <button
                @click="openZoomModal(idx)"
                class="btn btn-primary py-2 text-xs"
              >
                Quét vé này
              </button>
              <button
                @click="selectTicket(idx)"
                class="btn btn-secondary py-2 text-xs"
              >
                Chi tiết
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- PENDING REGISTRATIONS SECTION -->
      <div v-if="pendingList.length > 0" class="card p-5 bg-amber-50/70 border-amber-200/90 space-y-3">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <Clock class="w-4 h-4" />
          </div>
          <div>
            <h3 class="font-black text-sm text-amber-950">Đang chờ phê duyệt ({{ pendingList.length }})</h3>
            <p class="text-[11px] text-amber-700">Mã QR sẽ tự kích hoạt ngay sau khi được người phụ trách duyệt</p>
          </div>
        </div>

        <div class="space-y-2">
          <div
            v-for="p in pendingList"
            :key="p.registration_id"
            class="p-3 bg-white rounded-2xl border border-amber-200/80 flex items-center justify-between gap-3 text-xs"
          >
            <div>
              <div class="flex items-center gap-1.5 flex-wrap">
                <div class="font-extrabold text-slate-900">{{ p.event_name }}</div>
                <span
                  v-if="p.session_type && p.session_type !== 'FULL_DAY'"
                  class="px-2 py-0.5 rounded-full border text-[10px] font-bold"
                  :class="sessionBadgeClasses(p.session_type)"
                >
                  {{ formatSessionLabel(p.session_type) }}
                </span>
              </div>
              <div class="text-[11px] text-slate-500 mt-0.5">
                Người giới thiệu: <strong class="text-slate-800">{{ p.referrer_name }}</strong>
              </div>
            </div>

            <span class="chip chip-amber text-[10px] py-1 shrink-0">
              {{ p.registration_status === 'PENDING_ADMIN' ? 'Chờ Admin duyệt' : 'Chờ NV duyệt' }}
            </span>
          </div>
        </div>
      </div>

      <!-- UPGRADE TO EVENT HOST BANNER (Hide in Guest Portal) -->
      <div v-if="!isGuestMode" class="card p-5 bg-gradient-to-r from-primary-50 via-indigo-50/60 to-purple-50 border border-primary-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl">
        <div class="flex items-center gap-3.5 text-left">
          <div class="w-11 h-11 rounded-2xl bg-primary-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-primary-500/20">
            <Sparkles class="w-5 h-5" />
          </div>
          <div>
            <h3 class="font-black text-slate-900 text-sm">Bạn Muốn Tự Tổ Chức Sự Kiện Của Riêng Mình?</h3>
            <p class="text-xs text-slate-500 mt-0.5">Dùng ngay email này để nâng cấp thành Ban tổ chức — Tặng bạn <b>3 sự kiện miễn phí</b> với đầy đủ tính năng vé QR & check-in.</p>
          </div>
        </div>

        <router-link
          to="/login?tab=host&mode=register"
          class="btn btn-primary text-xs font-bold py-2.5 px-4 rounded-xl shadow-xs shrink-0 whitespace-nowrap flex items-center gap-1.5"
        >
          <span>Mở Sự Kiện Ngay</span>
          <ArrowRight class="w-4 h-4" />
        </router-link>
      </div>
    </div>

    <!-- FULLSCREEN QR ZOOM MODAL -->
    <div
      v-if="showZoomModal && zoomedTicket"
      class="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[130] flex flex-col items-center justify-center p-4 text-center select-none"
      @click.self="showZoomModal = false"
    >
      <div class="card max-w-sm w-full p-6 sm:p-8 shadow-2xl space-y-4 border-slate-200 relative animate-scale-in">
        <button
          @click="showZoomModal = false"
          class="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition"
        >
          <X class="w-4 h-4" />
        </button>

        <div>
          <span
            :class="zoomedTicket.status === 'ISSUED' ? 'chip-success' : 'chip-slate'"
            class="chip text-xs inline-flex mb-2"
          >
            {{ zoomedTicket.status === 'ISSUED' ? '● HỢP LỆ (SẴN SÀNG QUÉT)' : '✓ ĐÃ CHECK-IN' }}
          </span>

          <h3 class="font-black text-slate-900 text-base leading-snug line-clamp-2">
            {{ zoomedTicket.event_name }}
          </h3>

          <div v-if="ticketsList.length > 1" class="text-xs text-primary-600 font-bold mt-1">
            Vé {{ zoomIndex + 1 }} / {{ ticketsList.length }} vé
          </div>
        </div>

        <div class="p-3 bg-white border-2 border-slate-900 rounded-3xl shadow-inner inline-block mx-auto">
          <img
            :src="zoomedTicket.qr_image"
            :alt="`QR ${zoomedTicket.code}`"
            class="w-64 h-64 sm:w-72 sm:h-72 object-contain mx-auto"
          />
        </div>

        <div>
          <div class="font-mono text-lg font-black tracking-widest text-slate-900">
            {{ zoomedTicket.code }}
          </div>
          <div class="font-extrabold text-sm text-primary-700 mt-0.5">
            {{ zoomedTicket.full_name }}
          </div>
        </div>

        <div v-if="ticketsList.length > 1" class="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <button
            @click="prevZoomTicket"
            class="btn btn-secondary py-2 px-3 text-xs"
          >
            <ChevronLeft class="w-3.5 h-3.5" />
            <span>Trước</span>
          </button>

          <span class="text-xs font-bold text-slate-400">
            {{ zoomIndex + 1 }} / {{ ticketsList.length }}
          </span>

          <button
            @click="nextZoomTicket"
            class="btn btn-secondary py-2 px-3 text-xs"
          >
            <span>Tiếp</span>
            <ChevronRight class="w-3.5 h-3.5" />
          </button>
        </div>

        <div class="text-[11px] text-slate-400 pt-1 flex items-center justify-center gap-1 font-medium">
          <SunMedium class="w-3.5 h-3.5 text-amber-500" />
          <span>Vui lòng tăng độ sáng màn hình khi quét</span>
        </div>
      </div>
    </div>
  </div>
</template>
