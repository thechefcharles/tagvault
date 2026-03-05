/**
 * Push notification init for Capacitor (OneSignal).
 * Only runs when isCapacitor() is true; web is unchanged.
 * Handles tap routing for cold start, background, and foreground.
 */

import { isCapacitor } from './capacitor';
import { preparePushNavigation } from './deeplinkRouter';

export type PushNavigateFn = (url: string) => void;

/** Handle push tap: sanitize URL, prevent double-nav, log, and navigate. */
export function handlePushOpen(
  url: string | null | undefined,
  navigate: (url: string) => void,
): void {
  preparePushNavigation(url, navigate);
}

function getPlatform(): 'ios' | 'android' | 'web' {
  if (typeof window === 'undefined') return 'web';
  const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  const p = cap?.getPlatform?.();
  if (p === 'ios') return 'ios';
  if (p === 'android') return 'android';
  return 'web';
}

let initialNotificationHandled = false;

export async function initPush(navigate?: PushNavigateFn): Promise<void> {
  if (!isCapacitor()) return;
  if (typeof window === 'undefined') return;

  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  if (!appId) return;

  try {
    const OneSignal = (await import('onesignal-cordova-plugin')).default;
    OneSignal.initialize(appId);

    const onNotificationOpen = (
      notification: { additionalData?: Record<string, unknown> } | null,
      nav: PushNavigateFn,
    ) => {
      const url = notification?.additionalData?.url;
      if (url != null) handlePushOpen(String(url), nav);
    };

    if (navigate) {
      OneSignal.Notifications.addEventListener('click', (event: unknown) => {
        const ev = event as { notification?: { additionalData?: Record<string, unknown> } };
        const url = ev?.notification?.additionalData?.url;
        handlePushOpen(url != null ? String(url) : null, navigate);
      });

      const notif = OneSignal.Notifications as { getInitialNotification?: () => Promise<{ additionalData?: Record<string, unknown> } | null> };
      const getInitialNotification = notif.getInitialNotification;
      if (getInitialNotification && !initialNotificationHandled) {
        initialNotificationHandled = true;
        getInitialNotification()
          .then((notification) => {
            if (notification) onNotificationOpen(notification, navigate);
          })
          .catch(() => {});
      }
    }

    const accepted = await OneSignal.Notifications.requestPermission(false);
    if (accepted) {
      await registerPushDevice(OneSignal, getPlatform());
    }
  } catch {
    // OneSignal or permission failed; no-op
  }
}

async function registerPushDevice(
  OneSignal: {
    User?: {
      pushSubscription?: {
        getIdAsync?: () => Promise<string | null | undefined>;
        id?: string | null;
      };
    };
  },
  platform: 'ios' | 'android' | 'web',
): Promise<void> {
  try {
    const sub = OneSignal.User?.pushSubscription;
    const raw = sub?.getIdAsync ? await sub.getIdAsync() : sub?.id;
    const id = raw ?? undefined;
    if (!id) return;

    const res = await fetch('/api/push/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ player_id: id, platform }),
    });
    if (!res.ok) return;
  } catch {
    // ignore
  }
}
