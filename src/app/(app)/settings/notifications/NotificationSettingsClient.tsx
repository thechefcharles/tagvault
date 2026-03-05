'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Prefs = {
  push_enabled: boolean;
  push_alerts: boolean;
  push_digest: boolean;
  digest_frequency?: string;
  timezone?: string;
};

export function NotificationSettingsClient() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/notification-preferences')
      .then((r) => r.json())
      .then((data: Prefs & { ok?: boolean }) => {
        setPrefs(
          data?.push_enabled !== undefined
            ? {
                push_enabled: data.push_enabled ?? true,
                push_alerts: data.push_alerts ?? true,
                push_digest: data.push_digest ?? false,
                digest_frequency: data.digest_frequency,
                timezone: data.timezone,
              }
            : null,
        );
      })
      .catch(() => setPrefs(null))
      .finally(() => setLoading(false));
  }, []);

  const update = async (updates: Partial<Prefs>) => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/notification-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error?.message ?? 'Failed to save' });
        return;
      }
      setPrefs((p) => (p ? { ...p, ...updates } : null));
      setMessage({ type: 'success', text: 'Saved' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !prefs) {
    return (
      <div className="text-sm text-neutral-500 dark:text-neutral-400">
        {loading ? 'Loading…' : 'Unable to load preferences.'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/settings/data" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
        ← Back to Data settings
      </Link>

      <section>
        <h2 className="mb-3 text-sm font-medium">Push notifications (mobile app)</h2>
        <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
          These apply when using the TagVault iOS or Android app. Web has no push in this phase.
        </p>
        <div className="space-y-4">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span className="text-sm">Enable push notifications</span>
            <input
              type="checkbox"
              checked={prefs.push_enabled}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                update({ push_enabled: e.target.checked })
              }
              disabled={saving}
              className="h-4 w-4 rounded border-neutral-300"
            />
          </label>
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span className="text-sm">Alert notifications</span>
            <input
              type="checkbox"
              checked={prefs.push_alerts}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                update({ push_alerts: e.target.checked })
              }
              disabled={saving || !prefs.push_enabled}
              className="h-4 w-4 rounded border-neutral-300"
            />
          </label>
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span className="text-sm">Digest notifications</span>
            <input
              type="checkbox"
              checked={prefs.push_digest}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                update({ push_digest: e.target.checked })
              }
              disabled={saving || !prefs.push_enabled}
              className="h-4 w-4 rounded border-neutral-300"
            />
          </label>
        </div>
      </section>

      {message && (
        <p
          className={`text-sm ${
            message.type === 'success'
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
