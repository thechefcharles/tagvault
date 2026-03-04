'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Collection = { id: string; name: string; created_at: string };

export function CollectionsClient({ collections: initial }: { collections: Collection[] }) {
  const router = useRouter();
  const [collections, setCollections] = useState(initial);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setCollections((prev) => [...prev, data]);
        setName('');
        router.refresh();
      } else {
        setError(data.error ?? 'Failed to create');
        if (res.status === 402) setError('Upgrade required');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New collection name"
          className="flex-1 rounded border border-neutral-300 px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800"
        />
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="rounded bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Create
        </button>
      </form>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
        {collections.map((c) => (
          <li key={c.id} className="py-2">
            <Link href={`/collections/${c.id}`} className="font-medium hover:underline">
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
      {collections.length === 0 && (
        <p className="text-sm text-neutral-500">No collections yet. Create one above.</p>
      )}
    </div>
  );
}
