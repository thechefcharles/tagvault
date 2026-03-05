import type { SupabaseClient } from '@supabase/supabase-js';

export async function ensureInboxCollection(
  orgId: string,
  userId: string,
  supabase: SupabaseClient,
): Promise<string> {
  const { data, error } = await supabase.rpc('ensure_inbox_collection', {
    p_org_id: orgId,
    p_user_id: userId,
  });
  if (error) {
    throw error;
  }
  return data as string;
}

