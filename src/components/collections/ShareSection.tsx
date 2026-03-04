'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getErrorMessage } from '@/lib/api/parse-error';

type Share = {
  id: string;
  token: string;
  created_at: string;
  revoked_at: string | null;
  expires_at: string | null;
  last_accessed_at: string | null;
};

function formatDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function ShareSection({ collectionId }: { collectionId: string }) {
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlanLimit, setIsPlanLimit] = useState(false);
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  async function fetchShares() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/collections/${collectionId}/shares`);
      if (res.ok) {
        const data = await res.json();
        setShares(data);
      }
    } catch {
      setError('Failed to load shares');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchShares();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionId]);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    setIsPlanLimit(false);
    try {
      const res = await fetch(`/api/collections/${collectionId}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setShares((prev) => [data, ...prev]);
      } else {
        setError(getErrorMessage(data, 'Failed to create share link'));
        setIsPlanLimit(res.status === 402);
      }
    } catch {
      setError('Failed to create share link');
    } finally {
      setCreating(false);
    }
  }

  async function handleCopy(share: Share) {
    if (share.revoked_at) return;
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/share/${share.token}`;
    await navigator.clipboard.writeText(url);
  }

  async function handleRotate(share: Share) {
    setRotatingId(share.id);
    setError(null);
    try {
      const res = await fetch(`/api/collections/shares/${share.id}/rotate`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setShares((prev) => [data, ...prev.filter((s) => s.id !== share.id)]);
      } else {
        setError(getErrorMessage(data, 'Failed to rotate link'));
      }
    } catch {
      setError('Failed to rotate link');
    } finally {
      setRotatingId(null);
    }
  }

  async function handleRevoke(share: Share) {
    setRevokingId(share.id);
    setError(null);
    try {
      const res = await fetch(`/api/collections/shares/${share.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revoked: true }),
      });
      if (res.ok) {
        setShares((prev) =>
          prev.map((s) => (s.id === share.id ? { ...s, revoked_at: new Date().toISOString() } : s)),
        );
      } else {
        const data = await res.json().catch(() => ({}));
        setError(getErrorMessage(data, 'Failed to revoke link'));
      }
    } catch {
      setError('Failed to revoke link');
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Share links</h3>
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          {creating ? 'Creating…' : 'Create share link'}
        </button>
      </div>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {error}
          {isPlanLimit && (
            <Link href="/pricing" className="ml-2 font-medium underline">
              Upgrade →
            </Link>
          )}
        </p>
      )}
      {loading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : shares.length === 0 ? (
        <p className="text-sm text-neutral-500">No share links yet. Create one to share this collection publicly.</p>
      ) : (
        <ul className="space-y-2">
          {shares.map((share) => {
            const isRevoked = !!share.revoked_at;
            const isExpired = share.expires_at && new Date(share.expires_at) < new Date();
            const isActive = !isRevoked && !isExpired;
            return (
              <li
                key={share.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-neutral-200 py-2 px-3 dark:border-neutral-600"
              >
                <div className="min-w-0 flex-1 text-sm">
                  <span className="font-mono text-xs truncate block" title={share.token}>
                    …{share.token.slice(-12)}
                  </span>
                  <span className="text-neutral-500">
                    {isRevoked && 'Revoked'}
                    {isExpired && !isRevoked && 'Expired'}
                    {isActive && (
                      <>
                        Created {formatDate(share.created_at)}
                        {share.last_accessed_at && (
                          <> · Last accessed {formatDate(share.last_accessed_at)}</>
                        )}
                        {share.expires_at && (
                          <> · Expires {formatDate(share.expires_at)}</>
                        )}
                      </>
                    )}
                  </span>
                </div>
                <div className="flex gap-1">
                  {isActive && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleCopy(share)}
                        className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-800"
                      >
                        Copy link
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRotate(share)}
                        disabled={!!rotatingId}
                        className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-600 dark:hover:bg-neutral-800"
                      >
                        {rotatingId === share.id ? 'Rotating…' : 'Rotate'}
                      </button>
                    </>
                  )}
                  {isActive && (
                    <button
                      type="button"
                      onClick={() => handleRevoke(share)}
                      disabled={!!revokingId}
                      className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      {revokingId === share.id ? 'Revoking…' : 'Revoke'}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
