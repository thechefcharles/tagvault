"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { SavedSearchModal } from "@/components/saved-searches/SavedSearchModal";
import type { Item } from "@/types/item";

const DEBOUNCE_MS = 350;

function formatDate(s: string) {
  return new Date(s).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function SearchClient() {
  const [query, setQuery] = useState("");
  const [semantic, setSemantic] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [saveModalOpen, setSaveModalOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const search = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("q", debouncedQuery);
      params.set("semantic", String(semantic));
      const res = await fetch(`/api/search?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, semantic]);

  useEffect(() => {
    search();
  }, [search]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-center">
        <input
          type="search"
          placeholder="Search items…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 border border-neutral-300 rounded-md dark:border-neutral-600 dark:bg-neutral-800"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={semantic}
            onChange={(e) => setSemantic(e.target.checked)}
          />
          Semantic boost
        </label>
        <button
          type="button"
          onClick={() => setSaveModalOpen(true)}
          className="px-3 py-2 text-sm border border-neutral-300 rounded-md hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-800"
        >
          Save this search
        </button>
      </div>
      <SavedSearchModal
        open={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        onSave={() => setSaveModalOpen(false)}
        preset={{
          name: debouncedQuery.slice(0, 50) || undefined,
          query: debouncedQuery,
          semantic_enabled: semantic,
        }}
      />

      {loading ? (
        <p className="text-neutral-500 py-8">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-neutral-500 py-8">
          {debouncedQuery ? "No results found." : "Enter a search query."}
        </p>
      ) : (
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
          {items.map((item) => (
            <li key={item.id} className="py-3">
              <Link
                href={`/app/item/${item.id}`}
                className="block hover:bg-neutral-50 dark:hover:bg-neutral-800/50 -mx-2 px-2 py-1 rounded"
              >
                <span className="inline-block px-1.5 py-0.5 text-xs font-medium rounded bg-neutral-200 dark:bg-neutral-700 capitalize mr-2">
                  {item.type}
                </span>
                <h3 className="font-medium mt-1">
                  {item.title || item.description.slice(0, 60)}
                  {!item.title && item.description.length > 60 ? "…" : ""}
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-0.5 line-clamp-2">
                  {item.description}
                </p>
                <p className="text-xs text-neutral-500 mt-1">
                  {formatDate(item.created_at)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
