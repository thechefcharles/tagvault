import type { SupabaseClient } from '@supabase/supabase-js';
import { getQueryEmbedding } from '@/lib/embeddings';
import { searchItemsHybrid } from '@/lib/db/search-hybrid';
import type { Item } from '@/types/item';

export type SavedSearchRow = {
  id: string;
  query: string;
  filters: Record<string, unknown>;
  sort: string;
  semantic_enabled: boolean;
};

/**
 * Run a saved search for a given org.
 * Reuses the same logic as /api/saved-searches/[id]/run.
 * Pass supabase when running from cron (admin client).
 */
export async function runSavedSearch(
  saved: SavedSearchRow,
  orgId: string,
  userId: string,
  supabase?: SupabaseClient,
): Promise<Item[]> {
  const filters = (saved.filters ?? {}) as { type?: string[]; tag_ids?: string[] };
  const type = filters.type?.[0] ?? 'all';
  const tagIds = Array.isArray(filters.tag_ids) ? filters.tag_ids : undefined;

  let queryEmbedding: number[] | null = null;
  if (saved.semantic_enabled && saved.query?.trim()) {
    queryEmbedding = await getQueryEmbedding(saved.query);
  }

  return searchItemsHybrid({
    orgId,
    userId,
    q: saved.query ?? '',
    type: type as 'link' | 'file' | 'note' | 'all',
    sort: (saved.sort ?? 'best_match') as 'best_match' | 'priority' | 'recent',
    limit: 100,
    offset: 0,
    useSemantic: saved.semantic_enabled,
    queryEmbedding,
    tagIds,
    supabase,
  });
}
