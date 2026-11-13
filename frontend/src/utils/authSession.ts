import {
  isNavigationFailure,
  NavigationFailureType,
  type RouteLocationNormalizedLoaded,
  type Router,
} from 'vue-router';
import type { useAuthStore } from '../stores/auth';

type AuthStore = ReturnType<typeof useAuthStore>;

let inFlightRedirectTarget: string | null = null;
let inFlightRedirectPromise: Promise<void> | null = null;
let hardNavigationInProgressTo: string | null = null;

/** Sanitize an internal redirect target to avoid open redirects or login loops. */
export function sanitizeRedirectPath(rawPath: unknown, fallback = '/guest'): string {
  if (typeof rawPath !== 'string') return fallback;
  const trimmed = rawPath.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return fallback;
  const pathOnly = trimmed.split('?')[0];
  if (pathOnly === '/login' || pathOnly === '/guest' || pathOnly === '/khach' || pathOnly === '/admin/login') {
    return fallback;
  }
  return trimmed;
}

/** Resolve which login screen corresponds to the current route or previous role. */
export function getLoginRouteForPath(path: string, wasAdmin = false): string {
  return wasAdmin || path.startsWith('/admin') ? '/admin/login' : '/guest';
}

/** Resolve default authenticated home route based on account role. */
export function getHomeRouteForUser(auth: AuthStore): string {
  if (auth.isAdmin) return '/admin';
  if (auth.isTenantAdmin || auth.isStaff) return '/tenant';
  if (auth.isCustomer) return '/my-ticket';
  return '/guest';
}

/** Check whether current auth state satisfies all auth, role, and permission rules of a route. */
export function canAccessRoute(route: RouteLocationNormalizedLoaded, auth: AuthStore): boolean {
  if (!route.matched.length) return false;

  const isAdminArea =
    (route.path.startsWith('/admin') && route.path !== '/admin/login') || Boolean(route.meta.requiresAdmin);
  if (isAdminArea) {
    return auth.isAuthenticated && auth.isAdmin;
  }

  if (route.meta.requiresAuth) {
    if (!auth.isAuthenticated) return false;
    const allowedRoles = route.meta.allowedRoles as string[] | undefined;
    if (allowedRoles?.length && (!auth.user?.type || !allowedRoles.includes(auth.user.type))) {
      return false;
    }
    if (route.meta.permission && !auth.hasPermission(route.meta.permission as string)) {
      return false;
    }
  }

  return true;
}

/** Compute fallback route when current session cannot access the active route. */
export function getUnauthorizedRedirect(
  route: RouteLocationNormalizedLoaded,
  auth: AuthStore,
  includeRedirect = true
): string {
  if (auth.isAuthenticated) {
    return getHomeRouteForUser(auth);
  }
  const loginBase = getLoginRouteForPath(route.path);
  if (
    !includeRedirect ||
    !route.fullPath ||
    route.fullPath === '/' ||
    route.path === '/admin/login' ||
    route.path === '/guest' ||
    route.path === '/login'
  ) {
    return loginBase;
  }
  return `${loginBase}?redirect=${encodeURIComponent(route.fullPath)}`;
}

export function isAuthRedirectInProgress(): boolean {
  return inFlightRedirectPromise !== null;
}

export function triggerHardNavigation(target: string, replace = true): void {
  if (hardNavigationInProgressTo === target) return;
  hardNavigationInProgressTo = target;
  setTimeout(() => {
    if (hardNavigationInProgressTo === target) {
      hardNavigationInProgressTo = null;
    }
  }, 2000);

  if (replace) {
    window.location.replace(target);
  } else {
    window.location.assign(target);
  }
}

/**
 * Navigate via Vue Router with hard-browser reload fallback if navigation fails
 * or stale route chunks cannot be loaded after a deploy.
 */
export async function navigateWithFallback(router: Router, target: string, replace = true): Promise<void> {
  if (inFlightRedirectPromise && inFlightRedirectTarget === target) {
    return inFlightRedirectPromise;
  }

  const run = (async () => {
    const fromPath = router.currentRoute.value.path;
    const targetPathOnly = target.split('?')[0];
    try {
      const failure = await (replace ? router.replace(target) : router.push(target));
      const curPath = router.currentRoute.value.path;
      const abortedOrFailed =
        Boolean(failure) &&
        !isNavigationFailure(failure, NavigationFailureType.duplicated) &&
        curPath !== targetPathOnly;
      const stuckOnSameRoute = fromPath !== targetPathOnly && curPath === fromPath;

      if (abortedOrFailed || stuckOnSameRoute) {
        triggerHardNavigation(target, replace);
      }
    } catch {
      triggerHardNavigation(target, replace);
    } finally {
      if (inFlightRedirectTarget === target) {
        inFlightRedirectTarget = null;
        inFlightRedirectPromise = null;
      }
    }
  })();

  inFlightRedirectTarget = target;
  inFlightRedirectPromise = run;
  return run;
}

/** Clear session state and redirect cleanly off any protected screen. */
export async function performLogoutAndRedirect(
  router: Router,
  auth: AuthStore,
  targetOverride?: string
): Promise<void> {
  const wasAdmin = auth.isAdmin;
  const currentPath = router.currentRoute.value.path;
  const target = targetOverride || getLoginRouteForPath(currentPath, wasAdmin);

  // Set target navigation immediately after clearing auth so reactive watchers don't double-redirect.
  auth.logout();
  await navigateWithFallback(router, target, true);
}
