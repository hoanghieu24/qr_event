<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  KeyRound,
  Server,
  QrCode
} from 'lucide-vue-next';
import { useAuthStore } from '../../stores/auth';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const email = ref('');
const password = ref('');
const showPassword = ref(false);
const errorMessage = ref('');
const isLoading = ref(false);

const handleAdminLogin = async () => {
  errorMessage.value = '';
  const trimmedEmail = email.value.trim();
  const trimmedPassword = password.value.trim();

  if (!trimmedEmail || !trimmedPassword) {
    errorMessage.value = 'Vui lòng nhập đầy đủ Email và Mật khẩu Quản trị.';
    return;
  }

  isLoading.value = true;
  try {
    const user = await auth.loginWithPassword(trimmedEmail, trimmedPassword);
    
    // Strict Admin Authorization Check
    if (user?.type !== 'ADMIN') {
      auth.logout();
      errorMessage.value = 'Truy cập bị từ chối: Tài khoản này không có quyền Quản trị viên cấp cao!';
      return;
    }

    const redirect = (route.query.redirect as string) || '/admin';
    router.push(redirect);
  } catch (err: any) {
    errorMessage.value = err.response?.data?.message || err.message || 'Đăng nhập Quản trị viên thất bại.';
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="min-h-[100dvh] bg-slate-950 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden selection:bg-rose-500 selection:text-white">
    <!-- Background glow & grid accents -->
    <div class="pointer-events-none absolute inset-0">
      <div class="absolute -top-40 left-1/2 -translate-x-1/2 h-[32rem] w-[40rem] rounded-full bg-indigo-600/20 blur-[120px]" />
      <div class="absolute -bottom-40 right-10 h-80 w-80 rounded-full bg-rose-600/15 blur-[100px]" />
      <div
        class="absolute inset-0 opacity-[0.03]"
        style="background-image: radial-gradient(#fff 1px, transparent 1px); background-size: 24px 24px"
      />
    </div>

    <!-- Central Security Card -->
    <div class="relative z-10 w-full max-w-[420px]">
      <!-- Header Badge -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 shadow-inner mb-4">
          <span class="flex h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
          <span class="text-[11px] font-bold tracking-widest uppercase text-slate-300">Cổng Quản Trị Hệ Thống</span>
        </div>

        <div class="flex items-center justify-center gap-3">
          <img src="/logo-white.png" alt="EventGo.vn" class="h-11 w-auto object-contain" />
          <span class="text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2.5 py-1 rounded-lg">ADMIN</span>
        </div>
      </div>

      <!-- Main Login Container -->
      <div class="rounded-3xl bg-slate-900/90 border border-slate-800 p-7 sm:p-8 shadow-2xl backdrop-blur-xl">
        <div class="mb-6">
          <h1 class="text-lg font-bold text-white tracking-tight">Xác thực Quản trị viên</h1>
          <p class="text-xs text-slate-400 mt-1 leading-relaxed">
            Khu vực giới hạn chỉ dành cho Quản trị viên cấp cao. Vui lòng nhập thông tin xác thực để vào bảng điều khiển.
          </p>
        </div>

        <!-- Error alert -->
        <div
          v-if="errorMessage"
          class="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300 animate-shake"
        >
          <ShieldAlert class="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
          <div class="leading-relaxed">{{ errorMessage }}</div>
        </div>

        <!-- Admin Form -->
        <form @submit.prevent="handleAdminLogin" class="space-y-4">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5" for="admin-email">
              Email Quản trị viên
            </label>
            <div class="relative">
              <Mail class="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-500" />
              <input
                id="admin-email"
                v-model="email"
                type="email"
                autocomplete="username"
                required
                autofocus
                placeholder="admin@domain.com"
                class="w-full rounded-xl border border-slate-800 bg-slate-950/80 pl-11 pr-4 py-2.5 text-sm text-white placeholder-slate-600 transition focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5" for="admin-password">
              Mật khẩu bảo mật
            </label>
            <div class="relative">
              <Lock class="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-500" />
              <input
                id="admin-password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                required
                placeholder="••••••••••••"
                class="w-full rounded-xl border border-slate-800 bg-slate-950/80 pl-11 pr-11 py-2.5 text-sm text-white placeholder-slate-600 transition focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-500 hover:text-slate-300 transition"
                tabindex="-1"
              >
                <component :is="showPassword ? EyeOff : Eye" class="h-4 w-4" />
              </button>
            </div>
          </div>

          <button
            type="submit"
            :disabled="isLoading"
            class="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 py-3 text-sm font-bold text-white shadow-lg shadow-rose-600/20 transition hover:from-rose-500 hover:to-indigo-500 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Loader2 v-if="isLoading" class="h-5 w-5 animate-spin" />
            <template v-else>
              <span>Đăng nhập Quản trị viên</span>
              <ArrowRight class="h-4 w-4" />
            </template>
          </button>
        </form>

        <div class="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
          <span class="flex items-center gap-1.5">
            <Server class="h-3.5 w-3.5 text-slate-600" />
            Bảo mật SSL 256-bit
          </span>
          <span>© 2026 EventGo.vn Admin</span>
        </div>
      </div>
    </div>
  </div>
</template>
