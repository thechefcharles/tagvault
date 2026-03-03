import { createAdminClient } from '@/lib/supabase/admin';

export type BillingPlan = 'free' | 'pro' | 'grace' | 'canceled';

export type BillingAccount = {
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: BillingPlan;
  status: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
};

/** Pro = paid active; grace = past due but still has access. */
export function isPro(plan: BillingPlan): boolean {
  return plan === 'pro' || plan === 'grace';
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

  if (data) return data as BillingAccount;

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
      if (retry) return retry as BillingAccount;
    }
    throw insertError;
  }
  return inserted as BillingAccount;
}
