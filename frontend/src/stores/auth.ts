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

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: JSON.parse(localStorage.getItem('user') || 'null') as User | null,
    token: localStorage.getItem('token') || null,
    isLoading: false,
  }),

  getters: {
    isAuthenticated: (state) => !!state.token,
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
    async loginWithPassword(email: string, password: string) {
      this.isLoading = true;
      try {
        const res = await api.post('/auth/login', { email, password });
        this.token = res.data.data.token;
        this.user = res.data.data.user;
        localStorage.setItem('token', this.token as string);
        localStorage.setItem('user', JSON.stringify(this.user));
        refreshSocketAuth();
        return this.user;
      } finally {
        this.isLoading = false;
      }
    },

    async sendOtp(email: string) {
      const res = await api.post('/auth/send-otp', { email });
      if (res.data?.data?.token) {
        this.token = res.data.data.token;
        this.user = res.data.data.user;
        localStorage.setItem('token', this.token as string);
        localStorage.setItem('user', JSON.stringify(this.user));
        refreshSocketAuth();
      }
      return res;
    },

    async verifyOtp(email: string, otp: string, name?: string, phone?: string) {
      this.isLoading = true;
      try {
        const res = await api.post('/auth/verify-otp', { email, otp, name, phone });
        this.token = res.data.data.token;
        this.user = res.data.data.user;
        localStorage.setItem('token', this.token as string);
        localStorage.setItem('user', JSON.stringify(this.user));
        refreshSocketAuth();
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

    logout() {
      this.token = null;
      this.user = null;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      refreshSocketAuth();
    },
  },
});
