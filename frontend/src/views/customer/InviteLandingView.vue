<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import {
  MapPin,
  CalendarDays,
  Clock,
  UserCheck,
  ShieldCheck,
  Check,
  X,
  Mail,
  Loader2,
  PartyPopper,
  Ticket,
  QrCode,
  LogOut,
  ArrowRight,
  KeyRound,
  LogIn,
  Eye,
  EyeOff,
  AlertTriangle,
  ExternalLink,
  Users,
  Navigation
} from 'lucide-vue-next';
import api from '../../api/client';
import { useAuthStore } from '../../stores/auth';

const route = useRoute();
const auth = useAuthStore();

const token = route.params.token as string;
const inviteData = ref<any>(null);
const loading = ref(true);
const error = ref('');

const actionChosen = ref<'none' | 'confirm' | 'decline'>('none');
const isSubmitting = ref(false);
const registrationDone = ref(false);

const authMode = ref<'otp' | 'password'>('otp');
const otpEmail = ref('');
const otpCode = ref('');
const otpSent = ref(false);
const otpBusy = ref(false);

const passwordEmail = ref('');
const passwordValue = ref('');
const passwordBusy = ref(false);
const showPassword = ref(false);

const formError = ref('');

const form = ref({ full_name: '', phone: '', email: '', address: '' });

const isPasswordAccount = computed(() => {
  const msg = (formError.value || '').toLowerCase();
  return msg.includes('mật khẩu') || msg.includes('email và mật khẩu') || msg.includes('đăng nhập bằng email');
});

const switchToPassword = () => {
  authMode.value = 'password';
  if (otpEmail.value && !passwordEmail.value) {
    passwordEmail.value = otpEmail.value.trim();
  }
  formError.value = '';
};

const switchToOtp = () => {
  authMode.value = 'otp';
  if (passwordEmail.value && !otpEmail.value) {
    otpEmail.value = passwordEmail.value.trim();
  }
  formError.value = '';
};

const FALLBACK_POSTER = 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1600&q=80';

const event = computed(() => inviteData.value?.event || {});
const startAt = computed(() => (event.value.start_at ? new Date(event.value.start_at) : null));
const endAt = computed(() => (event.value.end_at ? new Date(event.value.end_at) : null));
const dateLabel = computed(() =>
  startAt.value?.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }) || ''
);
const timeLabel = computed(() => {
  if (!startAt.value) return '';
  const f = (d: Date) => d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  return endAt.value ? `${f(startAt.value)} – ${f(endAt.value)}` : f(startAt.value);
});
const dayNum = computed(() => startAt.value?.getDate().toString().padStart(2, '0'));
const monthLabel = computed(() => (startAt.value ? `TH ${startAt.value.getMonth() + 1}` : ''));

const regDeadlineDate = computed(() => {
  if (event.value.registration_deadline) {
    const d = new Date(event.value.registration_deadline);
    return isNaN(d.getTime()) ? null : d;
  }
  return startAt.value;
});

const regDeadlineLabel = computed(() => {
  if (!regDeadlineDate.value) return '';
  return (
    regDeadlineDate.value.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) +
    ', ' +
    regDeadlineDate.value.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  );
});

const isRegistrationClosed = computed(() => {
  if (inviteData.value?.is_registration_closed) return true;
  const now = new Date();
  if (endAt.value && now > endAt.value) return true;
  if (regDeadlineDate.value && now > regDeadlineDate.value) return true;
  if (event.value?.capacity && Number(event.value?.current_registrations || 0) >= Number(event.value.capacity)) return true;
  return false;
});

const closureReason = computed(() => {
  if (inviteData.value?.closure_reason) return inviteData.value.closure_reason;
  const now = new Date();
  if (endAt.value && now > endAt.value) {
    return 'Sự kiện đã kết thúc, cổng đăng ký đã tự động đóng.';
  }
  if (regDeadlineDate.value && now > regDeadlineDate.value) {
    return `Đã hết thời hạn đăng ký (Hạn chót: ${regDeadlineLabel.value}).`;
  }
  if (event.value?.capacity && Number(event.value?.current_registrations || 0) >= Number(event.value.capacity)) {
    return 'Sự kiện đã đạt số lượng khách tối đa (Đã hết chỗ).';
  }
  return 'Cổng tiếp nhận đăng ký hiện đã đóng.';
});

const googleMapsUrl = computed(() => {
  if (event.value.map_url) return event.value.map_url;
  if (event.value.location) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.value.location)}`;
  }
  return '';
});

const infoUrl = computed(() => event.value.info_url || '');

const spotsInfo = computed(() => {
  if (!event.value.capacity) return null;
  const total = Number(event.value.capacity);
  const current = Number(event.value.current_registrations || 0);
  const remaining = Math.max(0, total - current);
  return {
    total,
    current,
    remaining,
    isFull: remaining === 0
  };
});

const youtubeEmbed = computed(() => {
  const url: string = event.value.video_url || '';
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}?rel=0` : '';
});

const referrerInitials = computed(() => {
  const n: string = inviteData.value?.referrer?.name || '';
  const p = n.trim().split(/\s+/);
  return ((p[p.length - 1]?.[0] || '') + (p.length > 1 ? p[0][0] : '')).toUpperCase();
});

const step = computed(() => (registrationDone.value ? 3 : auth.isAuthenticated ? 2 : 1));

const loadInvite = async () => {
  loading.value = true;
  error.value = '';
  try {
    const res = await api.get(`/invites/verify/${token}`);
    inviteData.value = res.data.data;
    if (inviteData.value?.token && inviteData.value.token !== token) {
      // Tự động cập nhật URL thành link rút gọn mới mà không reload trang
      window.history.replaceState({}, '', `/invite/${inviteData.value.token}`);
    }
    if (auth.user) {
      form.value.full_name = auth.user.name || form.value.full_name;
      form.value.email = auth.user.email || form.value.email;
      form.value.phone = auth.user.phone || form.value.phone;
    }
  } catch (err: any) {
    error.value = err.response?.data?.message || err.message || 'Link mời không hợp lệ hoặc đã hết hạn.';
  } finally {
    loading.value = false;
  }
};

onMounted(loadInvite);

const chooseConfirm = () => {
  if (isRegistrationClosed.value) return;
  actionChosen.value = 'confirm';
  requestAnimationFrame(() => document.getElementById('register')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
};

const handleSendOtp = async () => {
  formError.value = '';
  otpBusy.value = true;
  try {
    const res = await auth.sendOtp(otpEmail.value.trim());
    if (res.data?.data?.token) {
      // Đã từng có tài khoản -> Bỏ qua OTP, tự động đăng nhập và cập nhật form
      const user = res.data.data.user;
      form.value.full_name = user.name || form.value.full_name;
      form.value.email = user.email || otpEmail.value.trim();
      form.value.phone = user.phone || form.value.phone;
      return;
    }
    otpSent.value = true;
    form.value.email = otpEmail.value.trim();
  } catch (err: any) {
    const msg = err.response?.data?.message || err.message;
    formError.value = msg;
    if (msg?.toLowerCase().includes('mật khẩu') || msg?.toLowerCase().includes('email và mật khẩu')) {
      passwordEmail.value = otpEmail.value.trim();
    }
  } finally {
    otpBusy.value = false;
  }
};

const handlePasswordLogin = async () => {
  formError.value = '';
  const email = passwordEmail.value.trim();
  const password = passwordValue.value;
  if (!email || !password) {
    formError.value = 'Vui lòng nhập đầy đủ email và mật khẩu.';
    return;
  }
  passwordBusy.value = true;
  try {
    const user = await auth.loginWithPassword(email, password);
    if (user) {
      form.value.full_name = user.name || form.value.full_name;
      form.value.email = user.email || email;
      form.value.phone = user.phone || form.value.phone;
    }
  } catch (err: any) {
    formError.value = err.response?.data?.message || err.message || 'Đăng nhập không thành công. Vui lòng kiểm tra lại mật khẩu.';
  } finally {
    passwordBusy.value = false;
  }
};

const handleVerifyOtp = async () => {
  formError.value = '';
  otpBusy.value = true;
  try {
    const user = await auth.verifyOtp(otpEmail.value.trim(), otpCode.value.trim(), form.value.full_name, form.value.phone);
    form.value.full_name = user.name || form.value.full_name;
    form.value.email = user.email || form.value.email;
    form.value.phone = user.phone || form.value.phone;
  } catch (err: any) {
    formError.value = err.response?.data?.message || err.message;
  } finally {
    otpBusy.value = false;
  }
};

const handleSubmitRegistration = async () => {
  formError.value = '';
  isSubmitting.value = true;
  try {
    const activeToken = inviteData.value?.token || token;
    const res = await api.post('/registrations', { token: activeToken, ...form.value });
    if (res.data?.data?.token) {
      auth.token = res.data.data.token;
      auth.user = res.data.data.user;
      localStorage.setItem('token', res.data.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.data.user));
    }
    registrationDone.value = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err: any) {
    formError.value = err.response?.data?.message || err.message || 'Đăng ký thất bại.';
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div class="min-h-[100dvh] pb-32 sm:pb-16">
    <!-- LOADING -->
    <div v-if="loading" class="mx-auto max-w-3xl px-4 pt-6 sm:pt-12">
      <div class="skeleton aspect-[16/10] w-full rounded-3xl sm:aspect-[21/9]" />
      <div class="mt-6 space-y-3">
        <div class="skeleton h-8 w-3/4" />
        <div class="skeleton h-4 w-1/2" />
        <div class="skeleton h-24 w-full rounded-2xl" />
      </div>
    </div>

    <!-- ERROR -->
    <div v-else-if="error" class="grid min-h-[100dvh] place-items-center px-4">
      <div class="card card-pad w-full max-w-sm animate-scale-in text-center space-y-4">
        <div class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-600"><X class="h-7 w-7" /></div>
        <div>
          <h2 class="text-lg font-bold text-slate-900">Link mời không khả dụng</h2>
          <p class="mt-1.5 text-sm text-slate-500 leading-relaxed">{{ error }}</p>
        </div>
        <p class="text-xs text-slate-400">Vui lòng liên hệ người đã gửi link cho bạn để nhận link mới hoặc kiểm tra lại đường dẫn.</p>
        <div class="pt-2 flex flex-col gap-2">
          <button
            type="button"
            @click="loadInvite()"
            class="w-full py-2.5 px-4 rounded-xl bg-primary-700 hover:bg-primary-800 text-white text-xs font-bold transition cursor-pointer"
          >
            Thử tải lại
          </button>
          <router-link
            to="/khach"
            class="w-full py-2 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold text-center transition block"
          >
            Về Cổng Khách Mời & Tra Cứu Vé
          </router-link>
        </div>
      </div>
    </div>

    <template v-else>
      <!-- HERO -->
      <header class="relative">
        <div class="relative mx-auto max-w-3xl sm:px-4 sm:pt-8">
          <div class="relative aspect-[4/3] overflow-hidden bg-slate-900 sm:aspect-[21/10] sm:rounded-3xl sm:shadow-lift">
            <iframe
              v-if="youtubeEmbed"
              :src="youtubeEmbed"
              class="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen
            />
            <video
              v-else-if="event.video_url"
              :src="event.video_url"
              :poster="event.poster_url || FALLBACK_POSTER"
              class="absolute inset-0 h-full w-full object-cover"
              controls
              playsinline
              muted
            />
            <template v-else>
              <img :src="event.poster_url || FALLBACK_POSTER" :alt="event.name" class="absolute inset-0 h-full w-full object-cover" />
              <div class="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-slate-950/10" />
              <div class="pt-safe absolute inset-x-0 top-0 flex items-center justify-between p-4">
                <span class="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/25 backdrop-blur-md">
                  <QrCode class="h-3.5 w-3.5" /> KTSQR
                </span>
                <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/90 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
                  <ShieldCheck class="h-3.5 w-3.5" /> Thư mời chính thức
                </span>
              </div>
              <div class="absolute inset-x-0 bottom-0 p-5 sm:p-8">
                <h1 class="text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">{{ event.name }}</h1>
              </div>
            </template>
          </div>
        </div>
      </header>

      <main class="relative mx-auto max-w-3xl px-4">
        <!-- Title (when video occupies hero) -->
        <h1 v-if="youtubeEmbed || event.video_url" class="mt-5 text-2xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-3xl">
          {{ event.name }}
        </h1>

        <!-- SUCCESS -->
        <section v-if="registrationDone" class="card mt-5 animate-scale-in overflow-hidden sm:mt-6">
          <div class="bg-gradient-to-br from-emerald-500 to-emerald-600 px-6 py-8 text-center text-white">
            <div class="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/20 ring-8 ring-white/10"><PartyPopper class="h-8 w-8" /></div>
            <h2 class="mt-4 text-xl font-extrabold">Đã gửi đăng ký!</h2>
            <p class="mx-auto mt-1.5 max-w-sm text-sm text-emerald-50">
              <b>{{ inviteData.referrer?.name }}</b> sẽ xét duyệt và cấp vé QR cho bạn. Bạn sẽ nhận email khi vé sẵn sàng.
            </p>
          </div>
          <div class="card-pad space-y-4">
            <ol class="space-y-3 text-sm">
              <li class="flex items-center gap-3"><span class="grid h-7 w-7 place-items-center rounded-full bg-emerald-100 text-emerald-700"><Check class="h-4 w-4" /></span><span class="font-medium text-slate-900">Gửi thông tin đăng ký</span></li>
              <li class="flex items-center gap-3"><span class="grid h-7 w-7 place-items-center rounded-full bg-amber-100 text-amber-700"><Clock class="h-4 w-4" /></span><span class="text-slate-600">Chờ người giới thiệu duyệt</span></li>
              <li class="flex items-center gap-3"><span class="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-slate-400"><Ticket class="h-4 w-4" /></span><span class="text-slate-400">Nhận vé QR & check-in tại cổng</span></li>
            </ol>
            <router-link to="/my-ticket" class="btn-success btn-lg w-full">Xem vé của tôi <ArrowRight class="h-[18px] w-[18px]" /></router-link>
          </div>
        </section>

        <template v-else>
          <!-- Registration Status Alert (Closed / Open) -->
          <div v-if="isRegistrationClosed" class="mt-4 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-rose-900 shadow-sm sm:mt-6">
            <div class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-600">
              <AlertTriangle class="h-5 w-5" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
                  Cổng đăng ký đã đóng
                </span>
              </div>
              <p class="mt-1 text-sm font-semibold text-rose-900 leading-snug">{{ closureReason }}</p>
              <p class="mt-0.5 text-xs text-rose-700">Rất tiếc sự kiện hiện không thể tiếp nhận thêm lượt đăng ký mới.</p>
            </div>
          </div>

          <div v-else class="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-200/80 bg-emerald-50/70 px-4 py-2.5 text-emerald-900 shadow-sm sm:mt-6">
            <div class="flex items-center gap-2">
              <span class="relative flex h-2.5 w-2.5">
                <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
              </span>
              <span class="text-xs font-bold uppercase tracking-wider text-emerald-800">Cổng đăng ký đang mở</span>
            </div>
            <div v-if="regDeadlineLabel" class="text-xs font-medium text-emerald-700">
              Hạn chót: <span class="font-bold text-emerald-900">{{ regDeadlineLabel }}</span>
            </div>
          </div>

          <!-- Info -->
          <section class="mt-4 grid gap-3 sm:mt-5 sm:grid-cols-[auto_1fr]">
            <div v-if="startAt" class="hidden w-20 flex-col items-center justify-center rounded-2xl bg-primary-600 py-3 text-white shadow-glow sm:flex">
              <span class="text-[11px] font-bold tracking-wider opacity-80">{{ monthLabel }}</span>
              <span class="text-3xl font-extrabold leading-none">{{ dayNum }}</span>
            </div>
            <div class="card divide-y divide-slate-100 overflow-hidden">
              <!-- Event start/end time -->
              <div class="flex items-start gap-3.5 p-4">
                <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-600"><CalendarDays class="h-5 w-5" /></span>
                <div class="min-w-0">
                  <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Thời gian diễn ra sự kiện</div>
                  <div class="font-semibold capitalize text-slate-900">{{ dateLabel }}</div>
                  <div class="text-sm text-slate-500">{{ timeLabel }}</div>
                </div>
              </div>

              <!-- Registration deadline & spots -->
              <div v-if="regDeadlineLabel || spotsInfo" class="grid gap-3 p-4 sm:grid-cols-2 bg-slate-50/50">
                <div v-if="regDeadlineLabel" class="flex items-start gap-3">
                  <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600"><Clock class="h-4 w-4" /></span>
                  <div class="min-w-0 text-xs">
                    <div class="font-bold text-slate-600">Hạn chót đăng ký:</div>
                    <div class="font-semibold text-slate-900 mt-0.5">{{ regDeadlineLabel }}</div>
                  </div>
                </div>
                <div v-if="spotsInfo" class="flex items-start gap-3">
                  <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600"><Users class="h-4 w-4" /></span>
                  <div class="min-w-0 text-xs">
                    <div class="font-bold text-slate-600">Hạn mức tham dự:</div>
                    <div class="font-semibold text-slate-900 mt-0.5">
                      {{ spotsInfo.current }} / {{ spotsInfo.total }} khách
                      <span :class="spotsInfo.isFull ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'">
                        ({{ spotsInfo.isFull ? 'Hết chỗ' : `Còn ${spotsInfo.remaining} chỗ` }})
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Location & Map -->
              <div class="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div class="flex items-start gap-3.5 min-w-0">
                  <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600"><MapPin class="h-5 w-5" /></span>
                  <div class="min-w-0">
                    <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Địa điểm tổ chức</div>
                    <div class="text-sm leading-relaxed text-slate-800 font-medium">{{ event.location || 'Địa điểm sẽ được cập nhật sau' }}</div>
                  </div>
                </div>
                <a
                  v-if="googleMapsUrl"
                  :href="googleMapsUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/70 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
                >
                  <Navigation class="h-3.5 w-3.5" /> Chỉ đường Google Maps <ExternalLink class="h-3 w-3 opacity-70" />
                </a>
              </div>
            </div>
          </section>

          <!-- Referrer -->
          <section class="mt-3 flex items-center gap-3.5 rounded-2xl border border-primary-100 bg-primary-50/60 p-4">
            <span class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary-600 text-sm font-bold text-white">{{ referrerInitials }}</span>
            <div class="min-w-0 flex-1">
              <div class="text-xs font-medium text-primary-700/80">Bạn được mời bởi</div>
              <div class="truncate font-bold text-primary-950">{{ inviteData.referrer?.name }}</div>
            </div>
            <UserCheck class="h-5 w-5 shrink-0 text-primary-500" />
          </section>

          <!-- Description & Info URL -->
          <section v-if="event.description || infoUrl" class="mt-5 card card-pad space-y-3">
            <div class="flex items-center justify-between">
              <h2 class="eyebrow">Giới thiệu sự kiện</h2>
              <a
                v-if="infoUrl"
                :href="infoUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline"
              >
                Xem chi tiết giới thiệu <ExternalLink class="h-3 w-3" />
              </a>
            </div>
            <p v-if="event.description" class="whitespace-pre-line text-[15px] leading-relaxed text-slate-700">{{ event.description }}</p>
          </section>

          <!-- RSVP (desktop inline) -->
          <section v-if="actionChosen === 'none'" class="mt-8 hidden sm:block">
            <div v-if="isRegistrationClosed" class="rounded-2xl border border-rose-200 bg-rose-50/80 p-5 text-center">
              <div class="inline-flex items-center justify-center gap-2 text-rose-700 font-bold mb-1">
                <AlertTriangle class="h-5 w-5" /> Cổng đăng ký đã đóng
              </div>
              <p class="text-sm text-rose-900 font-medium">{{ closureReason }}</p>
              <p class="mt-2 text-xs text-rose-600">Nếu có thắc mắc, vui lòng liên hệ trực tiếp ban tổ chức hoặc người gửi thư mời.</p>
            </div>
            <div v-else class="flex gap-3">
              <button @click="chooseConfirm" class="btn-primary btn-lg flex-1"><Check class="h-5 w-5" /> Xác nhận tham gia</button>
              <button @click="actionChosen = 'decline'" class="btn-secondary btn-lg">Không tham gia</button>
            </div>
          </section>

          <!-- DECLINED -->
          <section v-if="actionChosen === 'decline'" class="card card-pad mt-6 animate-scale-in text-center">
            <div class="text-4xl">🙏</div>
            <h3 class="mt-2 font-bold text-slate-900">Cảm ơn bạn đã phản hồi</h3>
            <p class="mt-1 text-sm text-slate-500">Hy vọng được gặp bạn ở những sự kiện tiếp theo.</p>
            <button @click="actionChosen = 'none'" class="btn-ghost btn-sm mt-3">Tôi đổi ý, muốn tham gia</button>
          </section>

          <!-- REGISTER -->
          <section v-if="actionChosen === 'confirm'" id="register" class="mt-6 scroll-mt-4 animate-fade-up">
            <!-- Stepper -->
            <ol class="mb-4 flex items-center gap-2 text-xs font-semibold">
              <template v-for="(s, i) in ['Xác thực email', 'Thông tin', 'Hoàn tất']" :key="s">
                <li class="flex items-center gap-2" :class="step > i + 1 ? 'text-emerald-600' : step === i + 1 ? 'text-slate-900' : 'text-slate-400'">
                  <span
                    class="grid h-6 w-6 place-items-center rounded-full text-[11px]"
                    :class="step > i + 1 ? 'bg-emerald-500 text-white' : step === i + 1 ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'"
                  >
                    <Check v-if="step > i + 1" class="h-3.5 w-3.5" /><template v-else>{{ i + 1 }}</template>
                  </span>
                  <span class="hidden sm:inline">{{ s }}</span>
                </li>
                <li v-if="i < 2" class="h-px flex-1 bg-slate-200" />
              </template>
            </ol>

            <div class="card card-pad space-y-5">
              <!-- Error message with prominent "Đã có tài khoản, đăng nhập" button if applicable -->
              <div v-if="formError" class="alert-error space-y-2.5">
                <div class="text-sm font-medium">{{ formError }}</div>
                <div v-if="isPasswordAccount && authMode === 'otp'" class="pt-1">
                  <button
                    type="button"
                    @click="switchToPassword"
                    class="btn-primary btn-sm flex items-center justify-center gap-2 shadow-sm font-bold"
                  >
                    <LogIn class="h-4 w-4" /> Đã có tài khoản, đăng nhập
                  </button>
                </div>
              </div>

              <!-- Account Banner (when logged in) -->
              <div v-if="auth.isAuthenticated" class="alert-info flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <span class="block text-sm font-bold truncate">Đang đăng nhập: {{ auth.user?.name || auth.user?.email }}</span>
                  <span class="block text-xs text-primary-700/80 truncate">
                    {{ auth.user?.email }} • {{ auth.user?.type === 'TENANT_ADMIN' ? 'Ban tổ chức (Khách thuê)' : auth.user?.type === 'ADMIN' ? 'Quản trị viên' : auth.user?.type === 'STAFF' ? 'Nhân sự' : 'Khách mời' }}
                  </span>
                </div>
                <button type="button" @click="auth.logout()" class="btn-secondary btn-sm shrink-0"><LogOut class="h-3.5 w-3.5" /> Thoát</button>
              </div>

              <!-- Step 1: Authentication (OTP or Password) -->
              <div v-if="!auth.isAuthenticated" class="space-y-4">
                <!-- MODE 1: OTP Flow -->
                <template v-if="authMode === 'otp'">
                  <div>
                    <h3 class="font-bold text-slate-900">Xác thực email của bạn</h3>
                    <p class="text-sm text-slate-500">Khách đã từng có tài khoản sẽ tự động chuyển bước nhận vé ngay mà không cần nhập OTP.</p>
                  </div>
                  
                  <form v-if="!otpSent" @submit.prevent="handleSendOtp" class="space-y-3">
                    <div class="flex flex-col gap-2 sm:flex-row">
                      <div class="relative flex-1">
                        <Mail class="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                        <input
                          v-model="otpEmail"
                          type="email"
                          inputmode="email"
                          autocomplete="email"
                          required
                          placeholder="ban@example.com"
                          class="field pl-11"
                        />
                      </div>
                      <button type="submit" :disabled="otpBusy || !otpEmail" class="btn-dark py-3">
                        <Loader2 v-if="otpBusy" class="h-4 w-4 animate-spin" />
                        <template v-else>Xác thực / Tiếp tục</template>
                      </button>
                    </div>

                    <!-- Direct option: Đã có tài khoản, đăng nhập -->
                    <div class="flex items-center justify-between border-t border-slate-100 pt-2.5">
                      <span class="text-xs text-slate-500">Đã có tài khoản trên hệ thống?</span>
                      <button
                        type="button"
                        @click="switchToPassword"
                        class="text-xs font-bold text-primary-600 hover:text-primary-800 hover:underline flex items-center gap-1.5"
                      >
                        <LogIn class="h-3.5 w-3.5" /> Đã có tài khoản, đăng nhập
                      </button>
                    </div>
                  </form>

                  <form v-else @submit.prevent="handleVerifyOtp" class="space-y-2">
                    <div class="alert-success">Đã gửi mã tới <b>{{ otpEmail }}</b></div>
                    <div class="flex gap-2">
                      <input
                        v-model="otpCode"
                        inputmode="numeric"
                        autocomplete="one-time-code"
                        maxlength="6"
                        placeholder="••••••"
                        class="field flex-1 text-center font-mono text-xl font-bold tracking-[0.5em]"
                      />
                      <button type="submit" :disabled="otpBusy || otpCode.length !== 6" class="btn-success px-5">
                        <Loader2 v-if="otpBusy" class="h-4 w-4 animate-spin" /> Xác nhận
                      </button>
                    </div>
                    <div class="flex items-center justify-between pt-1">
                      <button type="button" @click="otpSent = false; otpCode = ''" class="text-xs font-semibold text-slate-500 hover:text-slate-800">
                        Đổi email khác
                      </button>
                      <button type="button" @click="switchToPassword" class="text-xs font-bold text-primary-600 hover:underline flex items-center gap-1">
                        <LogIn class="h-3.5 w-3.5" /> Đã có tài khoản, đăng nhập
                      </button>
                    </div>
                  </form>
                </template>

                <!-- MODE 2: Password Login Flow -->
                <template v-else>
                  <div>
                    <h3 class="font-bold text-slate-900">Đăng nhập tài khoản</h3>
                    <p class="text-sm text-slate-500">Tài khoản này đã có mật khẩu. Đăng nhập để tiếp tục nhận vé.</p>
                  </div>

                  <form @submit.prevent="handlePasswordLogin" class="space-y-3">
                    <div>
                      <label class="field-label">Email tài khoản</label>
                      <div class="relative">
                        <Mail class="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                        <input
                          v-model="passwordEmail"
                          type="email"
                          inputmode="email"
                          autocomplete="email"
                          required
                          placeholder="ban@example.com"
                          class="field pl-11"
                        />
                      </div>
                    </div>

                    <div>
                      <label class="field-label">Mật khẩu</label>
                      <div class="relative">
                        <KeyRound class="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                        <input
                          v-model="passwordValue"
                          :type="showPassword ? 'text' : 'password'"
                          autocomplete="current-password"
                          required
                          placeholder="Nhập mật khẩu"
                          class="field pl-11 pr-11"
                        />
                        <button
                          type="button"
                          @click="showPassword = !showPassword"
                          class="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          tabindex="-1"
                        >
                          <EyeOff v-if="showPassword" class="h-4 w-4" />
                          <Eye v-else class="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div class="flex flex-col gap-2 pt-1 sm:flex-row">
                      <button
                        type="submit"
                        :disabled="passwordBusy || !passwordEmail || !passwordValue"
                        class="btn-primary py-3 flex-1 flex items-center justify-center gap-2 font-bold"
                      >
                        <Loader2 v-if="passwordBusy" class="h-4 w-4 animate-spin" />
                        <LogIn v-else class="h-4 w-4" />
                        Đăng nhập & Tiếp tục
                      </button>

                      <button
                        type="button"
                        @click="switchToOtp"
                        class="btn-secondary py-3 text-xs"
                      >
                        Quay lại nhận mã OTP
                      </button>
                    </div>
                  </form>
                </template>
              </div>

              <!-- Step 2: Details -->
              <form @submit.prevent="handleSubmitRegistration" class="space-y-4">
                <div v-if="!auth.isAuthenticated" class="divider" />
                <h3 class="font-bold text-slate-900">Thông tin người tham dự</h3>
                <div class="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label class="field-label">Họ và tên <span class="text-rose-500">*</span></label>
                    <input v-model="form.full_name" required autocomplete="name" placeholder="Nguyễn Văn A" class="field" />
                  </div>
                  <div>
                    <label class="field-label">Số điện thoại <span class="text-rose-500">*</span></label>
                    <input v-model="form.phone" type="tel" inputmode="tel" autocomplete="tel" required placeholder="0912 345 678" class="field" />
                  </div>
                  <div>
                    <label class="field-label">Email nhận vé <span class="text-rose-500">*</span></label>
                    <input v-model="form.email" type="email" inputmode="email" autocomplete="email" required placeholder="ban@example.com" class="field" />
                  </div>
                  <div>
                    <label class="field-label">Người giới thiệu</label>
                    <input :value="inviteData.referrer?.name" readonly class="field" />
                  </div>
                </div>
                <div>
                  <label class="field-label">Địa chỉ <span class="font-normal text-slate-400">(tuỳ chọn)</span></label>
                  <input v-model="form.address" autocomplete="street-address" placeholder="Số nhà, đường, quận/huyện, tỉnh/thành" class="field" />
                </div>
                <button type="submit" :disabled="isSubmitting" class="btn-primary btn-lg w-full">
                  <Loader2 v-if="isSubmitting" class="h-5 w-5 animate-spin" />
                  <template v-else>Xác nhận tham gia & Nhận vé QR</template>
                </button>
                <p class="flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
                  <ShieldCheck class="h-3.5 w-3.5" /> Thông tin chỉ dùng cho việc check-in sự kiện
                </p>
              </form>
            </div>
          </section>
        </template>
      </main>

      <!-- Mobile sticky RSVP bar -->
      <div
        v-if="!registrationDone && actionChosen === 'none'"
        class="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 shadow-nav backdrop-blur-xl sm:hidden"
      >
        <div class="p-3">
          <div v-if="isRegistrationClosed" class="flex items-center justify-center gap-2 rounded-xl bg-slate-100 py-3 px-4 text-center text-xs font-bold text-slate-600">
            <AlertTriangle class="h-4 w-4 text-rose-500 shrink-0" />
            <span class="truncate">Đã đóng đăng ký ({{ closureReason }})</span>
          </div>
          <div v-else class="flex gap-2">
            <button @click="actionChosen = 'decline'" class="btn-secondary btn-lg px-4" aria-label="Không tham gia"><X class="h-5 w-5" /></button>
            <button @click="chooseConfirm" class="btn-primary btn-lg flex-1"><Check class="h-5 w-5" /> Xác nhận tham gia</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
