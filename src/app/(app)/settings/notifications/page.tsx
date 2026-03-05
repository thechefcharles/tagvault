import { requireActiveOrg } from '@/lib/server/auth';
import { NotificationSettingsClient } from './NotificationSettingsClient';

export const dynamic = 'force-dynamic';

export default async function SettingsNotificationsPage() {
  await requireActiveOrg();

  return (
    <div className="min-h-screen p-6">
      <header className="mx-auto mb-6 max-w-2xl">
        <h1 className="text-xl font-semibold">Notifications</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Manage push and in-app notification preferences.
        </p>
      </header>
      <main className="mx-auto max-w-2xl">
        <NotificationSettingsClient />
      </main>
    </div>
  );
}
