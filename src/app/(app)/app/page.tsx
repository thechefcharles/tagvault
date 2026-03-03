import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/server/auth';
import { LogoutButton } from '@/components/LogoutButton';
import { NotificationBell } from '@/components/NotificationBell';
import { listItems } from '@/lib/db/items';
import { VaultClient } from './VaultClient';

export const dynamic = 'force-dynamic';

export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; sort?: string; cursor?: string; limit?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const params = await searchParams;
  const type = params.type as 'link' | 'file' | 'note' | undefined;
  const sort = (params.sort as 'recent' | 'priority') || 'recent';
  const cursor = params.cursor;
  const limit = params.limit ? Math.min(100, Math.max(1, parseInt(params.limit, 10))) : 25;

  const { items, nextCursor } = await listItems({
    userId: user.id,
    type,
    sort,
    limit,
    cursor,
  });

  return (
    <div className="min-h-screen p-6">
      <header className="mx-auto flex max-w-2xl items-center justify-between">
        <h1 className="text-xl font-semibold">Vault</h1>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <LogoutButton />
        </div>
      </header>
      <nav className="mx-auto mt-2 flex max-w-2xl gap-3 text-sm text-neutral-500 dark:text-neutral-400">
        <Link href="/search" className="hover:text-foreground">
          Search
        </Link>
        <Link href="/saved-searches" className="hover:text-foreground">
          Saved Searches
        </Link>
        <Link href="/alerts" className="hover:text-foreground">
          Alerts
        </Link>
      </nav>
      <main className="mx-auto mt-6 max-w-2xl">
        <VaultClient items={items} nextCursor={nextCursor} type={type} sort={sort} limit={limit} />
      </main>
    </div>
  );
}
