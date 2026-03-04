'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Tag } from '@/types/item';

export function ManageTags({
  itemId,
  initialTags,
}: {
  itemId: string;
  initialTags: Tag[];
}) {
  const router = useRouter();
  const [tags, setTags] = useState<Tag[]>(initialTags);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/tags')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setAllTags(Array.isArray(data) ? data : []));
  }, []);

  async function addTag(tagId: string) {
    setAdding(tagId);
    try {
      const res = await fetch(`/api/items/${itemId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_ids: [...tags.map((t) => t.id), tagId] }),
      });
      if (res.ok) {
        const data = await res.json();
        setTags(data.tags ?? []);
        router.refresh();
      }
    } finally {
      setAdding(null);
    }
  }

  async function removeTag(tagId: string) {
    try {
      const res = await fetch(`/api/items/${itemId}/tags`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_id: tagId }),
      });
      if (res.ok) {
        setTags((prev) => prev.filter((t) => t.id !== tagId));
        router.refresh();
      }
    } catch {
      // ignore
    }
  }

  const availableTags = allTags.filter((t) => !tags.some((x) => x.id === t.id));

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Tags</p>
      <div className="flex flex-wrap items-center gap-2">
        {tags.map((t) => (
          <span
            key={t.id}
            className="group flex items-center gap-1 rounded bg-neutral-200 px-2 py-0.5 text-sm dark:bg-neutral-700"
          >
            {t.name}
            <button
              type="button"
              onClick={() => removeTag(t.id)}
              className="ml-0.5 text-neutral-500 hover:text-red-600 dark:text-neutral-400 dark:hover:text-red-400"
              aria-label={`Remove ${t.name}`}
            >
              ×
            </button>
          </span>
        ))}
        {availableTags.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              const v = e.target.value;
              if (v) addTag(v);
              e.target.value = '';
            }}
            disabled={!!adding}
            className="rounded border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-800"
          >
            <option value="">Add tag…</option>
            {availableTags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </div>
      {allTags.length === 0 && tags.length === 0 && (
        <p className="text-xs text-neutral-500">Create tags in the Tags page first.</p>
      )}
    </div>
  );
}
