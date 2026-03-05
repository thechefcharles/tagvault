import { requireActiveOrg } from '@/lib/server/auth';
import { ShareImportClient } from './ShareImportClient';

export const dynamic = 'force-dynamic';

export default async function ShareImportPage() {
  await requireActiveOrg();
  return (
    <div className="mx-auto max-w-2xl p-6">
      <ShareImportClient />
    </div>
  );
}
