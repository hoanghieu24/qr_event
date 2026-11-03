<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ScanLine, Users, ShieldAlert, LayoutDashboard, Ticket, LogOut, QrCode, ChevronDown } from 'lucide-vue-next';
import { useAuthStore } from './stores/auth';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const user = computed(() => auth.user);
const menuOpen = ref(false);

// Trang khách (link mời, đăng nhập) hiển thị toàn màn hình, không có khung quản trị
const bareLayout = computed(() => route.path.startsWith('/invite') || route.path === '/login' || route.path.startsWith('/tenant') || route.path.startsWith('/events/'));

const initials = computed(() => {
  const name = user.value?.name?.trim() || '';
  const parts = name.split(/\s+/);
  return ((parts[parts.length - 1]?.[0] || '') + (parts.length > 1 ? parts[0][0] : '')).toUpperCase() || 'U';
});

const roleLabel = computed(() => {
  if (!user.value) return '';
  return { ADMIN: 'Quản trị viên', TENANT_ADMIN: 'Ban tổ chức', STAFF: 'Nhân viên', CUSTOMER: 'Khách hàng' }[user.value.type];
});

const navItems = computed(() => {
  const items: { to: string; label: string; short: string; icon: any; show: boolean }[] = [
    { to: '/admin', label: 'Tổng quan', short: 'Tổng quan', icon: LayoutDashboard, show: auth.isAdmin },
    { to: '/tenant', label: 'Không gian sự kiện', short: 'Sự kiện', icon: LayoutDashboard, show: auth.isTenantAdmin || !!user.value?.tenant_id },
    { to: '/staff/referral', label: 'Khách & Link mời', short: 'Khách mời', icon: Users, show: auth.hasPermission('invite:create') },
    { to: '/staff/scanner', label: 'Soát vé', short: 'Soát vé', icon: ScanLine, show: auth.hasPermission('tickets:scan') },
    { to: '/staff/disputes', label: 'Tranh chấp', short: 'Tranh chấp', icon: ShieldAlert, show: auth.hasPermission('customer:dispute_manage') },
    { to: '/my-ticket', label: 'Vé của tôi', short: 'Vé của tôi', icon: Ticket, show: auth.isCustomer },
  ];
  return items.filter((i) => i.show);
});

const isActive = (to: string) => route.path === to || route.path.startsWith(to + '/');

const handleLogout = () => {
  menuOpen.value = false;
  auth.logout();
  router.push('/login');
};

watch(() => route.fullPath, () => (menuOpen.value = false));
</script>

<template>
  <div v-if="bareLayout" class="min-h-[100dvh]">
    <router-view />
  </div>

  <div v-else class="flex min-h-[100dvh] flex-col">
    <!-- Header -->
    <header class="pt-safe sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
      <div class="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:h-16 sm:px-6 lg:px-8">
        <router-link to="/" class="flex items-center gap-2.5">
          <span class="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-glow">
            <QrCode class="h-5 w-5" :stroke-width="2.25" />
          </span>
          <span class="text-[17px] font-extrabold tracking-tight text-slate-900">KTS<span class="text-primary-600">QR</span></span>
        </router-link>

        <!-- Desktop nav -->
        <nav v-if="auth.isAuthenticated" class="ml-4 hidden items-center gap-1 md:flex">
          <router-link
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            :class="isActive(item.to) ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'"
            class="flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition"
          >
            <component :is="item.icon" class="h-4 w-4" />
            {{ item.label }}
          </router-link>
        </nav>

        <div class="ml-auto flex items-center gap-2">
          <template v-if="auth.isAuthenticated">
            <div class="relative">
              <button
                @click="menuOpen = !menuOpen"
                class="flex items-center gap-2.5 rounded-xl py-1.5 pl-1.5 pr-2 transition hover:bg-slate-100"
                aria-label="Tài khoản"
              >
                <span class="grid h-8 w-8 place-items-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                  {{ initials }}
                </span>
                <span class="hidden text-left leading-tight sm:block">
                  <span class="block max-w-[160px] truncate text-sm font-semibold text-slate-900">{{ user?.name }}</span>
                  <span class="block text-[11px] text-slate-500">{{ roleLabel }}</span>
                </span>
                <ChevronDown class="hidden h-4 w-4 text-slate-400 sm:block" />
              </button>

              <Transition
                enter-active-class="transition duration-150 ease-out"
                enter-from-class="opacity-0 -translate-y-1 scale-95"
                leave-active-class="transition duration-100 ease-in"
                leave-to-class="opacity-0 -translate-y-1 scale-95"
              >
                <div v-if="menuOpen" class="absolute right-0 mt-2 w-64 origin-top-right rounded-2xl border border-slate-200 bg-white p-2 shadow-lift">
                  <div class="px-3 py-2.5">
                    <div class="truncate text-sm font-semibold text-slate-900">{{ user?.name }}</div>
                    <div class="truncate text-xs text-slate-500">{{ user?.email }}</div>
                    <span class="chip-brand mt-2">{{ roleLabel }}</span>
                  </div>
                  <div class="divider my-1" />
                  <button @click="handleLogout" class="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50">
                    <LogOut class="h-4 w-4" /> Đăng xuất
                  </button>
                </div>
              </Transition>
              <div v-if="menuOpen" class="fixed inset-0 -z-10" @click="menuOpen = false" />
            </div>
          </template>
          <router-link v-else to="/login" class="btn-primary btn-sm">Đăng nhập</router-link>
        </div>
      </div>
    </header>

    <!-- Content -->
    <main class="w-full flex-1" :class="auth.isAuthenticated && navItems.length > 1 ? 'pb-24 md:pb-0' : ''">
      <router-view v-slot="{ Component, route: r }">
        <div :key="r.path" class="animate-page-in">
          <component :is="Component" />
        </div>
      </router-view>
    </main>

    <!-- Mobile bottom tab bar -->
    <nav
      v-if="auth.isAuthenticated && navItems.length > 1"
      class="pb-safe fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/80 bg-white/90 shadow-nav backdrop-blur-xl md:hidden"
    >
      <div class="mx-auto flex max-w-md items-stretch justify-around px-2 pt-1.5">
        <router-link
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="group relative flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 transition"
          :class="isActive(item.to) ? 'text-primary-700' : 'text-slate-400 active:text-slate-600'"
        >
          <span
            class="grid h-8 w-14 place-items-center rounded-full transition"
            :class="isActive(item.to) ? 'bg-primary-100' : 'group-active:bg-slate-100'"
          >
            <component :is="item.icon" class="h-[21px] w-[21px]" :stroke-width="isActive(item.to) ? 2.4 : 2" />
          </span>
          <span class="text-[11px] font-semibold leading-none">{{ item.short }}</span>
        </router-link>
      </div>
      <div class="h-1.5" />
    </nav>
  </div>
</template>
