import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/server/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type UserRow = {
  user_id: string;
  email: string | null;
  created_at: string;
  plan: string;
  status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  grace_period_ends_at: string | null;
  items_count: number;
  saved_searches_count: number;
  alerts_count: number;
  notifications_unread_count: number;
  last_cron_alerts_run: string | null;
};

function countByKey<T extends { [k: string]: unknown }>(
  rows: T[],
  key: keyof T,
): Record<string, number> {
  const m: Record<string, number> = {};
  for (const r of rows) {
    const v = r[key];
    const k = typeof v === 'string' ? v : String(v ?? '');
    m[k] = (m[k] ?? 0) + 1;
  }
  return m;
}

export default async function AdminUsersPage() {
  try {
    await requireAdmin();
  } catch {
    redirect('/login');
  }

  const admin = createAdminClient();

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, created_at, active_org_id')
    .order('created_at', { ascending: false })
    .limit(200);

  const userIds = (profiles ?? []).map((p) => p.id);
  if (userIds.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-50 p-6 dark:bg-neutral-950">
        <header className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Admin: Users</h1>
            <Link href="/admin" className="text-blue-600 hover:underline dark:text-blue-400">
              Back to admin
            </Link>
          </div>
        </header>
        <main className="mx-auto mt-8 max-w-7xl">
          <p className="text-neutral-600 dark:text-neutral-400">No users found.</p>
        </main>
      </div>
    );
  }

  const activeOrgIds = Array.from(
    new Set((profiles ?? []).map((p) => (p as { active_org_id?: string }).active_org_id).filter(Boolean)),
  ) as string[];

  const [billingRows, itemsRows, savedRows, alertsRows, notifRows, cronRow] = await Promise.all([
    activeOrgIds.length
      ? admin
          .from('billing_accounts')
          .select('org_id, plan, status, current_period_end, cancel_at_period_end, grace_period_ends_at')
          .in('org_id', activeOrgIds)
      : { data: [] },
    admin.from('items').select('user_id').in('user_id', userIds),
    admin.from('saved_searches').select('owner_user_id').in('owner_user_id', userIds),
    admin.from('alerts').select('owner_user_id').in('owner_user_id', userIds),
    admin.from('notifications').select('owner_user_id').eq('read', false).in('owner_user_id', userIds),
    admin.from('cron_runs').select('last_finished_at').eq('job', 'alerts:process-due').single(),
  ]);

  const billingByOrg = new Map(
    (billingRows.data ?? []).map((b) => [
      b.org_id,
      {
        plan: b.plan ?? 'free',
        status: b.status,
        current_period_end: b.current_period_end,
        cancel_at_period_end: b.cancel_at_period_end ?? false,
        grace_period_ends_at: b.grace_period_ends_at,
      },
    ]),
  );
  const billingMap = new Map(
    (profiles ?? []).map((p) => {
      const profile = p as { id: string; active_org_id?: string };
      const b = profile.active_org_id ? billingByOrg.get(profile.active_org_id) : undefined;
      return [
        profile.id,
        b ?? {
          plan: 'free',
          status: null,
          current_period_end: null,
          cancel_at_period_end: false,
          grace_period_ends_at: null,
        },
      ];
    }),
  );
  const itemsCount = countByKey(itemsRows.data ?? [], 'user_id');
  const savedCount = countByKey(savedRows.data ?? [], 'owner_user_id');
  const alertsCount = countByKey(alertsRows.data ?? [], 'owner_user_id');
  const notifCount = countByKey(notifRows.data ?? [], 'owner_user_id');
  const lastCron = cronRow.data?.last_finished_at ?? null;

  const emailMap = new Map<string, string | null>();
  await Promise.all(
    userIds.map(async (id) => {
      try {
        const { data } = await admin.auth.admin.getUserById(id);
        emailMap.set(id, data.user?.email ?? null);
      } catch {
        emailMap.set(id, null);
      }
    }),
  );

  const rows: UserRow[] = (profiles ?? []).map((p) => {
    const b = billingMap.get(p.id) ?? {
      plan: 'free',
      status: null,
      current_period_end: null,
      cancel_at_period_end: false,
      grace_period_ends_at: null,
    };
    return {
      user_id: p.id,
      email: emailMap.get(p.id) ?? null,
      created_at: p.created_at,
      plan: b.plan,
      status: b.status,
      current_period_end: b.current_period_end,
      cancel_at_period_end: b.cancel_at_period_end,
      grace_period_ends_at: b.grace_period_ends_at,
      items_count: itemsCount[p.id] ?? 0,
      saved_searches_count: savedCount[p.id] ?? 0,
      alerts_count: alertsCount[p.id] ?? 0,
      notifications_unread_count: notifCount[p.id] ?? 0,
      last_cron_alerts_run: lastCron,
    };
  });

  return (
    <div className="min-h-screen bg-neutral-50 p-6 dark:bg-neutral-950">
      <header className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Admin: Users</h1>
          <Link href="/admin" className="text-blue-600 hover:underline dark:text-blue-400">
            Back to admin
          </Link>
        </div>
      </header>

      <main className="mx-auto mt-8 max-w-7xl overflow-x-auto">
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="min-w-full divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left font-medium">user_id</th>
                <th className="px-4 py-2 text-left font-medium">email</th>
                <th className="px-4 py-2 text-left font-medium">created_at</th>
                <th className="px-4 py-2 text-left font-medium">plan</th>
                <th className="px-4 py-2 text-left font-medium">status</th>
                <th className="px-4 py-2 text-left font-medium">current_period_end</th>
                <th className="px-4 py-2 text-left font-medium">cancel_at_period_end</th>
                <th className="px-4 py-2 text-left font-medium">grace_period_ends_at</th>
                <th className="px-4 py-2 text-left font-medium">items</th>
                <th className="px-4 py-2 text-left font-medium">saved</th>
                <th className="px-4 py-2 text-left font-medium">alerts</th>
                <th className="px-4 py-2 text-left font-medium">unread</th>
                <th className="px-4 py-2 text-left font-medium">last_cron</th>
                <th className="px-4 py-2 text-left font-medium">actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {rows.map((r) => (
                <tr key={r.user_id} className="font-mono text-xs">
                  <td className="px-4 py-2">{r.user_id.slice(0, 8)}…</td>
                  <td className="px-4 py-2">{r.email ?? '—'}</td>
                  <td className="px-4 py-2">
                    {r.created_at ? new Date(r.created_at).toISOString() : '—'}
                  </td>
                  <td className="px-4 py-2">{r.plan}</td>
                  <td className="px-4 py-2">{r.status ?? '—'}</td>
                  <td className="px-4 py-2">
                    {r.current_period_end
                      ? new Date(r.current_period_end).toISOString()
                      : '—'}
                  </td>
                  <td className="px-4 py-2">{r.cancel_at_period_end ? 'Y' : 'N'}</td>
                  <td className="px-4 py-2">
                    {r.grace_period_ends_at
                      ? new Date(r.grace_period_ends_at).toISOString()
                      : '—'}
                  </td>
                  <td className="px-4 py-2">{r.items_count}</td>
                  <td className="px-4 py-2">{r.saved_searches_count}</td>
                  <td className="px-4 py-2">{r.alerts_count}</td>
                  <td className="px-4 py-2">{r.notifications_unread_count}</td>
                  <td className="px-4 py-2">
                    {r.last_cron_alerts_run
                      ? new Date(r.last_cron_alerts_run).toISOString()
                      : '—'}
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/users/${r.user_id}`}
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
