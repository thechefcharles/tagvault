import Link from 'next/link';
import { requireActiveOrg } from '@/lib/server/auth';
import { createClient } from '@/lib/supabase/server';
import { OrgListClient } from '@/components/OrgListClient';

export const dynamic = 'force-dynamic';

export default async function OrgsPage() {
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

  return (
    <div className="min-h-screen p-6">
      <header className="mx-auto flex max-w-2xl items-center justify-between">
        <h1 className="text-xl font-semibold">Organizations</h1>
        <Link href="/app" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          Back to Vault
        </Link>
      </header>
      <main className="mx-auto mt-6 max-w-2xl">
        <OrgListClient orgs={orgs ?? []} activeOrgId={activeOrgId} />
      </main>
    </div>
  );
}
