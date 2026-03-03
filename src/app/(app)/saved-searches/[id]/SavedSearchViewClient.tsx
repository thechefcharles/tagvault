'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { SavedSearchModal } from '@/components/saved-searches/SavedSearchModal';
import { AlertModal } from '@/components/alerts/AlertModal';
import type { SavedSearch } from '@/types/saved-search';
import type { Item } from '@/types/item';

function formatDate(s: string) {
  return new Date(s).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function SavedSearchViewClient({ saved }: { saved: SavedSearch }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);

  useEffect(() => {
    fetch('/api/saved-searches')
      .then((res) => (res.ok ? res.json() : []))
      .then(setSavedSearches);
  }, []);

  useEffect(() => {
    async function run() {
      setLoading(true);
      try {
        const res = await fetch(`/api/saved-searches/${saved.id}/run`);
        if (res.ok) {
          const data = await res.json();
          setItems(data);
        }
      } finally {
        setLoading(false);
      }
    }
    run();
  }, [saved.id]);

  return (
    <>
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2">
          <h1 className="text-xl font-semibold">{saved.name}</h1>
          <button
            type="button"
            onClick={() => setEditModalOpen(true)}
            className="text-sm text-neutral-600 hover:underline dark:text-neutral-400"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setAlertModalOpen(true)}
            className="text-sm text-neutral-600 hover:underline dark:text-neutral-400"
          >
            Create alert
          </button>
        </div>
        {saved.query && (
          <p className="text-neutral-600 dark:text-neutral-400">
            Query: &ldquo;{saved.query}&rdquo;
          </p>
        )}
      </div>

      {loading ? (
        <p className="py-8 text-neutral-500">Loading results…</p>
      ) : items.length === 0 ? (
        <p className="py-8 text-neutral-500">No results found.</p>
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

      <SavedSearchModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSave={() => window.location.reload()}
        initial={saved}
      />
      <AlertModal
        open={alertModalOpen}
        onClose={() => setAlertModalOpen(false)}
        onSave={() => {}}
        initial={null}
        savedSearches={savedSearches}
        presetSavedSearchId={saved.id}
      />
    </>
  );
}
