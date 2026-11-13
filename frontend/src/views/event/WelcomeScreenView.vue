<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import api from '../../api/client';
import { getSocket } from '../../api/socket';
import {
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  Sparkles,
  Trophy,
  Users,
  Clock,
  Ticket,
  CheckCircle2,
  Gift,
  RotateCw,
  Award,
  Crown
} from 'lucide-vue-next';

const route = useRoute();
const eventId = ref<number>(Number(route.params.id) || 1);
const eventData = ref<any>(null);
const checkedInGuests = ref<any[]>([]);
const latestCheckin = ref<any>(null);
const showBigWelcome = ref(false);
const isFullscreen = ref(false);
const soundEnabled = ref(true);
const currentTime = ref('');

// Tab: 'welcome' | 'luckydraw'
const currentMode = ref<'welcome' | 'luckydraw'>('welcome');

// Lucky Draw state
const selectedPrize = ref('Giải Đặc Biệt');
const prizes = ['Giải Đặc Biệt', 'Giải Nhất', 'Giải Nhì', 'Giải Ba', 'Giải Khuyến Khích'];
const isRolling = ref(false);
const rollingCandidate = ref<any>(null);
const luckyWinner = ref<any>(null);
const winnersList = ref<Array<{ prize: string; guest: any; wonAt: string }>>([]);

let timeInterval: any = null;
let welcomeTimer: any = null;
let rollInterval: any = null;

// Clock
const updateClock = () => {
  const now = new Date();
  currentTime.value = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

// Fullscreen toggle
const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().then(() => {
      isFullscreen.value = true;
    }).catch(() => {});
  } else {
    document.exitFullscreen().then(() => {
      isFullscreen.value = false;
    }).catch(() => {});
  }
};

// Play audio effects using Web Audio API synthesized chimes
const playChime = () => {
  if (!soundEnabled.value) return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
      gain.gain.setValueAtTime(0.3, ctx.currentTime + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.12);
      osc.stop(ctx.currentTime + idx * 0.12 + 0.6);
    });
  } catch (e) {
    console.warn('Audio chime error:', e);
  }
};

const playFanfare = () => {
  if (!soundEnabled.value) return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const notes = [440, 554.37, 659.25, 880, 880, 1108.73];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.15);
      gain.gain.setValueAtTime(0.2, ctx.currentTime + idx * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.15 + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.15);
      osc.stop(ctx.currentTime + idx * 0.15 + 0.5);
    });
  } catch (e) {
    console.warn('Audio fanfare error:', e);
  }
};

// Load event report and all checked-in attendees
const loadEventData = async () => {
  try {
    const res = await api.get(`/events/${eventId.value}/report`);
    eventData.value = res.data.data.event;
    const attendees = res.data.data.attendees || [];
    checkedInGuests.value = attendees.filter((a: any) => a.ticket_status === 'USED');
  } catch (e) {
    console.error('Error loading event data:', e);
  }
};

// Trigger big welcome on screen when a new check-in arrives
const triggerWelcome = (guest: any) => {
  latestCheckin.value = guest;
  showBigWelcome.value = true;
  playChime();

  // Also add to checkedInGuests if not already there
  const exists = checkedInGuests.value.some((g) => g.id === guest.customerId || g.full_name === guest.customerName);
  if (!exists) {
    checkedInGuests.value.unshift({
      id: guest.customerId,
      full_name: guest.customerName,
      phone: guest.customerPhone,
      ticket_code: guest.code,
      checked_in_at: guest.usedAt || new Date().toISOString(),
      scanner_name: guest.staffName,
      referrer_name: guest.referrerName,
    });
  }

  if (welcomeTimer) clearTimeout(welcomeTimer);
  welcomeTimer = setTimeout(() => {
    showBigWelcome.value = false;
  }, 7000);
};

// Lucky Draw logic
const startLuckyDraw = () => {
  if (checkedInGuests.value.length === 0) {
    alert('Chưa có khách nào check-in sự kiện để bốc thăm!');
    return;
  }

  // Filter out already won guests
  const eligible = checkedInGuests.value.filter(
    (g) => !winnersList.value.some((w) => w.guest.ticket_code === g.ticket_code || w.guest.full_name === g.full_name)
  );

  if (eligible.length === 0) {
    alert('Tất cả khách mời đã check-in đều đã trúng thưởng!');
    return;
  }

  isRolling.value = true;
  luckyWinner.value = null;

  let speed = 50;
  let elapsed = 0;
  const totalDuration = 4500; // 4.5 seconds

  rollInterval = setInterval(() => {
    elapsed += speed;
    const randIdx = Math.floor(Math.random() * eligible.length);
    rollingCandidate.value = eligible[randIdx];

    if (elapsed >= totalDuration) {
      clearInterval(rollInterval);
      isRolling.value = false;
      luckyWinner.value = rollingCandidate.value;
      winnersList.value.unshift({
        prize: selectedPrize.value,
        guest: luckyWinner.value,
        wonAt: new Date().toLocaleTimeString('vi-VN'),
      });
      playFanfare();
    }
  }, speed);
};

onMounted(async () => {
  updateClock();
  timeInterval = setInterval(updateClock, 1000);
  await loadEventData();

  // Socket listener for real-time checkins
  const socket = getSocket();
  socket.emit('join:event', eventId.value);
  socket.on('scan:recorded', (data: any) => {
    if (data && (Number(data.eventId) === eventId.value || !data.eventId)) {
      triggerWelcome(data);
    }
  });
});

onUnmounted(() => {
  if (timeInterval) clearInterval(timeInterval);
  if (welcomeTimer) clearTimeout(welcomeTimer);
  if (rollInterval) clearInterval(rollInterval);
  const socket = getSocket();
  socket.emit('leave:event', eventId.value);
  socket.off('scan:recorded');
});
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-white font-sans overflow-x-hidden relative select-none flex flex-col justify-between">
    <!-- Background Luxury Radial Aura -->
    <div class="fixed inset-0 pointer-events-none z-0">
      <div class="absolute -top-40 -left-40 w-96 h-96 bg-primary-600/20 rounded-full blur-[140px]"></div>
      <div class="absolute -bottom-40 -right-40 w-96 h-96 bg-amber-500/20 rounded-full blur-[140px]"></div>
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-indigo-900/10 rounded-full blur-[180px]"></div>
    </div>

    <!-- TOP HEADER BAR -->
    <header class="relative z-20 px-6 py-4 flex items-center justify-between border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md">
      <!-- Left: Logo & Event Title -->
      <div class="flex items-center gap-4">
        <img src="/logo-white.png" alt="EventGo" class="h-9 w-auto object-contain" />
        <div>
          <span class="text-[10px] uppercase tracking-widest text-primary-400 font-extrabold flex items-center gap-1.5">
            <Sparkles class="w-3 h-3 text-amber-400" />
            MÀN HÌNH CHÀO MỪNG SỰ KIỆN VIP
          </span>
          <h1 class="text-base sm:text-lg font-black text-white tracking-tight truncate max-w-xl">
            {{ eventData?.name || 'SỰ KIỆN DOANH NGHIỆP CÔNG NGHỆ 2026' }}
          </h1>
        </div>
      </div>

      <!-- Center: Switch Mode (Welcome Screen vs Lucky Draw) -->
      <div class="flex items-center gap-1 bg-slate-900/90 p-1 rounded-2xl border border-slate-800 shadow-inner">
        <button
          @click="currentMode = 'welcome'"
          class="px-4 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5"
          :class="currentMode === 'welcome' ? 'bg-primary-600 text-white shadow-md shadow-primary-600/30' : 'text-slate-400 hover:text-white'"
        >
          <Crown class="w-3.5 h-3.5 text-amber-300" />
          <span>Chào Mừng Check-in</span>
        </button>
        <button
          @click="currentMode = 'luckydraw'"
          class="px-4 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5"
          :class="currentMode === 'luckydraw' ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30' : 'text-slate-400 hover:text-white'"
        >
          <Trophy class="w-3.5 h-3.5 text-yellow-300" />
          <span>Bốc Thăm May Mắn</span>
        </button>
      </div>

      <!-- Right: Realtime Clock & Actions -->
      <div class="flex items-center gap-3">
        <!-- Live Checked-In Count Badge -->
        <div class="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 text-xs font-bold">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Đã đến: <strong>{{ checkedInGuests.length }}</strong> khách</span>
        </div>

        <!-- Clock -->
        <div class="hidden sm:flex items-center gap-1.5 font-mono text-sm font-bold text-slate-300 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
          <Clock class="w-3.5 h-3.5 text-slate-400" />
          <span>{{ currentTime }}</span>
        </div>

        <!-- Sound toggle -->
        <button
          @click="soundEnabled = !soundEnabled"
          class="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          :title="soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'"
        >
          <Volume2 v-if="soundEnabled" class="w-4 h-4 text-emerald-400" />
          <VolumeX v-else class="w-4 h-4 text-slate-500" />
        </button>

        <!-- Fullscreen toggle -->
        <button
          @click="toggleFullscreen"
          class="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          title="Toàn màn hình (F11)"
        >
          <Minimize v-if="isFullscreen" class="w-4 h-4" />
          <Maximize v-else class="w-4 h-4" />
        </button>
      </div>
    </header>

    <!-- MAIN BODY CONTAINER -->
    <main class="relative z-10 flex-1 flex flex-col p-6 max-w-7xl mx-auto w-full">
      <!-- ================= MODE 1: WELCOME SCREEN ================= -->
      <div v-if="currentMode === 'welcome'" class="flex-1 flex flex-col justify-between space-y-6">
        <!-- BIG WELCOME MODAL OVERLAY WHEN A GUEST SCANS IN -->
        <transition name="pop">
          <div
            v-if="showBigWelcome && latestCheckin"
            class="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/85 backdrop-blur-lg"
          >
            <div class="relative max-w-2xl w-full text-center space-y-6 p-10 rounded-3xl bg-gradient-to-b from-slate-900/90 to-indigo-950/90 border-2 border-amber-400/60 shadow-[0_0_80px_rgba(245,158,11,0.25)] animate-scale-in">
              <!-- Golden Laurels / Crown -->
              <div class="w-20 h-20 mx-auto rounded-3xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-glow animate-bounce">
                <Crown class="w-10 h-10" />
              </div>

              <div class="space-y-1">
                <p class="text-xs uppercase tracking-widest text-amber-400 font-black">
                  ✦ NHIỆT LIỆT CHÀO MỪNG QUÝ KHÁCH ✦
                </p>
                <h2 class="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-300 tracking-tight py-2">
                  {{ latestCheckin.customerName }}
                </h2>
                <p v-if="latestCheckin.customerPhone" class="text-sm font-mono text-slate-400">
                  SĐT: {{ latestCheckin.customerPhone }}
                </p>
              </div>

              <!-- Ticket Code & Checkin Details Pill -->
              <div class="inline-flex items-center gap-3 px-6 py-2.5 rounded-full bg-slate-900/80 border border-amber-400/30 text-amber-300 text-sm font-mono font-bold shadow-inner">
                <Ticket class="w-4 h-4 text-amber-400" />
                <span>MÃ VÉ: {{ latestCheckin.code }}</span>
                <span class="text-slate-500">·</span>
                <span class="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 class="w-3.5 h-3.5" />
                  ĐÃ CHECK-IN HỢP LỆ
                </span>
              </div>

              <div class="pt-2 text-xs text-slate-400">
                Kính chúc Quý khách có một trải nghiệm sự kiện tuyệt vời!
              </div>
            </div>
          </div>
        </transition>

        <!-- NORMAL STAGE HERO BANNER (When no pop-up is active) -->
        <div class="text-center py-8 space-y-3">
          <div class="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-primary-500/10 border border-primary-500/30 text-primary-300 text-xs font-bold uppercase tracking-widest">
            <Sparkles class="w-3.5 h-3.5 text-amber-400" />
            CỔNG ĐIỂM DANH THỜI GIAN THỰC (REALTIME CHECK-IN)
          </div>
          <h2 class="text-3xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-400 tracking-tight">
            Chào Mừng Đến Với Sự Kiện
          </h2>
          <p class="text-slate-400 text-sm max-w-xl mx-auto">
            Quý khách vui lòng xuất trình mã vé QR trên điện thoại tại bàn lễ tân để hoàn tất thủ tục điểm danh vào hội trường.
          </p>
        </div>

        <!-- RECENTLY CHECKED-IN GUESTS GRID -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Users class="w-4 h-4 text-primary-400" />
              Khách Mời Vừa Check-in Mới Nhất ({{ checkedInGuests.length }} Khách)
            </h3>
            <span class="text-xs text-slate-500 font-mono">Tự động cập nhật trực tiếp</span>
          </div>

          <div v-if="checkedInGuests.length > 0" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[380px] overflow-y-auto pr-1">
            <div
              v-for="(guest, idx) in checkedInGuests.slice(0, 16)"
              :key="guest.ticket_code || idx"
              class="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 hover:border-amber-400/50 transition-all duration-300 flex items-center gap-3 shadow-md"
            >
              <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 font-black flex items-center justify-center shrink-0 shadow-sm">
                {{ (guest.full_name || 'VIP').charAt(0).toUpperCase() }}
              </div>
              <div class="min-w-0 flex-1">
                <div class="font-bold text-sm text-white truncate">{{ guest.full_name }}</div>
                <div class="text-[11px] font-mono text-slate-400 truncate">
                  Vé: {{ guest.ticket_code }}
                </div>
                <div class="text-[10px] text-emerald-400 font-bold flex items-center gap-1 mt-0.5">
                  <CheckCircle2 class="w-2.5 h-2.5" />
                  <span>Check-in: {{ guest.checked_in_at ? new Date(guest.checked_in_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Vừa xong' }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty state -->
          <div v-else class="py-16 text-center text-slate-500 text-sm border-2 border-dashed border-slate-800 rounded-3xl space-y-2">
            <Ticket class="w-8 h-8 text-slate-600 mx-auto" />
            <p>Chưa có lượt quét vé nào. Khi nhân viên quét vé ở cổng, danh sách sẽ tự động nhảy lên màn hình!</p>
          </div>
        </div>
      </div>

      <!-- ================= MODE 2: LUCKY DRAW (BỐC THĂM MAY MẮN) ================= -->
      <div v-else class="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <!-- Left 2 Cols: Slot Machine / Spinner Stage -->
        <div class="lg:col-span-2 space-y-6 bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-md">
          <!-- Prize Selector -->
          <div class="flex items-center justify-between gap-3 flex-wrap border-b border-slate-800 pb-4">
            <div>
              <span class="text-[10px] uppercase tracking-widest text-amber-400 font-extrabold flex items-center gap-1">
                <Trophy class="w-3.5 h-3.5" />
                VÒNG QUAY BỐC THĂM TRÚNG THƯỞNG
              </span>
              <h3 class="text-xl font-black text-white">Quay Số Khách Mời Đã Check-in</h3>
            </div>

            <!-- Prize Pills -->
            <div class="flex items-center gap-1.5 flex-wrap">
              <button
                v-for="pz in prizes"
                :key="pz"
                @click="selectedPrize = pz"
                class="px-3 py-1 rounded-xl text-xs font-bold transition-all"
                :class="selectedPrize === pz ? 'bg-amber-500 text-slate-950 shadow-md font-black' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'"
              >
                {{ pz }}
              </button>
            </div>
          </div>

          <!-- Spinner Screen Frame -->
          <div class="py-12 px-6 rounded-3xl bg-gradient-to-b from-slate-950 to-indigo-950 border-2 border-amber-400/40 shadow-[0_0_60px_rgba(245,158,11,0.15)] text-center space-y-6 relative overflow-hidden">
            <div class="text-xs uppercase tracking-widest text-amber-300 font-bold">
              Đang quay giải: <span class="text-white text-base font-black underline">{{ selectedPrize }}</span>
            </div>

            <!-- Winner or Rolling Display -->
            <div class="min-h-[140px] flex flex-col items-center justify-center space-y-2">
              <template v-if="luckyWinner">
                <div class="text-4xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-300 tracking-tight animate-scale-in">
                  {{ luckyWinner.full_name }}
                </div>
                <div class="text-lg font-mono text-emerald-400 font-bold">
                  MÃ VÉ: {{ luckyWinner.ticket_code }}
                </div>
                <div v-if="luckyWinner.phone" class="text-xs font-mono text-slate-400">
                  SĐT: {{ luckyWinner.phone }}
                </div>
                <div class="text-xs font-bold text-amber-400 pt-1 animate-pulse">
                  🎉 CHÚC MỪNG BẠN ĐÃ TRÚNG THƯỞNG! 🎉
                </div>
              </template>

              <template v-else-if="isRolling && rollingCandidate">
                <div class="text-4xl sm:text-5xl font-black text-slate-100 font-mono tracking-tight animate-pulse">
                  {{ rollingCandidate.full_name }}
                </div>
                <div class="text-sm font-mono text-amber-400">
                  {{ rollingCandidate.ticket_code }}
                </div>
              </template>

              <template v-else>
                <div class="text-slate-600 text-3xl sm:text-4xl font-mono font-black">
                  [ ? ? ? ? ? ? ? ]
                </div>
                <p class="text-xs text-slate-400">
                  Có <strong class="text-emerald-400">{{ checkedInGuests.length }}</strong> khách mời hợp lệ sẵn sàng tham gia bốc thăm
                </p>
              </template>
            </div>

            <!-- Action Spin Button -->
            <div>
              <button
                @click="startLuckyDraw"
                :disabled="isRolling || checkedInGuests.length === 0"
                class="btn py-4 px-10 rounded-2xl text-base font-black shadow-xl transition-all duration-300 transform active:scale-95"
                :class="isRolling ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 hover:brightness-110 shadow-amber-500/30'"
              >
                <RotateCw v-if="isRolling" class="w-5 h-5 animate-spin inline mr-2" />
                <Trophy v-else class="w-5 h-5 inline mr-2 text-slate-900" />
                <span>{{ isRolling ? 'ĐANG QUAY SỐ...' : 'QUAY SỐ MAY MẮN' }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Right Col: Winners Leaderboard -->
        <div class="space-y-4 bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-md">
          <div class="flex items-center justify-between border-b border-slate-800 pb-3">
            <h4 class="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Award class="w-4 h-4 text-amber-400" />
              Bảng Vàng Trúng Thưởng
            </h4>
            <span class="text-xs font-mono text-amber-400 font-bold">{{ winnersList.length }} Giải</span>
          </div>

          <div v-if="winnersList.length > 0" class="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
            <div
              v-for="(win, idx) in winnersList"
              :key="idx"
              class="p-3.5 rounded-2xl bg-slate-950/80 border border-amber-400/30 flex items-center justify-between gap-3 shadow-md animate-scale-in"
            >
              <div class="min-w-0">
                <span class="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase tracking-wider">
                  {{ win.prize }}
                </span>
                <div class="font-extrabold text-white text-sm mt-1 truncate">{{ win.guest.full_name }}</div>
                <div class="text-[10px] font-mono text-slate-400">Vé: {{ win.guest.ticket_code }}</div>
              </div>
              <div class="text-[10px] font-mono text-slate-500 shrink-0">
                {{ win.wonAt }}
              </div>
            </div>
          </div>

          <div v-else class="py-16 text-center text-slate-500 text-xs italic">
            Chưa có giải thưởng nào được quay. Hãy chọn giải và bấm "Quay số may mắn"!
          </div>
        </div>
      </div>
    </main>

    <!-- FOOTER STATUS -->
    <footer class="relative z-10 px-6 py-3 border-t border-slate-800/60 bg-slate-950/80 text-center text-[11px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
      <div>
        Hệ thống Check-in QR Thông Minh & Màn Hình Sân Khấu EventGo
      </div>
      <div class="flex items-center gap-3">
        <span>Địa điểm: <strong class="text-slate-400">{{ eventData?.location || 'Hội trường sự kiện' }}</strong></span>
        <span>·</span>
        <span>Trạng thái: <strong class="text-emerald-400">● Realtime Connected</strong></span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.shadow-glow {
  box-shadow: 0 0 35px rgba(245, 158, 11, 0.4);
}

.animate-scale-in {
  animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.92);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.pop-enter-active,
.pop-leave-active {
  transition: all 0.35s ease;
}

.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
</style>
