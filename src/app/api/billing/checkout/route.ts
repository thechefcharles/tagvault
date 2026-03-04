import { NextRequest } from 'next/server';
import { requireActiveOrg } from '@/lib/server/auth';
import { apiOk, apiError, buildApiContext } from '@/lib/api/response';
import { getStripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimitOrThrow, RateLimitError, getRateLimitKey } from '@/lib/rateLimit';
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
  const start = Date.now();
  const ctx = () => buildApiContext(request, null, null);
  let user: { id: string; email?: string };
  let activeOrgId: string;
  try {
    const ctx = await requireActiveOrg();
    user = ctx.user;
    activeOrgId = ctx.activeOrgId;
    const key = getRateLimitKey('billing:checkout', request, user.id);
    await rateLimitOrThrow({ key, limit: 10, windowSec: 60 });
  } catch (e) {
    const ms = Date.now() - start;
    if (e instanceof RateLimitError) {
      logApi({
        requestId: request.headers.get('x-request-id') ?? crypto.randomUUID(),
        path: '/api/billing/checkout',
        method: 'POST',
        status: 429,
        ms,
        errorCode: 'RATE_LIMITED',
      });
      const res = apiError('RATE_LIMITED', 'Too many requests', {
        retry_after_seconds: e.retryAfter,
      }, 429, ctx());
      e.headers.forEach((v, k) => res.headers.set(k, v));
      return res;
    }
    logApi({
      requestId: request.headers.get('x-request-id') ?? crypto.randomUUID(),
      path: '/api/billing/checkout',
      method: 'POST',
      status: 401,
      ms,
    });
    return apiError('UNAUTHORIZED', 'Unauthorized', undefined, 401, ctx());
  }

  const priceId = process.env.STRIPE_PRICE_PRO_MONTHLY;
  if (!priceId) {
    return apiError('INTERNAL_ERROR', 'Billing not configured', undefined, 500, ctx());
  }

  const stripe = getStripe();
  const admin = createAdminClient();
  const { getBillingAccountForOrg } = await import('@/lib/billing');
  let billing = await getBillingAccountForOrg(activeOrgId);

  if (!billing.stripe_customer_id) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { user_id: user.id, org_id: activeOrgId },
    });
    await admin
      .from('billing_accounts')
      .update({ stripe_customer_id: customer.id })
      .eq('org_id', activeOrgId);
    billing = await getBillingAccountForOrg(activeOrgId);
  }

  const baseUrl = getBaseUrl(request);
  const session = await stripe.checkout.sessions.create({
    customer: billing.stripe_customer_id!,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/billing/success`,
    cancel_url: `${baseUrl}/pricing?canceled=1`,
    metadata: { user_id: user.id, org_id: activeOrgId },
    subscription_data: { metadata: { user_id: user.id, org_id: activeOrgId } },
  });

  if (!session.url) {
    logApi({
      requestId: request.headers.get('x-request-id') ?? crypto.randomUUID(),
      userId: user.id,
      path: '/api/billing/checkout',
      method: 'POST',
      status: 500,
      ms: Date.now() - start,
    });
    return apiError(
      'INTERNAL_ERROR',
      'Failed to create checkout session',
      undefined,
      500,
      buildApiContext(request, user, billing),
    );
  }

  logApi({
    requestId: request.headers.get('x-request-id') ?? crypto.randomUUID(),
    userId: user.id,
    path: '/api/billing/checkout',
    method: 'POST',
    status: 200,
    ms: Date.now() - start,
  });
  return apiOk({ url: session.url });
}
