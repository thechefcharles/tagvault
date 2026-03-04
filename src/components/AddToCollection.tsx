'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function AddToCollection({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [collections, setCollections] = useState<{ id: string; name: string }[]>([]);
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/collections')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setCollections(Array.isArray(data) ? data : []));
  }, []);

  async function addToCollection(collectionId: string) {
    setAdding(collectionId);
    try {
      const res = await fetch(`/api/collections/${collectionId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId }),
      });
      if (res.ok) router.refresh();
    } finally {
      setAdding(null);
    }
  }

  if (collections.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Add to collection</p>
      <select
        value=""
        onChange={(e) => {
          const v = e.target.value;
          if (v) addToCollection(v);
          e.target.value = '';
        }}
        disabled={!!adding}
        className="rounded border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800"
      >
        <option value="">Choose collection…</option>
        {collections.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
