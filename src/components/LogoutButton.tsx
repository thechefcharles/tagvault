'use client';

import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    router.refresh();
    router.push('/login');
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="rounded-md border border-neutral-300 px-4 py-2 hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-800"
    >
      Log out
    </button>
  );
}
