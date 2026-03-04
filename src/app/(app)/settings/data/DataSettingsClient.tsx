'use client';

import { useState } from 'react';
import Link from 'next/link';

type Backup = {
  id: string;
  created_at: string;
  size_bytes: number | null;
  status: string;
};

type ImportResult = {
  ok: boolean;
  mode?: string;
  imported?: Record<string, number>;
  error?: string;
};

export function DataSettingsClient({
  isOwner,
  backupsEnabled,
  backups,
}: {
  isOwner: boolean;
  backupsEnabled: boolean;
  backups: Backup[];
}) {
  const [importing, setImporting] = useState(false);
  const [replaceMode, setReplaceMode] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [restoreReplaceId, setRestoreReplaceId] = useState<string | null>(null);
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

  const handleRestore = async (backupId: string, mode: 'merge' | 'replace') => {
    if (mode === 'replace' && !isOwner) return;
    setRestoring(backupId);
    setMessage(null);
    try {
      const res = await fetch(`/api/backups/${backupId}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const data = (await res.json()) as ImportResult & { imported?: Record<string, number> };
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error ?? `Restore failed (${res.status})` });
        return;
      }
      const counts = data.imported
        ? `Items: ${data.imported.items ?? 0}, Tags: ${data.imported.tags ?? 0}`
        : '';
      setMessage({ type: 'success', text: `Restore complete (${mode}). ${counts}` });
      setRestoreReplaceId(null);
      window.location.reload();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Restore failed' });
    } finally {
      setRestoring(null);
    }
  };

  const formatSize = (bytes: number | null) => {
    if (bytes == null) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

      <section>
        <h2 className="mb-2 text-lg font-medium">Backups</h2>
        {!backupsEnabled ? (
          <>
            <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
              Automated nightly backups are available for Pro and Team plans. Upgrade to keep up to 30 (Pro) or 90
              (Team) restore points.
            </p>
            <Link
              href="/pricing"
              className="inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              Upgrade to Pro
            </Link>
          </>
        ) : (
          <>
            <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
              Nightly backups are created automatically. Download or restore from a backup below.
            </p>
            {backups.length === 0 ? (
              <p className="text-sm text-neutral-500">No backups yet. Run the nightly cron or wait for the next run.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-neutral-200 dark:border-neutral-700">
                <table className="min-w-full text-sm">
                  <thead className="bg-neutral-50 dark:bg-neutral-800/50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Date</th>
                      <th className="px-4 py-2 text-left font-medium">Size</th>
                      <th className="px-4 py-2 text-left font-medium">Status</th>
                      <th className="px-4 py-2 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backups.map((b) => (
                      <tr key={b.id} className="border-t border-neutral-200 dark:border-neutral-700">
                        <td className="px-4 py-2">{new Date(b.created_at).toLocaleString()}</td>
                        <td className="px-4 py-2">{formatSize(b.size_bytes)}</td>
                        <td className="px-4 py-2">{b.status === 'ok' ? 'OK' : 'Failed'}</td>
                        <td className="px-4 py-2 text-right">
                          {b.status === 'ok' && (
                            <>
                              <a
                                href={`/api/backups/${b.id}/download`}
                                className="mr-2 text-blue-600 hover:underline dark:text-blue-400"
                              >
                                Download
                              </a>
                              <button
                                type="button"
                                onClick={() => handleRestore(b.id, 'merge')}
                                disabled={restoring !== null}
                                className="mr-2 text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-400"
                              >
                                Restore (Merge)
                              </button>
                              {isOwner && (
                                <>
                                  {restoreReplaceId === b.id ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleRestore(b.id, 'replace')}
                                        disabled={restoring !== null}
                                        className="mr-2 font-medium text-amber-600 hover:underline disabled:opacity-50 dark:text-amber-400"
                                      >
                                        Confirm Replace
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setRestoreReplaceId(null)}
                                        className="text-neutral-500 hover:underline"
                                      >
                                        Cancel
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setRestoreReplaceId(b.id)}
                                      className="text-amber-600 hover:underline dark:text-amber-400"
                                    >
                                      Restore (Replace)
                                    </button>
                                  )}
                                </>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      {restoreReplaceId && (
        <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
          Warning: Replace will delete all current data and restore from the backup. Click Confirm Replace to
          proceed.
        </p>
      )}

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
