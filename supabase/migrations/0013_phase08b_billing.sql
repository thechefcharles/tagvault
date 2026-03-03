-- Phase 08B: Stripe Billing
-- billing_accounts (Stripe state), stripe_webhook_events (idempotency)

-- =============================================================================
-- 1) BILLING_ACCOUNTS
-- =============================================================================
CREATE TABLE public.billing_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text UNIQUE,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'grace', 'canceled')),
  status text,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_billing_accounts_updated_at
  BEFORE UPDATE ON public.billing_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_billing_accounts_stripe_customer ON public.billing_accounts(stripe_customer_id);
CREATE INDEX idx_billing_accounts_stripe_subscription ON public.billing_accounts(stripe_subscription_id);

-- =============================================================================
-- 2) STRIPE_WEBHOOK_EVENTS (idempotency)
-- =============================================================================
CREATE TABLE public.stripe_webhook_events (
  event_id text PRIMARY KEY,
  processed_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 3) RLS
-- =============================================================================
ALTER TABLE public.billing_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- billing_accounts: user can SELECT/INSERT/UPDATE own row
CREATE POLICY "billing_accounts_select_own" ON public.billing_accounts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "billing_accounts_insert_own" ON public.billing_accounts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "billing_accounts_update_own" ON public.billing_accounts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- stripe_webhook_events: no policies (service-role only; webhook handler uses admin client)
-- RLS enabled with no policies = deny all for anon/authenticated
