import axios from 'axios';

const rawBase = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
const baseURL = rawBase
  ? (rawBase.endsWith('/api/v1') ? rawBase : `${rawBase}/api/v1`)
  : '/api/v1';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach Authorization header if token exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for unauthorized handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear token if expired or unauthorized
      if (!window.location.pathname.startsWith('/invite/')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
