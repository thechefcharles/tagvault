'use client';

import { useState, useEffect } from 'react';
import { getErrorMessage } from '@/lib/api/parse-error';
import type { SavedSearch } from '@/types/saved-search';

type SortOption = 'best_match' | 'priority' | 'recent';

type Preset = Partial<
  Pick<SavedSearch, 'name' | 'query' | 'sort' | 'semantic_enabled' | 'pinned' | 'filters'>
>;

export function SavedSearchModal({
  open,
  onClose,
  onSave,
  initial,
  preset,
}: {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  initial?: SavedSearch | null;
  preset?: Preset | null;
}) {
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortOption>('best_match');
  const [semanticEnabled, setSemanticEnabled] = useState(true);
  const [pinned, setPinned] = useState(false);
  const [filtersJson, setFiltersJson] = useState('{}');
  const [filtersError, setFiltersError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initial) {
      setName(initial.name);
      setQuery(initial.query ?? '');
      setSort((initial.sort as SortOption) ?? 'best_match');
      setSemanticEnabled(initial.semantic_enabled ?? true);
      setPinned(initial.pinned ?? false);
      setFiltersJson(JSON.stringify(initial.filters ?? {}, null, 2));
    } else if (preset) {
      setName(preset.name ?? preset.query?.slice(0, 50) ?? '');
      setQuery(preset.query ?? '');
      setSort((preset.sort as SortOption) ?? 'best_match');
      setSemanticEnabled(preset.semantic_enabled ?? true);
      setPinned(preset.pinned ?? false);
      setFiltersJson(JSON.stringify(preset.filters ?? {}, null, 2));
    } else {
      setName('');
      setQuery('');
      setSort('best_match');
      setSemanticEnabled(true);
      setPinned(false);
      setFiltersJson('{}');
    }
    setFiltersError(null);
    setError(null);
  }, [initial, preset, open]);

  function parseFilters(): Record<string, unknown> | null {
    try {
      const parsed = JSON.parse(filtersJson || '{}');
      if (typeof parsed !== 'object' || parsed === null) return {};
      return parsed as Record<string, unknown>;
    } catch {
      setFiltersError('Invalid JSON');
      return null;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFiltersError(null);

    const filters = parseFilters();
    if (filters === null) return;

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setLoading(true);
    try {
      const url = initial ? `/api/saved-searches/${initial.id}` : '/api/saved-searches';
      const method = initial ? 'PATCH' : 'POST';
      const body = initial
        ? { name: name.trim(), query, filters, sort, semantic_enabled: semanticEnabled, pinned }
        : {
            name: name.trim(),
            query,
            filters,
            sort,
            semantic_enabled: semanticEnabled,
            pinned,
          };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(getErrorMessage(data, 'Failed to save'));
        setLoading(false);
        return;
      }
      onSave();
      onClose();
    } finally {
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
        <h2 className="mb-4 text-lg font-semibold">
          {initial ? 'Edit Saved Search' : 'New Saved Search'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={200}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Query</label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search terms…"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Sort</label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="w-full rounded-md border px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800"
            >
              <option value="best_match">Best match</option>
              <option value="priority">Priority</option>
              <option value="recent">Most recent</option>
            </select>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={semanticEnabled}
                onChange={(e) => setSemanticEnabled(e.target.checked)}
              />
              Semantic boost
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
              />
              Pinned
            </label>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Filters (JSON, optional)</label>
            <textarea
              value={filtersJson}
              onChange={(e) => {
                setFiltersJson(e.target.value);
                setFiltersError(null);
              }}
              rows={3}
              className="w-full rounded-md border px-3 py-2 font-mono text-sm dark:border-neutral-600 dark:bg-neutral-800"
              placeholder='{"type": ["note"], "tags": []}'
            />
            {filtersError && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{filtersError}</p>
            )}
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border px-4 py-2 dark:border-neutral-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              {loading ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
