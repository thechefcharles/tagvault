import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { requireActiveOrg, isOrgOwner } from '@/lib/server/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const BUCKET = 'org-backups';
const SUPPORTED_VERSION = '1.0';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { activeOrgId } = await requireActiveOrg();
    const { id } = await params;

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const mode = body?.mode === 'replace' ? 'replace' : 'merge';

    if (mode === 'replace') {
      const ok = await isOrgOwner(activeOrgId);
      if (!ok) {
        return NextResponse.json(
          { error: 'Replace restore is owner-only' },
          { status: 403 },
        );
      }
    }

    const supabase = await createClient();
    const { data: backup, error } = await supabase
      .from('org_backups')
      .select('org_id, storage_path, status')
      .eq('id', id)
      .single();

    if (error || !backup) {
      return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
    }
    if (backup.org_id !== activeOrgId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (backup.status !== 'ok' || !backup.storage_path) {
      return NextResponse.json({ error: 'Backup unavailable' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: fileData, error: downloadError } = await admin.storage
      .from(BUCKET)
      .download(backup.storage_path);

    if (downloadError || !fileData) {
      Sentry.captureException(downloadError ?? new Error('No file data'), {
        tags: { area: 'backups' },
        extra: { backup_id: id },
      });
      return NextResponse.json(
        { error: 'Failed to fetch backup file' },
        { status: 500 },
      );
    }

    const text = await fileData.text();
    let payload: { version?: string; data?: Record<string, unknown> };
    try {
      payload = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: 'Invalid backup file format' },
        { status: 400 },
      );
    }

    if (payload.version !== SUPPORTED_VERSION || !payload.data) {
      return NextResponse.json(
        { error: 'Unsupported backup version' },
        { status: 400 },
      );
    }

    const importBody = {
      version: payload.version,
      data: payload.data,
      mode,
    };

    const importRes = await fetch(
      `${request.nextUrl.origin}/api/import`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: request.headers.get('cookie') ?? '',
        },
        body: JSON.stringify(importBody),
      },
    );

    const importData = await importRes.json();

    if (!importRes.ok) {
      return NextResponse.json(
        { error: importData.error ?? 'Restore failed' },
        { status: importRes.status },
      );
    }

    return NextResponse.json({
      ok: true,
      mode,
      imported: importData.imported,
    });
  } catch (err) {
    if (err instanceof Error && (err.message === 'Unauthenticated' || err.message === 'No active org')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    Sentry.captureException(err, { tags: { area: 'backups' } });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Restore failed' },
      { status: 500 },
    );
  }
}
