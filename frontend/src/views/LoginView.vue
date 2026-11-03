<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import {
  QrCode,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  ScanLine,
  Zap,
  ArrowLeft,
  User,
  Phone,
  Loader2,
  Building2,
  Ticket,
  Sparkles,
  CheckCircle2,
  KeyRound
} from 'lucide-vue-next';
import { useAuthStore } from '../stores/auth';
import api from '../api/client';
import { isGuestMode, isAdminMode } from '../utils/portalMode';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

// 2 Chức năng chính: 'check_ticket' (Khách xem vé) | 'host_event' (Khách thuê mở sự kiện) | 'internal_staff' (Nội bộ)
const mainTab = ref<'check_ticket' | 'host_event' | 'internal_staff'>(
  isAdminMode
    ? 'internal_staff'
    : (route.query.tab as string) === 'host'
    ? 'host_event'
    : (route.query.tab as string) === 'admin'
    ? 'internal_staff'
    : 'check_ticket'
);

// Khách thuê: Đăng nhập hay Đăng ký
const tenantSubTab = ref<'login' | 'register'>(
  (route.query.mode as string) === 'register' ? 'register' : 'login'
);

// Staff/Admin password login state
const staffEmail = ref(isAdminMode ? 'admin@eventqr.com' : '');
const staffPassword = ref(isAdminMode ? 'Admin@123' : '');
const staffError = ref('');
const showPassword = ref(false);

// Tenant Registration State
const tenantForm = ref({
  name: '',
  contact_name: '',
  email: (route.query.email as string) || '',
  phone: '',
  password: ''
});
const tenantRegBusy = ref(false);
const tenantRegError = ref('');
const tenantRegSuccess = ref('');

// Customer OTP State (Kiểm tra vé)
const customerEmail = ref('');
const customerName = ref('');
const customerPhone = ref('');
const otpCode = ref('');
const otpSent = ref(false);
const sendingOtp = ref(false);
const customerError = ref('');
const customerMessage = ref('');

const demoAccounts = [
  { label: 'Admin Tổng', email: 'hvan86771@gmail.com', password: '123456' },
  { label: 'Khách thuê mẫu', email: 'hvan8611@gmail.com', password: '12345678' },
  { label: 'Soát vé', email: 'staff_d@eventqr.com', password: 'Staff@123' },
];

const fillDemo = (acc: (typeof demoAccounts)[number]) => {
  staffEmail.value = acc.email;
  staffPassword.value = acc.password;
  staffError.value = '';
};

const handleTenantRegister = async () => {
  tenantRegError.value = '';
  tenantRegSuccess.value = '';
  if (!tenantForm.value.name.trim() || !tenantForm.value.email.trim() || !tenantForm.value.password) {
    tenantRegError.value = 'Vui lòng điền đầy đủ tên đơn vị, email và mật khẩu.';
    return;
  }
  if (tenantForm.value.password.length < 8) {
    tenantRegError.value = 'Mật khẩu cần ít nhất 8 ký tự.';
    return;
  }
  tenantRegBusy.value = true;
  try {
    const res = await api.post('/tenants/register', tenantForm.value);
    const { token, user } = res.data.data;
    auth.token = token;
    auth.user = user;
    localStorage.setItem('tenant_token', token);
    localStorage.setItem('tenant_user', JSON.stringify(user));
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    tenantRegSuccess.value = 'Đăng ký thành công! Đang chuyển vào Cổng sự kiện của bạn...';
    tenantRegSuccess.value = '🎉 ' + (res.data?.data?.message || 'Đăng ký thành công! Đang chuyển vào Cổng sự kiện của bạn...');
    setTimeout(() => {
      router.push('/tenant');
    }, 1000);
  } catch (err: any) {
    tenantRegError.value = err.response?.data?.message || err.message || 'Đăng ký khách thuê thất bại.';
  } finally {
    tenantRegBusy.value = false;
  }
};

const handleStaffLogin = async () => {
  staffError.value = '';
  const email = staffEmail.value.trim();
  const password = staffPassword.value.trim();
  if (!email || !password) {
    staffError.value = 'Vui lòng nhập đầy đủ Email và Mật khẩu.';
    return;
  }
  try {
    const user = await auth.loginWithPassword(email, password);
    const redirectQuery = route.query.redirect as string;
    if (user?.type === 'TENANT_ADMIN' || user?.type === 'STAFF') {
      localStorage.setItem('tenant_token', auth.token || '');
      localStorage.setItem('tenant_user', JSON.stringify(user));
      if (redirectQuery) {
        router.push(redirectQuery);
        return;
      }
      router.push('/tenant');
      return;
    }
    const redirect =
      redirectQuery ||
      (user.type === 'ADMIN'
        ? '/admin'
        : user.permissions?.includes('customer:dispute_manage')
          ? '/staff/disputes'
          : '/my-ticket');
    router.push(redirect);
  } catch (err: any) {
    staffError.value = err.response?.data?.message || err.message || 'Đăng nhập thất bại.';
  }
};

const handleSendOtp = async () => {
  customerError.value = '';
  customerMessage.value = '';
  sendingOtp.value = true;
  try {
    const res = await auth.sendOtp(customerEmail.value);
    otpSent.value = true;
    customerMessage.value = res.data?.data?.message || `Đã gửi mã xác thực 6 số tới ${customerEmail.value}`;
  } catch (err: any) {
    customerError.value = err.response?.data?.message || err.message || 'Không thể gửi mã OTP.';
  } finally {
    sendingOtp.value = false;
  }
};

const handleVerifyOtp = async () => {
  customerError.value = '';
  try {
    await auth.verifyOtp(customerEmail.value, otpCode.value, customerName.value, customerPhone.value);
    router.push((route.query.redirect as string) || '/my-ticket');
  } catch (err: any) {
    customerError.value = err.response?.data?.message || err.message || 'Mã xác thực không hợp lệ.';
  }
};

const onOtpInput = (e: Event) => {
  otpCode.value = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6);
};
</script>

<template>
  <div class="grid grid-cols-1 min-h-[100dvh] min-w-0 lg:grid-cols-[1.05fr_1fr]">
    <!-- Brand panel (desktop) -->
    <aside class="relative hidden overflow-hidden bg-primary-950 lg:flex lg:flex-col lg:justify-between lg:p-12">
      <div class="pointer-events-none absolute inset-0">
        <div class="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-primary-600/40 blur-3xl" />
        <div class="absolute -bottom-32 right-0 h-[28rem] w-[28rem] rounded-full bg-emerald-500/20 blur-3xl" />
        <div class="absolute inset-0 opacity-[0.07]" style="background-image: radial-gradient(white 1px, transparent 1px); background-size: 22px 22px" />
      </div>

      <div class="relative flex items-center gap-3 text-white">
        <span class="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
          <QrCode class="h-6 w-6" />
        </span>
        <span class="text-xl font-extrabold tracking-tight">KTS<span class="text-primary-300">QR</span></span>
      </div>

      <div class="relative max-w-md">
        <h2 class="text-4xl font-extrabold leading-tight tracking-tight text-white">
          Nền tảng vé & check-in sự kiện <span class="text-primary-300">chuyên nghiệp.</span>
        </h2>
        <p class="mt-4 text-base leading-relaxed text-primary-100/80">
          Tra cứu vé QR tức thì cho khách tham gia, hoặc tạo và vận hành sự kiện trọn gói cho đơn vị tổ chức.
        </p>
        <ul class="mt-8 space-y-4">
          <li v-for="f in [
            { icon: Ticket, t: 'Kiểm tra vé nhanh chóng', d: 'Xác thực OTP email tiện lợi, không cần nhớ mật khẩu' },
            { icon: Sparkles, t: 'Mở sự kiện chỉ trong 1 phút', d: 'Tặng 3 sự kiện dùng thử miễn phí, thanh toán tự động' },
            { icon: ShieldCheck, t: 'Vé QR một chạm chống trùng', d: 'Mã QR bảo mật HMAC, quét trực tiếp bằng camera' },
          ]" :key="f.t" class="flex gap-3.5">
            <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-primary-200 ring-1 ring-white/10">
              <component :is="f.icon" class="h-5 w-5" />
            </span>
            <div>
              <div class="font-semibold text-white">{{ f.t }}</div>
              <div class="text-sm text-primary-100/70">{{ f.d }}</div>
            </div>
          </li>
        </ul>
      </div>

      <div class="relative text-xs text-primary-200/60">© 2026 KTSQR · Smart Event Check-in Platform</div>
    </aside>

    <!-- Right Interaction Panel -->
    <section class="flex min-w-0 flex-col justify-center">
      <!-- Mobile brand header -->
      <div class="pt-safe relative overflow-hidden bg-primary-950 px-5 pb-10 pt-7 text-white lg:hidden">
        <div class="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary-600/50 blur-3xl" />
        <div class="relative flex items-center gap-2.5">
          <span class="grid h-10 w-10 place-items-center rounded-xl bg-white/10 ring-1 ring-white/20"><QrCode class="h-5 w-5" /></span>
          <span class="text-lg font-extrabold">KTS<span class="text-primary-300">QR</span></span>
        </div>
        <h1 class="relative mt-4 text-2xl font-extrabold tracking-tight">Chào mừng bạn 👋</h1>
        <p class="relative mt-1 text-xs text-primary-100/80">Tra cứu vé sự kiện hoặc mở sự kiện riêng của bạn</p>
      </div>

      <div class="flex min-w-0 flex-1 items-start justify-center px-4 py-8 lg:items-center lg:px-10">
        <div class="relative z-10 w-full min-w-0 max-w-[440px] animate-fade-up rounded-3xl bg-white p-6 shadow-lift ring-1 ring-slate-200/70 sm:p-8 lg:bg-transparent lg:p-0 lg:shadow-none lg:ring-0">
          
          <!-- 2 CHỨC NĂNG CHÍNH: KIỂM TRA VÉ & TÔI MUỐN MỞ SỰ KIỆN (chỉ hiện khi ở chế độ đa năng) -->
          <div v-if="!isGuestMode && !isAdminMode" class="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-2xl mb-6">
            <button
              type="button"
              @click="mainTab = 'check_ticket'"
              :class="[
                'flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl text-xs font-bold transition cursor-pointer select-none',
                mainTab === 'check_ticket'
                  ? 'bg-white text-primary-700 shadow-sm ring-1 ring-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              ]"
            >
              <Ticket class="h-5 w-5" />
              <span>1. Kiểm tra vé của tôi</span>
            </button>

            <button
              type="button"
              @click="mainTab = 'host_event'"
              :class="[
                'flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl text-xs font-bold transition cursor-pointer select-none',
                mainTab === 'host_event'
                  ? 'bg-white text-primary-700 shadow-sm ring-1 ring-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              ]"
            >
              <Building2 class="h-5 w-5" />
              <span>2. Tôi muốn mở sự kiện</span>
            </button>
          </div>

          <!-- ================= CHỨC NĂNG 1: KIỂM TRA VÉ CỦA TÔI ================= -->
          <div v-if="mainTab === 'check_ticket'" class="space-y-4">
            <div class="border-b border-slate-100 pb-3">
              <span class="text-[11px] font-bold uppercase tracking-wider text-primary-600">Dành cho Khách tham gia</span>
              <h2 class="text-2xl font-black text-slate-900 tracking-tight mt-0.5">Kiểm tra vé tham dự</h2>
              <p class="text-xs text-slate-500 mt-1 leading-relaxed">
                Nhập email bạn đã đăng ký vé. Hệ thống sẽ gửi mã xác thực để hiển thị mã QR vé của bạn.
              </p>
            </div>

            <div v-if="customerError" class="alert-error">{{ customerError }}</div>
            <div v-if="customerMessage" class="alert-success">{{ customerMessage }}</div>

            <!-- BƯỚC 1: GỬI OTP -->
            <form v-if="!otpSent" @submit.prevent="handleSendOtp" class="space-y-4">
              <div>
                <label class="field-label" for="ticket-email">Email đăng ký vé</label>
                <div class="relative">
                  <Mail class="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                  <input
                    id="ticket-email"
                    v-model="customerEmail"
                    type="email"
                    inputmode="email"
                    required
                    placeholder="ban@example.com"
                    class="field pl-11"
                  />
                </div>
              </div>

              <button type="submit" :disabled="sendingOtp || !customerEmail" class="btn-primary btn-lg w-full">
                <Loader2 v-if="sendingOtp" class="h-5 w-5 animate-spin" />
                <template v-else>Gửi mã xác thực để xem vé <ArrowRight class="h-[18px] w-[18px]" /></template>
              </button>
            </form>

            <!-- BƯỚC 2: NHẬP OTP -->
            <form v-else @submit.prevent="handleVerifyOtp" class="space-y-4">
              <div>
                <label class="field-label" for="otp">Mã xác thực 6 số (gửi qua email)</label>
                <input
                  id="otp"
                  :value="otpCode"
                  @input="onOtpInput"
                  type="text"
                  inputmode="numeric"
                  maxlength="6"
                  required
                  placeholder="------"
                  class="field text-center font-mono text-2xl tracking-widest"
                  autofocus
                />
              </div>

              <button type="submit" :disabled="otpCode.length < 6" class="btn-primary btn-lg w-full">
                Xem vé QR của tôi <ArrowRight class="h-[18px] w-[18px]" />
              </button>

              <div class="text-center pt-1">
                <button type="button" @click="otpSent = false" class="text-xs font-semibold text-slate-500 hover:text-slate-800">
                  ← Nhập lại email khác
                </button>
              </div>
            </form>
          </div>

          <!-- ================= CHỨC NĂNG 2: TÔI MUỐN MỞ SỰ KIỆN (KHÁCH THUÊ) ================= -->
          <div v-else-if="mainTab === 'host_event'" class="space-y-4">
            <div class="border-b border-slate-100 pb-3">
              <div class="flex items-center justify-between">
                <span class="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Dành cho Khách thuê / Ban tổ chức</span>
                <div class="flex items-center gap-1 text-xs">
                  <button
                    type="button"
                    @click="tenantSubTab = 'login'"
                    :class="['font-bold px-2.5 py-1 rounded-lg transition', tenantSubTab === 'login' ? 'bg-primary-50 text-primary-700' : 'text-slate-400 hover:text-slate-700']"
                  >
                    Đăng nhập
                  </button>
                  <span class="text-slate-300">|</span>
                  <button
                    type="button"
                    @click="tenantSubTab = 'register'"
                    :class="['font-bold px-2.5 py-1 rounded-lg transition', tenantSubTab === 'register' ? 'bg-primary-50 text-primary-700' : 'text-slate-400 hover:text-slate-700']"
                  >
                    Đăng ký mới
                  </button>
                </div>
              </div>
              <h2 class="text-2xl font-black text-slate-900 tracking-tight mt-1">
                {{ tenantSubTab === 'login' ? 'Cổng điều hành sự kiện' : 'Đăng ký mở sự kiện riêng' }}
              </h2>
              <p class="text-xs text-slate-500 mt-0.5">
                {{ tenantSubTab === 'login' ? 'Đăng nhập vào không gian quản lý vé & nhân sự sự kiện của bạn.' : 'Tạo tài khoản ban tổ chức, được tặng 3 sự kiện dùng thử miễn phí.' }}
              </p>
            </div>

            <!-- ĐĂNG KÝ KHÁCH THUÊ MỚI (CHO 1 NÚT ĐĂNG KÝ Ở PHẦN KHÁCH THUÊ) -->
            <div v-if="tenantSubTab === 'register'" class="space-y-3.5">
              <div v-if="tenantRegError" class="alert-error">{{ tenantRegError }}</div>
              <div v-if="tenantRegSuccess" class="alert-success">{{ tenantRegSuccess }}</div>

              <!-- Friendly helper banner for existing attendees -->
              <div class="rounded-xl bg-amber-50/90 border border-amber-200/90 p-3 text-xs text-amber-900 flex items-start gap-2.5 shadow-2xs">
                <Sparkles class="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div class="leading-relaxed">
                  <span class="font-bold">Đã từng dùng email này nhận vé sự kiện?</span> Bạn hoàn toàn có thể đăng ký bình thường! Hệ thống sẽ <b>tự động nâng cấp tài khoản của bạn lên Ban tổ chức</b>, giữ nguyên vé cũ và tặng ngay <b>3 sự kiện miễn phí</b>.
                </div>
              </div>

              <form @submit.prevent="handleTenantRegister" class="space-y-3">
                <div>
                  <label class="field-label">Tên đơn vị / Tên công ty / Tên sự kiện *</label>
                  <div class="relative">
                    <Building2 class="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                    <input v-model="tenantForm.name" required placeholder="VD: Công ty TNHH Sự Kiện ABC" class="field pl-11" />
                  </div>
                </div>

                <div>
                  <label class="field-label">Họ tên người đại diện *</label>
                  <div class="relative">
                    <User class="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                    <input v-model="tenantForm.contact_name" required placeholder="Nguyễn Văn A" class="field pl-11" />
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="field-label">Email quản lý *</label>
                    <div class="relative">
                      <Mail class="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                      <input v-model="tenantForm.email" type="email" required placeholder="banto-chuc@email.com" class="field pl-11" />
                    </div>
                  </div>
                  <div>
                    <label class="field-label">Số điện thoại</label>
                    <div class="relative">
                      <Phone class="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                      <input v-model="tenantForm.phone" placeholder="0912..." class="field pl-11" />
                    </div>
                  </div>
                </div>

                <div>
                  <label class="field-label">Mật khẩu quản lý (tối thiểu 8 ký tự) *</label>
                  <div class="relative">
                    <Lock class="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                    <input v-model="tenantForm.password" type="password" minlength="8" required placeholder="Nhập mật khẩu" class="field pl-11" />
                  </div>
                </div>

                <button type="submit" :disabled="tenantRegBusy" class="btn-primary btn-lg w-full">
                  <Loader2 v-if="tenantRegBusy" class="h-5 w-5 animate-spin" />
                  <template v-else>Đăng ký & Mở sự kiện ngay <ArrowRight class="h-[18px] w-[18px]" /></template>
                </button>

                <div class="text-center pt-2 text-xs text-slate-600">
                  Đã có tài khoản đơn vị?
                  <button type="button" @click="tenantSubTab = 'login'" class="font-bold text-primary-600 hover:underline">
                    Đăng nhập ngay
                  </button>
                </div>
              </form>
            </div>

            <!-- ĐĂNG NHẬP KHÁCH THUÊ -->
            <form v-else @submit.prevent="handleStaffLogin" class="space-y-4">
              <div v-if="staffError" class="alert-error">{{ staffError }}</div>

              <div>
                <label class="field-label" for="ten-email">Email quản lý đơn vị</label>
                <div class="relative">
                  <Mail class="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                  <input id="ten-email" v-model="staffEmail" type="email" inputmode="email" autocomplete="username" required placeholder="ban-to-chuc@email.com" class="field pl-11" />
                </div>
              </div>

              <div>
                <label class="field-label" for="ten-password">Mật khẩu</label>
                <div class="relative">
                  <Lock class="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                  <input
                    id="ten-password"
                    v-model="staffPassword"
                    :type="showPassword ? 'text' : 'password'"
                    autocomplete="current-password"
                    required
                    placeholder="Nhập mật khẩu"
                    class="field pl-11 pr-11"
                  />
                  <button type="button" @click="showPassword = !showPassword" class="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:text-slate-700">
                    <component :is="showPassword ? EyeOff : Eye" class="h-[18px] w-[18px]" />
                  </button>
                </div>
              </div>

              <button type="submit" :disabled="auth.isLoading" class="btn-primary btn-lg w-full">
                <Loader2 v-if="auth.isLoading" class="h-5 w-5 animate-spin" />
                <template v-else>Vào Không gian Sự kiện <ArrowRight class="h-[18px] w-[18px]" /></template>
              </button>

              <div class="text-center pt-2 text-xs text-slate-600">
                Chưa có tài khoản đơn vị?
                <button type="button" @click="tenantSubTab = 'register'" class="font-bold text-primary-600 hover:underline">
                  Đăng ký mở sự kiện ngay
                </button>
              </div>
            </form>
          </div>

          <!-- ================= CHỨC NĂNG PHỤ: QUẢN TRỊ VIÊN & NHÂN SỰ NỘI BỘ ================= -->
          <!-- (BÊN PHÍA ADMIN KHÔNG CÓ NÚT ĐĂNG KÝ) -->
          <div v-else class="space-y-4">
            <div class="border-b border-slate-100 pb-3">
              <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Khu vực nội bộ</span>
              <h2 class="text-2xl font-black text-slate-900 tracking-tight mt-0.5">Quản trị viên & Nhân sự</h2>
              <p class="text-xs text-slate-500 mt-1">
                Dành cho Admin tổng hệ thống hoặc nhân viên soát vé nội bộ được phân quyền. (Không có đăng ký tự do).
              </p>
            </div>

            <div v-if="staffError" class="alert-error">{{ staffError }}</div>

            <form @submit.prevent="handleStaffLogin" class="space-y-4">
              <div>
                <label class="field-label">Email nội bộ</label>
                <div class="relative">
                  <Mail class="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                  <input v-model="staffEmail" type="email" required placeholder="admin@eventqr.com" class="field pl-11" />
                </div>
              </div>

              <div>
                <label class="field-label">Mật khẩu</label>
                <div class="relative">
                  <Lock class="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                  <input v-model="staffPassword" :type="showPassword ? 'text' : 'password'" required placeholder="Nhập mật khẩu" class="field pl-11 pr-11" />
                  <button type="button" @click="showPassword = !showPassword" class="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:text-slate-700">
                    <component :is="showPassword ? EyeOff : Eye" class="h-[18px] w-[18px]" />
                  </button>
                </div>
              </div>

              <button type="submit" :disabled="auth.isLoading" class="btn-primary btn-lg w-full">
                <Loader2 v-if="auth.isLoading" class="h-5 w-5 animate-spin" />
                <template v-else>Đăng nhập nội bộ <ArrowRight class="h-[18px] w-[18px]" /></template>
              </button>

              <details class="group pt-1">
                <summary class="flex min-h-10 cursor-pointer list-none items-center justify-between rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
                  <span>Tài khoản demo</span>
                  <span class="text-slate-400 transition group-open:rotate-45">+</span>
                </summary>
                <div class="mt-2 grid grid-cols-2 gap-2">
                  <button
                    v-for="acc in demoAccounts"
                    :key="acc.email"
                    type="button"
                    @click="fillDemo(acc)"
                    class="rounded-xl border border-slate-200 p-2 text-left text-xs font-semibold hover:bg-slate-50 transition"
                  >
                    {{ acc.label }}
                    <span class="block truncate font-mono text-[10px] text-slate-400">{{ acc.email }}</span>
                  </button>
                </div>
              </details>
            </form>
          </div>

          <!-- FOOTER SWITCH LINK -->
          <div v-if="!isGuestMode && !isAdminMode" class="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <button
              v-if="mainTab !== 'internal_staff'"
              type="button"
              @click="mainTab = 'internal_staff'"
              class="hover:text-slate-700 transition"
            >
              🔒 Đăng nhập Quản trị viên / Nhân sự nội bộ
            </button>
            <button
              v-else
              type="button"
              @click="mainTab = 'check_ticket'"
              class="font-semibold text-primary-600 hover:underline"
            >
              ← Về màn hình chính (Khách xem vé & Khách thuê)
            </button>
            <span>KTSQR Platform</span>
          </div>

        </div>
      </div>
    </section>
  </div>
</template>
