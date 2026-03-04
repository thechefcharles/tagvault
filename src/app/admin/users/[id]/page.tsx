import { redirect, notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/server/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import Link from 'next/link';
import { UserOpsClient } from '@/components/admin/UserOpsClient';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminUserDetailPage({ params }: PageProps) {
  try {
    await requireAdmin();
  } catch {
    redirect('/login');
  }

  const { id: userId } = await params;
  const admin = createAdminClient();

  const [profileRes, userRes] = await Promise.all([
    admin.from('profiles').select('*').eq('id', userId).single(),
    admin.auth.admin.getUserById(userId),
  ]);
  const profile = profileRes.data;
  const activeOrgId = profile?.active_org_id as string | null;
  const billingRes = activeOrgId
    ? await admin.from('billing_accounts').select('*').eq('org_id', activeOrgId).single()
    : { data: null };

  const billing = billingRes.data;
  const authUser = userRes.data.user;

  if (!profile && !authUser) {
    notFound();
  }

  const hasStripeCustomer = !!(billing?.stripe_customer_id);

  const [items, notifications, webhooks] = await Promise.all([
    admin
      .from('items')
      .select('id, type, title, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
    admin
      .from('notifications')
      .select('id, type, title, read, created_at')
      .eq('owner_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
    admin
      .from('stripe_webhook_events')
      .select('event_id, event_type, received_at, processed_at, status, error_message')
      .order('processed_at', { ascending: false })
      .limit(20),
  ]);

  const itemsList = items.data ?? [];
  const notifList = notifications.data ?? [];
  const webhookList = webhooks.data ?? [];

  const email = authUser?.email ?? null;

  return (
    <div className="min-h-screen bg-neutral-50 p-6 dark:bg-neutral-950">
      <header className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Admin: User {userId.slice(0, 8)}…</h1>
          <Link href="/admin/users" className="text-blue-600 hover:underline dark:text-blue-400">
            Back to users
          </Link>
        </div>
      </header>

      <main className="mx-auto mt-8 max-w-5xl space-y-8">
        <section>
          <h2 className="mb-2 text-lg font-medium">Profile</h2>
          <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <dl className="grid gap-2 text-sm">
              <div>
                <dt className="font-medium text-neutral-500">user_id</dt>
                <dd className="font-mono text-xs">{userId}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-500">email</dt>
                <dd>{email ?? '—'}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-500">username</dt>
                <dd>{profile?.username ?? '—'}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-500">full_name</dt>
                <dd>{profile?.full_name ?? '—'}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-500">created_at</dt>
                <dd>{profile?.created_at ? new Date(profile.created_at).toISOString() : '—'}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium">Billing</h2>
          <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <dl className="grid gap-2 text-sm">
              <div>
                <dt className="font-medium text-neutral-500">plan</dt>
                <dd>{billing?.plan ?? 'free'}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-500">status</dt>
                <dd>{billing?.status ?? '—'}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-500">current_period_end</dt>
                <dd>
                  {billing?.current_period_end
                    ? new Date(billing.current_period_end).toISOString()
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-500">cancel_at_period_end</dt>
                <dd>{billing?.cancel_at_period_end ? 'Yes' : 'No'}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-500">grace_period_ends_at</dt>
                <dd>
                  {billing?.grace_period_ends_at
                    ? new Date(billing.grace_period_ends_at).toISOString()
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-500">stripe_customer_id</dt>
                <dd className="font-mono text-xs">{billing?.stripe_customer_id ?? '—'}</dd>
              </div>
            </dl>
            <div className="mt-4">
              <UserOpsClient userId={userId} hasStripeCustomer={hasStripeCustomer} />
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium">Last 20 items</h2>
          <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
            <table className="min-w-full divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left font-medium">id</th>
                  <th className="px-4 py-2 text-left font-medium">type</th>
                  <th className="px-4 py-2 text-left font-medium">title</th>
                  <th className="px-4 py-2 text-left font-medium">created_at</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {itemsList.map((i) => (
                  <tr key={i.id} className="font-mono text-xs">
                    <td className="px-4 py-2">{i.id.slice(0, 8)}…</td>
                    <td className="px-4 py-2">{i.type ?? '—'}</td>
                    <td className="max-w-[200px] truncate px-4 py-2">{i.title ?? '—'}</td>
                    <td className="px-4 py-2">
                      {i.created_at ? new Date(i.created_at).toISOString() : '—'}
                    </td>
                  </tr>
                ))}
                {itemsList.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-4 text-neutral-500">
                      No items
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium">Last 20 notifications</h2>
          <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
            <table className="min-w-full divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left font-medium">id</th>
                  <th className="px-4 py-2 text-left font-medium">type</th>
                  <th className="px-4 py-2 text-left font-medium">title</th>
                  <th className="px-4 py-2 text-left font-medium">read</th>
                  <th className="px-4 py-2 text-left font-medium">created_at</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {notifList.map((n) => (
                  <tr key={n.id} className="font-mono text-xs">
                    <td className="px-4 py-2">{n.id.slice(0, 8)}…</td>
                    <td className="px-4 py-2">{n.type ?? '—'}</td>
                    <td className="max-w-[200px] truncate px-4 py-2">{n.title ?? '—'}</td>
                    <td className="px-4 py-2">{n.read ? 'Y' : 'N'}</td>
                    <td className="px-4 py-2">
                      {n.created_at ? new Date(n.created_at).toISOString() : '—'}
                    </td>
                  </tr>
                ))}
                {notifList.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-4 text-neutral-500">
                      No notifications
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium">Last 20 webhook events (global)</h2>
          <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
            <table className="min-w-full divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left font-medium">event_id</th>
                  <th className="px-4 py-2 text-left font-medium">type</th>
                  <th className="px-4 py-2 text-left font-medium">received_at</th>
                  <th className="px-4 py-2 text-left font-medium">status</th>
                  <th className="px-4 py-2 text-left font-medium">error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {webhookList.map((w) => (
                  <tr key={w.event_id} className="font-mono text-xs">
                    <td className="px-4 py-2">{w.event_id.slice(0, 20)}…</td>
                    <td className="px-4 py-2">{w.event_type ?? '—'}</td>
                    <td className="px-4 py-2">
                      {w.received_at
                        ? new Date(w.received_at).toISOString()
                        : w.processed_at
                          ? new Date(w.processed_at).toISOString()
                          : '—'}
                    </td>
                    <td className="px-4 py-2">{w.status ?? 'ok'}</td>
                    <td className="max-w-[150px] truncate px-4 py-2 text-red-600 dark:text-red-400">
                      {w.error_message ?? '—'}
                    </td>
                  </tr>
                ))}
                {webhookList.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-4 text-neutral-500">
                      No webhook events
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium">Sentry</h2>
          <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Release / version:{' '}
              <code className="font-mono text-xs">
                {process.env.SENTRY_RELEASE ??
                  process.env.VERCEL_GIT_COMMIT_SHA ??
                  'tagvault-app@0.1.0'}
              </code>
              . Check Sentry for errors and performance traces for this user.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
