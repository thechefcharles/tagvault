import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runAlertQuery, type AlertRow } from '@/lib/alerts/run-alert-query';
import { sendPushToUsers } from '@/lib/server/push/onesignal';
import { withCronLock } from '@/lib/server/cronLock';
import {
  recordCronStarted,
  recordCronSuccess,
  recordCronFailure,
  recordCronSkipped,
  JOB_ALERTS_PROCESS_DUE,
} from '@/lib/server/cronHeartbeat';
import { logApi } from '@/lib/apiLog';

const DEFAULT_LIMIT = 25;
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

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const start = Date.now();

  if (!validateCronSecret(request)) {
    logApi({
      requestId,
      path: '/api/alerts/process-due',
      method: 'POST',
      status: 401,
      ms: Date.now() - start,
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let acquired = false;
  let result: { processed: number; notified: number } | undefined;
  try {
    const lockResult = await withCronLock(
      'cron:alerts:process-due',
      CRON_LOCK_TTL_SEC,
      async () => {
        await recordCronStarted(JOB_ALERTS_PROCESS_DUE);
        const supabase = createAdminClient();

      const { data: dueAlerts, error: errAlerts } = await supabase
        .from('alerts')
        .select('id, org_id, owner_user_id, saved_search_id, source_type, source_id, tag_ids, name, frequency_minutes, notify_on_new, last_run_at, last_cursor')
        .eq('enabled', true)
        .not('org_id', 'is', null)
        .lte('next_run_at', new Date().toISOString())
        .order('next_run_at', { ascending: true })
        .limit(DEFAULT_LIMIT);

      if (errAlerts) {
        Sentry.captureException(errAlerts, {
          tags: { area: 'cron', job: 'alerts_process_due', phase: 'fetch_alerts' },
        });
        throw new Error('Failed to fetch due alerts');
      }

      if (!dueAlerts?.length) {
        return { processed: 0, notified: 0 };
      }

      let processed = 0;
      let totalNotified = 0;

      for (const alert of dueAlerts) {
        const orgId = alert.org_id as string;
        if (!orgId) continue;
        const { data: orgRow } = await supabase
          .from('organizations')
          .select('owner_id')
          .eq('id', orgId)
          .single();
        const runAsUserId = (alert.owner_user_id ?? orgRow?.owner_id) as string;
        if (!runAsUserId) continue;

        let runStatus: 'success' | 'error' = 'success';
        let newMatchCount = 0;
        let runError: string | null = null;

        try {
          const matches = await runAlertQuery(
            alert as AlertRow,
            runAsUserId,
            supabase,
          );

          const cutoff = alert.last_cursor ?? alert.last_run_at ?? '1970-01-01T00:00:00Z';
          const newMatches = matches.filter((m) => m.matchAt > cutoff);
          newMatchCount = newMatches.length;

          if (alert.notify_on_new && newMatches.length > 0) {
            const newIds = newMatches.map((m) => m.item.id);
            const meta: Record<string, unknown> = {
              alert_id: alert.id,
              source_type: alert.source_type,
              source_id: alert.source_id ?? alert.saved_search_id,
              item_ids: newIds.slice(0, 50),
            };

            await supabase.from('notifications').insert({
              owner_user_id: runAsUserId,
              org_id: orgId,
              type: 'alert_new_matches',
              title: `New matches for: ${alert.name}`,
              body: `${newMatchCount} new item${newMatchCount === 1 ? '' : 's'} matched your alert.`,
              meta,
            });
            totalNotified += 1;
            void sendPushToUsers({
              orgId,
              userIds: [runAsUserId],
              title: 'TagVault Alert',
              body: 'New matches found',
              url: '/notifications?tab=alerts',
              kind: 'alert',
            });
          }

          const maxMatchAt =
            matches.length > 0
              ? matches.reduce((max, m) => (m.matchAt > max ? m.matchAt : max), matches[0].matchAt)
              : undefined;
          await supabase
            .from('alerts')
            .update({
              last_run_at: new Date().toISOString(),
              ...(maxMatchAt ? { last_cursor: maxMatchAt } : {}),
            })
            .eq('id', alert.id);
        } catch (e) {
          runStatus = 'error';
          runError = e instanceof Error ? e.message : 'Unknown error';
          Sentry.captureException(e, {
            tags: { area: 'cron', job: 'alerts_process_due' },
            extra: { alert_id: alert.id, runError },
          });
        }

        await supabase.from('alert_runs').insert({
          alert_id: alert.id,
          status: runStatus,
          new_match_count: newMatchCount,
          error: runError,
        });

        const nextRun = new Date();
        nextRun.setMinutes(nextRun.getMinutes() + (alert.frequency_minutes ?? 60));

        await supabase
          .from('alerts')
          .update({ next_run_at: nextRun.toISOString() })
          .eq('id', alert.id);

        processed += 1;
      }

        return { processed, notified: totalNotified };
      },
    );
    acquired = lockResult.acquired;
    result = lockResult.result;
  } catch (e) {
    const msErr = Date.now() - start;
    await recordCronFailure(JOB_ALERTS_PROCESS_DUE, {
      durationMs: msErr,
      error: e instanceof Error ? e.message : String(e),
    });
    Sentry.captureException(e, {
      tags: { area: 'cron', job: 'alerts_process_due' },
      extra: { lock_acquired: acquired, duration_ms: msErr },
    });
    logApi({
      requestId,
      path: '/api/alerts/process-due',
      method: 'POST',
      status: 500,
      ms: msErr,
    });
    return NextResponse.json({ error: 'Cron handler failed' }, { status: 500 });
  }

  const ms = Date.now() - start;

  if (!acquired) {
    await recordCronSkipped(JOB_ALERTS_PROCESS_DUE, 'skipped: lock_not_acquired');
    logApi({
      requestId,
      path: '/api/alerts/process-due',
      method: 'POST',
      status: 200,
      ms,
      errorCode: 'CRON_LOCK_SKIPPED',
    });
    return NextResponse.json({ ok: true, skipped: 'lock_not_acquired' });
  }

  if (result === undefined) {
    await recordCronFailure(JOB_ALERTS_PROCESS_DUE, {
      durationMs: ms,
      error: 'Unexpected: no result from handler',
    });
    logApi({
      requestId,
      path: '/api/alerts/process-due',
      method: 'POST',
      status: 500,
      ms,
    });
    return NextResponse.json({ error: 'Cron handler failed' }, { status: 500 });
  }

  await recordCronSuccess(JOB_ALERTS_PROCESS_DUE, {
    durationMs: ms,
    processedCount: result.processed,
  });
  Sentry.setTag('cron.lock_acquired', 'true');
  Sentry.setTag('cron.processed', String(result.processed));
  logApi({
    requestId,
    path: '/api/alerts/process-due',
    method: 'POST',
    status: 200,
    ms,
  });
  return NextResponse.json(result);
}
