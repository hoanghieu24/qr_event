import axios, { type InternalAxiosRequestConfig } from 'axios';
import { reactive } from 'vue';

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retryCount?: number;
}

const rawBase = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
const baseURL = rawBase
  ? (rawBase.endsWith('/api/v1') ? rawBase : `${rawBase}/api/v1`)
  : '/api/v1';

const healthURL = rawBase
  ? `${rawBase.replace(/\/api\/v1$/, '')}/health`
  : '/health';

export const backendWarmState = reactive({
  isWaking: false,
});

let pendingRequests = 0;
let wakeTimer: ReturnType<typeof setTimeout> | null = null;
let lastWarmPingAt = 0;

function beginTrackRequest() {
  pendingRequests += 1;
  if (pendingRequests === 1 && !wakeTimer) {
    wakeTimer = setTimeout(() => {
      if (pendingRequests > 0) {
        backendWarmState.isWaking = true;
      }
    }, 3500);
  }
}

function endTrackRequest() {
  pendingRequests = Math.max(0, pendingRequests - 1);
  if (pendingRequests === 0) {
    if (wakeTimer) {
      clearTimeout(wakeTimer);
      wakeTimer = null;
    }
    backendWarmState.isWaking = false;
  }
}

/**
 * Silently pings /health so a sleeping Render container starts booting
 * while the user is reading the page instead of waiting after submit.
 */
export function warmUpBackend(minIntervalMs = 10 * 60 * 1000) {
  const now = Date.now();
  if (now - lastWarmPingAt < minIntervalMs) return;
  lastWarmPingAt = now;
  try {
    void fetch(healthURL, { method: 'GET', cache: 'no-store', keepalive: true }).catch(() => {});
  } catch {
    // Ignore silent pre-warm failures
  }
}

const api = axios.create({
  baseURL,
  timeout: 65000,
  headers: {
    'Content-Type': 'application/json',
  },
});

type UnauthorizedContext = { url: string; hadToken: boolean };
let unauthorizedHandler: ((ctx: UnauthorizedContext) => void) | null = null;

/** Register a global callback invoked when HTTP 401 invalidates an active session. */
export function setUnauthorizedHandler(handler: ((ctx: UnauthorizedContext) => void) | null): void {
  unauthorizedHandler = handler;
}

// Attach Authorization header if token exists and track slow wake-ups
api.interceptors.request.use((config) => {
  const cfg = config as RetryableRequestConfig;
  if (!cfg._retryCount) {
    beginTrackRequest();
  }
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-retry idempotent GET/HEAD requests on transient Render cold-start 502/503/504
api.interceptors.response.use(
  (response) => {
    endTrackRequest();
    return response;
  },
  async (error) => {
    const cfg = error.config as RetryableRequestConfig | undefined;
    const status = error.response?.status;
    const method = (cfg?.method || '').toLowerCase();
    const isIdempotent = method === 'get' || method === 'head';
    const isTransientWakeError =
      status === 502 || status === 503 || status === 504 || (!error.response && error.code !== 'ERR_CANCELED');

    if (cfg && isIdempotent && isTransientWakeError && (cfg._retryCount || 0) < 2) {
      cfg._retryCount = (cfg._retryCount || 0) + 1;
      backendWarmState.isWaking = true;
      await new Promise((resolve) => setTimeout(resolve, 2500));
      return api(cfg);
    }

    endTrackRequest();
    if (status === 401) {
      const requestUrl = String(cfg?.url || '');
      const isAuthSubmission =
        /\/auth\/(login|verify-otp|send-otp)|\/tenants\/register/.test(requestUrl);
      const hadToken = Boolean(cfg?.headers?.Authorization || localStorage.getItem('token'));

      if (!isAuthSubmission) {
        if (unauthorizedHandler) {
          unauthorizedHandler({ url: requestUrl, hadToken });
        } else {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('tenant_token');
          localStorage.removeItem('tenant_user');
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
