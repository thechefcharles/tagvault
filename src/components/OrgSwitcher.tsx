'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';

type Org = { id: string; name: string; slug: string };

export function OrgSwitcher({
  orgs,
  activeOrgId,
}: {
  orgs: Org[];
  activeOrgId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = orgs.find((o) => o.id === activeOrgId);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleSelect(orgId: string) {
    if (orgId === activeOrgId) {
      setOpen(false);
      return;
    }
    const res = await fetch('/api/orgs/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active_org_id: orgId }),
    });
    if (res.ok) {
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="rounded border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-600"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {active?.name ?? 'Org'}
      </button>
      {open && (
        <ul
          className="absolute right-0 top-full z-10 mt-1 min-w-[160px] rounded border border-neutral-200 bg-white py-1 shadow dark:border-neutral-700 dark:bg-neutral-900"
          role="listbox"
        >
          {orgs.map((org) => (
            <li key={org.id} role="option" aria-selected={org.id === activeOrgId}>
              <button
                type="button"
                onClick={() => handleSelect(org.id)}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                  org.id === activeOrgId ? 'font-medium' : ''
                }`}
              >
                {org.name}
              </button>
            </li>
          ))}
          <li className="border-t border-neutral-200 dark:border-neutral-700">
            <Link
              href="/orgs"
              className="block px-3 py-2 text-sm text-blue-600 hover:bg-neutral-100 dark:text-blue-400 dark:hover:bg-neutral-800"
              onClick={() => setOpen(false)}
            >
              Create org
            </Link>
          </li>
        </ul>
      )}
    </div>
  );
}
