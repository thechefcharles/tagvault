'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DownloadFileButton } from '@/components/DownloadFileButton';
import { openExternal } from '@/lib/native/openExternal';
import { ManageTags } from '@/components/ManageTags';
import { AddToCollection } from '@/components/AddToCollection';
import { ItemShareSection } from '@/components/share/ItemShareSection';
import { TagChips } from '@/components/TagChips';
import { Button } from '@/components/ui/Button';
import type { Item } from '@/types/item';

type ItemWithTags = Item & { tags?: { id: string; name: string; slug: string }[] };

export function ItemDetailClient({ item }: { item: ItemWithTags }) {
  const router = useRouter();
  const [title, setTitle] = useState(item.title ?? '');
  const [description, setDescription] = useState(item.description);
  const [priority, setPriority] = useState(item.priority?.toString() ?? '');
  const [url, setUrl] = useState(item.url ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [movingOut, setMovingOut] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload: Record<string, unknown> = {
      title: title.trim() || null,
      description: description.trim(),
      priority: priority ? Math.min(20, Math.max(1, parseInt(priority, 10))) : null,
    };
    if (item.type === 'link') payload.url = url.trim() || null;

    const res = await fetch(`/api/items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    setSaving(false);
    if (!res.ok) {
      setError(data.error || 'Failed to save');
      if (data.details?.fieldErrors) {
        setError(Object.values(data.details.fieldErrors).flat().join(', '));
      }
      return;
    }
    router.refresh();
  }

  async function handleMoveOutOfInbox() {
    setError(null);
    setMovingOut(true);
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          inbox: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to move to Vault');
        if (data.details?.fieldErrors?.description?.length) {
          // Focus description if validation failed
          const textarea = document.querySelector<HTMLTextAreaElement>('textarea');
          textarea?.focus();
        }
        return;
      }
      router.refresh();
    } finally {
      setMovingOut(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);

    const res = await fetch(`/api/items/${item.id}`, { method: 'DELETE' });
    setDeleting(false);
    setShowDeleteConfirm(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Failed to delete');
      return;
    }
    router.push('/app');
    router.refresh();
  }

  return (
    <div className="min-h-screen overflow-y-auto pb-safe">
      <div className="space-y-6 safe-area-bottom">
        {item.type === 'link' && item.url && (
          <Button
            type="button"
            variant="primary"
            onClick={() => openExternal(item.url!)}
          >
            Open link
          </Button>
        )}

      {item.type === 'file' && item.storage_path && <DownloadFileButton itemId={item.id} />}

      <ItemShareSection itemId={item.id} />

      {item.tags && item.tags.length > 0 && (
        <div>
          <p className="mb-1 text-sm font-medium">Tags</p>
          <TagChips tags={item.tags} />
        </div>
      )}
      <ManageTags itemId={item.id} initialTags={item.tags ?? []} />
      <AddToCollection itemId={item.id} />

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Title (optional)</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800"
          />
        </div>

        {item.type === 'link' && (
          <div>
            <label className="mb-1 block text-sm font-medium">URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800"
            />
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium">Description * (12–500 chars)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            minLength={12}
            maxLength={500}
            rows={4}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Priority (optional, 1–20)</label>
          <input
            type="number"
            min={1}
            max={20}
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-24 rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800"
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="submit"
            disabled={saving || description.length < 12}
            className="min-h-[44px] touch-manipulation rounded-md bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {item.inbox && (
            <Button
              type="button"
              variant="success"
              onClick={handleMoveOutOfInbox}
              disabled={movingOut || description.trim().length < 12}
            >
              {movingOut ? 'Moving…' : 'Move to Vault'}
            </Button>
          )}
          <Button type="button" variant="danger" onClick={() => setShowDeleteConfirm(true)}>
            Delete
          </Button>
        </div>
      </form>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg border bg-white p-6 dark:border-neutral-700 dark:bg-neutral-900">
            <p className="mb-4">Are you sure you want to delete this item?</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="min-h-[44px] touch-manipulation rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
