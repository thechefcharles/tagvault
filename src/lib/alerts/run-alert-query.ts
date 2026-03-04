import type { SupabaseClient } from '@supabase/supabase-js';
import { runSavedSearch } from '@/lib/alerts/run-saved-search';
import { searchItemsHybrid } from '@/lib/db/search-hybrid';
import type { Item } from '@/types/item';

export type AlertRow = {
  id: string;
  org_id: string;
  owner_user_id: string | null;
  source_type: 'saved_search' | 'collection' | 'tag_filter';
  source_id: string | null;
  saved_search_id: string | null;
  tag_ids: string[] | null;
  name: string;
  last_run_at: string | null;
  last_cursor: string | null;
};

export type AlertMatch = { item: Item; matchAt: string };

/**
 * Resolve matching items for an alert based on source_type.
 * Returns { item, matchAt } where matchAt is the timestamp used for delta detection
 * (items.created_at for saved_search/tag_filter, collection_items.created_at for collection).
 */
export async function runAlertQuery(
  alert: AlertRow,
  runAsUserId: string,
  supabase: SupabaseClient,
): Promise<AlertMatch[]> {
  const orgId = alert.org_id;
  if (!orgId) return [];

  switch (alert.source_type) {
    case 'saved_search': {
      const searchId = alert.source_id ?? alert.saved_search_id;
      if (!searchId) return [];
      const { data: saved, error } = await supabase
        .from('saved_searches')
        .select('id, query, filters, sort, semantic_enabled')
        .eq('id', searchId)
        .eq('org_id', orgId)
        .single();
      if (error || !saved) return [];
      const items = await runSavedSearch(
        saved as { id: string; query: string; filters: Record<string, unknown>; sort: string; semantic_enabled: boolean },
        orgId,
        runAsUserId,
        supabase,
      );
      return items.map((item) => ({ item, matchAt: item.created_at }));
    }

    case 'collection': {
      const collectionId = alert.source_id;
      if (!collectionId) return [];
      const { data: rows, error } = await supabase
        .from('collection_items')
        .select('created_at, items(*)')
        .eq('collection_id', collectionId)
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });
      if (error) return [];
      return (rows ?? []).map((r: { created_at: string; items: Item | Item[] | null }) => {
        const raw = r.items;
        const item = Array.isArray(raw) ? raw[0] : raw;
        if (!item) return null;
        return { item, matchAt: r.created_at };
      }).filter((x): x is AlertMatch => x !== null);
    }

    case 'tag_filter': {
      const tagIds = alert.tag_ids;
      if (!tagIds?.length) return [];
      const items = await searchItemsHybrid({
        orgId,
        userId: runAsUserId,
        q: '',
        type: 'all',
        sort: 'recent',
        limit: 100,
        offset: 0,
        useSemantic: false,
        queryEmbedding: null,
        tagIds,
        supabase,
      });
      return items.map((item) => ({ item, matchAt: item.created_at }));
    }

    default:
      return [];
  }
}
