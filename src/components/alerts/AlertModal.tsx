'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getErrorMessage } from '@/lib/api/parse-error';
import type { SavedSearch } from '@/types/saved-search';

export type Alert = {
  id: string;
  saved_search_id: string | null;
  source_type?: 'saved_search' | 'collection' | 'tag_filter';
  source_id?: string | null;
  tag_ids?: string[] | null;
  name: string;
  frequency_minutes: number;
  enabled: boolean;
  notify_on_new: boolean;
  last_run_at: string | null;
  next_run_at: string;
  saved_searches?: { id: string; name: string; query?: string } | null;
};

export type AlertPresetSource =
  | { type: 'saved_search'; savedSearchId: string }
  | { type: 'collection'; collectionId: string; collectionName: string }
  | { type: 'tag_filter'; tagIds: string[]; tagNames?: string[] };

const FREQUENCY_OPTIONS = [
  { value: 15, label: 'Every 15 min' },
  { value: 30, label: 'Every 30 min' },
  { value: 60, label: 'Every hour' },
  { value: 240, label: 'Every 4 hours' },
  { value: 1440, label: 'Daily' },
];

export function AlertModal({
  open,
  onClose,
  onSave,
  initial,
  savedSearches,
  presetSavedSearchId,
  presetSource,
}: {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  initial?: Alert | null;
  savedSearches: SavedSearch[];
  presetSavedSearchId?: string;
  presetSource?: AlertPresetSource;
}) {
  const [name, setName] = useState('');
  const [savedSearchId, setSavedSearchId] = useState('');
  const [frequencyMinutes, setFrequencyMinutes] = useState(60);
  const [enabled, setEnabled] = useState(true);
  const [notifyOnNew, setNotifyOnNew] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlanLimit, setIsPlanLimit] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initial) {
      setName(initial.name);
      setSavedSearchId(initial.saved_search_id ?? presetSavedSearchId ?? savedSearches[0]?.id ?? '');
      setFrequencyMinutes(initial.frequency_minutes);
      setEnabled(initial.enabled);
      setNotifyOnNew(initial.notify_on_new);
    } else {
      let defaultName = '';
      if (presetSource?.type === 'collection') defaultName = `New in ${presetSource.collectionName}`;
      else if (presetSource?.type === 'tag_filter' && presetSource.tagNames?.length)
        defaultName = `Items tagged ${presetSource.tagNames.slice(0, 2).join(', ')}${presetSource.tagNames.length > 2 ? '…' : ''}`;
      else if (presetSource?.type === 'tag_filter') defaultName = `${presetSource.tagIds.length} tags`;
      setName(defaultName);
      setSavedSearchId(presetSavedSearchId ?? savedSearches[0]?.id ?? '');
      setFrequencyMinutes(60);
      setEnabled(true);
      setNotifyOnNew(true);
    }
    setError(null);
    setIsPlanLimit(false);
  }, [initial, savedSearches, presetSavedSearchId, presetSource, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const url = initial ? `/api/alerts/${initial.id}` : '/api/alerts';
      const method = initial ? 'PATCH' : 'POST';
      let body: Record<string, unknown>;
      if (initial) {
        body = { name, frequency_minutes: frequencyMinutes, enabled, notify_on_new: notifyOnNew };
      } else if (presetSource?.type === 'collection') {
        body = {
          source_type: 'collection',
          source_id: presetSource.collectionId,
          name,
          frequency_minutes: frequencyMinutes,
          enabled,
          notify_on_new: notifyOnNew,
        };
      } else if (presetSource?.type === 'tag_filter') {
        body = {
          source_type: 'tag_filter',
          tag_ids: presetSource.tagIds,
          name,
          frequency_minutes: frequencyMinutes,
          enabled,
          notify_on_new: notifyOnNew,
        };
      } else {
        body = {
          source_type: 'saved_search',
          saved_search_id: savedSearchId,
          source_id: savedSearchId,
          name,
          frequency_minutes: frequencyMinutes,
          enabled,
          notify_on_new: notifyOnNew,
        };
      }
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(getErrorMessage(data, 'Failed to save'));
        setIsPlanLimit(res.status === 402);
        setLoading(false);
        return;
      }
      onSave();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold">{initial ? 'Edit alert' : 'Create alert'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800"
              placeholder="e.g. New notes"
              required
            />
          </div>
          {!presetSource ? (
            <div>
              <label className="mb-1 block text-sm font-medium">Saved search</label>
              <select
                value={savedSearchId}
                onChange={(e) => setSavedSearchId(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800"
                disabled={!!initial}
                required
              >
                <option value="">Select…</option>
                {savedSearches.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          ) : presetSource.type === 'collection' ? (
            <div>
              <label className="mb-1 block text-sm font-medium">Source</label>
              <p className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800">
                Collection: {presetSource.collectionName}
              </p>
            </div>
          ) : presetSource.type === 'tag_filter' ? (
            <div>
              <label className="mb-1 block text-sm font-medium">Source</label>
              <p className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800">
                {presetSource.tagNames?.length
                  ? `Tags: ${presetSource.tagNames.join(', ')}`
                  : `${presetSource.tagIds.length} tag${presetSource.tagIds.length !== 1 ? 's' : ''} selected`}
              </p>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-sm font-medium">Saved search</label>
              <select
                value={savedSearchId}
                onChange={(e) => setSavedSearchId(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800"
                disabled={!!initial}
                required
              >
                <option value="">Select…</option>
                {savedSearches.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium">Frequency</label>
            <select
              value={frequencyMinutes}
              onChange={(e) => setFrequencyMinutes(parseInt(e.target.value, 10))}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800"
            >
              {FREQUENCY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="enabled" className="text-sm">
              Enabled
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="notifyOnNew"
              checked={notifyOnNew}
              onChange={(e) => setNotifyOnNew(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="notifyOnNew" className="text-sm">
              Notify when new items match
            </label>
          </div>
          {error && (
            <div>
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              {isPlanLimit && (
                <Link
                  href="/pricing"
                  className="mt-2 inline-block text-sm font-medium underline"
                >
                  Upgrade to Pro →
                </Link>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-neutral-600 hover:text-foreground dark:text-neutral-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              {loading ? 'Saving…' : initial ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
