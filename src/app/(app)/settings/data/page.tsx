import { requireActiveOrg, isOrgOwner } from '@/lib/server/auth';
import { getOrgEntitlements } from '@/lib/entitlements';
import { getBackupsEnabled } from '@/lib/entitlements/limits';
import { createClient } from '@/lib/supabase/server';
import { DataSettingsClient } from './DataSettingsClient';

export const dynamic = 'force-dynamic';

export default async function SettingsDataPage() {
  const { activeOrgId } = await requireActiveOrg();
  const owner = await isOrgOwner(activeOrgId);
  const { plan } = await getOrgEntitlements(activeOrgId);
  const backupsEnabled = getBackupsEnabled(plan);

  const supabase = await createClient();
  const { data: backups } = backupsEnabled
    ? await supabase
        .from('org_backups')
        .select('id, created_at, size_bytes, status')
        .eq('org_id', activeOrgId)
        .order('created_at', { ascending: false })
        .limit(50)
    : { data: [] };

  return (
    <div className="min-h-screen p-6">
      <header className="mx-auto mb-6 max-w-2xl">
        <h1 className="text-xl font-semibold">Data</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Export and import your organization&apos;s data.
        </p>
      </header>
      <main className="mx-auto max-w-2xl">
        <DataSettingsClient
          isOwner={owner}
          backupsEnabled={backupsEnabled}
          backups={backups ?? []}
        />
      </main>
    </div>
  );
}
