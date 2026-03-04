'use client';

import { useState } from 'react';
import { openExternal } from '@/lib/native/openExternal';

export function DownloadFileButton({ itemId }: { itemId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch(`/api/items/${itemId}/download`);
      const data = await res.json();
      if (res.ok && data.url) {
        await openExternal(data.url);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="inline-block rounded-md border border-neutral-300 px-4 py-2 hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-600 dark:hover:bg-neutral-800"
    >
      {loading ? 'Preparing…' : 'Download file'}
    </button>
  );
}
