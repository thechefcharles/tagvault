import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;

/** Singleton Stripe client. Uses STRIPE_SECRET_KEY. */
export function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('Missing STRIPE_SECRET_KEY');
    stripeInstance = new Stripe(key);
  }
  return stripeInstance;
}
