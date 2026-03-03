import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { apiOk, apiError } from '@/lib/api/response';
import { getStripe } from '@/lib/stripe';
import { getBillingAccount } from '@/lib/billing';
import { createAdminClient } from '@/lib/supabase/admin';

function getBaseUrl(request: NextRequest): string {
  try {
    const url = new URL(request.url);
    if (url.origin && url.origin.startsWith('http')) return url.origin;
  } catch {
    /* ignore */
  }
  const fallback =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL ||
    'http://localhost:3000';
  return fallback.startsWith('http') ? fallback : `https://${fallback}`;
}

export async function POST(request: NextRequest) {
  let user: { id: string; email?: string };
  try {
    user = await requireUser();
  } catch {
    return apiError('UNAUTHORIZED', 'Unauthorized', undefined, 401);
  }

  const stripe = getStripe();
  const admin = createAdminClient();
  let billing = await getBillingAccount(user.id);

  if (!billing.stripe_customer_id) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { user_id: user.id },
    });
    await admin
      .from('billing_accounts')
      .update({ stripe_customer_id: customer.id })
      .eq('user_id', user.id);
    billing = await getBillingAccount(user.id);
  }

  const baseUrl = getBaseUrl(request);
  const session = await stripe.billingPortal.sessions.create({
    customer: billing.stripe_customer_id!,
    return_url: `${baseUrl}/app`,
  });

  if (!session.url) {
    return apiError('INTERNAL_ERROR', 'Failed to create portal session', undefined, 500);
  }

  return apiOk({ url: session.url });
}
