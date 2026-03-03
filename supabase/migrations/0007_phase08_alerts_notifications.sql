-- Phase 8: Alerts + In-App Notifications
-- Migration: 0007

-- =============================================================================
-- 1) ALERTS TABLE
-- =============================================================================
CREATE TABLE public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  saved_search_id uuid NOT NULL REFERENCES public.saved_searches(id) ON DELETE CASCADE,
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  frequency_minutes int NOT NULL DEFAULT 60,
  last_run_at timestamptz,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  notify_on_new boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alerts_frequency_check CHECK (frequency_minutes >= 15),
  CONSTRAINT alerts_scope_check CHECK (
    (owner_user_id IS NOT NULL AND org_id IS NULL) OR
    (owner_user_id IS NULL AND org_id IS NOT NULL)
  )
);

CREATE INDEX idx_alerts_owner_next ON public.alerts (owner_user_id, enabled, next_run_at)
  WHERE owner_user_id IS NOT NULL;

CREATE INDEX idx_alerts_org_next ON public.alerts (org_id, enabled, next_run_at)
  WHERE org_id IS NOT NULL;

CREATE INDEX idx_alerts_saved_search ON public.alerts (saved_search_id);

CREATE TRIGGER set_alerts_updated_at
  BEFORE UPDATE ON public.alerts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 2) ALERT_RUNS TABLE
-- =============================================================================
CREATE TABLE public.alert_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
  run_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error')),
  new_match_count int NOT NULL DEFAULT 0,
  error text
);

CREATE INDEX idx_alert_runs_alert_run ON public.alert_runs (alert_id, run_at DESC);

-- =============================================================================
-- 3) ALERT_ITEM_STATE TABLE (dedupe: track notified items)
-- =============================================================================
CREATE TABLE public.alert_item_state (
  alert_id uuid NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (alert_id, item_id)
);

CREATE INDEX idx_alert_item_state_alert ON public.alert_item_state (alert_id);

-- =============================================================================
-- 4) NOTIFICATIONS TABLE
-- =============================================================================
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_owner_read_created ON public.notifications (owner_user_id, read, created_at DESC);

-- =============================================================================
-- 5) RLS
-- =============================================================================
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alerts_select_own" ON public.alerts
  FOR SELECT USING (owner_user_id = auth.uid());

CREATE POLICY "alerts_insert_own" ON public.alerts
  FOR INSERT WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "alerts_update_own" ON public.alerts
  FOR UPDATE USING (owner_user_id = auth.uid());

CREATE POLICY "alerts_delete_own" ON public.alerts
  FOR DELETE USING (owner_user_id = auth.uid());

-- alert_runs: read via alerts they own
ALTER TABLE public.alert_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alert_runs_select_via_alert" ON public.alert_runs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.alerts
      WHERE alerts.id = alert_runs.alert_id AND alerts.owner_user_id = auth.uid()
    )
  );

-- alert_item_state: no direct user access; service role only
ALTER TABLE public.alert_item_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alert_item_state_select_via_alert" ON public.alert_item_state
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.alerts
      WHERE alerts.id = alert_item_state.alert_id AND alerts.owner_user_id = auth.uid()
    )
  );

-- notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (owner_user_id = auth.uid());

CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (owner_user_id = auth.uid());
