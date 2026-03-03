"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";
import { NotificationBell } from "@/components/NotificationBell";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  meta: { saved_search_id?: string; alert_id?: string; item_ids?: string[] };
  read: boolean;
  created_at: string;
};

function formatDate(s: string) {
  return new Date(s).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchNotifications() {
    const res = await fetch("/api/notifications");
    if (res.ok) {
      const data = await res.json();
      setItems(data);
    }
  }

  useEffect(() => {
    fetchNotifications().finally(() => setLoading(false));
  }, []);

  async function markRead(id: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    fetchNotifications();
  }

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    fetchNotifications();
  }

  const unreadCount = items.filter((n) => !n.read).length;

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
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="text-sm text-neutral-600 hover:underline dark:text-neutral-400"
            >
              Mark all read
            </button>
          )}
          <LogoutButton />
        </div>
      </header>
      <main className="max-w-2xl mx-auto">
        <h1 className="text-xl font-semibold mb-6">Notifications</h1>

        {loading ? (
          <p className="text-neutral-500 py-8">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-neutral-500 py-8">No notifications yet.</p>
        ) : (
          <ul className="space-y-3">
            {items.map((n) => (
              <li
                key={n.id}
                className={`rounded-lg border p-4 ${
                  n.read
                    ? "border-neutral-200 dark:border-neutral-700 bg-transparent"
                    : "border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800/50"
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h2 className="font-medium">{n.title}</h2>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                      {n.body}
                    </p>
                    <p className="text-xs text-neutral-500 mt-2">
                      {formatDate(n.created_at)}
                    </p>
                    {n.meta?.saved_search_id && (
                      <Link
                        href={`/saved-searches/${n.meta.saved_search_id}`}
                        className="inline-block mt-2 text-sm text-blue-600 hover:underline dark:text-blue-400"
                      >
                        View saved search →
                      </Link>
                    )}
                  </div>
                  {!n.read && (
                    <button
                      type="button"
                      onClick={() => markRead(n.id)}
                      className="text-xs text-neutral-500 hover:underline shrink-0"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
