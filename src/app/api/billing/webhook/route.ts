import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import Stripe from 'stripe';

export const runtime = 'nodejs';

/** Disable body parsing so we get raw body for Stripe signature verification */
export const dynamic = 'force-dynamic';

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
): Promise<boolean> {
  const { data } = await admin
    .from('stripe_webhook_events')
    .select('event_id')
    .eq('event_id', eventId)
    .single();

  if (data) return true;

  await admin.from('stripe_webhook_events').insert({ event_id: eventId });
  return false;
}

async function upsertBilling(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  updates: {
    plan?: string;
    stripe_subscription_id?: string | null;
    status?: string | null;
    current_period_end?: string | null;
  },
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
  if (await ensureProcessed(admin, event.id)) {
    return NextResponse.json({ received: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
        if (!customerId) break;

        const userId = await resolveUserId(admin, customerId, session.metadata);
        if (!userId) break;

        const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
        if (subId) {
          const stripe = getStripe();
          const sub = await stripe.subscriptions.retrieve(subId);
          const periodEnd = sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null;
          await upsertBilling(admin, userId, {
            plan: 'pro',
            stripe_subscription_id: subId,
            status: sub.status,
            current_period_end: periodEnd,
          });
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

        const periodEnd = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null;

        const plan = ['active', 'trialing'].includes(sub.status) ? 'pro' : 'free';
        await upsertBilling(admin, userId, {
          plan,
          stripe_subscription_id: sub.id,
          status: sub.status,
          current_period_end: periodEnd,
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
        if (!customerId) break;

        const userId = await resolveUserId(admin, customerId, sub.metadata);
        if (!userId) break;

        await upsertBilling(admin, userId, {
          plan: 'canceled',
          stripe_subscription_id: null,
          status: 'canceled',
          current_period_end: null,
        });
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
        if (!customerId) break;

        const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
        if (!subId) break;

        const userId = await resolveUserId(admin, customerId);
        if (!userId) break;

        const stripe = getStripe();
        const sub = await stripe.subscriptions.retrieve(subId);
        const periodEnd = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null;

        await upsertBilling(admin, userId, {
          plan: 'pro',
          stripe_subscription_id: subId,
          status: sub.status,
          current_period_end: periodEnd,
        });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
        if (!customerId) break;

        const userId = await resolveUserId(admin, customerId);
        if (!userId) break;

        await upsertBilling(admin, userId, { plan: 'grace', status: 'past_due' });
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error('[billing/webhook]', event.id, err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
