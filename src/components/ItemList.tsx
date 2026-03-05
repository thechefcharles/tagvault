'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { TagChips } from '@/components/TagChips';
import { SkeletonCard } from '@/components/ui/Skeleton';
import type { ItemWithTags } from '@/types/item';

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
  tagIdsFilter,
}: {
  items: ItemWithTags[];
  nextCursor: string | null;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  tagIdsFilter?: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [updatingPriority, setUpdatingPriority] = useState<string | null>(null);

  const type = searchParams.get('type') ?? 'all';
  const sort = searchParams.get('sort') ?? 'recent';
  const inboxParam = searchParams.get('inbox');
  const inbox =
    inboxParam === null ? 'all' : inboxParam === '1' ? 'inbox' : inboxParam === '0' ? 'vault' : 'all';

  function setParams(updates: { type?: string; sort?: string; cursor?: string; tag_ids?: string; inbox?: string }) {
    const params = new URLSearchParams(searchParams);
    if (updates.type !== undefined) {
      if (updates.type === 'all') params.delete('type');
      else params.set('type', updates.type);
    }
    if (updates.sort !== undefined) params.set('sort', updates.sort);
    if (updates.tag_ids !== undefined) {
      if (updates.tag_ids) params.set('tag_ids', updates.tag_ids);
      else params.delete('tag_ids');
    }
    if (updates.inbox !== undefined) {
      if (!updates.inbox || updates.inbox === 'all') params.delete('inbox');
      else params.set('inbox', updates.inbox);
    }
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
        <span className="text-sm text-neutral-500">Items:</span>
        <button
          type="button"
          onClick={() => setParams({ inbox: '1' })}
          className={`min-h-[44px] min-w-[44px] rounded px-3 py-2.5 text-sm sm:min-w-0 ${
            inbox === 'inbox'
              ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
              : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700'
          }`}
          aria-label="Show Inbox"
        >
          Inbox
        </button>
        <button
          type="button"
          onClick={() => setParams({ inbox: 'vault' })}
          className={`min-h-[44px] min-w-[44px] rounded px-3 py-2.5 text-sm sm:min-w-0 ${
            inbox === 'vault'
              ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
              : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700'
          }`}
          aria-label="Show Vault"
        >
          Vault
        </button>
        <span className="ml-2 text-sm text-neutral-500 sm:ml-4">Type:</span>
        {['all', 'note', 'link', 'file'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setParams({ type: t })}
            className={`min-h-[44px] min-w-[44px] rounded px-3 py-2.5 text-sm sm:min-w-0 ${
              type === t
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700'
            }`}
            aria-label={`Filter by ${t}`}
          >
            {t === 'all' ? 'All' : t}
          </button>
        ))}
        <span className="ml-2 sm:ml-4 text-sm text-neutral-500">Sort:</span>
        <select
          value={sort}
          onChange={(e) => setParams({ sort: e.target.value })}
          className="min-h-[44px] rounded border px-3 py-2 text-sm sm:min-h-[32px] sm:px-2 sm:py-1 dark:border-neutral-600 dark:bg-neutral-800"
          aria-label="Sort order"
        >
          <option value="recent">Recent</option>
          <option value="priority">Priority</option>
        </select>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 px-6 py-12 text-center dark:border-neutral-600">
          <p className="font-medium text-neutral-600 dark:text-neutral-400">No items yet</p>
          <p className="mt-1 text-sm text-neutral-500">
            Click Quick Add to save a link, file, or note.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile: single column. Tablet: 2 columns. Desktop: single column (max-w-2xl) */}
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {items.map((item) => (
              <li key={item.id}>
                <div className="flex flex-col rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:shadow-md hover:-translate-y-[1px] dark:border-neutral-700 dark:bg-neutral-900 sm:flex-row sm:items-start sm:gap-2 lg:flex-col">
                  <Link
                    href={`/app/item/${item.id}`}
                    className="min-w-0 flex-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-400"
                  >
                    <div className="mb-3 aspect-video rounded-lg bg-neutral-100 dark:bg-neutral-800" aria-hidden />
                    <span className="mr-2 inline-block rounded bg-neutral-200 px-1.5 py-0.5 text-xs font-medium capitalize dark:bg-neutral-700">
                      {item.type}
                    </span>
                    {item.inbox && (
                      <span className="mr-2 inline-block rounded border border-amber-500 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                        INBOX
                      </span>
                    )}
                    <h3 className="mt-1 truncate font-medium">
                      {item.title || item.description.slice(0, 50)}
                      {!item.title && item.description.length > 50 ? '…' : ''}
                    </h3>
                    <p className="mt-0.5 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-400">
                      {item.description}
                    </p>
                    {item.tags?.length ? (
                      <TagChips tags={item.tags} basePath="/app" tagIdsFilter={tagIdsFilter} />
                    ) : null}
                    <p className="mt-1 text-xs text-neutral-500">{formatDate(item.created_at)}</p>
                  </Link>
                  <div className="mt-2 shrink-0 sm:mt-0" onClick={(e) => e.preventDefault()}>
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
                      className="min-h-[44px] min-w-[44px] rounded border px-2 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800"
                      aria-label="Priority"
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
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  <SkeletonCard />
                  <SkeletonCard />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onLoadMore}
                  className="min-h-[44px] min-w-[44px] rounded-lg border border-neutral-200 px-4 py-2 text-sm text-neutral-600 transition hover:bg-neutral-50 hover:text-foreground dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-foreground"
                  style={{ minHeight: 44 }}
                  aria-label="Load more items"
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
