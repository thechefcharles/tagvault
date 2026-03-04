import { NextRequest, NextResponse } from 'next/server';
import { requireActiveOrg } from '@/lib/server/auth';
import { createClient } from '@/lib/supabase/server';
import { runAlertQuery, type AlertRow } from '@/lib/alerts/run-alert-query';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, activeOrgId } = await requireActiveOrg();
    const { id } = await params;
    const supabase = await createClient();

    const { data: alert, error: errAlert } = await supabase
      .from('alerts')
      .select('id, org_id, owner_user_id, saved_search_id, source_type, source_id, tag_ids, name, notify_on_new, last_run_at, last_cursor')
      .eq('id', id)
      .eq('org_id', activeOrgId)
      .single();

    if (errAlert || !alert) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const orgId = alert.org_id as string;
    const runAsUserId = (alert.owner_user_id ?? user.id) as string;
    const matches = await runAlertQuery(alert as AlertRow, runAsUserId, supabase);

    const cutoff = alert.last_cursor ?? alert.last_run_at ?? '1970-01-01T00:00:00Z';
    const newMatches = matches.filter((m) => m.matchAt > cutoff);
    const newMatchCount = newMatches.length;

    if (alert.notify_on_new && newMatches.length > 0) {
      const newIds = newMatches.map((m) => m.item.id);
      await supabase.from('notifications').insert({
        owner_user_id: runAsUserId,
        org_id: orgId,
        type: 'alert_new_matches',
        title: `New matches for: ${alert.name}`,
        body: `${newMatchCount} new item${newMatchCount === 1 ? '' : 's'} matched your alert.`,
        meta: {
          alert_id: alert.id,
          source_type: alert.source_type,
          source_id: alert.source_id ?? alert.saved_search_id,
          item_ids: newIds.slice(0, 50),
        },
      });
    }

    const maxMatchAt =
      matches.length > 0
        ? matches.reduce((max, m) => (m.matchAt > max ? m.matchAt : max), matches[0].matchAt)
        : undefined;
    const now = new Date().toISOString();
    const nextRun = new Date();
    const { data: freq } = await supabase.from('alerts').select('frequency_minutes').eq('id', alert.id).single();
    const mins = (freq?.frequency_minutes as number) ?? 60;
    nextRun.setMinutes(nextRun.getMinutes() + mins);

    await supabase
      .from('alerts')
      .update({
        last_run_at: now,
        next_run_at: nextRun.toISOString(),
        ...(maxMatchAt ? { last_cursor: maxMatchAt } : {}),
      })
      .eq('id', alert.id);

    await supabase.from('alert_runs').insert({
      alert_id: alert.id,
      status: 'success',
      new_match_count: newMatchCount,
    });

    return NextResponse.json({
      ok: true,
      total_matches: matches.length,
      new_matches: newMatchCount,
      notified: newMatchCount > 0,
    });
  } catch (err) {
    if (err instanceof Error && (err.message === 'Unauthenticated' || err.message === 'No active org')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
