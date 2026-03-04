'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (error.message === 'Unauthenticated' || error.message === 'No active org') {
      window.location.href = '/login';
      return;
    }
  }, [error.message]);

  if (error.message === 'Unauthenticated' || error.message === 'No active org') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-neutral-600">Redirecting to sign in…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="text-sm text-neutral-600">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="rounded bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900"
      >
        Try again
      </button>
    </div>
  );
}
