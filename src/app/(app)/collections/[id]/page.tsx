import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireActiveOrg } from '@/lib/server/auth';
import { createClient } from '@/lib/supabase/server';
import { CollectionDetailClient } from './CollectionDetailClient';
import { ShareSection } from '@/components/collections/ShareSection';

export const dynamic = 'force-dynamic';

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { activeOrgId } = await requireActiveOrg();
  const { id } = await params;
  const supabase = await createClient();

  const { data: collection } = await supabase
    .from('collections')
    .select('id, name')
    .eq('id', id)
    .eq('org_id', activeOrgId)
    .single();

  if (!collection) notFound();

  const { data: rows } = await supabase
    .from('collection_items')
    .select('item_id, items(*)')
    .eq('collection_id', id)
    .eq('org_id', activeOrgId)
    .order('created_at', { ascending: false });

  const rawItems = (rows ?? []).map((r: { item_id: string; items: unknown }) =>
    (r as { items: Record<string, unknown> | null }).items,
  ).filter(Boolean) as Record<string, unknown>[];
  const itemIds = rawItems.map((i) => i.id as string);

  let itemsWithTags = rawItems as (Record<string, unknown> & { tags?: { id: string; name: string; slug: string }[] })[];
  if (itemIds.length > 0) {
    const { data: tagRows } = await supabase
      .from('item_tags')
      .select('item_id, tags(id, name, slug)')
      .eq('org_id', activeOrgId)
      .in('item_id', itemIds);
    const tagsByItem = new Map<string, { id: string; name: string; slug: string }[]>();
    for (const r of tagRows ?? []) {
      const row = r as { item_id: string; tags: { id: string; name: string; slug: string } | null } | { item_id: string; tags: { id: string; name: string; slug: string }[] };
      const t = Array.isArray(row.tags) ? row.tags[0] : row.tags;
      if (t) {
        const list = tagsByItem.get(row.item_id) ?? [];
        list.push(t);
        tagsByItem.set(row.item_id, list);
      }
    }
    itemsWithTags = rawItems.map((item) => ({
      ...item,
      tags: tagsByItem.get(item.id as string) ?? [],
    })) as (Record<string, unknown> & { tags: { id: string; name: string; slug: string }[] })[];
  }

  type ItemWithTags = { id: string; type: string; title: string | null; description: string; created_at: string; tags?: { id: string; name: string; slug: string }[] };
  const items = itemsWithTags as ItemWithTags[];

  return (
    <div className="min-h-screen p-6">
      <header className="mx-auto mb-6 flex max-w-2xl items-center justify-between">
        <Link
          href="/collections"
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          ← Collections
        </Link>
        <h1 className="text-xl font-semibold">{collection.name}</h1>
      </header>
      <main className="mx-auto max-w-2xl space-y-6">
        <ShareSection collectionId={id} />
        <CollectionDetailClient
          collectionId={id}
          collectionName={collection.name}
          items={items}
        />
      </main>
    </div>
  );
}
