'use client';

import { openExternal } from '@/lib/native/openExternal';

function formatDate(s: string) {
  return new Date(s).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

type Item = {
  id: string;
  type: string;
  title: string | null;
  description: string;
  url: string | null;
  storage_path: string | null;
  mime_type: string | null;
  created_at: string;
};

export function SharedCollectionView({
  collectionName,
  items,
  token,
}: {
  collectionName: string;
  items: Item[];
  token: string;
}) {
  async function handleDownload(itemId: string) {
    const res = await fetch(`/api/share/${token}/download/${itemId}`);
    const data = await res.json();
    if (res.ok && data.url) {
      await openExternal(data.url);
    }
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">{collectionName}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Shared collection · {items.length} item{items.length !== 1 ? 's' : ''}
        </p>
      </header>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 px-6 py-8 text-center text-neutral-500 dark:border-neutral-600">
          No items in this collection.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
          {items.map((item) => (
            <li key={item.id} className="py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <span className="inline-block rounded bg-neutral-200 px-1.5 py-0.5 text-xs capitalize dark:bg-neutral-700">
                    {item.type}
                  </span>
                  <h3 className="mt-2 font-medium">
                    {item.title || item.description.slice(0, 80)}
                    {!item.title && item.description.length > 80 ? '…' : ''}
                  </h3>
                  {item.type === 'note' && (
                    <p className="mt-1 line-clamp-3 text-sm text-neutral-600 dark:text-neutral-400">
                      {item.description}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-neutral-500">{formatDate(item.created_at)}</p>
                </div>
                <div className="shrink-0">
                  {item.type === 'link' && item.url && (
                    <button
                      type="button"
                      onClick={() => openExternal(item.url!)}
                      className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
                    >
                      Open
                    </button>
                  )}
                  {item.type === 'file' && (
                    <button
                      type="button"
                      onClick={() => handleDownload(item.id)}
                      className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
                    >
                      Download
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
