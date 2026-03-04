import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import Stripe from 'stripe';

export const runtime = 'nodejs';

/** Disable body parsing so we get raw body for Stripe signature verification */
export const dynamic = 'force-dynamic';

const BILLING_GRACE_DAYS = Math.max(1, parseInt(process.env.BILLING_GRACE_DAYS ?? '7', 10) || 7);

function logWebhook(eventId: string, type: string, msg: string, extra?: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      type: 'billing_webhook',
      eventId,
      eventType: type,
      msg,
      ...extra,
    }),
  );
}

async function resolveUserId(
  admin: ReturnType<typeof createAdminClient>,
  customerId: string,
  metadata?: { user_id?: string } | null,
): Promise<string | null> {
  if (metadata?.user_id) return metadata.user_id;

  const { data } = await admin
    .from('billing_accounts')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .single();

  return data?.user_id ?? null;
}

async function ensureProcessed(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  eventType: string,
): Promise<boolean> {
  const { data } = await admin
    .from('stripe_webhook_events')
    .select('event_id')
    .eq('event_id', eventId)
    .single();

  if (data) return true;

  const now = new Date().toISOString();
  await admin.from('stripe_webhook_events').insert({
    event_id: eventId,
    event_type: eventType,
    received_at: now,
  });
  return false;
}

async function recordWebhookFailure(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  errorMessage: string,
) {
  await admin
    .from('stripe_webhook_events')
    .update({ status: 'failed', error_message: errorMessage })
    .eq('event_id', eventId);
}

/** Extract period end from subscription (supports item-level periods in Stripe API 2025+) */
function getPeriodEnd(
  sub: { current_period_end?: number; items?: { data?: Array<{ current_period_end?: number }> } },
): string | null {
  const end = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
  return end ? new Date(end * 1000).toISOString() : null;
}

/** Extract price_id from first subscription item */
function getPriceId(sub: Stripe.Subscription): string | null {
  const item = sub.items?.data?.[0];
  const price = item?.price;
  return typeof price === 'object' && price?.id ? price.id : null;
}

type BillingUpdates = {
  plan?: 'free' | 'pro';
  stripe_subscription_id?: string | null;
  status?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  price_id?: string | null;
  last_payment_status?: 'paid' | 'failed' | null;
  grace_period_ends_at?: string | null;
};

async function upsertBilling(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  updates: BillingUpdates,
) {
  const { error } = await admin
    .from('billing_accounts')
    .upsert(
      {
        user_id: userId,
        ...updates,
      },
      { onConflict: 'user_id' },
    );

  if (error) throw error;
}

/** Compute grace_period_ends_at = now + BILLING_GRACE_DAYS */
function gracePeriodEndsAt(): string {
  const d = new Date();
  d.setDate(d.getDate() + BILLING_GRACE_DAYS);
  return d.toISOString();
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret || !sig) {
    return NextResponse.json({ error: 'Missing webhook secret or signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid signature';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const admin = createAdminClient();

  if (await ensureProcessed(admin, event.id, event.type)) {
    logWebhook(event.id, event.type, 'idempotent skip');
    return NextResponse.json({ received: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId =
          typeof session.customer === 'string' ? session.customer : session.customer?.id;
        if (!customerId) break;

        const userId = await resolveUserId(admin, customerId, session.metadata);
        if (!userId) break;

        const subId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id;
        if (subId) {
          const stripe = getStripe();
          const sub = await stripe.subscriptions.retrieve(subId);
          const periodEnd = getPeriodEnd(sub);
          const priceId = getPriceId(sub);
          await upsertBilling(admin, userId, {
            plan: 'pro',
            stripe_subscription_id: subId,
            status: sub.status,
            current_period_end: periodEnd,
            cancel_at_period_end: sub.cancel_at_period_end ?? false,
            price_id: priceId,
            last_payment_status: 'paid',
            grace_period_ends_at: null,
          });
          logWebhook(event.id, event.type, 'checkout completed', { userId });
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
        if (!customerId) break;

        const userId = await resolveUserId(admin, customerId, sub.metadata);
        if (!userId) break;

        const periodEnd = getPeriodEnd(sub);
        const priceId = getPriceId(sub);
        const cancelAtPeriodEnd = sub.cancel_at_period_end ?? false;

        let plan: 'free' | 'pro' = 'free';
        if (['active', 'trialing'].includes(sub.status)) {
          plan = 'pro';
        } else if (sub.status === 'past_due') {
          plan = 'pro';
        } else if (sub.status === 'canceled' && cancelAtPeriodEnd && periodEnd) {
          const periodEndDate = new Date(periodEnd);
          if (periodEndDate > new Date()) plan = 'pro';
        }

        await upsertBilling(admin, userId, {
          plan,
          stripe_subscription_id: sub.id,
          status: sub.status,
          current_period_end: periodEnd,
          cancel_at_period_end: cancelAtPeriodEnd,
          price_id: priceId,
        });
        logWebhook(event.id, event.type, 'subscription updated', { userId, plan, status: sub.status });
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
        if (!customerId) break;

        const userId = await resolveUserId(admin, customerId, sub.metadata);
        if (!userId) break;

        await upsertBilling(admin, userId, {
          plan: 'free',
          stripe_subscription_id: null,
          status: 'canceled',
          current_period_end: null,
          cancel_at_period_end: false,
          price_id: null,
          last_payment_status: null,
          grace_period_ends_at: null,
        });
        logWebhook(event.id, event.type, 'subscription deleted', { userId });
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | { id?: string };
        };
        const customerId =
          typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
        if (!customerId) break;

        const subId =
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription?.id;
        if (!subId) break;

        const userId = await resolveUserId(admin, customerId);
        if (!userId) break;

        const stripe = getStripe();
        const sub = await stripe.subscriptions.retrieve(subId);
        const periodEnd = getPeriodEnd(sub);
        const priceId = getPriceId(sub);

        await upsertBilling(admin, userId, {
          plan: 'pro',
          stripe_subscription_id: subId,
          status: 'active',
          current_period_end: periodEnd,
          cancel_at_period_end: sub.cancel_at_period_end ?? false,
          price_id: priceId,
          last_payment_status: 'paid',
          grace_period_ends_at: null,
        });
        logWebhook(event.id, event.type, 'invoice paid', { userId });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
        if (!customerId) break;

        const userId = await resolveUserId(admin, customerId);
        if (!userId) break;

        const graceEnd = gracePeriodEndsAt();
        await upsertBilling(admin, userId, {
          plan: 'pro',
          status: 'past_due',
          last_payment_status: 'failed',
          grace_period_ends_at: graceEnd,
        });
        logWebhook(event.id, event.type, 'payment failed, grace set', {
          userId,
          grace_period_ends_at: graceEnd,
        });
        break;
      }

      default:
        logWebhook(event.id, event.type, 'unhandled type');
        break;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logWebhook(event.id, event.type, 'handler failed', { error: msg });
    await recordWebhookFailure(admin, event.id, msg);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
