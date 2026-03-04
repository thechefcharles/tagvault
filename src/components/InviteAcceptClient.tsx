'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function InviteAcceptClient({
  token,
  isLoggedIn,
}: {
  token: string;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isLoggedIn) {
    const loginUrl = `/login?next=${encodeURIComponent(`/invite?token=${encodeURIComponent(token)}`)}`;
    return (
      <div className="mt-4">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Log in with the email address this invite was sent to, then you can accept it.
        </p>
        <Link
          href={loginUrl}
          className="mt-3 inline-block rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Log in to accept
        </Link>
      </div>
    );
  }

  async function handleAccept() {
    setStatus('loading');
    setErrorMessage(null);
    try {
      const res = await fetch('/api/orgs/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus('error');
        setErrorMessage(data.error ?? 'Failed to accept invite');
        if (res.status === 402) {
          setErrorMessage(
            'Seat limit reached. The organization cannot add more members. Upgrade to add more seats.',
          );
        }
        return;
      }
      router.push('/app');
      router.refresh();
    } catch {
      setStatus('error');
      setErrorMessage('Something went wrong');
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={handleAccept}
        disabled={status === 'loading'}
        className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        {status === 'loading' ? 'Accepting…' : 'Accept invite'}
      </button>
      {status === 'error' && errorMessage && (
        <div className="mt-2">
          <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
          <Link
            href="/app"
            className="mt-2 inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Go to app →
          </Link>
        </div>
      )}
    </div>
  );
}
