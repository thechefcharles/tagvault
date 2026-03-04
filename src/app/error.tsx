'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isAuthError =
    error.message === 'Unauthenticated' || error.message === 'No active org' || error.message === 'Failed to ensure personal org';

  useEffect(() => {
    if (isAuthError) {
      window.location.href = '/login';
    }
  }, [isAuthError]);

  if (isAuthError) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-neutral-600">Redirecting to sign in…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="max-w-sm text-center text-sm text-neutral-600">
        If you opened the app on a phone, try signing in again — sessions can sometimes expire.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/login"
          className="rounded bg-neutral-900 px-4 py-2 text-center text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900"
        >
          Go to sign in
        </Link>
        <button
          type="button"
          onClick={reset}
          className="rounded border border-neutral-300 px-4 py-2 hover:bg-neutral-50 dark:border-neutral-600 dark:hover:bg-neutral-800"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
