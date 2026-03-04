import Link from 'next/link';
import { requireActiveOrg } from '@/lib/server/auth';
import { createClient } from '@/lib/supabase/server';
import { LogoutButton } from '@/components/LogoutButton';
import { ManageBillingButton } from '@/app/billing/success/ManageBillingButton';
import { NotificationBell } from '@/components/NotificationBell';
import { OrgSwitcher } from '@/components/OrgSwitcher';
import { listItems } from '@/lib/db/items';
import { VaultClient } from './VaultClient';

export const dynamic = 'force-dynamic';

export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; sort?: string; cursor?: string; limit?: string; tag_ids?: string }>;
}) {
  const { user, activeOrgId } = await requireActiveOrg();
  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id);
  const orgIds = Array.from(new Set((memberships ?? []).map((m) => m.org_id)));
  const { data: orgs } = orgIds.length
    ? await supabase
        .from('organizations')
        .select('id, name, slug')
        .in('id', orgIds)
        .order('name')
    : { data: [] };

  const params = await searchParams;
  const type = params.type as 'link' | 'file' | 'note' | undefined;
  const sort = (params.sort as 'recent' | 'priority') || 'recent';
  const cursor = params.cursor;
  const limit = params.limit ? Math.min(100, Math.max(1, parseInt(params.limit, 10))) : 25;
  const tagIds = params.tag_ids ? params.tag_ids.split(',').map((s) => s.trim()).filter(Boolean) : undefined;

  const { items, nextCursor } = await listItems({
    orgId: activeOrgId,
    userId: user.id,
    type,
    sort,
    limit,
    cursor,
    tagIds,
  });

  return (
    <div className="min-h-screen p-6">
      <header className="mx-auto flex max-w-2xl items-center justify-between">
        <h1 className="text-xl font-semibold">Vault</h1>
        <div className="flex items-center gap-2">
          <OrgSwitcher orgs={orgs ?? []} activeOrgId={activeOrgId} />
          <NotificationBell />
          <ManageBillingButton />
          <LogoutButton />
        </div>
      </header>
      <nav className="mx-auto mt-2 flex max-w-2xl flex-wrap gap-3 text-sm text-neutral-500 dark:text-neutral-400">
        <Link href="/search" className="hover:text-foreground">
          Search
        </Link>
        <Link href="/saved-searches" className="hover:text-foreground">
          Saved Searches
        </Link>
        <Link href="/alerts" className="hover:text-foreground">
          Alerts
        </Link>
        <Link href="/tags" className="hover:text-foreground">
          Tags
        </Link>
        <Link href="/collections" className="hover:text-foreground">
          Collections
        </Link>
        <Link href="/orgs" className="hover:text-foreground">
          Orgs
        </Link>
        <Link href="/settings/data" className="hover:text-foreground">
          Data
        </Link>
      </nav>
      <main className="mx-auto mt-6 max-w-2xl">
        <VaultClient items={items} nextCursor={nextCursor} type={type} sort={sort} limit={limit} tagIds={tagIds} />
      </main>
    </div>
  );
}
