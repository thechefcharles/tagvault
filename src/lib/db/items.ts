import { createClient } from '@/lib/supabase/server';
import type { Item } from '@/types/item';
import type { CreateItemInput, UpdateItemInput } from '@/lib/db/validators';

const CURSOR_SEP = '__C__';

export async function listItems({
  orgId,
  userId,
  type,
  sort = 'recent',
  limit = 25,
  cursor,
}: {
  orgId: string;
  userId: string;
  type?: 'link' | 'file' | 'note';
  sort?: 'recent' | 'priority';
  limit?: number;
  cursor?: string;
}): Promise<{ items: Item[]; nextCursor: string | null }> {
  const supabase = await createClient();
  const safeLimit = Math.min(Math.max(1, limit), 100);
  void userId; // reserved for future use (e.g. filter by creator)

  let query = supabase
    .from('items')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(safeLimit + 1);

  if (type) query = query.eq('type', type);

  if (cursor) {
    const [cursorCreatedAt] = cursor.split(CURSOR_SEP);
    if (cursorCreatedAt) {
      query = query.lt('created_at', cursorCreatedAt);
    }
  }

  const { data, error } = await query;
  if (error) throw error;

  let items = (data ?? []) as Item[];
  const hasMore = items.length > safeLimit;
  if (hasMore) items = items.slice(0, safeLimit);

  if (sort === 'priority') {
    items = [...items].sort((a, b) => {
      const pa = a.priority ?? 999;
      const pb = b.priority ?? 999;
      return pa - pb;
    });
  }

  const last = items[items.length - 1];
  const nextCursor = hasMore && last ? `${last.created_at}${CURSOR_SEP}${last.id}` : null;

  return { items, nextCursor };
}

export async function getItemById({
  orgId,
  id,
}: {
  orgId: string;
  id: string;
}): Promise<Item | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('id', id)
    .eq('org_id', orgId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as Item;
}

export async function createItem({
  orgId,
  userId,
  payload,
}: {
  orgId: string;
  userId: string;
  payload: CreateItemInput;
}): Promise<Item> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('items')
    .insert({
      org_id: orgId,
      user_id: userId,
      type: payload.type,
      title: payload.title ?? null,
      description: payload.description,
      priority: payload.priority ?? null,
      url: payload.type === 'link' ? (payload.url ?? null) : null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Item;
}

export async function updateItem({
  orgId,
  id,
  payload,
}: {
  orgId: string;
  id: string;
  payload: UpdateItemInput;
}): Promise<Item> {
  const supabase = await createClient();
  const update: Record<string, unknown> = {};
  if (payload.title !== undefined) update.title = payload.title;
  if (payload.description !== undefined) update.description = payload.description;
  if (payload.priority !== undefined) update.priority = payload.priority;
  if (payload.url !== undefined) update.url = payload.url;

  const { data, error } = await supabase
    .from('items')
    .update(update)
    .eq('id', id)
    .eq('org_id', orgId)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error('Item not found');
  return data as Item;
}

export async function deleteItem({ orgId, id }: { orgId: string; id: string }): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('items').delete().eq('id', id).eq('org_id', orgId);

  if (error) throw error;
}

export async function attachFileToItem({
  orgId,
  id,
  storage_path,
  mime_type,
  title,
}: {
  orgId: string;
  id: string;
  storage_path: string;
  mime_type: string;
  title?: string | null;
}): Promise<Item> {
  const supabase = await createClient();
  const update: Record<string, unknown> = {
    storage_path,
    mime_type,
  };
  if (title !== undefined) update.title = title;

  const { data, error } = await supabase
    .from('items')
    .update(update)
    .eq('id', id)
    .eq('org_id', orgId)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error('Item not found');
  return data as Item;
}
