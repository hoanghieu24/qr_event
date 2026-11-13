import { createRouter, createWebHistory } from 'vue-router';
import { setUnauthorizedHandler } from '../api/client';
import { useAuthStore } from '../stores/auth';
import {
  canAccessRoute,
  getHomeRouteForUser,
  getUnauthorizedRedirect,
  navigateWithFallback,
  triggerHardNavigation,
} from '../utils/authSession';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: () => {
        const auth = useAuthStore();
        if (auth.isAdmin) return '/admin';
        if (auth.isTenantAdmin || auth.isStaff) return '/tenant';
        if (auth.isCustomer) return '/my-ticket';
        return '/guest';
      },
    },
    // ========================================================
    // 1. LINK DÀNH CHO KHÁCH (Khách xem vé & Khách mở sự kiện)
    // ========================================================
    {
      path: '/guest',
      name: 'guest-portal',
      component: () => import('../views/LoginView.vue'),
    },
    {
      path: '/khach',
      redirect: (to) => ({ path: '/guest', query: to.query }),
    },
    {
      path: '/login',
      redirect: (to) => ({ path: '/guest', query: to.query }),
    },
    {
      path: '/tra-cuu',
      redirect: '/guest?tab=check',
    },
    {
      path: '/to-chuc',
      redirect: '/guest?tab=host',
    },
    // ========================================================
    // 2. LINK DÀNH CHO ADMIN (Tách biệt hoàn toàn, bảo mật cao)
    // ========================================================
    {
      path: '/admin/login',
      name: 'admin-login',
      component: () => import('../views/admin/AdminLoginView.vue'),
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('../views/admin/DashboardView.vue'),
      meta: { requiresAdmin: true },
    },
    {
      path: '/admin/tenants',
      name: 'admin-tenants',
      component: () => import('../views/admin/TenantsView.vue'),
      meta: { requiresAdmin: true },
    },
    // ========================================================
    // 3. CỔNG BAN TỔ CHỨC / KHÁCH THUÊ
    // ========================================================
    {
      path: '/tenant',
      name: 'tenant-portal',
      component: () => import('../views/tenant/TenantPortalView.vue'),
      meta: { requiresAuth: true, allowedRoles: ['TENANT_ADMIN', 'STAFF'] },
    },
    {
      path: '/tenant-portal',
      redirect: '/tenant',
    },
    // ========================================================
    // 4. CHỨC NĂNG NHÂN VIÊN
    // ========================================================
    {
      path: '/staff/referral',
      name: 'staff-referral',
      component: () => import('../views/staff/ReferralView.vue'),
      meta: { requiresAuth: true, permission: 'invite:create' },
    },
    {
      path: '/staff/scanner',
      redirect: '/tenant',
    },
    {
      path: '/staff/disputes',
      name: 'staff-disputes',
      component: () => import('../views/staff/DisputesView.vue'),
      meta: { requiresAuth: true, permission: 'customer:dispute_manage' },
    },
    // ========================================================
    // 5. TRANG VÉ CỦA KHÁCH & MÀN HÌNH CHÀO MỪNG
    // ========================================================
    {
      path: '/invite/:token',
      name: 'invite-landing',
      component: () => import('../views/customer/InviteLandingView.vue'),
    },
    {
      path: '/dang-ky',
      redirect: '/guest',
    },
    {
      path: '/my-ticket',
      name: 'my-ticket',
      component: () => import('../views/customer/MyTicketView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/events/:id/welcome',
      name: 'event-welcome',
      component: () => import('../views/event/WelcomeScreenView.vue'),
    },
    {
      path: '/welcome',
      redirect: '/events/1/welcome',
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
});

let isCheckingAuthBeforeEach = false;

router.beforeEach(async (to, _from, next) => {
  const auth = useAuthStore();

  // Load profile if token exists but user not loaded yet
  if (auth.token && !auth.user) {
    isCheckingAuthBeforeEach = true;
    try {
      await auth.fetchMe();
    } catch {
      auth.logout();
    } finally {
      isCheckingAuthBeforeEach = false;
    }
  }

  // 1. BẢO VỆ KHU VỰC ADMIN (TÁCH BIỆT & CHẶN KHÁCH HOÀN TOÀN)
  if (to.path.startsWith('/admin')) {
    // Nếu vào trang đăng nhập Admin (/admin/login)
    if (to.path === '/admin/login') {
      if (auth.isAuthenticated && auth.isAdmin) {
        return next('/admin');
      }
      // Nếu là khách / khách thuê đã đăng nhập nhưng cố vào /admin/login -> chặn lại
      if (auth.isAuthenticated && !auth.isAdmin) {
        return next(getHomeRouteForUser(auth));
      }
      return next();
    }

    // Nếu vào các trang quản trị (/admin, /admin/tenants...)
    if (!auth.isAuthenticated) {
      // Chưa đăng nhập -> chuyển sang trang Đăng nhập Quản trị
      return next({ path: '/admin/login', query: { redirect: to.fullPath } });
    }

    if (!auth.isAdmin) {
      // Khách cố tình truy cập vào trang Quản trị -> chuyển về đúng cổng tài khoản
      return next(getHomeRouteForUser(auth));
    }
  }

  // 2. KHU VỰC KHÁCH (/guest): Nếu là Admin tổng đang đăng nhập, tự động chuyển về /admin
  if (to.path === '/guest' && auth.isAuthenticated && auth.isAdmin) {
    return next('/admin');
  }

  // 3. Yêu cầu đăng nhập & phân quyền (Tenant portal, My ticket, Staff)
  if (to.meta.requiresAuth) {
    if (!auth.isAuthenticated) {
      if (to.path.startsWith('/admin')) {
        return next({ path: '/admin/login', query: { redirect: to.fullPath } });
      }
      return next({ path: '/guest', query: { redirect: to.fullPath } });
    }

    const allowedRoles = to.meta.allowedRoles as string[] | undefined;
    if (allowedRoles?.length && (!auth.user?.type || !allowedRoles.includes(auth.user.type))) {
      return next(getHomeRouteForUser(auth));
    }

    if (to.meta.permission && !auth.hasPermission(to.meta.permission as string)) {
      return next(getHomeRouteForUser(auth));
    }
  }

  next();
});

const CHUNK_RELOAD_KEY = 'eventgo_chunk_reload_at';

function isDynamicImportError(error: unknown): boolean {
  const msg = String((error as any)?.message || error || '').toLowerCase();
  return (
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('importing a module script failed') ||
    msg.includes('unable to preload css') ||
    msg.includes('loading chunk') ||
    msg.includes('loading css chunk') ||
    msg.includes('dynamically imported module') ||
    msg.includes('unexpected token') ||
    msg.includes('mime type')
  );
}

router.onError((error, to) => {
  if (!isDynamicImportError(error) || !to?.fullPath) return;
  const now = Date.now();
  const lastReloadAt = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || '0');
  // Reload once per 15s window when a stale Vite route chunk fails after a new deploy
  if (!lastReloadAt || now - lastReloadAt > 15000) {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
    triggerHardNavigation(to.fullPath, true);
  }
});

// Sync Pinia session and redirect cleanly off protected screens on HTTP 401
setUnauthorizedHandler(() => {
  const auth = useAuthStore();
  const wasAdmin = auth.isAdmin;
  const curRoute = router.currentRoute.value;
  auth.logout();

  if (isCheckingAuthBeforeEach || !curRoute.matched.length) return;
  if (!canAccessRoute(curRoute, auth)) {
    const target =
      wasAdmin || curRoute.path.startsWith('/admin')
        ? `/admin/login?redirect=${encodeURIComponent(curRoute.fullPath)}`
        : getUnauthorizedRedirect(curRoute, auth, true);
    void navigateWithFallback(router, target, true);
  }
});

// Sync logout / account switch immediately across open browser tabs
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== null && event.key !== 'token' && event.key !== 'user') return;
    const auth = useAuthStore();
    auth.syncFromStorage();
  });
}

export default router;
