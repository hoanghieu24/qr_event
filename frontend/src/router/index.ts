import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { isGuestMode, isTenantMode, isAdminMode } from '../utils/portalMode';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: () => {
        if (isGuestMode) {
          const auth = useAuthStore();
          if (auth.isCustomer) return '/my-ticket';
          return '/khach';
        }
        if (isTenantMode) {
          return '/tenant';
        }
        if (isAdminMode) {
          const auth = useAuthStore();
          if (auth.isAdmin) return '/admin';
          return '/login';
        }
        const auth = useAuthStore();
        if (auth.isAdmin) return '/admin';
        if (auth.isTenantAdmin) return '/tenant';
        if (auth.isStaff && auth.user?.tenant_id) return '/tenant';
        if (auth.hasPermission('tickets:scan')) return '/tenant';
        if (auth.hasPermission('invite:create')) return '/staff/referral';
        if (auth.hasPermission('customer:dispute_manage')) return '/staff/disputes';
        if (auth.isStaff) return '/tenant';
        if (auth.isCustomer) return '/my-ticket';
        return '/login';
      },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
    },
    {
      path: '/tenant',
      name: 'tenant-portal',
      component: () => import('../views/tenant/TenantPortalView.vue'),
    },
    {
      path: '/tenant-portal',
      redirect: '/tenant',
    },
    {
      path: '/khach',
      name: 'guest-portal',
      redirect: '/login?tab=check',
    },
    {
      path: '/tra-cuu',
      redirect: '/login?tab=check',
    },
    {
      path: '/dang-ky',
      redirect: '/invite/inv_b20d2efd41ea43a8b1e26d0b666bf33d',
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
    {
      path: '/invite/:token',
      name: 'invite-landing',
      component: () => import('../views/customer/InviteLandingView.vue'),
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
  // Strict mode isolation
  if (isGuestMode) {
    if (to.path.startsWith('/tenant') || to.path.startsWith('/admin') || to.path.startsWith('/staff')) {
      return next('/khach');
    }
  }
  if (isTenantMode) {
    if (to.path.startsWith('/admin') || to.path === '/khach' || to.path === '/tra-cuu' || to.path === '/my-ticket') {
      return next('/tenant');
    }
  }
  if (isAdminMode) {
    if (to.path.startsWith('/tenant') || to.path === '/khach' || to.path === '/tra-cuu' || to.path === '/my-ticket') {
      return next('/admin');
    }
  }

  const auth = useAuthStore();

  // Load profile if token exists but user not loaded yet
  if (auth.token && !auth.user) {
    await auth.fetchMe();
  }

  if (to.meta.requiresAdmin) {
    if (!auth.isAuthenticated || !auth.isAdmin) {
      return next({ name: 'login' });
    }
  }

  if (to.meta.requiresAuth) {
    if (!auth.isAuthenticated) {
      return next({ name: 'login', query: { redirect: to.fullPath } });
    }

    if (to.meta.permission && !auth.hasPermission(to.meta.permission as string)) {
      alert('Bạn không có quyền truy cập vào chức năng này!');
      return next({ path: '/' });
    }
  }

  next();
});

export default router;
