-- Phase 12E: Team plan (seat_limit=5)
-- Extend billing_accounts.plan to include 'team'.

ALTER TABLE public.billing_accounts DROP CONSTRAINT IF EXISTS billing_accounts_plan_check;
ALTER TABLE public.billing_accounts ADD CONSTRAINT billing_accounts_plan_check
  CHECK (plan IN ('free', 'pro', 'team'));
