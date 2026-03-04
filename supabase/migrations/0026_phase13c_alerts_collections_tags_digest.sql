-- Phase 13C: Collection/tag alerts + delta notifications + digest prefs

-- =============================================================================
-- 1) Extend alerts
-- =============================================================================
ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'saved_search',
  ADD COLUMN IF NOT EXISTS source_id uuid,
  ADD COLUMN IF NOT EXISTS tag_ids uuid[],
  ADD COLUMN IF NOT EXISTS last_cursor timestamptz;

ALTER TABLE public.alerts
  ALTER COLUMN saved_search_id DROP NOT NULL;

ALTER TABLE public.alerts
  ADD CONSTRAINT alerts_source_type_check
  CHECK (source_type IN ('saved_search', 'collection', 'tag_filter'));

-- Backfill: existing alerts stay saved_search, source_id = saved_search_id
UPDATE public.alerts
SET source_type = 'saved_search',
    source_id = saved_search_id
WHERE source_type = 'saved_search' AND source_id IS NULL AND saved_search_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_alerts_org_source_next
  ON public.alerts(org_id, source_type, next_run_at)
  WHERE org_id IS NOT NULL AND enabled = true;

-- =============================================================================
-- 2) notification_preferences (per user, per org)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  digest_frequency text NOT NULL DEFAULT 'none' CHECK (digest_frequency IN ('none', 'daily', 'weekly')),
  timezone text NOT NULL DEFAULT 'UTC',
  digest_time_local text,
  last_digest_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_org_user
  ON public.notification_preferences(org_id, user_id);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_preferences_select_org_member" ON public.notification_preferences
  FOR SELECT USING (public.is_org_member(org_id));

CREATE POLICY "notification_preferences_insert_org_member" ON public.notification_preferences
  FOR INSERT WITH CHECK (public.is_org_member(org_id) AND user_id = auth.uid());

CREATE POLICY "notification_preferences_update_org_member" ON public.notification_preferences
  FOR UPDATE USING (public.is_org_member(org_id) AND user_id = auth.uid());
