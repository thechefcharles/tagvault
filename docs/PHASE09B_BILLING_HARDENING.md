# Phase 09B: Billing Lifecycle + Ops Hardening

## Overview

Subscription status, grace period, idempotency, and admin ops for production correctness.

## Env vars

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BILLING_GRACE_DAYS` | No | 7 | Days of grace when `invoice.payment_failed` before downgrade |
| `ADMIN_EMAILS` | Yes (for admin) | — | Comma-separated emails allowed to access `/admin/billing` |

## Migrations

- `0014_phase09b_billing_lifecycle.sql` — billing_accounts columns (cancel_at_period_end, price_id, last_payment_status, grace_period_ends_at), status/plan constraints, stripe_webhook_events observability
- `0015_stripe_webhook_received_at.sql` — received_at on stripe_webhook_events

## Verification Checklist

### 1. payment_failed sets grace and keeps Pro until grace ends

1. Create a Pro subscription (checkout → success).
2. In Stripe Dashboard → Customers → select customer → trigger `invoice.payment_failed` (or use a test card that will fail on renewal).
3. Verify `billing_accounts`: `status='past_due'`, `grace_period_ends_at` ≈ now + 7 days.
4. Confirm Pro limits still apply (e.g. create >100 items).
5. Set `grace_period_ends_at` in DB to a past timestamp.
6. Reload app; confirm Pro actions are blocked (402 + PLAN_LIMIT_EXCEEDED).

### 2. invoice.paid restores active + clears grace

1. After a `payment_failed` scenario, resolve the invoice (retry payment in Stripe).
2. Stripe sends `invoice.paid`.
3. Verify `billing_accounts`: `status='active'`, `grace_period_ends_at` is NULL, `last_payment_status='paid'`.
4. Confirm Pro limits apply again.

### 3. Cancel at period end remains Pro until period end then downgrades

1. As Pro user, cancel subscription at period end (Stripe Customer Portal or API).
2. Verify `billing_accounts`: `cancel_at_period_end=true`, `current_period_end` in future.
3. Confirm Pro limits still apply until `current_period_end`.
4. Wait for period end (or set `current_period_end` to past in DB); Stripe sends `customer.subscription.deleted`.
5. Verify `billing_accounts`: `plan='free'`, `status='canceled'`.
6. Confirm free limits apply.

### 4. Webhook idempotency (replay same event id)

1. Use Stripe CLI to forward webhooks: `stripe listen --forward-to localhost:3000/api/billing/webhook`.
2. Trigger any billing event (e.g. checkout completed).
3. Note the `event.id` from Stripe CLI or Dashboard.
4. Replay the same event: `stripe events resend evt_xxx` or re-send the webhook payload.
5. Second request returns 200; no duplicate DB updates (e.g. no double plan change).

### 5. Admin page access control

1. Set `ADMIN_EMAILS=admin@example.com` in `.env.local`.
2. Log in as `admin@example.com`; visit `/admin/billing` → page loads.
3. Log in as a different user; visit `/admin/billing` → redirect to `/login` or 403.
4. Unauthenticated visit to `/admin/billing` → redirect to `/login`.

### 6. Resync from Stripe

1. As admin, open `/admin/billing`.
2. Click "Resync" on a row with a Stripe customer.
3. Confirm `billing_accounts` row is updated to match Stripe (plan, status, current_period_end, etc.).

## Implementation Notes

- Source of truth: `billing_accounts.plan` (free | pro); `status` holds Stripe subscription status.
- Pro is effective when: `plan='pro'` AND (status in active/trialing, OR past_due within grace, OR cancel_at_period_end with period not ended).
- Entitlements: `src/lib/billing.ts` `isPro(billing)`, called from `src/lib/entitlements/index.ts`.
