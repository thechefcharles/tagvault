import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/server/auth';
import { LogoutButton } from '@/components/LogoutButton';
import Link from 'next/link';
import { SavedSearchesClient } from './SavedSearchesClient';

export default async function SavedSearchesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen p-6">
      <header className="mx-auto mb-6 flex max-w-2xl items-center justify-between">
        <Link href="/app" className="text-neutral-600 hover:text-foreground dark:text-neutral-400">
          ← Vault
        </Link>
        <LogoutButton />
      </header>
      <main className="mx-auto max-w-2xl">
        <h1 className="mb-4 text-xl font-semibold">Saved Searches</h1>
        <SavedSearchesClient />
      </main>
    </div>
  );
}
