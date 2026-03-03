"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DownloadFileButton } from "@/components/DownloadFileButton";
import type { Item } from "@/types/item";

export function ItemDetailClient({ item }: { item: Item }) {
  const router = useRouter();
  const [title, setTitle] = useState(item.title ?? "");
  const [description, setDescription] = useState(item.description);
  const [priority, setPriority] = useState(item.priority?.toString() ?? "");
  const [url, setUrl] = useState(item.url ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload: Record<string, unknown> = {
      title: title.trim() || null,
      description: description.trim(),
      priority: priority ? Math.min(20, Math.max(1, parseInt(priority, 10))) : null,
    };
    if (item.type === "link") payload.url = url.trim() || null;

    const res = await fetch(`/api/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Failed to save");
      if (data.details?.fieldErrors) {
        setError(Object.values(data.details.fieldErrors).flat().join(", "));
      }
      return;
    }
    router.refresh();
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);

    const res = await fetch(`/api/items/${item.id}`, { method: "DELETE" });
    setDeleting(false);
    setShowDeleteConfirm(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to delete");
      return;
    }
    router.push("/app");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {item.type === "link" && item.url && (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-4 py-2 bg-neutral-900 text-white rounded-md hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Open link
        </a>
      )}

      {item.type === "file" && item.storage_path && (
        <DownloadFileButton itemId={item.id} />
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Title (optional)</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            className="w-full px-3 py-2 border border-neutral-300 rounded-md dark:border-neutral-600 dark:bg-neutral-800"
          />
        </div>

        {item.type === "link" && (
          <div>
            <label className="block text-sm font-medium mb-1">URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md dark:border-neutral-600 dark:bg-neutral-800"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Description * (12–500 chars)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            minLength={12}
            maxLength={500}
            rows={4}
            className="w-full px-3 py-2 border border-neutral-300 rounded-md dark:border-neutral-600 dark:bg-neutral-800"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Priority (optional, 1–20)</label>
          <input
            type="number"
            min={1}
            max={20}
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-24 px-3 py-2 border border-neutral-300 rounded-md dark:border-neutral-600 dark:bg-neutral-800"
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving || description.length < 12}
            className="px-4 py-2 bg-neutral-900 text-white rounded-md hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 border border-red-300 text-red-600 rounded-md hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            Delete
          </button>
        </div>
      </form>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg border bg-white p-6 dark:border-neutral-700 dark:bg-neutral-900">
            <p className="mb-4">Are you sure you want to delete this item?</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 border rounded-md"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
