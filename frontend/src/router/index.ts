import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

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
        return '/khach';
      },
    },
    // ========================================================
    // 1. LINK DÀNH CHO KHÁCH (Khách xem vé & Khách mở sự kiện)
    // ========================================================
    {
      path: '/khach',
      name: 'guest-portal',
      component: () => import('../views/LoginView.vue'),
    },
    {
      path: '/login',
      redirect: (to) => ({ path: '/khach', query: to.query }),
    },
    {
      path: '/tra-cuu',
      redirect: '/khach?tab=check',
    },
    {
      path: '/to-chuc',
      redirect: '/khach?tab=host',
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
      meta: { requiresAuth: true },
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
      redirect: '/khach',
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

router.beforeEach(async (to, from, next) => {
  const auth = useAuthStore();

  // Load profile if token exists but user not loaded yet
  if (auth.token && !auth.user) {
    try {
      await auth.fetchMe();
    } catch {
      auth.logout();
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
        return next(auth.isCustomer ? '/my-ticket' : '/tenant');
      }
      return next();
    }

    // Nếu vào các trang quản trị (/admin, /admin/tenants...)
    if (!auth.isAuthenticated) {
      // Chưa đăng nhập -> chuyển sang trang Đăng nhập Quản trị
      return next({ path: '/admin/login', query: { redirect: to.fullPath } });
    }

    if (!auth.isAdmin) {
      // Khách cố tình truy cập vào trang Quản trị -> CHẶN ĐỨNG
      alert('Bạn không có quyền truy cập vào Khu vực Quản trị viên!');
      return next(auth.isCustomer ? '/my-ticket' : '/khach');
    }
  }

  // 2. KHU VỰC KHÁCH (/khach): Nếu là Admin tổng đang đăng nhập, tự động chuyển về /admin
  if (to.path === '/khach' && auth.isAuthenticated && auth.isAdmin) {
    return next('/admin');
  }

  // 3. Yêu cầu đăng nhập thông thường (Tenant portal, My ticket, Staff)
  if (to.meta.requiresAuth) {
    if (!auth.isAuthenticated) {
      if (to.path.startsWith('/admin')) {
        return next({ path: '/admin/login', query: { redirect: to.fullPath } });
      }
      return next({ path: '/khach', query: { redirect: to.fullPath } });
    }

    if (to.meta.permission && !auth.hasPermission(to.meta.permission as string)) {
      alert('Bạn không có quyền truy cập vào chức năng này!');
      return next({ path: '/' });
    }
  }

  next();
});

export default router;
