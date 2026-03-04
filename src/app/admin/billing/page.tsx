import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/server/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import Link from 'next/link';
import { BillingOpsClient } from '@/components/admin/BillingOpsClient';

export const dynamic = 'force-dynamic';

type BillingRow = {
  user_id: string;
  user_email: string | null;
  plan: string;
  status: string | null;
  current_period_end: string | null;
  grace_period_ends_at: string | null;
  stripe_customer_id: string | null;
  updated_at: string;
};

type WebhookRow = {
  event_id: string;
  event_type: string | null;
  received_at: string | null;
  processed_at: string;
  status: string | null;
  error_message: string | null;
};

export default async function AdminBillingPage() {
  let user;
  try {
    user = await requireAdmin();
  } catch {
    redirect('/login');
  }

  const admin = createAdminClient();

  const { data: accounts } = await admin
    .from('billing_accounts')
    .select('user_id, plan, status, current_period_end, grace_period_ends_at, stripe_customer_id, updated_at')
    .order('updated_at', { ascending: false })
    .limit(200);

  const userIds = Array.from(new Set((accounts ?? []).map((a) => a.user_id)));
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

  const billingRows: BillingRow[] = (accounts ?? []).map((a) => ({
    user_id: a.user_id,
    user_email: emailMap.get(a.user_id) ?? null,
    plan: a.plan ?? 'free',
    status: a.status,
    current_period_end: a.current_period_end,
    grace_period_ends_at: a.grace_period_ends_at,
    stripe_customer_id: a.stripe_customer_id,
    updated_at: a.updated_at,
  }));

  const { data: events } = await admin
    .from('stripe_webhook_events')
    .select('event_id, event_type, received_at, processed_at, status, error_message')
    .order('processed_at', { ascending: false })
    .limit(100);

  const webhookRows: WebhookRow[] = (events ?? []).map((e) => ({
    event_id: e.event_id,
    event_type: e.event_type,
    received_at: e.received_at,
    processed_at: e.processed_at,
    status: e.status ?? 'ok',
    error_message: e.error_message,
  }));

  return (
    <div className="min-h-screen bg-neutral-50 p-6 dark:bg-neutral-950">
      <header className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Admin: Billing Ops</h1>
          <div className="flex gap-3 text-sm">
            <span className="text-neutral-500">{user.email}</span>
            <Link href="/app" className="text-blue-600 hover:underline dark:text-blue-400">
              Back to app
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto mt-8 max-w-6xl space-y-10">
        <section>
          <h2 className="mb-4 text-lg font-medium">Billing accounts</h2>
          <BillingOpsClient billingRows={billingRows} />
        </section>

        <section>
          <h2 className="mb-4 text-lg font-medium">Recent webhook events</h2>
          <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
            <table className="min-w-full divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left font-medium">event_id</th>
                  <th className="px-4 py-2 text-left font-medium">type</th>
                  <th className="px-4 py-2 text-left font-medium">received_at</th>
                  <th className="px-4 py-2 text-left font-medium">processed_at</th>
                  <th className="px-4 py-2 text-left font-medium">status</th>
                  <th className="px-4 py-2 text-left font-medium">error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {webhookRows.map((r) => (
                  <tr key={r.event_id} className="font-mono text-xs">
                    <td className="px-4 py-2">{r.event_id.slice(0, 20)}…</td>
                    <td className="px-4 py-2">{r.event_type ?? '—'}</td>
                    <td className="px-4 py-2">{r.received_at ? new Date(r.received_at).toISOString() : '—'}</td>
                    <td className="px-4 py-2">{new Date(r.processed_at).toISOString()}</td>
                    <td className="px-4 py-2">
                      <span
                        className={
                          r.status === 'failed'
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-neutral-600 dark:text-neutral-400'
                        }
                      >
                        {r.status ?? 'ok'}
                      </span>
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-2 text-red-600 dark:text-red-400">
                      {r.error_message ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
