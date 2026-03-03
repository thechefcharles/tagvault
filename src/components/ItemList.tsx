'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { Item } from '@/types/item';

function formatDate(s: string) {
  return new Date(s).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function ItemList({
  items,
  nextCursor,
  onLoadMore,
  loadingMore,
}: {
  items: Item[];
  nextCursor: string | null;
  onLoadMore?: () => void;
  loadingMore?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [updatingPriority, setUpdatingPriority] = useState<string | null>(null);

  const type = searchParams.get('type') ?? 'all';
  const sort = searchParams.get('sort') ?? 'recent';

  function setParams(updates: { type?: string; sort?: string; cursor?: string }) {
    const params = new URLSearchParams(searchParams);
    if (updates.type !== undefined) {
      if (updates.type === 'all') params.delete('type');
      else params.set('type', updates.type);
    }
    if (updates.sort !== undefined) params.set('sort', updates.sort);
    router.push(`/app?${params.toString()}`);
  }

  async function handlePriorityChange(itemId: string, priority: number | null) {
    setUpdatingPriority(itemId);
    try {
      const res = await fetch(`/api/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority }),
      });
      if (res.ok) router.refresh();
    } finally {
      setUpdatingPriority(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-neutral-500">Type:</span>
        {['all', 'note', 'link', 'file'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setParams({ type: t })}
            className={`rounded px-2 py-1 text-sm ${
              type === t
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700'
            }`}
          >
            {t === 'all' ? 'All' : t}
          </button>
        ))}
        <span className="ml-4 text-sm text-neutral-500">Sort:</span>
        <select
          value={sort}
          onChange={(e) => setParams({ sort: e.target.value })}
          className="rounded border px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-800"
        >
          <option value="recent">Recent</option>
          <option value="priority">Priority</option>
        </select>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 px-6 py-12 text-center dark:border-neutral-600">
          <p className="font-medium text-neutral-600 dark:text-neutral-400">No items yet</p>
          <p className="mt-1 text-sm text-neutral-500">
            Click Quick Add to save a link, file, or note.
          </p>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {items.map((item) => (
              <li key={item.id} className="group py-3">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/app/item/${item.id}`}
                    className="-mx-2 block min-w-0 flex-1 rounded px-2 py-1 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                  >
                    <span className="mr-2 inline-block rounded bg-neutral-200 px-1.5 py-0.5 text-xs font-medium capitalize dark:bg-neutral-700">
                      {item.type}
                    </span>
                    <h3 className="mt-1 truncate font-medium">
                      {item.title || item.description.slice(0, 50)}
                      {!item.title && item.description.length > 50 ? '…' : ''}
                    </h3>
                    <p className="mt-0.5 truncate text-sm text-neutral-600 dark:text-neutral-400">
                      {item.description}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">{formatDate(item.created_at)}</p>
                  </Link>
                  <div className="shrink-0" onClick={(e) => e.preventDefault()}>
                    <select
                      value={item.priority ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        handlePriorityChange(
                          item.id,
                          v ? Math.min(20, Math.max(1, parseInt(v, 10))) : null,
                        );
                      }}
                      disabled={!!updatingPriority}
                      className="rounded border px-1.5 py-0.5 text-xs dark:border-neutral-600 dark:bg-neutral-800"
                    >
                      <option value="">—</option>
                      {Array.from({ length: 20 }, (_, i) => i + 1).map((p) => (
                        <option key={p} value={p}>
                          P{p}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {nextCursor && onLoadMore && (
            <div className="mt-4 text-center">
              {loadingMore ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="h-8 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                  <p className="text-xs text-neutral-500">Loading more…</p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onLoadMore}
                  className="text-sm text-neutral-600 hover:text-foreground dark:text-neutral-400 dark:hover:text-foreground"
                >
                  Load more
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
