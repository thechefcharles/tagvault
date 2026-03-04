import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getBillingAccountForOrg, isPro } from '@/lib/billing';
import { getBackupRetentionDays, type Plan } from '@/lib/entitlements/limits';
import { buildExportForOrg } from '@/lib/server/export';
import { withCronLock } from '@/lib/server/cronLock';
import {
  recordCronStarted,
  recordCronSuccess,
  recordCronFailure,
  recordCronSkipped,
  JOB_BACKUPS_NIGHTLY,
} from '@/lib/server/cronHeartbeat';
import { logApi } from '@/lib/apiLog';

const BUCKET = 'org-backups';
const CRON_LOCK_TTL_SEC = 300;
const MAX_BACKUP_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

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
      path: '/api/backups/process-nightly',
      method: 'POST',
      status: 401,
      ms: Date.now() - start,
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let acquired = false;
  let result:
    | { processed_orgs: number; created_backups: number; deleted_old: number }
    | undefined;

  try {
    const lockResult = await withCronLock(
      'cron:backups:nightly',
      CRON_LOCK_TTL_SEC,
      async () => {
        await recordCronStarted(JOB_BACKUPS_NIGHTLY);
        const admin = createAdminClient();

        const { data: billingRows } = await admin
          .from('billing_accounts')
          .select('org_id')
          .in('plan', ['pro', 'team']);

        const orgIds = Array.from(
          new Set((billingRows ?? []).map((r) => r.org_id as string).filter(Boolean)),
        );

        let processedOrgs = 0;
        let createdBackups = 0;
        let deletedOld = 0;

        for (const orgId of orgIds) {
          try {
            const billing = await getBillingAccountForOrg(orgId);
            if (!isPro(billing)) continue;

            const plan: Plan = billing.plan === 'team' ? 'team' : 'pro';
            const retentionDays = getBackupRetentionDays(plan);
            if (retentionDays <= 0) continue;

            const { data: org } = await admin
              .from('organizations')
              .select('name')
              .eq('id', orgId)
              .single();
            if (!org?.name) continue;

            const { payload, sizeBytes } = await buildExportForOrg(
              admin,
              orgId,
              org.name,
            );

            if (sizeBytes > MAX_BACKUP_SIZE_BYTES) {
              await admin.from('org_backups').insert({
                org_id: orgId,
                storage_path: '',
                size_bytes: sizeBytes,
                status: 'failed',
                error_message: `Backup too large: ${sizeBytes} bytes (max ${MAX_BACKUP_SIZE_BYTES})`,
              });
              processedOrgs += 1;
              Sentry.captureMessage('Backup too large', {
                level: 'warning',
                tags: { area: 'backups', job: 'nightly', org_id: orgId },
                extra: { sizeBytes, maxBytes: MAX_BACKUP_SIZE_BYTES },
              });
              continue;
            }

            const dateStr = new Date().toISOString().slice(0, 10);
            const backupId = crypto.randomUUID();
            const storagePath = `backups/${orgId}/${dateStr}/${backupId}.json`;

            const { error: uploadError } = await admin.storage
              .from(BUCKET)
              .upload(storagePath, JSON.stringify(payload, null, 2), {
                contentType: 'application/json',
                upsert: false,
              });

            if (uploadError) {
              await admin.from('org_backups').insert({
                org_id: orgId,
                storage_path: storagePath,
                size_bytes: sizeBytes,
                status: 'failed',
                error_message: uploadError.message,
              });
              Sentry.captureException(uploadError, {
                tags: { area: 'backups', job: 'nightly', org_id: orgId },
              });
              processedOrgs += 1;
              continue;
            }

            await admin.from('org_backups').insert({
              org_id: orgId,
              storage_path: storagePath,
              size_bytes: sizeBytes,
              status: 'ok',
            });
            createdBackups += 1;
            processedOrgs += 1;

            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - retentionDays);
            const cutoffIso = cutoff.toISOString();

            const { data: oldBackups } = await admin
              .from('org_backups')
              .select('id, storage_path')
              .eq('org_id', orgId)
              .lt('created_at', cutoffIso)
              .order('created_at', { ascending: true });

            for (const row of oldBackups ?? []) {
              if (row.storage_path) {
                await admin.storage.from(BUCKET).remove([row.storage_path]);
              }
              await admin.from('org_backups').delete().eq('id', row.id);
              deletedOld += 1;
            }
          } catch (e) {
            Sentry.captureException(e, {
              tags: { area: 'backups', job: 'nightly' },
              extra: { org_id: orgId },
            });
          }
        }

        return {
          processed_orgs: processedOrgs,
          created_backups: createdBackups,
          deleted_old: deletedOld,
        };
      },
    );

    acquired = lockResult.acquired;
    result = lockResult.result;
  } catch (e) {
    const msErr = Date.now() - start;
    await recordCronFailure(JOB_BACKUPS_NIGHTLY, {
      durationMs: msErr,
      error: e instanceof Error ? e.message : String(e),
    });
    Sentry.captureException(e, {
      tags: { area: 'backups', job: 'nightly' },
      extra: { lock_acquired: acquired },
    });
    logApi({
      requestId,
      path: '/api/backups/process-nightly',
      method: 'POST',
      status: 500,
      ms: msErr,
    });
    return NextResponse.json({ error: 'Cron handler failed' }, { status: 500 });
  }

  const ms = Date.now() - start;

  if (!acquired) {
    await recordCronSkipped(JOB_BACKUPS_NIGHTLY, 'skipped: lock_not_acquired');
    logApi({
      requestId,
      path: '/api/backups/process-nightly',
      method: 'POST',
      status: 200,
      ms,
      errorCode: 'CRON_LOCK_SKIPPED',
    });
    return NextResponse.json({ ok: true, skipped: 'lock_not_acquired' });
  }

  if (result === undefined) {
    await recordCronFailure(JOB_BACKUPS_NIGHTLY, {
      durationMs: ms,
      error: 'Unexpected: no result from handler',
    });
    return NextResponse.json({ error: 'Cron handler failed' }, { status: 500 });
  }

  await recordCronSuccess(JOB_BACKUPS_NIGHTLY, {
    durationMs: ms,
    processedCount: result.created_backups + result.deleted_old,
  });
  logApi({
    requestId,
    path: '/api/backups/process-nightly',
    method: 'POST',
    status: 200,
    ms,
  });
  return NextResponse.json({
    ok: true,
    processed_orgs: result.processed_orgs,
    created_backups: result.created_backups,
    deleted_old: result.deleted_old,
  });
}
