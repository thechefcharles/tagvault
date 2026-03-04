import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withCronLock } from '@/lib/server/cronLock';
import {
  recordCronStarted,
  recordCronSuccess,
  recordCronFailure,
  recordCronSkipped,
  JOB_NOTIFICATIONS_DIGEST,
} from '@/lib/server/cronHeartbeat';
import { logApi } from '@/lib/apiLog';
import { rateLimitOrThrow, RateLimitError, getClientIp } from '@/lib/rateLimit';

const CRON_LOCK_TTL_SEC = 120;

function validateCronSecret(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const headerSecret = request.headers.get('x-cron-secret');
  if (headerSecret === expected) return true;
  const auth = request.headers.get('authorization');
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  return bearer === expected;
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const start = Date.now();

  if (!validateCronSecret(request)) {
    logApi({
      requestId,
      path: '/api/notifications/process-digest',
      method: 'POST',
      status: 401,
      ms: Date.now() - start,
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ip = getClientIp(request) ?? 'unknown';
  try {
    await rateLimitOrThrow({
      key: `cron:notifications:digest:ip:${ip}`,
      limit: 10,
      windowSec: 60,
    });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: e.headers },
      );
    }
    throw e;
  }

  let acquired = false;
  let result: { digestsCreated: number } | undefined;
  try {
    const lockResult = await withCronLock(
      'cron:notifications:process-digest',
      CRON_LOCK_TTL_SEC,
      async () => {
        Sentry.setTag('area', 'cron');
        Sentry.setTag('job', 'notifications_digest');
        await recordCronStarted(JOB_NOTIFICATIONS_DIGEST);
        const supabase = createAdminClient();

        const { data: prefs, error: errPrefs } = await supabase
          .from('notification_preferences')
          .select('user_id, org_id, digest_frequency, last_digest_at')
          .in('digest_frequency', ['daily', 'weekly']);

        if (errPrefs) {
          Sentry.captureException(errPrefs, {
            tags: { area: 'cron', job: 'notifications_digest', phase: 'fetch_prefs' },
          });
          throw new Error('Failed to fetch notification preferences');
        }

        const now = new Date();
        let digestsCreated = 0;

        for (const pref of prefs ?? []) {
          const { user_id, org_id, digest_frequency, last_digest_at } = pref;
          const windowHours = digest_frequency === 'weekly' ? 24 * 7 : 24;
          const windowMs = windowHours * 60 * 60 * 1000;
          const windowStart = new Date(now.getTime() - windowMs);

          if (last_digest_at && new Date(last_digest_at) > windowStart) {
            continue;
          }

          const { count, error: errCount } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('owner_user_id', user_id)
            .eq('org_id', org_id)
            .eq('read', false)
            .gte('created_at', windowStart.toISOString())
            .neq('type', 'digest');

          if (errCount) continue;

          const unreadCount = count ?? 0;
          if (unreadCount === 0) {
            await supabase
              .from('notification_preferences')
              .update({ last_digest_at: now.toISOString(), updated_at: now.toISOString() })
              .eq('user_id', user_id)
              .eq('org_id', org_id);
            continue;
          }

          const { error: errInsert } = await supabase.from('notifications').insert({
            owner_user_id: user_id,
            org_id,
            type: 'digest',
            title: 'Your notification digest',
            body: `You have ${unreadCount} unread notification${unreadCount === 1 ? '' : 's'} from the past ${digest_frequency === 'weekly' ? 'week' : 'day'}.`,
            meta: { from: 'digest', unread_count: unreadCount },
          });

          if (!errInsert) {
            digestsCreated += 1;
            await supabase
              .from('notification_preferences')
              .update({ last_digest_at: now.toISOString(), updated_at: now.toISOString() })
              .eq('user_id', user_id)
              .eq('org_id', org_id);
          }
        }

        return { digestsCreated };
      },
    );
    acquired = lockResult.acquired;
    result = lockResult.result;
  } catch (e) {
    const msErr = Date.now() - start;
    await recordCronFailure(JOB_NOTIFICATIONS_DIGEST, {
      durationMs: msErr,
      error: e instanceof Error ? e.message : String(e),
    });
    Sentry.captureException(e, {
      tags: { area: 'cron', job: 'notifications_digest' },
      extra: { lock_acquired: acquired, duration_ms: msErr },
    });
    logApi({
      requestId,
      path: '/api/notifications/process-digest',
      method: 'POST',
      status: 500,
      ms: msErr,
    });
    return NextResponse.json({ error: 'Cron handler failed' }, { status: 500 });
  }

  const ms = Date.now() - start;

  if (!acquired) {
    await recordCronSkipped(JOB_NOTIFICATIONS_DIGEST, 'skipped: lock_not_acquired');
    logApi({
      requestId,
      path: '/api/notifications/process-digest',
      method: 'POST',
      status: 200,
      ms,
      errorCode: 'CRON_LOCK_SKIPPED',
    });
    return NextResponse.json({ ok: true, skipped: 'lock_not_acquired' });
  }

  if (result === undefined) {
    await recordCronFailure(JOB_NOTIFICATIONS_DIGEST, {
      durationMs: ms,
      error: 'Unexpected: no result from handler',
    });
    return NextResponse.json({ error: 'Cron handler failed' }, { status: 500 });
  }

  await recordCronSuccess(JOB_NOTIFICATIONS_DIGEST, {
    durationMs: ms,
    processedCount: result.digestsCreated,
  });
  Sentry.setTag('cron.lock_acquired', 'true');
  Sentry.setTag('cron.digests_created', String(result.digestsCreated));
  logApi({
    requestId,
    path: '/api/notifications/process-digest',
    method: 'POST',
    status: 200,
    ms,
  });
  return NextResponse.json(result);
}
