import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/server/auth';
import { LogoutButton } from '@/components/LogoutButton';
import { ManageBillingButton } from '@/app/billing/success/ManageBillingButton';
import Link from 'next/link';
import { SearchClient } from './SearchClient';

export const dynamic = 'force-dynamic';

export default async function SearchPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen p-6">
      <header className="mx-auto mb-6 flex max-w-2xl items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/app"
            className="text-neutral-600 hover:text-foreground dark:text-neutral-400"
          >
            ← Vault
          </Link>
          <Link
            href="/saved-searches"
            className="text-sm text-neutral-600 hover:text-foreground dark:text-neutral-400"
          >
            Saved Searches
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <ManageBillingButton />
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto max-w-2xl">
        <h1 className="mb-4 text-xl font-semibold">Search</h1>
        <SearchClient />
      </main>
    </div>
  );
}
