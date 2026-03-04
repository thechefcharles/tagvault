'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Org = { id: string; name: string; slug: string };

export function OrgListClient({
  orgs,
  activeOrgId,
}: {
  orgs: Org[];
  activeOrgId: string;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const s = slug.trim() || name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!name.trim() || !s) {
      setError('Name and slug required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), slug: s }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to create org');
        return;
      }
      setName('');
      setSlug('');
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 text-lg font-medium">Create organization</h2>
        <form onSubmit={handleCreate} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div>
            <label htmlFor="org-name" className="block text-sm text-neutral-600 dark:text-neutral-400">
              Name
            </label>
            <input
              id="org-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug) setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
              }}
              className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 dark:border-neutral-600 dark:bg-neutral-900"
              placeholder="My Team"
            />
          </div>
          <div>
            <label htmlFor="org-slug" className="block text-sm text-neutral-600 dark:text-neutral-400">
              Slug
            </label>
            <input
              id="org-slug"
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 dark:border-neutral-600 dark:bg-neutral-900"
              placeholder="my-team"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {submitting ? 'Creating…' : 'Create'}
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Your organizations</h2>
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
          {orgs.map((org) => (
            <li key={org.id} className="flex items-center justify-between py-2">
              <span>
                {org.name}
                {org.id === activeOrgId && (
                  <span className="ml-2 text-xs text-neutral-500">(active)</span>
                )}
              </span>
              <span className="font-mono text-xs text-neutral-500">{org.slug}</span>
            </li>
          ))}
          {orgs.length === 0 && (
            <li className="py-4 text-sm text-neutral-500">No organizations yet. Create one above.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
