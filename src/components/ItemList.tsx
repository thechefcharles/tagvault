"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Item } from "@/types/item";

function formatDate(s: string) {
  return new Date(s).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ItemList({ items }: { items: Item[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const type = searchParams.get("type") ?? "all";
  const sort = searchParams.get("sort") ?? "recent";

  function setParams(updates: { type?: string; sort?: string }) {
    const params = new URLSearchParams(searchParams);
    if (updates.type !== undefined) {
      if (updates.type === "all") params.delete("type");
      else params.set("type", updates.type);
    }
    if (updates.sort !== undefined) params.set("sort", updates.sort);
    router.push(`/app?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm text-neutral-500">Type:</span>
        {["all", "note", "link", "file"].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setParams({ type: t })}
            className={`px-2 py-1 text-sm rounded ${
              type === t
                ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                : "bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700"
            }`}
          >
            {t === "all" ? "All" : t}
          </button>
        ))}
        <span className="text-sm text-neutral-500 ml-4">Sort:</span>
        <select
          value={sort}
          onChange={(e) => setParams({ sort: e.target.value })}
          className="px-2 py-1 text-sm border rounded dark:bg-neutral-800 dark:border-neutral-600"
        >
          <option value="recent">Recent</option>
          <option value="priority">Priority</option>
        </select>
      </div>

      {items.length === 0 ? (
        <p className="text-neutral-500 py-8 text-center">
          No items yet. Use Quick Add to create one.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
          {items.map((item) => (
            <li key={item.id} className="py-3">
              <Link
                href={`/app/item/${item.id}`}
                className="block hover:bg-neutral-50 dark:hover:bg-neutral-800/50 -mx-2 px-2 py-1 rounded"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="inline-block px-1.5 py-0.5 text-xs font-medium rounded bg-neutral-200 dark:bg-neutral-700 capitalize mr-2">
                      {item.type}
                    </span>
                    {item.priority != null && (
                      <span className="text-xs text-neutral-500">
                        P{item.priority}
                      </span>
                    )}
                    <h3 className="font-medium truncate mt-1">
                      {item.title || item.description.slice(0, 50)}
                      {!item.title && item.description.length > 50 ? "…" : ""}
                    </h3>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 truncate mt-0.5">
                      {item.description}
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">
                      {formatDate(item.created_at)}
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
