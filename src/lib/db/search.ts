import { createClient } from '@/lib/supabase/server';
import type { Item } from '@/types/item';

export type SortMode = 'best_match' | 'priority' | 'recent';

export type SearchResult = Item & { relevance?: number | null };

export async function searchItems({
  q,
  type,
  sort = 'best_match',
  limit = 50,
  offset = 0,
}: {
  q: string;
  type?: 'link' | 'file' | 'note' | 'all';
  sort?: SortMode;
  limit?: number;
  offset?: number;
}): Promise<SearchResult[]> {
  const supabase = await createClient();
  const typeParam = type && type !== 'all' ? type : null;

  const { data, error } = await supabase.rpc('search_items', {
    p_q: q ?? '',
    p_type: typeParam,
    p_sort: sort,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) throw error;
  return (data ?? []) as SearchResult[];
}
