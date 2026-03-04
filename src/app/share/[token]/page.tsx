import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SharedCollectionView } from './SharedCollectionView';

export const dynamic = 'force-dynamic';

type SharedItem = {
  id: string;
  type: string;
  title: string | null;
  description: string;
  url: string | null;
  storage_path: string | null;
  mime_type: string | null;
  created_at: string;
};

type SharedPayload = {
  collection: { id: string; name: string };
  items: SharedItem[];
};

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!token) notFound();

  const supabase = await createClient();
  const { data: raw, error } = await supabase.rpc('get_shared_collection_by_token', {
    p_token: token,
  });

  if (error || !raw) notFound();

  const payload = raw as SharedPayload | null;
  if (!payload || !payload.collection || !Array.isArray(payload.items)) notFound();

  return (
    <div className="min-h-screen bg-neutral-50 p-6 dark:bg-neutral-950">
      <div className="mx-auto max-w-2xl">
        <SharedCollectionView
          collectionName={payload.collection.name}
          items={payload.items}
          token={token}
        />
      </div>
    </div>
  );
}
