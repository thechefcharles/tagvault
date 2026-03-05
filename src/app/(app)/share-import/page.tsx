import { requireActiveOrg } from '@/lib/server/auth';
import { ShareImportClient } from './ShareImportClient';

export const dynamic = 'force-dynamic';

export default async function ShareImportPage() {
  await requireActiveOrg();
  return (
    <div className="min-h-screen overflow-y-auto pb-safe">
      <div className="mx-auto max-w-2xl p-4 sm:p-6 safe-area-bottom">
        <ShareImportClient />
      </div>
    </div>
  );
}
