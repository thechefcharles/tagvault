'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ItemList } from '@/components/ItemList';
import { QuickAddModal } from '@/components/QuickAddModal';
import type { Item } from '@/types/item';

export function VaultClient({
  items,
  nextCursor,
  type,
  sort,
  limit,
}: {
  items: Item[];
  nextCursor: string | null;
  type?: string;
  sort?: string;
  limit?: number;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [displayItems, setDisplayItems] = useState<Item[]>(items);
  const [displayNextCursor, setDisplayNextCursor] = useState<string | null>(nextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setDisplayItems(items);
    setDisplayNextCursor(nextCursor);
  }, [items, nextCursor]);

  function handleQuickAddClose() {
    setModalOpen(false);
    router.refresh();
  }

  async function handleLoadMore() {
    if (!displayNextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      params.set('cursor', displayNextCursor);
      params.set('limit', String(limit ?? 25));
      if (type && type !== 'all') params.set('type', type);
      if (sort) params.set('sort', sort);
      const res = await fetch(`/api/items?${params}`);
      const data = await res.json();
      if (res.ok && data.items) {
        setDisplayItems((prev) => [...prev, ...data.items]);
        setDisplayNextCursor(data.nextCursor ?? null);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-md bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Quick Add
        </button>
      </div>
      <ItemList
        items={displayItems}
        nextCursor={displayNextCursor}
        onLoadMore={handleLoadMore}
        loadingMore={loadingMore}
      />
      <QuickAddModal open={modalOpen} onClose={handleQuickAddClose} />
    </>
  );
}
