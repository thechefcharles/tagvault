import { createAdminClient } from '@/lib/supabase/admin';

export type BillingPlan = 'free' | 'pro';

export type BillingAccount = {
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: BillingPlan;
  status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  price_id: string | null;
  last_payment_status: 'paid' | 'failed' | null;
  grace_period_ends_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Pro is active when plan=pro AND (status in active/trialing, OR past_due within grace, OR cancel_at_period_end with period not ended). */
export function isPro(billing: BillingAccount): boolean {
  if (billing.plan !== 'pro') return false;

  if (['active', 'trialing'].includes(billing.status ?? '')) return true;

  if (billing.status === 'past_due' && billing.grace_period_ends_at) {
    if (new Date(billing.grace_period_ends_at) > new Date()) return true;
  }

  if (billing.cancel_at_period_end && billing.current_period_end) {
    if (new Date(billing.current_period_end) > new Date()) return true;
  }

  return false;
}

/** Get billing_accounts row for user. Creates one with plan=free if missing. */
export async function getBillingAccount(userId: string): Promise<BillingAccount> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('billing_accounts')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;

  if (data) return normalizeBillingAccount(data);

  const { data: inserted, error: insertError } = await admin
    .from('billing_accounts')
    .insert({ user_id: userId, plan: 'free' })
    .select()
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      const { data: retry } = await admin
        .from('billing_accounts')
        .select('*')
        .eq('user_id', userId)
        .single();
      if (retry) return normalizeBillingAccount(retry);
    }
    throw insertError;
  }
  return normalizeBillingAccount(inserted);
}

function normalizeBillingAccount(row: Record<string, unknown>): BillingAccount {
  return {
    user_id: row.user_id as string,
    stripe_customer_id: (row.stripe_customer_id as string | null) ?? null,
    stripe_subscription_id: (row.stripe_subscription_id as string | null) ?? null,
    plan: ((row.plan as string) === 'pro' ? 'pro' : 'free') as BillingPlan,
    status: (row.status as string | null) ?? null,
    current_period_end: (row.current_period_end as string | null) ?? null,
    cancel_at_period_end: Boolean(row.cancel_at_period_end),
    price_id: (row.price_id as string | null) ?? null,
    last_payment_status: (row.last_payment_status as 'paid' | 'failed' | null) ?? null,
    grace_period_ends_at: (row.grace_period_ends_at as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}
