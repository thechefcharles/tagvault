'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function UpgradeButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST', credentials: 'include' });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          router.push('/login?next=/pricing');
          return;
        }
        setError(data?.error?.message ?? data?.error ?? 'Failed to start checkout');
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
        className="w-full rounded-md bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        {loading ? 'Redirecting…' : 'Upgrade to Pro'}
      </button>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
