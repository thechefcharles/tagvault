/**
 * Cron heartbeat persistence for alerts process-due.
 * Writes to cron_runs table via admin client.
 */

import { createAdminClient } from '@/lib/supabase/admin';

const JOB_ALERTS_PROCESS_DUE = 'alerts:process-due';
const JOB_NOTIFICATIONS_DIGEST = 'notifications:process-digest';
const JOB_BACKUPS_NIGHTLY = 'backups:process-nightly';
const MAX_ERROR_LEN = 500;

export async function recordCronStarted(job: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from('cron_runs')
    .upsert(
      {
        job,
        last_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'job' },
    );
}

export async function recordCronSuccess(
  job: string,
  opts: { durationMs: number; processedCount: number },
): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from('cron_runs')
    .upsert(
      {
        job,
        last_finished_at: new Date().toISOString(),
        last_ok: true,
        last_error: null,
        last_duration_ms: opts.durationMs,
        last_processed_count: opts.processedCount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'job' },
    );
}

export async function recordCronFailure(
  job: string,
  opts: { durationMs: number; error: string },
): Promise<void> {
  const truncated = opts.error.length > MAX_ERROR_LEN ? opts.error.slice(0, MAX_ERROR_LEN) + '…' : opts.error;
  const admin = createAdminClient();
  await admin
    .from('cron_runs')
    .upsert(
      {
        job,
        last_finished_at: new Date().toISOString(),
        last_ok: false,
        last_error: truncated,
        last_duration_ms: opts.durationMs,
        last_processed_count: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'job' },
    );
}

export async function recordCronSkipped(job: string, reason: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from('cron_runs')
    .upsert(
      {
        job,
        last_finished_at: new Date().toISOString(),
        last_ok: true,
        last_error: reason,
        last_duration_ms: null,
        last_processed_count: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'job' },
    );
}

export { JOB_ALERTS_PROCESS_DUE, JOB_NOTIFICATIONS_DIGEST, JOB_BACKUPS_NIGHTLY };
