'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Props = {
  userId: string;
  hasStripeCustomer: boolean;
};

export function UserOpsClient({ userId, hasStripeCustomer }: Props) {
  const router = useRouter();
  const [resyncing, setResyncing] = useState(false);
  const [setPlanBusy, setSetPlanBusy] = useState<'free' | 'pro' | 'team' | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function handleResync() {
    setResyncing(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/resync-billing`, { method: 'POST' });
      const json = await res.json();
      if (json.ok) {
        setStatus('Resync OK');
        router.refresh();
      } else {
        setStatus(json.error?.message ?? 'Resync failed');
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Resync failed');
    } finally {
      setResyncing(false);
    }
  }

  async function handleSetPlan(plan: 'free' | 'pro' | 'team') {
    setSetPlanBusy(plan);
    setStatus(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/set-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const json = await res.json();
      if (json.ok) {
        setStatus(`Plan set to ${plan}`);
        router.refresh();
      } else {
        setStatus(json.error?.message ?? 'Set plan failed');
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Set plan failed');
    } finally {
      setSetPlanBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleResync}
          disabled={resyncing || !hasStripeCustomer}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {resyncing ? 'Resyncing…' : 'Resync Billing'}
        </button>
        <button
          type="button"
          onClick={() => handleSetPlan('free')}
          disabled={!!setPlanBusy}
          className="rounded bg-amber-600 px-3 py-1.5 text-sm text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {setPlanBusy === 'free' ? '…' : 'Set Free'}
        </button>
        <button
          type="button"
          onClick={() => handleSetPlan('pro')}
          disabled={!!setPlanBusy}
          className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {setPlanBusy === 'pro' ? '…' : 'Set Pro'}
        </button>
        <button
          type="button"
          onClick={() => handleSetPlan('team')}
          disabled={!!setPlanBusy}
          className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {setPlanBusy === 'team' ? '…' : 'Set Team'}
        </button>
      </div>
      {status && (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">{status}</p>
      )}
    </div>
  );
}
