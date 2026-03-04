import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SharedItemView } from './SharedItemView';

export const dynamic = 'force-dynamic';

type SharedItem = {
  id: string;
  org_id: string;
  type: string;
  title: string | null;
  description: string;
  url: string | null;
  storage_path: string | null;
  mime_type: string | null;
  created_at: string;
};

export default async function ShareItemPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!token) notFound();

  const supabase = await createClient();
  const { data: raw, error } = await supabase.rpc('get_shared_item_by_token', {
    p_token: token,
  });

  if (error || !raw) notFound();

  const item = raw as SharedItem | null;
  if (!item || !item.id) notFound();

  return (
    <div className="min-h-screen bg-neutral-50 p-6 dark:bg-neutral-950">
      <div className="mx-auto max-w-2xl">
        <SharedItemView item={item} token={token} />
      </div>
    </div>
  );
}
