import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { requireActiveOrg, isOrgOwner } from '@/lib/server/auth';
import { createClient } from '@/lib/supabase/server';

const MAX_ITEMS = 10000;
const MAX_TAGS = 2000;
const MAX_COLLECTIONS = 500;
const MAX_SAVED_SEARCHES = 500;
const MAX_ALERTS = 500;
const SUPPORTED_VERSION = '1.0';

type ExportData = {
  items?: Array<Record<string, unknown>>;
  tags?: Array<Record<string, unknown>>;
  item_tags?: Array<Record<string, unknown>>;
  collections?: Array<Record<string, unknown>>;
  collection_items?: Array<Record<string, unknown>>;
  saved_searches?: Array<Record<string, unknown>>;
  alerts?: Array<Record<string, unknown>>;
  notification_preferences?: Array<Record<string, unknown>>;
};

type ExportPayload = {
  version?: string;
  data?: ExportData;
};

function parseBody(body: unknown): ExportPayload | null {
  if (body == null || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  if (typeof o.version !== 'string' || !o.data || typeof o.data !== 'object') return null;
  return { version: o.version, data: o.data as ExportData };
}

export async function POST(request: NextRequest) {
  let activeOrgId = '';
  let mode = 'merge';
  try {
    const { user, activeOrgId: orgId } = await requireActiveOrg();
    activeOrgId = orgId;

    const body = await request.json();
    const parsed = parseBody(body);
    if (!parsed || parsed.version !== SUPPORTED_VERSION) {
      return NextResponse.json(
        { error: 'Invalid export format or unsupported version' },
        { status: 400 },
      );
    }

    const data = parsed.data ?? {};
    const items = Array.isArray(data.items) ? data.items : [];
    const tags = Array.isArray(data.tags) ? data.tags : [];
    const collections = Array.isArray(data.collections) ? data.collections : [];
    const savedSearches = Array.isArray(data.saved_searches) ? data.saved_searches : [];
    const alerts = Array.isArray(data.alerts) ? data.alerts : [];
    const itemTags = Array.isArray(data.item_tags) ? data.item_tags : [];
    const collectionItems = Array.isArray(data.collection_items) ? data.collection_items : [];
    const notificationPrefs = Array.isArray(data.notification_preferences) ? data.notification_preferences : [];

    if (items.length > MAX_ITEMS || tags.length > MAX_TAGS || collections.length > MAX_COLLECTIONS) {
      return NextResponse.json(
        { error: 'Export too large', max_items: MAX_ITEMS, max_tags: MAX_TAGS, max_collections: MAX_COLLECTIONS },
        { status: 413 },
      );
    }
    if (savedSearches.length > MAX_SAVED_SEARCHES || alerts.length > MAX_ALERTS) {
      return NextResponse.json(
        { error: 'Export too large', max_saved_searches: MAX_SAVED_SEARCHES, max_alerts: MAX_ALERTS },
        { status: 413 },
      );
    }

    mode = (body as Record<string, unknown>).mode === 'replace' ? 'replace' : 'merge';
    if (mode === 'replace') {
      const ok = await isOrgOwner(activeOrgId);
      if (!ok) {
        return NextResponse.json({ error: 'Replace mode is owner-only' }, { status: 403 });
      }
    }

    const supabase = await createClient();

    if (mode === 'replace') {
      await deleteOrgData(supabase, activeOrgId);
    }

    const itemMap = new Map<string, string>();
    const tagMap = new Map<string, string>();
    const collectionMap = new Map<string, string>();
    const savedSearchMap = new Map<string, string>();
    const alertMap = new Map<string, string>();

    for (const row of items) {
      const extId = String(row.id ?? crypto.randomUUID());
      const { data: existing } = await supabase
        .from('items')
        .select('id')
        .eq('org_id', activeOrgId)
        .eq('external_id', extId)
        .maybeSingle();

      if (existing) {
        itemMap.set(extId, existing.id);
        await supabase
          .from('items')
          .update({
            type: row.type ?? 'note',
            title: row.title ?? null,
            description: row.description ?? '',
            priority: row.priority ?? null,
            url: row.url ?? null,
            storage_path: row.storage_path ?? null,
            mime_type: row.mime_type ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        const { data: inserted } = await supabase
          .from('items')
          .insert({
            org_id: activeOrgId,
            user_id: user.id,
            type: row.type ?? 'note',
            title: row.title ?? null,
            description: row.description ?? '',
            priority: row.priority ?? null,
            url: row.url ?? null,
            storage_path: row.storage_path ?? null,
            mime_type: row.mime_type ?? null,
            external_id: extId,
          })
          .select('id')
          .single();
        if (inserted) itemMap.set(extId, inserted.id);
      }
    }

    for (const row of tags) {
      const extId = String(row.id ?? crypto.randomUUID());
      const { data: existing } = await supabase
        .from('tags')
        .select('id')
        .eq('org_id', activeOrgId)
        .eq('external_id', extId)
        .maybeSingle();

      if (existing) {
        tagMap.set(extId, existing.id);
        await supabase
          .from('tags')
          .update({ name: row.name ?? 'Untitled', slug: row.slug ?? 'untitled', updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        const { data: inserted } = await supabase
          .from('tags')
          .insert({
            org_id: activeOrgId,
            name: row.name ?? 'Untitled',
            slug: row.slug ?? 'untitled',
            external_id: extId,
          })
          .select('id')
          .single();
        if (inserted) tagMap.set(extId, inserted.id);
      }
    }

    for (const row of collections) {
      const extId = String(row.id ?? crypto.randomUUID());
      const { data: existing } = await supabase
        .from('collections')
        .select('id')
        .eq('org_id', activeOrgId)
        .eq('external_id', extId)
        .maybeSingle();

      if (existing) {
        collectionMap.set(extId, existing.id);
        await supabase
          .from('collections')
          .update({ name: row.name ?? 'Untitled' })
          .eq('id', existing.id);
      } else {
        const { data: inserted } = await supabase
          .from('collections')
          .insert({
            org_id: activeOrgId,
            name: row.name ?? 'Untitled',
            external_id: extId,
          })
          .select('id')
          .single();
        if (inserted) collectionMap.set(extId, inserted.id);
      }
    }

    for (const row of savedSearches) {
      const extId = String(row.id ?? crypto.randomUUID());
      const { data: existing } = await supabase
        .from('saved_searches')
        .select('id')
        .eq('org_id', activeOrgId)
        .eq('external_id', extId)
        .maybeSingle();

      if (existing) {
        savedSearchMap.set(extId, existing.id);
        await supabase
          .from('saved_searches')
          .update({
            name: row.name ?? '',
            query: row.query ?? '',
            filters: row.filters ?? {},
            sort: row.sort ?? 'best_match',
            semantic_enabled: row.semantic_enabled !== false,
            pinned: row.pinned === true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        const { data: inserted } = await supabase
          .from('saved_searches')
          .insert({
            org_id: activeOrgId,
            owner_user_id: null,
            name: row.name ?? '',
            query: row.query ?? '',
            filters: row.filters ?? {},
            sort: row.sort ?? 'best_match',
            semantic_enabled: row.semantic_enabled !== false,
            pinned: row.pinned === true,
            external_id: extId,
          })
          .select('id')
          .single();
        if (inserted) savedSearchMap.set(extId, inserted.id);
      }
    }

    for (const row of alerts) {
      const extId = String(row.id ?? crypto.randomUUID());
      const oldSsId = row.saved_search_id != null ? String(row.saved_search_id) : null;
      const newSsId = oldSsId ? savedSearchMap.get(oldSsId) ?? null : null;
      const oldSourceId = row.source_id != null ? String(row.source_id) : null;
      const sourceType = (row.source_type as string) ?? 'saved_search';
      let newSourceId: string | null = null;
      if (sourceType === 'saved_search' && oldSourceId) newSourceId = savedSearchMap.get(oldSourceId) ?? null;
      else if (sourceType === 'collection' && oldSourceId) newSourceId = collectionMap.get(oldSourceId) ?? null;

      const { data: existing } = await supabase
        .from('alerts')
        .select('id')
        .eq('org_id', activeOrgId)
        .eq('external_id', extId)
        .maybeSingle();

      const freq = typeof row.frequency_minutes === 'number' ? row.frequency_minutes : 60;
      const nextRun = new Date(Date.now() + freq * 60 * 1000).toISOString();

      const alertRow = {
        org_id: activeOrgId,
        saved_search_id: newSsId,
        source_type: sourceType,
        source_id: newSourceId ?? newSsId ?? null,
        tag_ids: Array.isArray(row.tag_ids) ? row.tag_ids : null,
        name: row.name ?? 'Alert',
        enabled: row.enabled !== false,
        frequency_minutes: freq,
        notify_on_new: row.notify_on_new !== false,
        next_run_at: nextRun,
        external_id: extId,
      };

      if (existing) {
        alertMap.set(extId, existing.id);
        await supabase
          .from('alerts')
          .update({
            ...alertRow,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        const { data: inserted } = await supabase
          .from('alerts')
          .insert(alertRow)
          .select('id')
          .single();
        if (inserted) alertMap.set(extId, inserted.id);
      }
    }

    for (const it of itemTags) {
      const itemId = itemMap.get(String(it.item_id));
      const tagId = tagMap.get(String(it.tag_id));
      if (!itemId || !tagId) continue;
      await supabase
        .from('item_tags')
        .upsert(
          { org_id: activeOrgId, item_id: itemId, tag_id: tagId },
          { onConflict: 'item_id,tag_id', ignoreDuplicates: true },
        );
    }

    for (const ci of collectionItems) {
      const collectionId = collectionMap.get(String(ci.collection_id));
      const itemId = itemMap.get(String(ci.item_id));
      if (!collectionId || !itemId) continue;
      await supabase
        .from('collection_items')
        .upsert(
          { org_id: activeOrgId, collection_id: collectionId, item_id: itemId },
          { onConflict: 'collection_id,item_id', ignoreDuplicates: true },
        );
    }

    for (const pref of notificationPrefs) {
      const prefUserId = pref.user_id != null ? String(pref.user_id) : null;
      if (prefUserId !== user.id) continue;
      await supabase
        .from('notification_preferences')
        .upsert(
          {
            user_id: user.id,
            org_id: activeOrgId,
            digest_frequency: pref.digest_frequency ?? 'none',
            timezone: pref.timezone ?? 'UTC',
            digest_time_local: pref.digest_time_local ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,org_id' },
        );
    }

    return NextResponse.json({
      ok: true,
      mode,
      imported: {
        items: items.length,
        tags: tags.length,
        collections: collections.length,
        saved_searches: savedSearches.length,
        alerts: alerts.length,
      },
    });
  } catch (err) {
    if (err instanceof Error && (err.message === 'Unauthenticated' || err.message === 'No active org')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    Sentry.captureException(err, { tags: { area: 'import', org_id: activeOrgId || 'unknown', mode } });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Import failed' },
      { status: 500 },
    );
  }
}

async function deleteOrgData(supabase: Awaited<ReturnType<typeof createClient>>, orgId: string): Promise<void> {
  await supabase.from('collection_items').delete().eq('org_id', orgId);
  await supabase.from('item_tags').delete().eq('org_id', orgId);
  await supabase.from('alerts').delete().eq('org_id', orgId);
  await supabase.from('saved_searches').delete().eq('org_id', orgId);
  await supabase.from('collections').delete().eq('org_id', orgId);
  await supabase.from('items').delete().eq('org_id', orgId);
  await supabase.from('tags').delete().eq('org_id', orgId);
  await supabase.from('notification_preferences').delete().eq('org_id', orgId);
}
