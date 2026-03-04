import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { requireActiveOrg } from '@/lib/server/auth';
import { createClient } from '@/lib/supabase/server';
import { buildExportForOrg } from '@/lib/server/export';

export async function GET() {
  let activeOrgId = '';
  try {
    const { activeOrgId: orgId } = await requireActiveOrg();
    activeOrgId = orgId;
    const supabase = await createClient();

    const orgRes = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', orgId)
      .single();

    if (orgRes.error || !orgRes.data) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const { payload } = await buildExportForOrg(supabase, orgRes.data.id, orgRes.data.name);

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `tagvault-export-${activeOrgId.slice(0, 8)}-${dateStr}.json`;

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    if (err instanceof Error && (err.message === 'Unauthenticated' || err.message === 'No active org')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    Sentry.captureException(err, { tags: { area: 'export', org_id: activeOrgId || 'unknown' } });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Export failed' },
      { status: 500 },
    );
  }
}
