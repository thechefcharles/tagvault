import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { requireActiveOrg } from '@/lib/server/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const BUCKET = 'org-backups';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { activeOrgId } = await requireActiveOrg();
    const { id } = await params;

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
    const { data: signed } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(backup.storage_path, 60);

    if (!signed?.signedUrl) {
      Sentry.captureMessage('Failed to create signed URL for backup', {
        tags: { area: 'backups' },
        extra: { backup_id: id },
      });
      return NextResponse.json(
        { error: 'Failed to generate download URL' },
        { status: 500 },
      );
    }

    return NextResponse.redirect(signed.signedUrl);
  } catch (err) {
    if (err instanceof Error && (err.message === 'Unauthenticated' || err.message === 'No active org')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    Sentry.captureException(err, { tags: { area: 'backups' } });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Download failed' },
      { status: 500 },
    );
  }
}
