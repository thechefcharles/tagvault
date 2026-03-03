"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";
import { NotificationBell } from "@/components/NotificationBell";
import { AlertModal, type Alert } from "@/components/alerts/AlertModal";
import type { SavedSearch } from "@/types/saved-search";

function formatDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const FREQ_LABELS: Record<number, string> = {
  15: "15 min",
  30: "30 min",
  60: "1 hr",
  240: "4 hrs",
  1440: "Daily",
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Alert | null>(null);
  const [running, setRunning] = useState<string | null>(null);

  async function fetchAlerts() {
    const res = await fetch("/api/alerts");
    if (res.ok) {
      const data = await res.json();
      setAlerts(data);
    }
  }

  async function fetchSavedSearches() {
    const res = await fetch("/api/saved-searches");
    if (res.ok) {
      const data = await res.json();
      setSavedSearches(data);
    }
  }

  useEffect(() => {
    Promise.all([fetchAlerts(), fetchSavedSearches()]).finally(() =>
      setLoading(false)
    );
  }, []);

  async function handleRun(alert: Alert) {
    setRunning(alert.id);
    try {
      const res = await fetch(`/api/alerts/${alert.id}/run`, { method: "POST" });
      if (res.ok) {
        await fetchAlerts();
      }
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="min-h-screen p-6">
      <header className="max-w-2xl mx-auto flex justify-between items-center mb-6">
        <Link
          href="/app"
          className="text-neutral-600 hover:text-foreground dark:text-neutral-400"
        >
          ← Vault
        </Link>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <LogoutButton />
        </div>
      </header>
      <main className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-semibold">Alerts</h1>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            className="px-4 py-2 bg-neutral-900 text-white rounded-md hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            New alert
          </button>
        </div>

        {loading ? (
          <p className="text-neutral-500 py-8">Loading…</p>
        ) : alerts.length === 0 ? (
          <p className="text-neutral-500 py-8">
            No alerts yet. Create an alert to get notified when new items match a
            saved search.
          </p>
        ) : (
          <ul className="space-y-4">
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-4"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-medium">{alert.name}</h2>
                      {!alert.enabled && (
                        <span className="text-xs px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700">
                          Disabled
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                      {typeof alert.saved_searches === "object" && alert.saved_searches
                        ? alert.saved_searches.name
                        : "Saved search"}
                      {" · "}
                      {FREQ_LABELS[alert.frequency_minutes] ?? `${alert.frequency_minutes} min`}
                    </p>
                    <p className="text-xs text-neutral-500 mt-2">
                      Last run: {formatDate(alert.last_run_at)} · Next:{" "}
                      {formatDate(alert.next_run_at)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleRun(alert)}
                      disabled={running === alert.id}
                      className="text-sm px-3 py-1 border border-neutral-300 rounded hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-800 disabled:opacity-50"
                    >
                      {running === alert.id ? "Running…" : "Run now"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(alert);
                        setModalOpen(true);
                      }}
                      className="text-sm text-neutral-600 hover:underline dark:text-neutral-400"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <AlertModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSave={fetchAlerts}
        initial={editing}
        savedSearches={savedSearches}
      />
    </div>
  );
}
