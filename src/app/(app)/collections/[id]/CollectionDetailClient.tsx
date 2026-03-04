'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TagChips } from '@/components/TagChips';
import { AlertModal } from '@/components/alerts/AlertModal';

type Item = {
  id: string;
  type: string;
  title: string | null;
  description: string;
  created_at: string;
  tags?: { id: string; name: string; slug: string }[];
};

function formatDate(s: string) {
  return new Date(s).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function CollectionDetailClient({
  collectionId,
  collectionName,
  items: initialItems,
}: {
  collectionId: string;
  collectionName?: string;
  items: Item[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [alertModalOpen, setAlertModalOpen] = useState(false);

  async function removeItem(itemId: string) {
    setRemovingId(itemId);
    try {
      const res = await fetch(`/api/collections/${collectionId}/items`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId }),
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== itemId));
        router.refresh();
      }
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {items.length} item{items.length !== 1 ? 's' : ''} in this collection
        </p>
        <button
          type="button"
          onClick={() => setAlertModalOpen(true)}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Create alert
        </button>
      </div>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 px-6 py-8 text-center text-neutral-500 dark:border-neutral-600">
          No items yet. Add items from the Vault.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
          {items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-2 py-3">
              <Link
                href={`/app/item/${item.id}`}
                className="min-w-0 flex-1 hover:underline"
              >
                <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-xs capitalize dark:bg-neutral-700">
                  {item.type}
                </span>
                <h3 className="mt-1 font-medium">
                  {item.title || item.description.slice(0, 50)}
                  {!item.title && item.description.length > 50 ? '…' : ''}
                </h3>
                {item.tags?.length ? (
                  <TagChips tags={item.tags} />
                ) : null}
                <p className="mt-1 text-xs text-neutral-500">{formatDate(item.created_at)}</p>
              </Link>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                disabled={!!removingId}
                className="shrink-0 text-sm text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <AlertModal
        open={alertModalOpen}
        onClose={() => setAlertModalOpen(false)}
        onSave={() => {
          setAlertModalOpen(false);
          router.refresh();
        }}
        savedSearches={[]}
        presetSource={{ type: 'collection', collectionId, collectionName: collectionName ?? 'Collection' }}
      />
    </div>
  );
}
