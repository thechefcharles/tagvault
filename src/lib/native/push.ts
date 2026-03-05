/**
 * Push notification init for Capacitor (OneSignal).
 * Only runs when isCapacitor() is true; web is unchanged.
 */

import { isCapacitor } from './capacitor';

function getPlatform(): 'ios' | 'android' | 'web' {
  if (typeof window === 'undefined') return 'web';
  const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  const p = cap?.getPlatform?.();
  if (p === 'ios') return 'ios';
  if (p === 'android') return 'android';
  return 'web';
}

export async function initPush(): Promise<void> {
  if (!isCapacitor()) return;
  if (typeof window === 'undefined') return;

  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  if (!appId) return;

  try {
    const OneSignal = (await import('onesignal-cordova-plugin')).default;
    OneSignal.initialize(appId);
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
