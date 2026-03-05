'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getErrorMessage } from '@/lib/api/parse-error';
import { SavedSearchModal } from '@/components/saved-searches/SavedSearchModal';
import { AlertModal } from '@/components/alerts/AlertModal';
import { SearchBar } from '@/components/search/SearchBar';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Item } from '@/types/item';

const DEBOUNCE_MS = 350;
const MIN_QUERY_LEN = 2;

function formatDate(s: string) {
  return new Date(s).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function SearchClient() {
  const [query, setQuery] = useState('');
  const [semantic, setSemantic] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlanLimit, setIsPlanLimit] = useState(false);
  const [tags, setTags] = useState<{ id: string; name: string }[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    fetch('/api/tags')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setTags(Array.isArray(data) ? data : []));
  }, []);

  const q = debouncedQuery.trim();

  const search = useCallback(
    async (cursor?: string | null, append = false) => {
      setLoading(true);
      setError(null);
      setIsPlanLimit(false);
      try {
        const params = new URLSearchParams();
        params.set('q', debouncedQuery);
        params.set('semantic', String(semantic));
        if (cursor) params.set('cursor', cursor);
        if (selectedTagIds.length) params.set('tag_ids', selectedTagIds.join(','));
        const res = await fetch(`/api/search?${params.toString()}`, {
          credentials: 'include',
        });
        if (res.status === 401) {
          window.location.href = '/login';
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          const list = Array.isArray(data) ? data : (data.items ?? []);
          const nc = data?.nextCursor ?? null;
          setItems(append ? (prev) => [...prev, ...list] : list);
          setNextCursor(nc);
        } else {
          if (!append) {
            setItems([]);
            setNextCursor(null);
          }
          if (res.status === 402) {
            setError(getErrorMessage(data, 'Search limit reached.'));
            setIsPlanLimit(true);
          }
        }
      } finally {
        setLoading(false);
      }
    },
    [debouncedQuery, semantic, selectedTagIds],
  );

  useEffect(() => {
    // Require 2+ chars for keyword search; empty query shows recent items (RPC fallback)
    if (q.length > 0 && q.length < MIN_QUERY_LEN) {
      setItems([]);
      setNextCursor(null);
      return;
    }
    search(null, false);
  }, [debouncedQuery, semantic, selectedTagIds, search, q]);

  return (
    <div className="space-y-4">
      <SearchBar
        value={query}
        onChange={setQuery}
        onClear={() => setQuery('')}
        placeholder="Search items…"
        autoFocus
      />
      <div className="flex flex-wrap items-center gap-2">
        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-sm text-neutral-500">Tags:</span>
            {tags.map((t) => {
              const active = selectedTagIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() =>
                    setSelectedTagIds((prev) =>
                      active ? prev.filter((id) => id !== t.id) : [...prev, t.id],
                    )
                  }
                  className={`min-h-[44px] min-w-[44px] touch-manipulation rounded px-3 py-2 text-xs sm:min-h-0 sm:min-w-0 sm:px-2 sm:py-0.5 ${
                    active
                      ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                      : 'bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-700 dark:hover:bg-neutral-600'
                  }`}
                >
                  {t.name}
                </button>
              );
            })}
          </div>
        )}
        <label className="flex min-h-[44px] touch-manipulation items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={semantic}
            onChange={(e) => setSemantic(e.target.checked)}
            className="h-4 w-4"
          />
          Semantic boost
        </label>
        <button
          type="button"
          onClick={() => setSaveModalOpen(true)}
          className="min-h-[44px] touch-manipulation rounded-xl border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-800"
        >
          Save this search
        </button>
        {selectedTagIds.length > 0 && (
          <button
            type="button"
            onClick={() => setAlertModalOpen(true)}
            className="min-h-[44px] touch-manipulation rounded-xl border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-800"
          >
            Create alert for these tags
          </button>
        )}
      </div>
      <SavedSearchModal
        open={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        onSave={() => setSaveModalOpen(false)}
        preset={{
          name: debouncedQuery.slice(0, 50) || undefined,
          query: debouncedQuery,
          semantic_enabled: semantic,
          filters: selectedTagIds.length ? { tag_ids: selectedTagIds } : {},
        }}
      />
      <AlertModal
        open={alertModalOpen}
        onClose={() => setAlertModalOpen(false)}
        onSave={() => setAlertModalOpen(false)}
        savedSearches={[]}
        presetSource={
          selectedTagIds.length
            ? {
                type: 'tag_filter',
                tagIds: selectedTagIds,
                tagNames: tags.filter((t) => selectedTagIds.includes(t.id)).map((t) => t.name),
              }
            : undefined
        }
      />

      {error && (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          <p>{error}</p>
          {isPlanLimit && (
            <Link
              href="/pricing"
              className="mt-2 inline-block font-medium underline"
            >
              Upgrade to Pro →
            </Link>
          )}
        </div>
      )}
      {loading && items.length === 0 ? (
        <div className="space-y-3 py-4">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-8 text-neutral-500">
          {q.length > 0 && q.length < MIN_QUERY_LEN
            ? `Type at least ${MIN_QUERY_LEN} characters to search.`
            : 'No results found.'}
        </p>
      ) : (
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
          {items.map((item) => (
            <li key={item.id} className="py-3">
              <Link
                href={`/app/item/${item.id}`}
                className="-mx-2 block min-h-[44px] rounded-lg px-2 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
              >
                <span className="mr-2 inline-block rounded bg-neutral-200 px-1.5 py-0.5 text-xs font-medium capitalize dark:bg-neutral-700">
                  {item.type}
                </span>
                <h3 className="mt-1 font-medium">
                  {item.title || item.description.slice(0, 60)}
                  {!item.title && item.description.length > 60 ? '…' : ''}
                </h3>
                <p className="mt-0.5 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-400">
                  {item.description}
                </p>
                <p className="mt-1 text-xs text-neutral-500">{formatDate(item.created_at)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {items.length > 0 && nextCursor && (
        <div className="pt-4">
          <button
            type="button"
            onClick={() => search(nextCursor, true)}
            disabled={loading}
            className="min-h-[44px] touch-manipulation rounded-xl border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-600 dark:hover:bg-neutral-800"
          >
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
