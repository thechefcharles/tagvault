'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export function PendingInvitesBanner() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/orgs/invites/pending')
      .then((res) => (res.ok ? res.json() : { invites: [] }))
      .then((data) => {
        if (!cancelled && Array.isArray(data.invites)) {
          setCount(data.invites.length);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (count === null || count === 0) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 dark:border-amber-800 dark:bg-amber-900/20">
      <p className="text-center text-sm text-amber-800 dark:text-amber-200">
        You have {count} pending invite{count !== 1 ? 's' : ''}.{' '}
        <Link
          href="/onboarding"
          className="font-medium underline hover:no-underline"
        >
          View and join
        </Link>
      </p>
    </div>
  );
}
