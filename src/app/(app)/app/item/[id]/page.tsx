import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireActiveOrg } from '@/lib/server/auth';
import { getItemById } from '@/lib/db/items';
import { ItemDetailClient } from './ItemDetailClient';

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { activeOrgId } = await requireActiveOrg();
  const { id } = await params;

  const item = await getItemById({ orgId: activeOrgId, id });
  if (!item) notFound();

  return (
    <div className="min-h-screen p-6">
      <header className="mx-auto mb-6 flex max-w-2xl items-center gap-4">
        <Link
          href="/app"
          className="text-neutral-600 hover:text-foreground dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          ← Back
        </Link>
        <span className="rounded bg-neutral-200 px-2 py-0.5 text-sm capitalize dark:bg-neutral-700">
          {item.type}
        </span>
      </header>
      <main className="mx-auto max-w-2xl">
        <ItemDetailClient item={item} />
      </main>
    </div>
  );
}
