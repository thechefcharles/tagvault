'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type BillingRow = {
  user_id: string;
  user_email: string | null;
  plan: string;
  status: string | null;
  current_period_end: string | null;
  grace_period_ends_at: string | null;
  stripe_customer_id: string | null;
  updated_at: string;
};

export function BillingOpsClient({ billingRows }: { billingRows: BillingRow[] }) {
  const router = useRouter();
  const [resyncing, setResyncing] = useState<string | null>(null);

  async function handleResync(userId: string) {
    setResyncing(userId);
    try {
      const res = await fetch(`/api/admin/billing/resync?user_id=${encodeURIComponent(userId)}`, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.ok) {
        router.refresh();
      } else {
        alert(json.error?.message ?? 'Resync failed');
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Resync failed');
    } finally {
      setResyncing(null);
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
      <table className="min-w-full divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
        <thead>
          <tr>
            <th className="px-4 py-2 text-left font-medium">user_id</th>
            <th className="px-4 py-2 text-left font-medium">email</th>
            <th className="px-4 py-2 text-left font-medium">plan</th>
            <th className="px-4 py-2 text-left font-medium">status</th>
            <th className="px-4 py-2 text-left font-medium">current_period_end</th>
            <th className="px-4 py-2 text-left font-medium">grace_period_ends_at</th>
            <th className="px-4 py-2 text-left font-medium">stripe_customer_id</th>
            <th className="px-4 py-2 text-left font-medium">updated_at</th>
            <th className="px-4 py-2 text-left font-medium">actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {billingRows.map((r) => (
            <tr key={r.user_id} className="font-mono text-xs">
              <td className="px-4 py-2">{r.user_id.slice(0, 8)}…</td>
              <td className="px-4 py-2">{r.user_email ?? '—'}</td>
              <td className="px-4 py-2">{r.plan}</td>
              <td className="px-4 py-2">{r.status ?? '—'}</td>
              <td className="px-4 py-2">
                {r.current_period_end ? new Date(r.current_period_end).toISOString() : '—'}
              </td>
              <td className="px-4 py-2">
                {r.grace_period_ends_at
                  ? new Date(r.grace_period_ends_at).toISOString()
                  : '—'}
              </td>
              <td className="px-4 py-2">{r.stripe_customer_id ?? '—'}</td>
              <td className="px-4 py-2">{new Date(r.updated_at).toISOString()}</td>
              <td className="px-4 py-2">
                <button
                  type="button"
                  onClick={() => handleResync(r.user_id)}
                  disabled={!!resyncing || !r.stripe_customer_id}
                  className="rounded bg-blue-600 px-2 py-1 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {resyncing === r.user_id ? '…' : 'Resync'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
