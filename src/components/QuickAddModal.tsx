"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Tab = "note" | "link" | "file";

export function QuickAddModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("note");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [priority, setPriority] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function reset() {
    setTitle("");
    setDescription("");
    setUrl("");
    setPriority("");
    setFile(null);
    setError(null);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (tab === "file") {
        if (!file || !description.trim()) {
          setError("File and description are required");
          setLoading(false);
          return;
        }
        if (description.length < 12) {
          setError("Description must be at least 12 characters");
          setLoading(false);
          return;
        }
        const formData = new FormData();
        formData.set("file", file);
        formData.set("description", description.trim());
        if (title.trim()) formData.set("title", title.trim());
        if (priority) formData.set("priority", priority);

        const res = await fetch("/api/items/upload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Upload failed");
          setLoading(false);
          return;
        }
      } else {
        if (description.length < 12 || description.length > 500) {
          setError("Description must be 12–500 characters");
          setLoading(false);
          return;
        }
        if (tab === "link" && !url.trim()) {
          setError("URL is required for links");
          setLoading(false);
          return;
        }

        const res = await fetch("/api/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: tab,
            title: title.trim() || null,
            description: description.trim(),
            priority: priority ? Math.min(20, Math.max(1, parseInt(priority, 10))) : null,
            url: tab === "link" ? url.trim() : null,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to create");
          if (data.details) {
            setError(
              Object.values(data.details.fieldErrors || {}).flat().join(", ")
            );
          }
          setLoading(false);
          return;
        }
      }

      reset();
      onClose();
      router.refresh();
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">Quick Add</h2>

        <div className="flex gap-2 mb-4 border-b border-neutral-200 dark:border-neutral-700">
          {(["note", "link", "file"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-sm font-medium capitalize ${
                tab === t
                  ? "border-b-2 border-neutral-900 dark:border-neutral-100 text-foreground"
                  : "text-neutral-500 hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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

          {tab === "link" && (
            <div>
              <label className="block text-sm font-medium mb-1">URL *</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required={tab === "link"}
                placeholder="https://..."
                className="w-full px-3 py-2 border border-neutral-300 rounded-md dark:border-neutral-600 dark:bg-neutral-800"
              />
            </div>
          )}

          {tab === "file" && (
            <div>
              <label className="block text-sm font-medium mb-1">File *</label>
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required={tab === "file"}
                className="w-full text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Description * (min 12 chars)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              minLength={12}
              maxLength={500}
              rows={3}
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

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => { reset(); onClose(); }}
              className="px-4 py-2 border border-neutral-300 rounded-md dark:border-neutral-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-neutral-900 text-white rounded-md hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              {loading ? "Saving…" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
