import { defineStore } from 'pinia';
import api from '../api/client';
import { refreshSocketAuth } from '../api/socket';

export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  type: 'ADMIN' | 'STAFF' | 'CUSTOMER' | 'TENANT_ADMIN';
  permissions: string[];
  tenant_id?: number;
  tenant_name?: string;
}

function readStoredUser(): User | null {
  try {
    const raw = localStorage.getItem('user');
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    localStorage.removeItem('user');
    return null;
  }
}

function syncTenantStorage(token: string | null, user: User | null): void {
  if (token && user && (user.type === 'TENANT_ADMIN' || user.type === 'STAFF')) {
    localStorage.setItem('tenant_token', token);
    localStorage.setItem('tenant_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('tenant_token');
    localStorage.removeItem('tenant_user');
  }
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: readStoredUser(),
    token: localStorage.getItem('token') || null,
    isLoading: false,
  }),

  getters: {
    isAuthenticated: (state) => !!state.token && !!state.user,
    isAdmin: (state) => state.user?.type === 'ADMIN',
    isStaff: (state) => state.user?.type === 'STAFF',
    isCustomer: (state) => state.user?.type === 'CUSTOMER',
    isTenantAdmin: (state) => state.user?.type === 'TENANT_ADMIN',
    hasPermission: (state) => (permissionCode: string) => {
      if (!state.user) return false;
      if (state.user.type === 'ADMIN' || state.user.type === 'TENANT_ADMIN') return true;
      return state.user.permissions?.includes(permissionCode) || false;
    },
  },

  actions: {
    setSession(token: string, user: User) {
      this.token = token;
      this.user = user;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      syncTenantStorage(token, user);
      refreshSocketAuth();
    },

    async loginWithPassword(email: string, password: string) {
      this.isLoading = true;
      try {
        const res = await api.post('/auth/login', { email, password });
        this.setSession(res.data.data.token, res.data.data.user);
        return this.user;
      } finally {
        this.isLoading = false;
      }
    },

    async sendOtp(email: string) {
      const res = await api.post('/auth/send-otp', { email });
      if (res.data?.data?.token) {
        this.setSession(res.data.data.token, res.data.data.user);
      }
      return res;
    },

    async verifyOtp(email: string, otp: string, name?: string, phone?: string) {
      this.isLoading = true;
      try {
        const res = await api.post('/auth/verify-otp', { email, otp, name, phone });
        this.setSession(res.data.data.token, res.data.data.user);
        return this.user;
      } finally {
        this.isLoading = false;
      }
    },

    async fetchMe() {
      if (!this.token) return null;
      try {
        const res = await api.get('/auth/me');
        this.user = res.data.data;
        localStorage.setItem('user', JSON.stringify(this.user));
        syncTenantStorage(this.token, this.user);
        return this.user;
      } catch (e: any) {
        const status = e?.response?.status;
        // Only log out on real auth rejection, not transient Render cold-start 502/503/network errors
        if (status === 401 || status === 403) {
          this.logout();
          return null;
        }
        return this.user;
      }
    },

    /** Reconcile Pinia session state after cross-tab localStorage updates or clearing. */
    syncFromStorage() {
      const nextToken = localStorage.getItem('token') || null;
      const nextUser = nextToken ? readStoredUser() : null;
      const tokenChanged = this.token !== nextToken;

      if (!nextToken || !nextUser) {
        this.token = null;
        this.user = null;
        syncTenantStorage(null, null);
      } else {
        this.token = nextToken;
        this.user = nextUser;
        syncTenantStorage(nextToken, nextUser);
      }

      if (tokenChanged) {
        refreshSocketAuth();
      }
    },

    logout() {
      this.token = null;
      this.user = null;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      syncTenantStorage(null, null);
      refreshSocketAuth();
    },
  },
});
