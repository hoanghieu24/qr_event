<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import {
  QrCode,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Building2,
  Ticket,
  Sparkles,
  Phone,
  User,
  Loader2,
  CheckCircle2
} from 'lucide-vue-next';
import { useAuthStore } from '../stores/auth';
import api from '../api/client';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

// 2 Chức năng dành cho Khách: 'check_ticket' (Khách xem vé) | 'host_event' (Khách thuê mở sự kiện)
const mainTab = ref<'check_ticket' | 'host_event'>(
  (route.query.tab as string) === 'host' ? 'host_event' : 'check_ticket'
);

// Khách thuê mở sự kiện: Đăng nhập hay Đăng ký
const tenantSubTab = ref<'login' | 'register'>(
  (route.query.mode as string) === 'register' ? 'register' : 'login'
);

// Form đăng nhập Khách thuê (Ban tổ chức)
const tenantLoginEmail = ref('');
const tenantLoginPassword = ref('');
const tenantLoginError = ref('');
const showPassword = ref(false);

// Form đăng ký Khách thuê mới
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

// Khách tham dự kiểm tra vé (OTP)
const customerEmail = ref('');
const customerName = ref('');
const customerPhone = ref('');
const otpCode = ref('');
const otpSent = ref(false);
const otpIsSimulation = ref(false);
const sendingOtp = ref(false);
const customerError = ref('');
const customerMessage = ref('');

// Xử lý đăng ký Ban tổ chức / Khách thuê
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
    tenantRegSuccess.value = '🎉 ' + (res.data?.data?.message || 'Đăng ký thành công! Đang chuyển vào Cổng sự kiện của bạn...');
    setTimeout(() => {
      router.push('/tenant');
    }, 900);
  } catch (err: any) {
    tenantRegError.value = err.response?.data?.message || err.message || 'Đăng ký đơn vị tổ chức thất bại.';
  } finally {
    tenantRegBusy.value = false;
  }
};

// Xử lý đăng nhập Ban tổ chức / Khách thuê
const handleTenantLogin = async () => {
  tenantLoginError.value = '';
  const email = tenantLoginEmail.value.trim();
  const password = tenantLoginPassword.value.trim();
  if (!email || !password) {
    tenantLoginError.value = 'Vui lòng nhập đầy đủ Email và Mật khẩu.';
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
    // Nếu là tài khoản khách thông thường
    router.push('/my-ticket');
  } catch (err: any) {
    tenantLoginError.value = err.response?.data?.message || err.message || 'Đăng nhập không thành công.';
  }
};

// Xử lý gửi OTP tra cứu vé
const handleSendOtp = async () => {
  customerError.value = '';
  customerMessage.value = '';
  sendingOtp.value = true;
  try {
    const res = await auth.sendOtp(customerEmail.value.trim());
    const data = res.data?.data || {};
    if (data.token) {
      // Người tham gia đã từng có tài khoản -> Không cần nhập mã OTP!
      customerMessage.value = data.message || 'Đã nhận diện vé của bạn! Đang mở mã QR...';
      setTimeout(() => {
        router.push('/my-ticket');
      }, 400);
      return;
    }
    otpSent.value = true;
    otpIsSimulation.value = Boolean(data.is_simulation);
    otpCode.value = otpIsSimulation.value ? (data.demo_otp || '123456') : '';
    customerMessage.value =
      data.message ||
      (otpIsSimulation.value
        ? 'Mã xác thực OTP kiểm thử là: 123456'
        : 'Mã xác thực OTP gồm 6 chữ số đã được gửi tới email của bạn. Vui lòng kiểm tra hộp thư (kể cả mục Spam).');
  } catch (err: any) {
    customerError.value = err.response?.data?.message || err.message || 'Không thể gửi mã xác thực.';
  } finally {
    sendingOtp.value = false;
  }
};

// Xử lý xác nhận OTP
const handleVerifyOtp = async () => {
  customerError.value = '';
  try {
    await auth.verifyOtp(customerEmail.value, otpCode.value, customerName.value, customerPhone.value);
    router.push((route.query.redirect as string) || '/my-ticket');
  } catch (err: any) {
    customerError.value = err.response?.data?.message || err.message || 'Mã xác thực không hợp lệ hoặc đã hết hạn.';
  }
};

const onOtpInput = (e: Event) => {
  otpCode.value = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6);
};
</script>

<template>
  <div class="grid grid-cols-1 min-h-[100dvh] min-w-0 lg:grid-cols-[1.05fr_1fr] bg-slate-50">
    <!-- Brand panel (desktop) -->
    <aside class="relative hidden overflow-hidden bg-primary-950 lg:flex lg:flex-col lg:justify-between lg:p-12">
      <div class="pointer-events-none absolute inset-0">
        <div class="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-primary-600/35 blur-3xl" />
        <div class="absolute -bottom-32 right-0 h-[28rem] w-[28rem] rounded-full bg-emerald-500/20 blur-3xl" />
        <div class="absolute inset-0 opacity-[0.06]" style="background-image: radial-gradient(white 1px, transparent 1px); background-size: 22px 22px" />
      </div>

      <div class="relative flex items-center gap-3 text-white">
        <span class="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
          <QrCode class="h-6 w-6" />
        </span>
        <span class="text-xl font-extrabold tracking-tight">KTS<span class="text-primary-300">QR</span></span>
      </div>

      <div class="relative max-w-md">
        <h2 class="text-4xl font-extrabold leading-tight tracking-tight text-white">
          Nền tảng vé & check-in sự kiện <span class="text-primary-300">thông minh.</span>
        </h2>
        <p class="mt-4 text-base leading-relaxed text-primary-100/80">
          Tra cứu vé QR tức thì cho khách tham gia, hoặc tạo và vận hành sự kiện trọn gói cho đơn vị tổ chức.
        </p>
        <ul class="mt-8 space-y-4">
          <li v-for="f in [
            { icon: Ticket, t: 'Tra cứu vé nhanh chóng', d: 'Xác thực OTP email tiện lợi, xem mã QR vé ngay lập tức' },
            { icon: Sparkles, t: 'Tạo sự kiện trong 1 phút', d: 'Tặng 3 sự kiện dùng thử miễn phí, quản lý danh sách khách mời' },
            { icon: ShieldCheck, t: 'Vé QR một chạm chống trùng', d: 'Bảo mật mã QR chống quét trùng, check-in trực tiếp bằng camera' },
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

      <div class="relative text-xs text-primary-200/60">© 2026 KTSQR Platform · All Rights Reserved</div>
    </aside>

    <!-- Right Interaction Panel -->
    <section class="flex min-w-0 flex-col justify-center bg-white lg:bg-transparent">
      <!-- Mobile brand header -->
      <div class="pt-safe relative overflow-hidden bg-primary-950 px-5 pb-8 pt-7 text-white lg:hidden">
        <div class="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary-600/50 blur-3xl" />
        <div class="relative flex items-center gap-2.5">
          <span class="grid h-9 w-9 place-items-center rounded-xl bg-white/10 ring-1 ring-white/20"><QrCode class="h-5 w-5" /></span>
          <span class="text-lg font-extrabold">KTS<span class="text-primary-300">QR</span></span>
        </div>
        <h1 class="relative mt-3 text-2xl font-extrabold tracking-tight">Chào mừng bạn 👋</h1>
        <p class="relative mt-1 text-xs text-primary-100/80">Tra cứu vé sự kiện hoặc tạo sự kiện riêng</p>
      </div>

      <div class="flex min-w-0 flex-1 items-start justify-center px-4 py-8 lg:items-center lg:px-10">
        <div class="relative z-10 w-full min-w-0 max-w-[440px] rounded-3xl bg-white p-6 shadow-lift ring-1 ring-slate-200/70 sm:p-8 lg:p-8">
          
          <!-- 2 CHỨC NĂNG DÀNH CHO KHÁCH -->
          <div class="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-2xl mb-6">
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
                Nhập email bạn đã đăng ký vé để nhận mã OTP xác thực qua email và xem mã QR tham dự.
              </p>
            </div>

            <div v-if="customerError" class="alert-error">{{ customerError }}</div>
            <div v-if="customerMessage" class="alert-success">{{ customerMessage }}</div>

            <!-- BƯỚC 1: GỬI EMAIL TRA CỨU -->
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
                    autofocus
                    placeholder="ban@example.com"
                    class="field pl-11"
                  />
                </div>
              </div>

              <button type="submit" :disabled="sendingOtp || !customerEmail" class="btn-primary btn-lg w-full">
                <Loader2 v-if="sendingOtp" class="h-5 w-5 animate-spin" />
                <template v-else>
                  <span>Tra cứu & Xem vé QR ngay</span>
                  <ArrowRight class="h-[18px] w-[18px]" />
                </template>
              </button>
            </form>

            <!-- BƯỚC 2: NHẬP OTP -->
            <form v-else @submit.prevent="handleVerifyOtp" class="space-y-4">
              <div>
                <label class="field-label" for="otp">
                  {{ otpIsSimulation ? 'Mã xác thực 6 số (Chế độ test: 123456)' : 'Nhập mã xác thực 6 số vừa gửi về email' }}
                </label>
                <input
                  id="otp"
                  :value="otpCode"
                  @input="onOtpInput"
                  type="text"
                  inputmode="numeric"
                  maxlength="6"
                  required
                  :placeholder="otpIsSimulation ? '123456' : '••••••'"
                  class="field text-center font-mono text-2xl tracking-widest"
                  autofocus
                />
              </div>

              <button type="submit" :disabled="otpCode.length < 6" class="btn-primary btn-lg w-full">
                <span>Xem vé QR của tôi</span>
                <ArrowRight class="h-[18px] w-[18px]" />
              </button>

              <div class="flex items-center justify-between pt-1">
                <button
                  type="button"
                  @click="otpSent = false; otpCode = ''; customerMessage = ''; customerError = ''"
                  class="text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  ← Nhập lại email khác
                </button>
                <button
                  type="button"
                  :disabled="sendingOtp"
                  @click="handleSendOtp"
                  class="text-xs font-bold text-primary-600 hover:underline disabled:opacity-50"
                >
                  {{ sendingOtp ? 'Đang gửi lại...' : 'Gửi lại mã OTP' }}
                </button>
              </div>
            </form>
          </div>

          <!-- ================= CHỨC NĂNG 2: TÔI MUỐN MỞ SỰ KIỆN ================= -->
          <div v-else class="space-y-4">
            <div class="border-b border-slate-100 pb-3">
              <div class="flex items-center justify-between">
                <span class="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Dành cho Ban tổ chức sự kiện</span>
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
                {{ tenantSubTab === 'login' ? 'Đăng nhập vào không gian quản lý vé & khách mời sự kiện.' : 'Tạo tài khoản ban tổ chức, được tặng 3 sự kiện dùng thử miễn phí.' }}
              </p>
            </div>

            <!-- ĐĂNG KÝ BAN TỔ CHỨC MỚI -->
            <div v-if="tenantSubTab === 'register'" class="space-y-3.5">
              <div v-if="tenantRegError" class="alert-error">{{ tenantRegError }}</div>
              <div v-if="tenantRegSuccess" class="alert-success">{{ tenantRegSuccess }}</div>

              <div class="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 flex items-start gap-2.5">
                <Sparkles class="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div class="leading-relaxed">
                  Tặng ngay <b>3 sự kiện miễn phí</b> cho mọi tài khoản ban tổ chức mới. Tạo và chia sẻ mã QR tức thì.
                </div>
              </div>

              <form @submit.prevent="handleTenantRegister" class="space-y-3">
                <div>
                  <label class="field-label">Tên đơn vị / Tên công ty / Tên sự kiện *</label>
                  <div class="relative">
                    <Building2 class="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                    <input v-model="tenantForm.name" required placeholder="Ví dụ: Công ty TNHH ABC" class="field pl-11" />
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="field-label">Người đại diện</label>
                    <div class="relative">
                      <User class="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                      <input v-model="tenantForm.contact_name" placeholder="Họ và tên" class="field pl-11" />
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
                  <label class="field-label">Email quản lý *</label>
                  <div class="relative">
                    <Mail class="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                    <input v-model="tenantForm.email" type="email" required placeholder="contact@congty.com" class="field pl-11" />
                  </div>
                </div>

                <div>
                  <label class="field-label">Mật khẩu (tối thiểu 8 ký tự) *</label>
                  <div class="relative">
                    <Lock class="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                    <input v-model="tenantForm.password" type="password" minlength="8" required placeholder="Nhập mật khẩu" class="field pl-11" />
                  </div>
                </div>

                <button type="submit" :disabled="tenantRegBusy" class="btn-primary btn-lg w-full">
                  <Loader2 v-if="tenantRegBusy" class="h-5 w-5 animate-spin" />
                  <template v-else>
                    <span>Đăng ký & Mở sự kiện ngay</span>
                    <ArrowRight class="h-[18px] w-[18px]" />
                  </template>
                </button>

                <div class="text-center pt-2 text-xs text-slate-600">
                  Đã có tài khoản ban tổ chức?
                  <button type="button" @click="tenantSubTab = 'login'" class="font-bold text-primary-600 hover:underline">
                    Đăng nhập
                  </button>
                </div>
              </form>
            </div>

            <!-- ĐĂNG NHẬP BAN TỔ CHỨC -->
            <form v-else @submit.prevent="handleTenantLogin" class="space-y-4">
              <div v-if="tenantLoginError" class="alert-error">{{ tenantLoginError }}</div>

              <div>
                <label class="field-label" for="ten-email">Email quản lý đơn vị</label>
                <div class="relative">
                  <Mail class="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                  <input id="ten-email" v-model="tenantLoginEmail" type="email" inputmode="email" autocomplete="username" required placeholder="ban-to-chuc@email.com" class="field pl-11" />
                </div>
              </div>

              <div>
                <label class="field-label" for="ten-password">Mật khẩu</label>
                <div class="relative">
                  <Lock class="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                  <input
                    id="ten-password"
                    v-model="tenantLoginPassword"
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
                <template v-else>
                  <span>Vào Không gian Sự kiện</span>
                  <ArrowRight class="h-[18px] w-[18px]" />
                </template>
              </button>

              <div class="text-center pt-2 text-xs text-slate-600">
                Chưa có tài khoản đơn vị?
                <button type="button" @click="tenantSubTab = 'register'" class="font-bold text-primary-600 hover:underline">
                  Đăng ký mở sự kiện ngay
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    </section>
  </div>
</template>
