"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

export function NotificationBell() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/notifications/count")
      .then((res) => (res.ok ? res.json() : { count: 0 }))
      .then((data) => setCount(data.count ?? 0))
      .catch(() => setCount(0));
  }, []);

  return (
    <Link
      href="/notifications"
      className="relative p-2 text-neutral-600 hover:text-foreground dark:text-neutral-400"
      aria-label={`Notifications${count ? ` (${count} unread)` : ""}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {count != null && count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
