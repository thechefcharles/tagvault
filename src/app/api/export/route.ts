import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { requireActiveOrg } from '@/lib/server/auth';
import { createClient } from '@/lib/supabase/server';

const EXPORT_VERSION = '1.0';

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

    const [itemsRes, tagsRes, itemTagsRes, collectionsRes, collectionItemsRes, savedSearchesRes, alertsRes, prefsRes] =
      await Promise.all([
        supabase
          .from('items')
          .select('id, org_id, user_id, type, title, description, priority, url, storage_path, mime_type, created_at, updated_at')
          .eq('org_id', activeOrgId)
          .order('created_at', { ascending: true }),
        supabase
          .from('tags')
          .select('id, org_id, name, slug, created_at')
          .eq('org_id', activeOrgId)
          .order('created_at', { ascending: true }),
        supabase
          .from('item_tags')
          .select('item_id, tag_id, created_at')
          .eq('org_id', activeOrgId)
          .order('created_at', { ascending: true }),
        supabase
          .from('collections')
          .select('id, org_id, name, created_at')
          .eq('org_id', activeOrgId)
          .order('created_at', { ascending: true }),
        supabase
          .from('collection_items')
          .select('collection_id, item_id, created_at')
          .eq('org_id', activeOrgId)
          .order('created_at', { ascending: true }),
        supabase
          .from('saved_searches')
          .select('id, org_id, name, query, filters, sort, semantic_enabled, pinned, created_at, updated_at')
          .eq('org_id', activeOrgId)
          .order('created_at', { ascending: true }),
        supabase
          .from('alerts')
          .select('id, org_id, saved_search_id, source_type, source_id, tag_ids, name, enabled, frequency_minutes, notify_on_new, created_at, updated_at')
          .eq('org_id', activeOrgId)
          .order('created_at', { ascending: true }),
        supabase
          .from('notification_preferences')
          .select('user_id, org_id, digest_frequency, timezone, digest_time_local, created_at, updated_at')
          .eq('org_id', activeOrgId)
          .order('user_id'),
      ]);

    if (itemsRes.error) throw itemsRes.error;
    if (tagsRes.error) throw tagsRes.error;
    if (itemTagsRes.error) throw itemTagsRes.error;
    if (collectionsRes.error) throw collectionsRes.error;
    if (collectionItemsRes.error) throw collectionItemsRes.error;
    if (savedSearchesRes.error) throw savedSearchesRes.error;
    if (alertsRes.error) throw alertsRes.error;
    if (prefsRes.error) throw prefsRes.error;

    const payload = {
      version: EXPORT_VERSION,
      exported_at: new Date().toISOString(),
      org: { id: orgRes.data.id, name: orgRes.data.name },
      data: {
        items: itemsRes.data ?? [],
        tags: tagsRes.data ?? [],
        item_tags: itemTagsRes.data ?? [],
        collections: collectionsRes.data ?? [],
        collection_items: collectionItemsRes.data ?? [],
        saved_searches: savedSearchesRes.data ?? [],
        alerts: alertsRes.data ?? [],
        notification_preferences: prefsRes.data ?? [],
      },
    };

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
