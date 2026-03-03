"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { SavedSearchModal } from "@/components/saved-searches/SavedSearchModal";
import type { SavedSearch } from "@/types/saved-search";

function formatDate(s: string) {
  return new Date(s).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function SavedSearchesClient() {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SavedSearch | null>(null);

  const fetchSearches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/saved-searches");
      if (res.ok) {
        const data = await res.json();
        setSearches(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSearches();
  }, [fetchSearches]);

  async function handlePinnedChange(s: SavedSearch) {
    const res = await fetch(`/api/saved-searches/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !s.pinned }),
    });
    if (res.ok) fetchSearches();
  }

  async function handleDelete(s: SavedSearch) {
    if (!confirm(`Delete "${s.name}"?`)) return;
    const res = await fetch(`/api/saved-searches/${s.id}`, {
      method: "DELETE",
    });
    if (res.ok) fetchSearches();
  }

  const sorted = [...searches].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  return (
    <>
      <div className="mb-4">
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          className="px-4 py-2 bg-neutral-900 text-white rounded-md hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          New Saved Search
        </button>
      </div>

      {loading ? (
        <p className="text-neutral-500 py-8">Loading…</p>
      ) : sorted.length === 0 ? (
        <p className="text-neutral-500 py-8">
          No saved searches. Create one to run the same search quickly.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
          {sorted.map((s) => (
            <li key={s.id} className="py-3 flex items-center gap-2">
              <Link
                href={`/saved-searches/${s.id}`}
                className="flex-1 min-w-0 block hover:bg-neutral-50 dark:hover:bg-neutral-800/50 -mx-2 px-2 py-1 rounded"
              >
                <div className="flex items-center gap-2">
                  {s.pinned && (
                    <span className="text-amber-500" aria-label="Pinned">
                      📌
                    </span>
                  )}
                  <span className="font-medium truncate">{s.name}</span>
                </div>
                {s.query && (
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 truncate mt-0.5">
                    &ldquo;{s.query}&rdquo;
                  </p>
                )}
                <p className="text-xs text-neutral-500 mt-1">
                  Updated {formatDate(s.updated_at)}
                </p>
              </Link>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  handlePinnedChange(s);
                }}
                className="shrink-0 px-2 py-1 text-sm"
                title={s.pinned ? "Unpin" : "Pin"}
              >
                {s.pinned ? "📌" : "📍"}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setEditing(s);
                  setModalOpen(true);
                }}
                className="shrink-0 px-2 py-1 text-sm hover:underline"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete(s);
                }}
                className="shrink-0 px-2 py-1 text-sm text-red-600 hover:underline dark:text-red-400"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <SavedSearchModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSave={fetchSearches}
        initial={editing}
      />
    </>
  );
}
