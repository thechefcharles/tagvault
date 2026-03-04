import Link from 'next/link';
import { requireUser } from '@/lib/server/auth';
import { createClient } from '@/lib/supabase/server';
import { OrgMembersClient } from '@/components/OrgMembersClient';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export default async function OrgMembersPage({ params }: Props) {
  const { id: orgId } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: myMember } = await supabase
    .from('org_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .single();

  if (!myMember) {
    notFound();
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, slug')
    .eq('id', orgId)
    .single();

  if (!org) {
    notFound();
  }

  const { data: membersRows } = await supabase.rpc('get_org_members', {
    p_org_id: orgId,
  });

  const members = (membersRows ?? []).map(
    (row: { user_id: string; role: string; email: string | null }) => ({
      user_id: row.user_id,
      role: row.role,
      email: row.email ?? undefined,
    }),
  );

  const { data: invites } = await supabase
    .from('org_invites')
    .select('id, email, role, expires_at, created_at')
    .eq('org_id', orgId)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  const canManage = ['owner', 'admin'].includes(myMember.role);
  const isOwner = myMember.role === 'owner';

  return (
    <div className="min-h-screen p-6">
      <header className="mx-auto flex max-w-2xl items-center justify-between">
        <div>
          <Link
            href="/orgs"
            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            ← Organizations
          </Link>
          <h1 className="mt-1 text-xl font-semibold">{org.name} – Members</h1>
        </div>
      </header>
      <main className="mx-auto mt-6 max-w-2xl">
        <OrgMembersClient
          orgId={orgId}
          members={members}
          pendingInvites={invites ?? []}
          currentUserId={user.id}
          canManage={canManage}
          isOwner={isOwner}
        />
      </main>
    </div>
  );
}
