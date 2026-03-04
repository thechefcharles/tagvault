/**
 * Shared admin billing ops (resync from Stripe).
 * Used by /api/admin/billing/resync and /api/admin/users/[id]/resync-billing.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { getStripe } from '@/lib/stripe';

function getPeriodEnd(
  sub: { current_period_end?: number; items?: { data?: Array<{ current_period_end?: number }> } },
): string | null {
  const end = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
  return end ? new Date(end * 1000).toISOString() : null;
}

function getPriceId(sub: { items?: { data?: Array<{ price?: { id?: string } }> } }): string | null {
  const item = sub.items?.data?.[0];
  const price = item?.price;
  return typeof price === 'object' && price?.id ? price.id : null;
}

export type ResyncResult =
  | { ok: true; plan: 'free'; message: string }
  | { ok: true; plan: 'pro'; status: string }
  | { ok: true; plan: 'team'; status: string }
  | { ok: false; error: string };

/** Resync billing for a user: uses that user's active org's billing row. */
export async function resyncBillingFromStripe(userId: string): Promise<ResyncResult> {
  const admin = createAdminClient();
  const stripe = getStripe();

  const { data: profile } = await admin
    .from('profiles')
    .select('active_org_id')
    .eq('id', userId)
    .single();
  const orgId = profile?.active_org_id as string | null;
  if (!orgId) return { ok: false, error: 'User has no active org' };

  const { data: billing } = await admin
    .from('billing_accounts')
    .select('stripe_customer_id')
    .eq('org_id', orgId)
    .single();

  if (!billing?.stripe_customer_id) {
    return { ok: false, error: 'No Stripe customer for this org' };
  }

  const customerId = billing.stripe_customer_id;

  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 1,
  });

  const sub = subs.data[0];

  if (!sub) {
    await admin
      .from('billing_accounts')
      .update({
        plan: 'free',
        stripe_subscription_id: null,
        status: 'canceled',
        current_period_end: null,
        cancel_at_period_end: false,
        price_id: null,
        last_payment_status: null,
        grace_period_ends_at: null,
      })
      .eq('org_id', orgId);
    return { ok: true, plan: 'free', message: 'No active subscription' };
  }

  const periodEnd = getPeriodEnd(sub);
  const priceId = getPriceId(sub);
  const teamPrice = process.env.STRIPE_PRICE_TEAM_MONTHLY;
  const planFromPrice = priceId === teamPrice ? 'team' : 'pro';
  let plan: 'free' | 'pro' | 'team' = 'free';
  if (['active', 'trialing'].includes(sub.status)) {
    plan = planFromPrice;
  } else if (sub.status === 'past_due') {
    plan = planFromPrice;
  } else if (sub.cancel_at_period_end && periodEnd && new Date(periodEnd) > new Date()) {
    plan = planFromPrice;
  }

  await admin
    .from('billing_accounts')
    .update({
      plan,
      stripe_subscription_id: sub.id,
      status: sub.status,
      current_period_end: periodEnd,
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
      price_id: priceId,
    })
    .eq('org_id', orgId);

  if (plan === 'pro') return { ok: true, plan: 'pro', status: sub.status };
  if (plan === 'team') return { ok: true, plan: 'team', status: sub.status };
  return { ok: true, plan: 'free', message: `Subscription status: ${sub.status}` };
}
