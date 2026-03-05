/**
 * Deep link routing for push notification taps.
 * Sanitizes URL, applies fallback, prevents double navigation.
 */

const FALLBACK_URL = '/notifications';
const DOUBLE_NAV_MS = 1000;

let lastNavigatedAt = 0;
let lastNavigatedUrl = '';

function isSameOriginPath(value: string): boolean {
  if (typeof value !== 'string' || !value.startsWith('/')) return false;
  if (value.includes('//') || value.startsWith('javascript:')) return false;
  return true;
}

/**
 * Sanitize push URL and return the path to navigate to.
 * Returns FALLBACK_URL if url is missing or invalid.
 */
export function navigateFromPush(url: string | null | undefined): string {
  const trimmed = typeof url === 'string' ? url.trim() : '';
  if (!trimmed || !isSameOriginPath(trimmed.split('?')[0] ?? trimmed)) {
    return FALLBACK_URL;
  }
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return path || FALLBACK_URL;
}

/**
 * Check if we should perform navigation (avoid double-nav).
 */
export function shouldNavigate(targetUrl: string): boolean {
  const now = Date.now();
  if (now - lastNavigatedAt < DOUBLE_NAV_MS && lastNavigatedUrl === targetUrl) {
    return false;
  }
  lastNavigatedAt = now;
  lastNavigatedUrl = targetUrl;
  return true;
}

/**
 * Full flow: sanitize URL, check double-nav, log, optionally add Sentry breadcrumb, then navigate.
 * Caller should pass the navigate function (e.g. router.push).
 */
export function preparePushNavigation(
  rawUrl: string | null | undefined,
  navigate: (url: string) => void,
): void {
  const target = navigateFromPush(rawUrl);
  if (!shouldNavigate(target)) return;

  if (process.env.NODE_ENV === 'development') {
    console.info('[push-open]', target);
  }

  if (typeof window !== 'undefined') {
    try {
      const Sentry = (window as unknown as { Sentry?: { addBreadcrumb?: (b: unknown) => void } })
        .Sentry;
      Sentry?.addBreadcrumb?.({
        category: 'push',
        message: 'push_open',
        data: { url: target },
      });
    } catch {
      // Sentry may not be available
    }
  }

  navigate(target);
}
