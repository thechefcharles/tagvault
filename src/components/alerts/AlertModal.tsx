"use client";

import { useState, useEffect } from "react";
import type { SavedSearch } from "@/types/saved-search";

export type Alert = {
  id: string;
  saved_search_id: string;
  name: string;
  frequency_minutes: number;
  enabled: boolean;
  notify_on_new: boolean;
  last_run_at: string | null;
  next_run_at: string;
  saved_searches?: { id: string; name: string; query?: string } | null;
};

const FREQUENCY_OPTIONS = [
  { value: 15, label: "Every 15 min" },
  { value: 30, label: "Every 30 min" },
  { value: 60, label: "Every hour" },
  { value: 240, label: "Every 4 hours" },
  { value: 1440, label: "Daily" },
];

export function AlertModal({
  open,
  onClose,
  onSave,
  initial,
  savedSearches,
  presetSavedSearchId,
}: {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  initial?: Alert | null;
  savedSearches: SavedSearch[];
  presetSavedSearchId?: string;
}) {
  const [name, setName] = useState("");
  const [savedSearchId, setSavedSearchId] = useState("");
  const [frequencyMinutes, setFrequencyMinutes] = useState(60);
  const [enabled, setEnabled] = useState(true);
  const [notifyOnNew, setNotifyOnNew] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initial) {
      setName(initial.name);
      setSavedSearchId(initial.saved_search_id);
      setFrequencyMinutes(initial.frequency_minutes);
      setEnabled(initial.enabled);
      setNotifyOnNew(initial.notify_on_new);
    } else {
      setName("");
      setSavedSearchId(presetSavedSearchId ?? savedSearches[0]?.id ?? "");
      setFrequencyMinutes(60);
      setEnabled(true);
      setNotifyOnNew(true);
    }
    setError(null);
  }, [initial, savedSearches, presetSavedSearchId, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const url = initial ? `/api/alerts/${initial.id}` : "/api/alerts";
      const method = initial ? "PATCH" : "POST";
      const body = initial
        ? { name, frequency_minutes: frequencyMinutes, enabled, notify_on_new: notifyOnNew }
        : {
            saved_search_id: savedSearchId,
            name,
            frequency_minutes: frequencyMinutes,
            enabled,
            notify_on_new: notifyOnNew,
          };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save");
      }
      onSave();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">
          {initial ? "Edit alert" : "Create alert"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md dark:border-neutral-600 dark:bg-neutral-800"
              placeholder="e.g. New notes"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Saved search</label>
            <select
              value={savedSearchId}
              onChange={(e) => setSavedSearchId(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md dark:border-neutral-600 dark:bg-neutral-800"
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
          <div>
            <label className="block text-sm font-medium mb-1">Frequency</label>
            <select
              value={frequencyMinutes}
              onChange={(e) => setFrequencyMinutes(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md dark:border-neutral-600 dark:bg-neutral-800"
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
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
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
              className="px-4 py-2 bg-neutral-900 text-white rounded-md hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200 disabled:opacity-50"
            >
              {loading ? "Saving…" : initial ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
