'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getErrorMessage } from '@/lib/api/parse-error';
import { SavedSearchModal } from '@/components/saved-searches/SavedSearchModal';
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
  const [error, setError] = useState<string | null>(null);
  const [isPlanLimit, setIsPlanLimit] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

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
    [debouncedQuery, semantic],
  );

  useEffect(() => {
    // Require 2+ chars for keyword search; empty query shows recent items (RPC fallback)
    if (q.length > 0 && q.length < MIN_QUERY_LEN) {
      setItems([]);
      setNextCursor(null);
      return;
    }
    search(null, false);
  }, [debouncedQuery, semantic, search, q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          placeholder="Search items…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-w-[200px] flex-1 rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={semantic}
            onChange={(e) => setSemantic(e.target.checked)}
          />
          Semantic boost
        </label>
        <button
          type="button"
          onClick={() => setSaveModalOpen(true)}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-800"
        >
          Save this search
        </button>
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-800"
          >
            Clear
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
        }}
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
        <p className="py-8 text-neutral-500">Loading…</p>
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
                className="-mx-2 block rounded px-2 py-1 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
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
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-600 dark:hover:bg-neutral-800"
          >
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
