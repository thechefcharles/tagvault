-- Phase 8A: Entitlements + Usage Limits
-- plan enum, user_entitlements, usage_counters, RLS, default provisioning

-- =============================================================================
-- 1) PLAN ENUM
-- =============================================================================
CREATE TYPE public.plan_t AS ENUM ('free', 'pro');

-- =============================================================================
-- 2) USER_ENTITLEMENTS
-- =============================================================================
CREATE TABLE public.user_entitlements (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan public.plan_t NOT NULL DEFAULT 'free',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_user_entitlements_updated_at
  BEFORE UPDATE ON public.user_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Provision entitlement for new users (trigger on profiles insert)
CREATE OR REPLACE FUNCTION public.provision_user_entitlement()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_entitlements (user_id, plan)
  VALUES (NEW.id, 'free')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_profile_created_provision_entitlement
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.provision_user_entitlement();

-- Backfill: provision entitlements for existing users without one
INSERT INTO public.user_entitlements (user_id, plan)
SELECT p.id, 'free' FROM public.profiles p
ON CONFLICT (user_id) DO NOTHING;

-- =============================================================================
-- 3) USAGE_COUNTERS
-- =============================================================================
CREATE TABLE public.usage_counters (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  items_created int NOT NULL DEFAULT 0,
  searches_run int NOT NULL DEFAULT 0,
  alerts_created int NOT NULL DEFAULT 0,
  saved_searches_created int NOT NULL DEFAULT 0,
  embeddings_enqueued int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, period_start)
);

CREATE TRIGGER set_usage_counters_updated_at
  BEFORE UPDATE ON public.usage_counters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_usage_counters_user_id ON public.usage_counters(user_id);

-- =============================================================================
-- 4) RLS
-- =============================================================================
ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

-- user_entitlements: users can read their own row only
CREATE POLICY "user_entitlements_select_own" ON public.user_entitlements
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- usage_counters: users can read and update their own rows
CREATE POLICY "usage_counters_select_own" ON public.usage_counters
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "usage_counters_insert_own" ON public.usage_counters
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "usage_counters_update_own" ON public.usage_counters
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
