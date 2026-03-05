'use client';

import * as Sentry from '@sentry/nextjs';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SharePayloadPlugin } from '@/lib/native/SharePayloadPlugin';
import { isCapacitor } from '@/lib/native/capacitor';
import { getErrorMessage } from '@/lib/api/parse-error';
import type { PendingSharePayload } from '@/lib/native/SharePayloadPlugin';

function getPlatformTag(): string {
  if (typeof window === 'undefined') return 'web';
  const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  return cap?.getPlatform?.() ?? 'web';
}

export function ShareImportClient() {
  const router = useRouter();
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const [payload, setPayload] = useState<PendingSharePayload | null | 'loading' | 'none'>('loading');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPlanLimit, setIsPlanLimit] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isCapacitor()) {
      setPayload('none');
      return;
    }
    SharePayloadPlugin.getPendingPayload()
      .then(({ payload: p }) => {
        setPayload(p ?? 'none');
        if (p) {
          if (p.kind === 'url' && p.url) {
            setTitle(p.url.replace(/^https?:\/\//, '').split('/')[0] || 'Link');
            setDescription('');
          } else if (p.kind === 'text' && p.text) {
            const text = p.text.trim();
            setDescription(text.length <= 500 ? text : text.slice(0, 497) + '…');
            setTitle(text.slice(0, 50) + (text.length > 50 ? '…' : ''));
          } else if (p.kind === 'file' && p.fileName) {
            setTitle(p.fileName);
            setDescription('');
          }
        }
      })
      .catch(() => setPayload('none'));
  }, []);

  useEffect(() => {
    if (payload && payload !== 'loading' && payload !== 'none' && descriptionRef.current) {
      descriptionRef.current.focus();
    }
  }, [payload]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const p = payload;
    if (!p || p === 'loading' || p === 'none') return;
    const payloadData = p as PendingSharePayload;
    setError(null);
    setLoading(true);

    try {
      const desc = description.trim();
      if (desc.length < 12 || desc.length > 500) {
        setError('Description must be 12–500 characters');
        setLoading(false);
        return;
      }

      const prio = priority ? Math.min(20, Math.max(1, parseInt(priority, 10))) : null;

      if (payloadData.kind === 'file' && payloadData.fileBase64) {
        const formData = new FormData();
        const bytes = Uint8Array.from(atob(payloadData.fileBase64), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: payloadData.mimeType || 'application/octet-stream' });
        formData.set('file', new File([blob], payloadData.fileName || 'shared_file'));
        formData.set('description', desc);
        if (title.trim()) formData.set('title', title.trim());
        if (prio) formData.set('priority', String(prio));

        const res = await fetch('/api/items/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) {
          setError(getErrorMessage(data, 'Upload failed'));
          setIsPlanLimit(res.status === 402);
          setLoading(false);
          return;
        }
      } else {
        const body: Record<string, unknown> = {
          type: payloadData.kind === 'url' ? 'link' : 'note',
          description: desc,
          title: title.trim() || null,
          priority: prio,
        };
        if (payloadData.kind === 'url' && payloadData.url) body.url = payloadData.url;

        const res = await fetch('/api/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(
            data?.details?.fieldErrors
              ? Object.values(data.details.fieldErrors).flat().join(', ')
              : getErrorMessage(data, 'Failed to save'),
          );
          setIsPlanLimit(res.status === 402);
          setLoading(false);
          return;
        }
      }

      await SharePayloadPlugin.clearPendingPayload();
      router.push('/app');
      router.refresh();
    } catch (err) {
      Sentry.captureException(err, {
        tags: { area: 'share_import', platform: getPlatformTag(), kind: payloadData.kind },
      });
      setError('Something went wrong');
      setLoading(false);
    }
  }

  if (payload === 'loading') {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-900">
        <p className="text-neutral-500 dark:text-neutral-400">Loading shared content…</p>
      </div>
    );
  }

  if (payload === 'none') {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-900">
        <h1 className="mb-2 text-lg font-semibold">Share Import</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Open TagVault from another app&apos;s Share menu to save links, text, or files here.
        </p>
        <Link
          href="/app"
          className="mt-4 inline-block font-medium text-neutral-900 underline dark:text-neutral-100"
        >
          Go to Vault
        </Link>
      </div>
    );
  }

  const p = payload as PendingSharePayload;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-900">
      <h1 className="mb-4 text-lg font-semibold">Quick Save</h1>
      <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
        {p.kind === 'url' && 'Save this link to your vault'}
        {p.kind === 'text' && 'Save this note'}
        {p.kind === 'file' && 'Save this file'}
      </p>
      {p.kind === 'url' && p.url && (
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-neutral-600 dark:text-neutral-400">Link</label>
          <p className="break-all rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
            {p.url}
          </p>
        </div>
      )}
      <form
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(e as unknown as React.FormEvent);
        }}
        className="space-y-4"
      >
        <div>
          <label className="mb-1 block text-sm font-medium">Title (optional)</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Description * (min 12 chars)</label>
          <textarea
            ref={descriptionRef}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            minLength={12}
            maxLength={500}
            rows={4}
            placeholder="What is this and why did you save it?"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Priority (optional, 1–20)</label>
          <input
            type="number"
            min={1}
            max={20}
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-24 rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800"
          />
        </div>
        {error && (
          <div>
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            {isPlanLimit && (
              <Link href="/pricing" className="mt-2 inline-block text-sm font-medium underline">
                Upgrade to Pro →
              </Link>
            )}
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => router.push('/app')}
            className="rounded-md border border-neutral-300 px-4 py-2 dark:border-neutral-600"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {loading ? 'Saving…' : 'Save to Vault'}
          </button>
        </div>
      </form>
    </div>
  );
}
