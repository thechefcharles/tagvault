import { requireActiveOrg, isOrgOwner } from '@/lib/server/auth';
import { DataSettingsClient } from './DataSettingsClient';

export const dynamic = 'force-dynamic';

export default async function SettingsDataPage() {
  const { activeOrgId } = await requireActiveOrg();
  const owner = await isOrgOwner(activeOrgId);

  return (
    <div className="min-h-screen p-6">
      <header className="mx-auto mb-6 max-w-2xl">
        <h1 className="text-xl font-semibold">Data</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Export and import your organization&apos;s data.
        </p>
      </header>
      <main className="mx-auto max-w-2xl">
        <DataSettingsClient isOwner={owner} />
      </main>
    </div>
  );
}
