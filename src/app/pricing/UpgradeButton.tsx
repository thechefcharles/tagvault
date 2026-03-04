'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getErrorMessage } from '@/lib/api/parse-error';

type Plan = 'pro' | 'team';

export function UpgradeButton({
  plan = 'pro',
  className,
}: {
  plan?: Plan;
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
        credentials: 'include',
      });
      const text = await res.text();
      let data: { url?: string; error?: string | { message?: string } } = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        /* invalid JSON */
      }

      if (!res.ok) {
        if (res.status === 401) {
          router.push('/login?next=/pricing');
          return;
        }
        setError(getErrorMessage(data, 'Failed to start checkout'));
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        setError('Invalid response from server');
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleUpgrade}
        disabled={loading}
        className={`w-full rounded-md bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200 ${className ?? ''}`}
      >
        {loading ? 'Redirecting…' : plan === 'team' ? 'Upgrade to Team' : 'Upgrade to Pro'}
      </button>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
