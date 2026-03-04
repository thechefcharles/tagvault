'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Tag = { id: string; name: string; slug: string; created_at: string };

export function TagsClient({ tags: initialTags }: { tags: Tag[] }) {
  const router = useRouter();
  const [tags, setTags] = useState(initialTags);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setTags((prev) => [...prev, data]);
        setName('');
        router.refresh();
      } else {
        setError(data.error ?? 'Failed to create');
        if (res.status === 402) {
          setError(data.message ?? 'Upgrade required');
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRename(id: string) {
    if (!editName.trim()) return;
    setEditingId(id);
    try {
      const res = await fetch(`/api/tags/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setTags((prev) => prev.map((t) => (t.id === id ? data : t)));
        setEditingId(null);
        setEditName('');
        router.refresh();
      }
    } finally {
      setEditingId(null);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/tags/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setTags((prev) => prev.filter((t) => t.id !== id));
        router.refresh();
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New tag name"
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
        {tags.map((t) => (
          <li key={t.id} className="flex items-center justify-between py-2">
            {editingId === t.id ? (
              <div className="flex flex-1 items-center gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 rounded border px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-800"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => handleRename(t.id)}
                  className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => { setEditingId(null); setEditName(''); }}
                  className="text-sm text-neutral-500 hover:underline"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <Link
                  href={`/app?tag_ids=${t.id}`}
                  className="font-medium hover:underline"
                >
                  {t.name}
                </Link>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setEditingId(t.id); setEditName(t.name); }}
                    className="text-sm text-neutral-500 hover:underline"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(t.id)}
                    disabled={!!deletingId}
                    className="text-sm text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      {tags.length === 0 && (
        <p className="text-sm text-neutral-500">No tags yet. Create one above.</p>
      )}
    </div>
  );
}
