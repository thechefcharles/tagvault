import Link from 'next/link';
import { requireActiveOrg } from '@/lib/server/auth';
import { createClient } from '@/lib/supabase/server';
import { OnboardingClient } from '@/components/OnboardingClient';

export const dynamic = 'force-dynamic';

type PendingInvite = {
  invite_id: string;
  org_id: string;
  org_name: string;
  role: string;
  expires_at: string;
};

export default async function OnboardingPage() {
  await requireActiveOrg();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_pending_invites_for_user');

  const pendingInvites: PendingInvite[] = [];
  if (!error && Array.isArray(data)) {
    for (const row of data) {
      pendingInvites.push({
        invite_id: row.invite_id,
        org_id: row.org_id,
        org_name: row.org_name ?? '',
        role: row.role ?? 'member',
        expires_at: row.expires_at,
      });
    }
  }

  return (
    <div className="min-h-screen p-6">
      <header className="mx-auto flex max-w-lg items-center justify-between">
        <h1 className="text-xl font-semibold">Welcome to TagVault</h1>
        <Link href="/app" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          Skip to app
        </Link>
      </header>
      <main className="mx-auto mt-8 max-w-lg">
        <p className="mb-6 text-sm text-neutral-600 dark:text-neutral-400">
          Choose how you&apos;d like to get started.
        </p>
        <OnboardingClient pendingInvites={pendingInvites} />
      </main>
    </div>
  );
}
