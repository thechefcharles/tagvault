import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/server/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripe } from '@/lib/stripe';
import { apiOk, apiError } from '@/lib/api/response';

/** Extract period end from subscription */
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

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return apiError('FORBIDDEN', 'Admin access required', undefined, 403);
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');
  if (!userId) {
    return apiError('BAD_REQUEST', 'user_id required', undefined, 400);
  }

  const admin = createAdminClient();
  const stripe = getStripe();

  const { data: billing } = await admin
    .from('billing_accounts')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single();

  if (!billing?.stripe_customer_id) {
    return apiError('NOT_FOUND', 'No Stripe customer for this user', undefined, 404);
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
      .eq('user_id', userId);
    return apiOk({ ok: true, plan: 'free', message: 'No active subscription' });
  }

  const periodEnd = getPeriodEnd(sub);
  const priceId = getPriceId(sub);
  let plan: 'free' | 'pro' = 'free';
  if (['active', 'trialing'].includes(sub.status)) {
    plan = 'pro';
  } else if (sub.status === 'past_due') {
    plan = 'pro';
  } else if (sub.cancel_at_period_end && periodEnd && new Date(periodEnd) > new Date()) {
    plan = 'pro';
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
    .eq('user_id', userId);

  return apiOk({ ok: true, plan, status: sub.status });
}
