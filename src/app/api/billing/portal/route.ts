import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { apiOk, apiError } from '@/lib/api/response';
import { getStripe } from '@/lib/stripe';
import { getBillingAccount } from '@/lib/billing';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimitOrThrow, RateLimitError } from '@/lib/rateLimit';
import { logApi } from '@/lib/apiLog';

function getBaseUrl(request: NextRequest): string {
  try {
    const url = new URL(request.url);
    if (url.origin && url.origin.startsWith('http')) return url.origin;
  } catch {
    /* ignore */
  }
  const fallback =
    process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'http://localhost:3000';
  return fallback.startsWith('http') ? fallback : `https://${fallback}`;
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const start = Date.now();
  let user: { id: string; email?: string };
  try {
    user = await requireUser();
    await rateLimitOrThrow({ key: `user:${user.id}:portal`, limit: 10, windowSec: 60 });
  } catch (e) {
    const ms = Date.now() - start;
    if (e instanceof RateLimitError) {
      logApi({
        requestId,
        path: '/api/billing/portal',
        method: 'POST',
        status: 429,
        ms,
        errorCode: 'RATE_LIMITED',
      });
      return apiError('RATE_LIMITED', 'Too many requests', { retryAfter: e.retryAfter }, 429);
    }
    logApi({ requestId, path: '/api/billing/portal', method: 'POST', status: 401, ms });
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
    logApi({
      requestId,
      userId: user.id,
      path: '/api/billing/portal',
      method: 'POST',
      status: 500,
      ms: Date.now() - start,
    });
    return apiError('INTERNAL_ERROR', 'Failed to create portal session', undefined, 500);
  }

  logApi({
    requestId,
    userId: user.id,
    path: '/api/billing/portal',
    method: 'POST',
    status: 200,
    ms: Date.now() - start,
  });
  return apiOk({ url: session.url });
}
