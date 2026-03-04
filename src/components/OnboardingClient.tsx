'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type PendingInvite = {
  invite_id: string;
  org_id: string;
  org_name: string;
  role: string;
  expires_at: string;
};

export function OnboardingClient({
  pendingInvites,
}: {
  pendingInvites: PendingInvite[];
}) {
  const router = useRouter();
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  async function handleJoin(inviteId: string) {
    setJoiningId(inviteId);
    setJoinError(null);
    try {
      const res = await fetch('/api/orgs/invites/accept-by-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_id: inviteId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 402) {
          setJoinError('Seat limit reached. The organization cannot add more members.');
          return;
        }
        setJoinError(data.error ?? 'Failed to join');
        return;
      }
      router.push('/app');
      router.refresh();
    } finally {
      setJoiningId(null);
    }
  }

  return (
    <div className="space-y-8">
      {pendingInvites.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-medium">Pending invites</h2>
          <p className="mb-3 text-sm text-neutral-600 dark:text-neutral-400">
            You&apos;ve been invited to join these organizations.
          </p>
          {joinError && (
            <p className="mb-2 text-sm text-red-600 dark:text-red-400">{joinError}</p>
          )}
          <ul className="space-y-2">
            {pendingInvites.map((inv) => (
              <li
                key={inv.invite_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800/50"
              >
                <div>
                  <span className="font-medium">{inv.org_name}</span>
                  <span className="ml-2 rounded bg-neutral-200 px-1.5 py-0.5 text-xs dark:bg-neutral-700">
                    {inv.role}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleJoin(inv.invite_id)}
                  disabled={!!joiningId}
                  className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
                >
                  {joiningId === inv.invite_id ? 'Joining…' : 'Join'}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-medium">Get started</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <Link
            href="/app"
            className="inline-flex items-center justify-center rounded border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          >
            Continue with Personal org
          </Link>
          <Link
            href="/orgs"
            className="inline-flex items-center justify-center rounded bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Create new org
          </Link>
        </div>
      </section>
    </div>
  );
}
