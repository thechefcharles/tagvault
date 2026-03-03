import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import type { Item } from '@/types/item';

export type HybridSearchResult = Item & { score?: number | null };

export async function searchItemsHybrid({
  userId,
  q,
  type,
  sort = 'best_match',
  limit = 50,
  offset = 0,
  useSemantic = true,
  queryEmbedding,
  supabase: supabaseOverride,
}: {
  userId: string;
  q: string;
  type?: 'link' | 'file' | 'note' | 'all';
  sort?: 'best_match' | 'priority' | 'recent';
  limit?: number;
  offset?: number;
  useSemantic?: boolean;
  queryEmbedding: number[] | null;
  supabase?: SupabaseClient;
}): Promise<HybridSearchResult[]> {
  const supabase = supabaseOverride ?? (await createClient());
  const typeParam = type && type !== 'all' ? type : null;

  const { data, error } = await supabase.rpc('rpc_search_items_hybrid', {
    p_query: q ?? '',
    p_owner: userId,
    p_query_embedding: queryEmbedding,
    p_limit: limit,
    p_offset: offset,
    p_use_semantic: useSemantic && !!queryEmbedding?.length,
    p_type: typeParam,
    p_sort: sort,
  });

  if (error) throw error;
  return (data ?? []) as HybridSearchResult[];
}
