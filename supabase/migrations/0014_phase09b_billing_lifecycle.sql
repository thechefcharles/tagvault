-- Phase 09B: Billing Lifecycle + Ops Hardening
-- Add columns for subscription state, grace period, webhook observability

-- =============================================================================
-- 1) BILLING_ACCOUNTS: new columns
-- =============================================================================
ALTER TABLE public.billing_accounts
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS price_id text,
  ADD COLUMN IF NOT EXISTS last_payment_status text CHECK (last_payment_status IS NULL OR last_payment_status IN ('paid', 'failed')),
  ADD COLUMN IF NOT EXISTS grace_period_ends_at timestamptz;

-- Normalize plan to free|pro; use status for Stripe state
-- First migrate existing grace/canceled to canonical state
UPDATE public.billing_accounts
SET plan = CASE
  WHEN plan = 'canceled' THEN 'free'
  WHEN plan IN ('grace', 'pro') THEN 'pro'
  ELSE plan
END
WHERE plan IN ('grace', 'canceled');

-- Drop old CHECK and add new one (plan = free | pro only)
ALTER TABLE public.billing_accounts DROP CONSTRAINT IF EXISTS billing_accounts_plan_check;
ALTER TABLE public.billing_accounts ADD CONSTRAINT billing_accounts_plan_check
  CHECK (plan IN ('free', 'pro'));

-- Ensure status fits Stripe values
ALTER TABLE public.billing_accounts DROP CONSTRAINT IF EXISTS billing_accounts_status_check;
ALTER TABLE public.billing_accounts ADD CONSTRAINT billing_accounts_status_check
  CHECK (status IS NULL OR status IN ('trialing', 'active', 'past_due', 'unpaid', 'canceled', 'incomplete'));

-- =============================================================================
-- 2) STRIPE_WEBHOOK_EVENTS: observability columns
-- =============================================================================
ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'ok' CHECK (status IN ('ok', 'failed')),
  ADD COLUMN IF NOT EXISTS error_message text;
