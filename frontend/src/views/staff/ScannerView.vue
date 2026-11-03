<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { Html5Qrcode } from 'html5-qrcode';
import api from '../../api/client';
import {
  Camera,
  Flashlight,
  RefreshCw,
  Keyboard,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  X,
  Scale,
  Send,
  Sparkles,
  Clock,
  User,
  Phone,
  ShieldAlert,
  Ticket,
  ChevronDown,
  Calendar,
  Wifi,
  WifiOff,
  CloudUpload,
  MapPin,
  Compass,
  Check
} from 'lucide-vue-next';

const events = ref<any[]>([]);
const selectedEventId = ref<number | null>(null);
const currentEvent = ref<any>(null);
const isScanning = ref(true);
const scanResult = ref<any>(null);
const scanError = ref('');
const isPaused = ref(false);
const autoResumeTimer = ref<any>(null);
const autoResumeCountdown = ref(4);

// Manual Input Drawer
const showManualModal = ref(false);
const manualCode = ref('');

// Dispute Modal
const showDisputeModal = ref(false);
const disputeForm = ref({
  claimant_name: '',
  claimant_phone: '',
  explanation: '',
});

// Flashlight & Camera Switch
const isTorchOn = ref(false);
const currentFacingMode = ref<'environment' | 'user'>('environment');
const hasTorch = ref(false);
let html5QrCode: Html5Qrcode | null = null;

// ==============================================================
// 1. OFFLINE SCANNER MODE (GROUP 1.1)
// ==============================================================
const isOnline = ref<boolean>(navigator.onLine);
const offlineCache = ref<any[]>([]);
const offlineQueue = ref<any[]>([]);
const isSyncing = ref<boolean>(false);
const syncToast = ref<string>('');

// ==============================================================
// 2. GEOFENCING GPS CHECK (GROUP 2.4)
// ==============================================================
const userCoords = ref<{ lat: number; lng: number } | null>(null);
const geofenceDist = ref<number | null>(null);
const isWithinGeofence = ref<boolean | null>(null);
let geoWatchId: number | null = null;

const calculateDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const updateGeofenceStatus = () => {
  if (
    currentEvent.value?.latitude &&
    currentEvent.value?.longitude &&
    userCoords.value
  ) {
    const dist = calculateDistanceMeters(
      userCoords.value.lat,
      userCoords.value.lng,
      Number(currentEvent.value.latitude),
      Number(currentEvent.value.longitude)
    );
    geofenceDist.value = Math.round(dist);
    const radius = Number(currentEvent.value.geofence_radius_meters) || 500;
    isWithinGeofence.value = dist <= radius;
  } else {
    geofenceDist.value = null;
    isWithinGeofence.value = null;
  }
};

const initGeolocation = () => {
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userCoords.value = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        updateGeofenceStatus();
      },
      (err) => console.warn('Geolocation initial error:', err.message),
      { enableHighAccuracy: true, timeout: 10000 }
    );

    geoWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        userCoords.value = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        updateGeofenceStatus();
      },
      (err) => console.warn('Geolocation watch error:', err.message),
      { enableHighAccuracy: true, maximumAge: 15000 }
    );
  }
};

// Sound synthesizer using Web Audio API
const playSound = (type: 'SUCCESS' | 'ALREADY_USED' | 'INVALID') => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'SUCCESS') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } else if (type === 'ALREADY_USED') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    }
  } catch (e) {
    // Audio context may require interaction
  }
};

// Haptic feedback
const triggerHaptic = (type: 'SUCCESS' | 'ALREADY_USED' | 'INVALID') => {
  if (navigator.vibrate) {
    if (type === 'SUCCESS') {
      navigator.vibrate([100]);
    } else if (type === 'ALREADY_USED') {
      navigator.vibrate([150, 80, 150]);
    } else {
      navigator.vibrate([300]);
    }
  }
};

const loadOfflineData = async (eventId: number) => {
  // 1. Read existing local queue
  const savedQueue = localStorage.getItem(`ktsqr_offline_queue_${eventId}`);
  offlineQueue.value = savedQueue ? JSON.parse(savedQueue) : [];

  // 2. Read existing local cache
  const savedCache = localStorage.getItem(`ktsqr_offline_cache_${eventId}`);
  if (savedCache) {
    try {
      offlineCache.value = JSON.parse(savedCache);
    } catch {}
  }

  // 3. Pre-fetch fresh tickets cache if online
  if (isOnline.value) {
    try {
      const res = await api.get('/check-in/offline-cache', { params: { event_id: eventId } });
      if (res.data?.data) {
        offlineCache.value = res.data.data;
        localStorage.setItem(`ktsqr_offline_cache_${eventId}`, JSON.stringify(res.data.data));
      }
    } catch (e) {
      console.warn('Không thể nạp bộ nhớ đệm offline:', e);
    }
  }
};

const syncBatchQueue = async () => {
  if (!selectedEventId.value || offlineQueue.value.length === 0 || isSyncing.value) return;

  isSyncing.value = true;
  try {
    const res = await api.post('/check-in/sync-batch', {
      event_id: selectedEventId.value,
      scans: offlineQueue.value,
    });

    const synced = res.data.data?.synced_success ?? offlineQueue.value.length;
    syncToast.value = `✓ Đã đồng bộ thành công ${synced} vé lên máy chủ!`;
    setTimeout(() => { syncToast.value = ''; }, 4000);

    // Clear local queue & reload offline cache
    offlineQueue.value = [];
    localStorage.removeItem(`ktsqr_offline_queue_${selectedEventId.value}`);
    await loadOfflineData(selectedEventId.value);
  } catch (err: any) {
    alert(`Lỗi đồng bộ offline: ${err.response?.data?.message || err.message}`);
  } finally {
    isSyncing.value = false;
  }
};

const onOnline = async () => {
  isOnline.value = true;
  if (selectedEventId.value && offlineQueue.value.length > 0) {
    await syncBatchQueue();
  }
};

const onOffline = () => {
  isOnline.value = false;
};

const loadEvents = async () => {
  try {
    const res = await api.get('/events?scope=active');
    events.value = res.data.data;
    if (events.value.length > 0) {
      selectedEventId.value = events.value[0].id;
      currentEvent.value = events.value[0];
      await loadOfflineData(events.value[0].id);
      updateGeofenceStatus();
    }
  } catch (e: any) {
    console.error(e);
  }
};

const onEventChange = async () => {
  currentEvent.value = events.value.find((e: any) => e.id === selectedEventId.value) || null;
  updateGeofenceStatus();
  if (selectedEventId.value) {
    await loadOfflineData(selectedEventId.value);
  }
};

const startCamera = async () => {
  if (!html5QrCode) {
    html5QrCode = new Html5Qrcode('camera-stream');
  }

  try {
    const config = {
      fps: 15,
      qrbox: { width: 220, height: 220 },
      aspectRatio: 1.0,
    };

    const onDecode = (decodedText: string) => {
      if (!isPaused.value) {
        handleScanCode(decodedText);
      }
    };

    try {
      await html5QrCode.start(
        { facingMode: currentFacingMode.value },
        config,
        onDecode,
        () => {}
      );
    } catch {
      const cameras = await Html5Qrcode.getCameras();
      if (cameras && cameras.length > 0) {
        await html5QrCode.start(cameras[0].id, config, onDecode, () => {});
      } else {
        throw new Error('Không tìm thấy thiết bị camera.');
      }
    }

    // Check torch capability
    try {
      const track = (html5QrCode as any).getRunningTrackCameraCapabilities?.();
      hasTorch.value = !!track?.torch;
    } catch {
      hasTorch.value = false;
    }
  } catch (err: any) {
    console.error('Không thể bật camera:', err);
    scanError.value = 'Vui lòng cấp quyền truy cập Camera trên trình duyệt di động.';
  }
};

const toggleTorch = async () => {
  if (!html5QrCode) return;
  try {
    isTorchOn.value = !isTorchOn.value;
    await html5QrCode.applyVideoConstraints({
      advanced: [{ torch: isTorchOn.value } as any],
    });
  } catch (e) {
    console.warn('Thiết bị không hỗ trợ đèn flash:', e);
  }
};

const flipCamera = async () => {
  if (!html5QrCode) return;
  await html5QrCode.stop();
  currentFacingMode.value = currentFacingMode.value === 'environment' ? 'user' : 'environment';
  await startCamera();
};

// Scan processing with OFFLINE FALLBACK & GEOFENCE COORDINATES
const handleScanCode = async (code: string) => {
  if (!selectedEventId.value) return;

  const cleanCode = code.trim();
  isPaused.value = true;
  scanResult.value = null;
  scanError.value = '';

  // 1. If currently OFFLINE -> perform instant local cache matching
  if (!isOnline.value) {
    handleOfflineScan(cleanCode);
    return;
  }

  // 2. If ONLINE -> send to server with current GPS lat/lng
  try {
    const res = await api.post('/check-in/scan', {
      code: cleanCode,
      event_id: selectedEventId.value,
      device_info: navigator.userAgent,
      lat: userCoords.value?.lat,
      lng: userCoords.value?.lng,
    });

    scanResult.value = res.data.data;
    const type = res.data.data.result;

    playSound(type);
    triggerHaptic(type);

    if (type === 'SUCCESS') {
      if (currentEvent.value) {
        currentEvent.value.total_checked_in = (currentEvent.value.total_checked_in || 0) + 1;
      }
      autoResumeCountdown.value = 3;
      autoResumeTimer.value = setInterval(() => {
        autoResumeCountdown.value--;
        if (autoResumeCountdown.value <= 0) {
          resumeScanning();
        }
      }, 1000);
    }
  } catch (err: any) {
    // If network error occurred (e.g. WiFi dropped during scan), gracefully fall back to offline mode
    if (!err.response) {
      console.warn('Mạng bị gián đoạn, chuyển sang chế độ quét offline dự phòng...');
      handleOfflineScan(cleanCode);
      return;
    }

    if (err.response?.data?.data) {
      scanResult.value = err.response.data.data;
      const type = err.response.data.data.result;
      playSound(type);
      triggerHaptic(type);
    } else {
      scanError.value = err.response?.data?.message || err.message;
      playSound('INVALID');
      triggerHaptic('INVALID');
    }
  }
};

const handleOfflineScan = (cleanCode: string) => {
  const match = offlineCache.value.find(
    (t: any) => t.code === cleanCode || t.ticket_code === cleanCode
  );

  if (!match) {
    scanError.value = 'Mã vé không tìm thấy trong bộ nhớ Offline của sự kiện này!';
    playSound('INVALID');
    triggerHaptic('INVALID');
    return;
  }

  if (match.status === 'USED') {
    scanResult.value = {
      result: 'ALREADY_USED',
      message: 'MÃ QR ĐÃ ĐƯỢC CHECK-IN TRƯỚC ĐÓ (Ghi nhận offline)!',
      ticket: {
        code: match.code || match.ticket_code,
        used_at: match.used_at || new Date().toISOString(),
        first_scanner: 'Bộ nhớ Offline',
      },
      attendee: {
        full_name: match.full_name,
        phone: match.phone,
        email: match.email,
      },
      referrer: {
        name: match.referrer_name,
      },
    };
    playSound('ALREADY_USED');
    triggerHaptic('ALREADY_USED');
    return;
  }

  // Valid ticket found in offline cache
  match.status = 'USED';
  match.used_at = new Date().toISOString();

  // Save updated cache
  localStorage.setItem(
    `ktsqr_offline_cache_${selectedEventId.value}`,
    JSON.stringify(offlineCache.value)
  );

  // Add scan to pending sync queue
  offlineQueue.value.push({
    code: cleanCode,
    scanned_at: new Date().toISOString(),
    lat: userCoords.value?.lat,
    lng: userCoords.value?.lng,
    device_info: `${navigator.userAgent} (Offline Mode)`,
  });

  localStorage.setItem(
    `ktsqr_offline_queue_${selectedEventId.value}`,
    JSON.stringify(offlineQueue.value)
  );

  if (currentEvent.value) {
    currentEvent.value.total_checked_in = (currentEvent.value.total_checked_in || 0) + 1;
  }

  scanResult.value = {
    result: 'SUCCESS',
    is_offline: true,
    message: 'CHECK-IN OFFLINE THÀNH CÔNG! Đã lưu trữ an toàn trong máy.',
    ticket: {
      code: cleanCode,
      status: 'USED',
      used_at: match.used_at,
    },
    attendee: {
      full_name: match.full_name,
      phone: match.phone,
      email: match.email,
    },
    referrer: {
      name: match.referrer_name,
    },
  };

  playSound('SUCCESS');
  triggerHaptic('SUCCESS');

  autoResumeCountdown.value = 3;
  autoResumeTimer.value = setInterval(() => {
    autoResumeCountdown.value--;
    if (autoResumeCountdown.value <= 0) {
      resumeScanning();
    }
  }, 1000);
};

const resumeScanning = () => {
  if (autoResumeTimer.value) {
    clearInterval(autoResumeTimer.value);
    autoResumeTimer.value = null;
  }
  scanResult.value = null;
  scanError.value = '';
  isPaused.value = false;
};

const submitDispute = async () => {
  if (!scanResult.value?.scan_log_id || !scanResult.value?.ticket?.id) return;
  try {
    await api.post('/disputes', {
      scan_log_id: scanResult.value.scan_log_id,
      ticket_id: scanResult.value.ticket.id,
      claimant_name: disputeForm.value.claimant_name,
      claimant_phone: disputeForm.value.claimant_phone,
      explanation: disputeForm.value.explanation,
    });
    alert('Đã gửi biên bản giải trình! Bộ phận Trọng tài sẽ xem xét.');
    showDisputeModal.value = false;
    disputeForm.value = { claimant_name: '', claimant_phone: '', explanation: '' };
    resumeScanning();
  } catch (e: any) {
    alert(e.response?.data?.message || e.message);
  }
};

onMounted(async () => {
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  initGeolocation();
  await loadEvents();
  await startCamera();
});

onBeforeUnmount(async () => {
  window.removeEventListener('online', onOnline);
  window.removeEventListener('offline', onOffline);
  if (geoWatchId !== null) navigator.geolocation.clearWatch(geoWatchId);
  if (autoResumeTimer.value) clearInterval(autoResumeTimer.value);
  if (html5QrCode) {
    try {
      await html5QrCode.stop();
    } catch {}
  }
});
</script>

<template>
  <div class="min-h-[calc(100vh-4rem)] flex flex-col bg-slate-950 text-white relative overflow-hidden select-none animate-page-in">
    <!-- Top Mobile Cockpit Control Bar -->
    <div class="bg-slate-900/95 backdrop-blur-md px-3 sm:px-4 py-2 border-b border-slate-800 flex flex-col gap-1.5 z-30">
      <div class="flex items-center justify-between gap-2">
        <!-- Event Select Compact -->
        <div class="flex items-center gap-2 max-w-[50%] sm:max-w-xs">
          <div class="w-7 h-7 rounded-lg bg-primary-500/20 text-primary-400 flex items-center justify-center shrink-0">
            <Calendar class="w-3.5 h-3.5" />
          </div>
          <select
            v-model="selectedEventId"
            @change="onEventChange"
            class="bg-slate-800 text-xs text-slate-100 border border-slate-700 rounded-xl px-2.5 py-1.5 font-bold truncate focus:outline-none focus:ring-1 focus:ring-primary-500 w-full"
          >
            <option v-for="ev in events" :key="ev.id" :value="ev.id">{{ ev.name }}</option>
          </select>
        </div>

        <!-- Live Count Badge & Action Controls -->
        <div class="flex items-center gap-1.5 shrink-0">
          <div class="px-2.5 py-1 bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 rounded-xl text-xs font-mono font-black flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{{ currentEvent?.total_checked_in || 0 }}/{{ currentEvent?.total_tickets || '0' }}</span>
          </div>

          <!-- Flashlight Button -->
          <button
            @click="toggleTorch"
            :class="isTorchOn ? 'bg-amber-400 text-slate-950 shadow-glow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'"
            class="p-2 rounded-xl text-xs border border-slate-700 transition"
            title="Bật/Tắt đèn Flash"
          >
            <Flashlight class="w-4 h-4" />
          </button>

          <!-- Flip Camera Button -->
          <button
            @click="flipCamera"
            class="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs border border-slate-700 transition"
            title="Đổi camera trước/sau"
          >
            <RefreshCw class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Second status row: OFFLINE STATUS & GEOFENCING INDICATOR -->
      <div class="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/60">
        <!-- Online/Offline & Sync Badge -->
        <div class="flex items-center gap-1.5">
          <span
            :class="isOnline ? 'bg-emerald-950/70 text-emerald-400 border-emerald-800/70' : 'bg-rose-950/70 text-rose-400 border-rose-800/70'"
            class="px-2 py-0.5 rounded-lg border font-bold flex items-center gap-1 text-[10px]"
          >
            <component :is="isOnline ? Wifi : WifiOff" class="w-3 h-3" />
            <span>{{ isOnline ? 'Online' : 'Offline Mode' }}</span>
          </span>

          <!-- Offline Queue Sync Button -->
          <button
            v-if="offlineQueue.length > 0"
            @click="syncBatchQueue"
            :disabled="!isOnline || isSyncing"
            class="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg font-bold flex items-center gap-1 text-[10px] transition animate-pulse"
          >
            <CloudUpload class="w-3 h-3" />
            <span>{{ isSyncing ? 'Đang đồng bộ...' : `Chờ sync: ${offlineQueue.length}` }}</span>
          </button>
        </div>

        <!-- Geofence GPS Cockpit Indicator -->
        <div v-if="currentEvent?.geofence_enabled" class="flex items-center gap-1 font-mono text-[10px]">
          <span
            v-if="geofenceDist !== null"
            :class="isWithinGeofence ? 'text-emerald-400' : 'text-rose-400'"
            class="flex items-center gap-1 font-bold"
          >
            <MapPin class="w-3 h-3" />
            <span>{{ isWithinGeofence ? `✓ Trong bán kính (${geofenceDist}m)` : `⚠️ Ngoài bán kính (${geofenceDist}m/${currentEvent?.geofence_radius_meters || 500}m)` }}</span>
          </span>
          <span v-else class="text-slate-400 flex items-center gap-1">
            <Compass class="w-3 h-3 animate-spin" />
            <span>Đang lấy GPS...</span>
          </span>
        </div>
      </div>
    </div>

    <!-- Sync Toast Alert -->
    <div
      v-if="syncToast"
      class="fixed top-16 inset-x-4 max-w-sm mx-auto z-[80] bg-emerald-600 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 animate-bounce"
    >
      <Check class="w-4 h-4 shrink-0" />
      <span>{{ syncToast }}</span>
    </div>

    <!-- Camera Viewport Cockpit -->
    <div class="flex-1 flex flex-col items-center justify-center relative bg-black p-3">
      <!-- Camera Container with Aiming Frame Overlay -->
      <div class="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl relative border border-slate-800 aspect-square flex items-center justify-center bg-slate-950">
        <div id="camera-stream" class="w-full h-full"></div>

        <!-- Aiming Frame Overlay (Laser Scan Animation) -->
        <div
          v-if="!isPaused"
          class="pointer-events-none absolute inset-0 flex items-center justify-center z-10"
        >
          <div class="w-56 h-56 border border-emerald-500/40 rounded-3xl relative overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.15)]">
            <!-- Laser Line Animation -->
            <div class="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#10b981] animate-laser"></div>

            <!-- Futuristic Corner brackets -->
            <div class="absolute top-2 left-2 w-5 h-5 border-t-2 border-l-2 border-emerald-400 rounded-tl-lg"></div>
            <div class="absolute top-2 right-2 w-5 h-5 border-t-2 border-r-2 border-emerald-400 rounded-tr-lg"></div>
            <div class="absolute bottom-2 left-2 w-5 h-5 border-b-2 border-l-2 border-emerald-400 rounded-bl-lg"></div>
            <div class="absolute bottom-2 right-2 w-5 h-5 border-b-2 border-r-2 border-emerald-400 rounded-br-lg"></div>

            <!-- Center reticle dot -->
            <div class="absolute inset-0 flex items-center justify-center">
              <div class="w-1.5 h-1.5 rounded-full bg-emerald-400/60"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Instruction Pill below camera -->
      <div class="mt-4 text-center px-4">
        <p class="text-[11px] text-slate-400 font-medium">
          Hướng khung ngắm vào mã QR vé của khách • Tự động nhận diện tức thì
        </p>
      </div>

      <!-- Button to Enter Code Manually -->
      <button
        @click="showManualModal = true"
        class="mt-3 px-4 py-2 bg-slate-900/90 hover:bg-slate-800 text-slate-200 text-xs font-bold rounded-2xl border border-slate-700/80 flex items-center gap-2 transition shadow-card"
      >
        <Keyboard class="w-3.5 h-3.5 text-primary-400" />
        <span>Nhập mã vé bằng tay</span>
      </button>
    </div>

    <!-- ============================================================== -->
    <!-- SLIDE-UP BOTTOM SHEET: SCAN RESULT CARD (MOBILE-FIRST)        -->
    <!-- ============================================================== -->
    <div
      v-if="scanResult || scanError"
      class="fixed inset-x-0 z-[60] p-3 sm:p-4 max-w-md mx-auto animate-slide-up scanner-result-card"
    >
      <div class="max-h-[calc(100dvh-7.5rem)] overflow-y-auto overscroll-contain rounded-3xl shadow-2xl">
        <!-- 1. SUCCESS (EMERALD CARD) -->
        <div
          v-if="scanResult?.result === 'SUCCESS'"
          class="bg-slate-900/95 backdrop-blur-md border-2 border-emerald-500 rounded-3xl p-5 shadow-glow space-y-4"
        >
          <!-- Header -->
          <div class="flex items-center justify-between pb-3 border-b border-slate-800">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 class="w-6 h-6" />
              </div>
              <div>
                <div class="flex items-center gap-1.5">
                  <span class="text-xs uppercase font-black text-emerald-400 tracking-wider">CHECK-IN THÀNH CÔNG</span>
                  <span v-if="scanResult.is_offline" class="px-1.5 py-0.5 bg-amber-400/20 text-amber-300 border border-amber-400/40 rounded text-[9px] font-bold">
                    OFFLINE
                  </span>
                </div>
                <div class="text-[11px] text-slate-400">Vé hợp lệ • Đã ghi nhận vào cổng</div>
              </div>
            </div>
            <button
              @click="resumeScanning"
              class="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
              title="Đóng"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Attendee & Referrer Info -->
          <div class="bg-slate-800/80 p-4 rounded-2xl space-y-2.5 border border-slate-700/70">
            <div class="flex justify-between items-start">
              <div>
                <div class="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                  <User class="w-3 h-3" />
                  Khách tham dự
                </div>
                <div class="text-base font-black text-white mt-0.5 truncate">{{ scanResult.attendee?.full_name }}</div>
                <div class="text-xs font-mono text-emerald-400 mt-0.5">{{ scanResult.attendee?.phone }}</div>
              </div>
              <div class="text-right">
                <div class="text-[10px] font-bold text-slate-400 uppercase">Người giới thiệu</div>
                <div class="text-xs font-black text-primary-400 mt-0.5 truncate">{{ scanResult.referrer?.name }}</div>
                <div class="text-[10px] text-slate-400 font-mono">{{ scanResult.referrer?.phone || 'Chưa có SĐT' }}</div>
              </div>
            </div>
          </div>

          <!-- Resume / Next Action Button -->
          <button
            @click="resumeScanning"
            class="btn btn-primary w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-sm font-black shadow-glow flex items-center justify-center gap-2"
          >
            <span>Quét khách tiếp theo</span>
            <span class="text-xs bg-emerald-700 px-2 py-0.5 rounded-full font-mono font-bold">
              {{ autoResumeCountdown }}s
            </span>
          </button>
        </div>

        <!-- 2. ALREADY USED (AMBER CARD) -->
        <div
          v-else-if="scanResult?.result === 'ALREADY_USED'"
          class="bg-slate-900/95 backdrop-blur-md border-2 border-amber-500 rounded-3xl p-5 shadow-2xl space-y-4"
        >
          <!-- Header -->
          <div class="flex items-center justify-between pb-3 border-b border-slate-800">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle class="w-6 h-6" />
              </div>
              <div>
                <div class="text-xs uppercase font-black text-amber-400 tracking-wider">MÃ QR ĐÃ ĐƯỢC SỬ DỤNG!</div>
                <div class="text-[11px] text-slate-400">Không thể check-in lần thứ hai</div>
              </div>
            </div>
            <button
              @click="resumeScanning"
              class="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- First scan history -->
          <div class="bg-amber-950/40 border border-amber-800/80 p-3 rounded-2xl text-xs text-amber-200 space-y-1">
            <div class="flex items-center gap-1.5 font-semibold">
              <Clock class="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Quét lần 1: {{ new Date(scanResult.ticket?.used_at).toLocaleTimeString('vi-VN') }} ngày {{ new Date(scanResult.ticket?.used_at).toLocaleDateString('vi-VN') }}</span>
            </div>
            <div class="text-[11px] text-amber-300/80 pl-5">
              Nhân viên soát vé: <strong>{{ scanResult.ticket?.first_scanner || 'Hệ thống' }}</strong>
            </div>
          </div>

          <!-- Attendee info -->
          <div class="bg-slate-800/80 p-3.5 rounded-2xl text-xs space-y-1 border border-slate-700">
            <div>Khách gốc: <strong class="text-white text-sm">{{ scanResult.attendee?.full_name }}</strong> ({{ scanResult.attendee?.phone }})</div>
            <div>Người giới thiệu: <strong class="text-primary-400">{{ scanResult.referrer?.name }}</strong></div>
          </div>

          <!-- Actions -->
          <div class="flex gap-2 pt-1">
            <button
              @click="showDisputeModal = true"
              class="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow transition flex items-center justify-center gap-1.5"
            >
              <Scale class="w-4 h-4" />
              <span>Lập Biên Bản Tranh Chấp</span>
            </button>
            <button
              @click="resumeScanning"
              class="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 transition"
            >
              Bỏ qua
            </button>
          </div>
        </div>

        <!-- 3. INVALID (RED CARD) -->
        <div
          v-else-if="scanResult?.result === 'INVALID' || scanError"
          class="bg-slate-900/95 backdrop-blur-md border-2 border-rose-500 rounded-3xl p-5 shadow-2xl space-y-4"
        >
          <div class="flex items-center justify-between pb-3 border-b border-slate-800">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <XCircle class="w-6 h-6" />
              </div>
              <div>
                <div class="text-xs uppercase font-black text-rose-400 tracking-wider">MÃ VÉ KHÔNG HỢP LỆ</div>
                <div class="text-xs text-slate-300 mt-0.5">{{ scanResult?.message || scanError }}</div>
              </div>
            </div>
            <button
              @click="resumeScanning"
              class="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <button
            @click="resumeScanning"
            class="btn btn-danger w-full py-3 text-xs font-black shadow"
          >
            Đã hiểu • Quét lại
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL: NHẬP MÃ THỦ CÔNG -->
    <div v-if="showManualModal" class="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-[70] flex items-center justify-center p-4">
      <div class="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-scale-in">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-bold text-white flex items-center gap-2">
            <Keyboard class="w-4 h-4 text-primary-400" />
            <span>Nhập mã số vé bằng tay</span>
          </h3>
          <button @click="showManualModal = false" class="text-slate-400 hover:text-white">
            <X class="w-4 h-4" />
          </button>
        </div>
        <p class="text-xs text-slate-400">
          Sử dụng trong trường hợp camera không đọc được do màn hình khách bị nứt hoặc mờ.
        </p>
        <input
          v-model="manualCode"
          placeholder="VD: TKT-1-8F3B912C..."
          class="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          @keyup.enter="showManualModal = false; handleScanCode(manualCode)"
        />
        <div class="flex justify-end gap-2 pt-2">
          <button
            @click="showManualModal = false"
            class="btn btn-ghost text-xs text-slate-400"
          >
            Hủy
          </button>
          <button
            @click="showManualModal = false; handleScanCode(manualCode)"
            class="btn btn-primary text-xs"
          >
            Kiểm tra vé
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL: LẬP BIÊN BẢN TRANH CHẤP -->
    <div v-if="showDisputeModal" class="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-[70] flex items-center justify-center p-4 overflow-y-auto">
      <div class="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 my-auto max-h-[90dvh] overflow-y-auto animate-scale-in">
        <div class="flex items-center gap-2.5 text-amber-400">
          <div class="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Scale class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-bold text-white">Lập Biên Bản Tranh Chấp</h3>
            <p class="text-[11px] text-slate-400">Ghi nhận thông tin người thứ 2 xuất trình vé</p>
          </div>
        </div>

        <form @submit.prevent="submitDispute" class="space-y-3.5 text-xs">
          <div>
            <label class="block font-bold text-slate-300 mb-1">Họ tên người đang cầm vé *</label>
            <input
              v-model="disputeForm.claimant_name"
              required
              placeholder="Nguyễn Văn A"
              class="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <label class="block font-bold text-slate-300 mb-1">Số điện thoại liên hệ *</label>
            <input
              v-model="disputeForm.claimant_phone"
              required
              placeholder="09xxxxxxxx"
              class="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <label class="block font-bold text-slate-300 mb-1">Giải trình của khách *</label>
            <textarea
              v-model="disputeForm.explanation"
              rows="3"
              required
              placeholder="VD: Tôi nhận email từ công ty, người trước có thể đã chụp lén QR của tôi..."
              class="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            ></textarea>
          </div>

          <div class="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              @click="showDisputeModal = false"
              class="btn btn-ghost text-xs text-slate-400"
            >
              Đóng
            </button>
            <button
              type="submit"
              class="btn text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5"
            >
              <Send class="w-3.5 h-3.5" />
              <span>Gửi Biên Bản</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes laser {
  0% { top: 0%; opacity: 0; }
  20% { opacity: 1; }
  80% { opacity: 1; }
  100% { top: 100%; opacity: 0; }
}

.animate-laser {
  animation: laser 1.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

@keyframes slideUp {
  from { transform: translateY(100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.animate-slide-up {
  animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.scanner-result-card {
  bottom: calc(4.75rem + env(safe-area-inset-bottom, 0px));
}

@media (min-width: 768px) {
  .scanner-result-card {
    bottom: 1.5rem;
  }
}

:deep(#qr-shaded-region),
#qr-shaded-region {
  display: none !important;
}
</style>
