'use client';

import Link from 'next/link';
import type { Tag } from '@/types/item';

export function TagChips({
  tags,
  basePath,
  tagIdsFilter,
}: {
  tags: Tag[];
  basePath?: string;
  tagIdsFilter?: string[];
}) {
  if (!tags.length) return null;

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {tags.map((t) => {
        const isActive = tagIdsFilter?.includes(t.id);
        if (basePath) {
          return (
            <Link
              key={t.id}
              href={isActive ? basePath : `${basePath}?tag_ids=${encodeURIComponent(t.id)}`}
              className={`rounded px-1.5 py-0.5 text-xs ${isActive ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900' : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600'}`}
            >
              {t.name}
            </Link>
          );
        }
        return (
          <span
            key={t.id}
            className="rounded bg-neutral-200 px-1.5 py-0.5 text-xs dark:bg-neutral-700"
          >
            {t.name}
          </span>
        );
      })}
    </div>
  );
}
