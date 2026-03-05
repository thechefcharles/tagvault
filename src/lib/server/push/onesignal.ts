/**
 * OneSignal push notification helper.
 * Sends push to users in an org, respecting notification_preferences.
 */

import * as Sentry from '@sentry/nextjs';
import { createAdminClient } from '@/lib/supabase/admin';

const ONESIGNAL_API = 'https://api.onesignal.com/notifications';

export type PushKind = 'alerts' | 'digest';

export type SendPushParams = {
  orgId: string;
  userIds: string[];
  title: string;
  body: string;
  url?: string;
  data?: Record<string, string>;
  kind: PushKind;
};

async function getNotificationPrefs(
  supabase: ReturnType<typeof createAdminClient>,
  userIds: string[],
  orgId: string,
  kind: PushKind,
): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('user_id, push_enabled, push_alerts, push_digest')
    .in('user_id', userIds)
    .eq('org_id', orgId);

  type PrefRow = {
    user_id: string;
    push_enabled?: boolean;
    push_alerts?: boolean;
    push_digest?: boolean;
  };
  const allowed = new Set<string>();
  const prefByUser = new Map<string, PrefRow>(
    (prefs ?? []).map((p: PrefRow) => [p.user_id, p]),
  );
  for (const uid of userIds) {
    const pref = prefByUser.get(uid);
    const pushEnabled = pref?.push_enabled ?? true;
    const pushAlerts = pref?.push_alerts ?? true;
    const pushDigest = pref?.push_digest ?? false;
    if (!pushEnabled) continue;
    if (kind === 'alerts' && !pushAlerts) continue;
    if (kind === 'digest' && !pushDigest) continue;
    allowed.add(uid);
  }
  return allowed;
}

export async function sendPushToUsers(params: SendPushParams): Promise<{
  sent: number;
  targets: number;
  error?: string;
}> {
  const { orgId, userIds, title, body, url, data, kind } = params;
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !apiKey) {
    const msg = 'OneSignal not configured: ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY missing';
    Sentry.captureMessage(msg, {
      level: 'warning',
      tags: { area: 'push', action: 'send', reason: 'config_missing' },
    });
    return { sent: 0, targets: userIds.length, error: msg };
  }

  const supabase = createAdminClient();
  const allowedUserIds = await getNotificationPrefs(supabase, userIds, orgId, kind);
  if (allowedUserIds.size === 0) {
    return { sent: 0, targets: userIds.length };
  }

  const { data: devices } = await supabase
    .from('push_devices')
    .select('player_id')
    .eq('org_id', orgId)
    .in('user_id', Array.from(allowedUserIds))
    .eq('provider', 'onesignal');

  const playerIds =
    devices?.map((d: { player_id: string }) => d.player_id).filter(Boolean) ?? [];
  if (playerIds.length === 0) {
    return { sent: 0, targets: allowedUserIds.size };
  }

  try {
    const bodyJson: Record<string, unknown> = {
      app_id: appId,
      include_subscription_ids: playerIds.slice(0, 2000),
      headings: { en: title },
      contents: { en: body },
      target_channel: 'push',
    };
    if (url) bodyJson.url = url;
    if (data && Object.keys(data).length > 0) bodyJson.data = data;

    const res = await fetch(ONESIGNAL_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify(bodyJson),
    });

    const json = (await res.json()) as { id?: string; errors?: Record<string, string[]> };
    if (!res.ok) {
      const errMsg = JSON.stringify(json.errors ?? json) || res.statusText;
      Sentry.captureMessage(`OneSignal API error: ${errMsg}`, {
        level: 'error',
        tags: { area: 'push', action: 'send', status: String(res.status) },
        extra: { playerCount: playerIds.length, orgId },
      });
      return { sent: 0, targets: playerIds.length, error: errMsg };
    }

    return { sent: json.id ? playerIds.length : 0, targets: playerIds.length };
  } catch (e) {
    Sentry.captureException(e, {
      tags: { area: 'push', action: 'send' },
      extra: { orgId, playerCount: playerIds.length },
    });
    return {
      sent: 0,
      targets: playerIds.length,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
