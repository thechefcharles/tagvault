"use client";

import { useState, useEffect, useCallback } from "react";
import { ItemList } from "@/components/ItemList";
import { QuickAddModal } from "@/components/QuickAddModal";
import type { Item } from "@/types/item";

const DEBOUNCE_MS = 300;

export function VaultClient({ initialItems }: { initialItems: Item[] }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<string>("all");
  const [sort, setSort] = useState<string>("best_match");
  const [items, setItems] = useState<Item[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("q", debouncedQuery);
      params.set("type", type);
      params.set("sort", sort);
      const res = await fetch(`/api/search?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, type, sort]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  function handleQuickAddClose() {
    setModalOpen(false);
    fetchItems();
  }

  return (
    <>
      <div className="flex flex-wrap gap-2 items-center justify-between mb-4">
        <input
          type="search"
          placeholder="Search title & description…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 border border-neutral-300 rounded-md dark:border-neutral-600 dark:bg-neutral-800"
        />
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="px-4 py-2 bg-neutral-900 text-white rounded-md hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Quick Add
        </button>
      </div>
      <ItemList
        items={items}
        loading={loading}
        type={type}
        sort={sort}
        onTypeChange={setType}
        onSortChange={setSort}
      />
      <QuickAddModal open={modalOpen} onClose={handleQuickAddClose} />
    </>
  );
}
