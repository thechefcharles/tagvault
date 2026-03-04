import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { requireActiveOrg } from '@/lib/server/auth';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const { activeOrgId } = await requireActiveOrg();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('org_backups')
      .select('id, created_at, size_bytes, status')
      .eq('org_id', activeOrgId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    if (err instanceof Error && (err.message === 'Unauthenticated' || err.message === 'No active org')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    Sentry.captureException(err, { tags: { area: 'backups' } });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to list backups' },
      { status: 500 },
    );
  }
}
