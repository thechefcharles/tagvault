'use client';

import { useState } from 'react';
import Link from 'next/link';

type ImportResult = {
  ok: boolean;
  mode?: string;
  imported?: Record<string, number>;
  error?: string;
};

export function DataSettingsClient({ isOwner }: { isOwner: boolean }) {
  const [importing, setImporting] = useState(false);
  const [replaceMode, setReplaceMode] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleExport = () => {
    window.open('/api/export', '_blank');
    setMessage({ type: 'success', text: 'Export started. Your file will download shortly.' });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setMessage(null);
    try {
      const text = await file.text();
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(text);
      } catch {
        setMessage({ type: 'error', text: 'Invalid JSON file' });
        setImporting(false);
        e.target.value = '';
        return;
      }
      if (replaceMode) body.mode = 'replace';

      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as ImportResult;

      if (!res.ok) {
        setMessage({
          type: 'error',
          text: data.error ?? `Import failed (${res.status})`,
        });
        setImporting(false);
        e.target.value = '';
        return;
      }

      const counts = data.imported
        ? `Items: ${data.imported.items ?? 0}, Tags: ${data.imported.tags ?? 0}, Collections: ${data.imported.collections ?? 0}`
        : '';
      setMessage({
        type: 'success',
        text: `Import complete. ${counts}`,
      });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Import failed',
      });
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-2 text-lg font-medium">Export</h2>
        <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
          Download all your items, tags, collections, saved searches, alerts, and notification preferences as a JSON
          file. Share tokens and billing data are not included.
        </p>
        <button
          type="button"
          onClick={handleExport}
          className="rounded-md bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Export JSON
        </button>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Import</h2>
        <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
          Import from a TagVault export file. Merge mode adds new data without removing existing; Replace mode
          (owner-only) deletes existing data first.
        </p>

        {isOwner && (
          <label className="mb-4 flex items-center gap-2">
            <input
              type="checkbox"
              checked={replaceMode}
              onChange={(e) => setReplaceMode(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">
              Replace mode (deletes all existing data in this org before import)
            </span>
          </label>
        )}
        {replaceMode && isOwner && (
          <p className="mb-4 text-sm font-medium text-amber-600 dark:text-amber-400">
            Warning: Replace mode will permanently delete all items, tags, collections, saved searches, and alerts in
            this organization.
          </p>
        )}

        <label className="inline-block cursor-pointer rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-900 dark:hover:bg-neutral-800">
          <input
            type="file"
            accept=".json,application/json"
            onChange={handleImport}
            disabled={importing}
            className="hidden"
          />
          {importing ? 'Importing…' : 'Choose file to import'}
        </label>
      </section>

      {message && (
        <div
          className={`rounded-md px-4 py-2 text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-200'
              : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <Link href="/app" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
        ← Back to Vault
      </Link>
    </div>
  );
}
