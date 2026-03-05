'use client';

import { useRef, useEffect } from 'react';
import Link from 'next/link';

export function SearchBar({
  value,
  onChange,
  onClear,
  placeholder = 'Search items…',
  autoFocus = true,
}: {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
      <div className="flex min-w-0 flex-1 gap-2">
        <input
          ref={inputRef}
          type="search"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-12 min-w-0 flex-1 rounded-xl border border-neutral-300 px-4 text-base dark:border-neutral-600 dark:bg-neutral-800"
          aria-label="Search items"
        />
        {value.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="min-h-[44px] min-w-[44px] shrink-0 touch-manipulation rounded-xl border border-neutral-200 px-3 text-sm text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
            aria-label="Clear search"
          >
            Clear
          </button>
        )}
      </div>
      <Link
        href="/app"
        className="flex min-h-[44px] min-w-[44px] touch-manipulation items-center justify-center rounded-xl border border-neutral-200 px-4 py-3 text-sm font-medium transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800 sm:shrink-0"
        aria-label="Close search and go to Vault"
      >
        Close
      </Link>
    </div>
  );
}
