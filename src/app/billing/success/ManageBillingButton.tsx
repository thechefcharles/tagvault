'use client';

import { useState } from 'react';
import { openExternal } from '@/lib/native/openExternal';

export function ManageBillingButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST', credentials: 'include' });
      const text = await res.text();
      let data: { url?: string; error?: string | { message?: string } } = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        /* invalid JSON - API may have returned non-JSON error */
      }

      if (res.ok && data.url) {
        await openExternal(data.url);
      }
    } catch {
      /* network error */
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="rounded-md border border-neutral-300 px-4 py-2 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-600 dark:hover:bg-neutral-800"
    >
      {loading ? 'Opening…' : 'Manage Billing'}
    </button>
  );
}
