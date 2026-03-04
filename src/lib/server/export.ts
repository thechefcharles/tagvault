/**
 * Shared export builder for /api/export and backup cron.
 * Produces the same JSON shape as Phase 15B export.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export const EXPORT_VERSION = '1.0';

export type ExportPayload = {
  version: string;
  exported_at: string;
  org: { id: string; name: string };
  data: {
    items: unknown[];
    tags: unknown[];
    item_tags: unknown[];
    collections: unknown[];
    collection_items: unknown[];
    saved_searches: unknown[];
    alerts: unknown[];
    notification_preferences: unknown[];
  };
};

export async function buildExportForOrg(
  supabase: SupabaseClient,
  orgId: string,
  orgName: string,
): Promise<{ payload: ExportPayload; sizeBytes: number }> {
  const [itemsRes, tagsRes, itemTagsRes, collectionsRes, collectionItemsRes, savedSearchesRes, alertsRes, prefsRes] =
    await Promise.all([
      supabase
        .from('items')
        .select('id, org_id, user_id, type, title, description, priority, url, storage_path, mime_type, created_at, updated_at')
        .eq('org_id', orgId)
        .order('created_at', { ascending: true }),
      supabase
        .from('tags')
        .select('id, org_id, name, slug, created_at')
        .eq('org_id', orgId)
        .order('created_at', { ascending: true }),
      supabase
        .from('item_tags')
        .select('item_id, tag_id, created_at')
        .eq('org_id', orgId)
        .order('created_at', { ascending: true }),
      supabase
        .from('collections')
        .select('id, org_id, name, created_at')
        .eq('org_id', orgId)
        .order('created_at', { ascending: true }),
      supabase
        .from('collection_items')
        .select('collection_id, item_id, created_at')
        .eq('org_id', orgId)
        .order('created_at', { ascending: true }),
      supabase
        .from('saved_searches')
        .select('id, org_id, name, query, filters, sort, semantic_enabled, pinned, created_at, updated_at')
        .eq('org_id', orgId)
        .order('created_at', { ascending: true }),
      supabase
        .from('alerts')
        .select('id, org_id, saved_search_id, source_type, source_id, tag_ids, name, enabled, frequency_minutes, notify_on_new, created_at, updated_at')
        .eq('org_id', orgId)
        .order('created_at', { ascending: true }),
      supabase
        .from('notification_preferences')
        .select('user_id, org_id, digest_frequency, timezone, digest_time_local, created_at, updated_at')
        .eq('org_id', orgId)
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

  const payload: ExportPayload = {
    version: EXPORT_VERSION,
    exported_at: new Date().toISOString(),
    org: { id: orgId, name: orgName },
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

  const json = JSON.stringify(payload, null, 2);
  const sizeBytes = new TextEncoder().encode(json).byteLength;

  return { payload, sizeBytes };
}
