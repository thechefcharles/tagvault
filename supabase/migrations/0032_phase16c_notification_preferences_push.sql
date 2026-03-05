-- Phase 16C: Extend notification_preferences with push columns

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS push_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_alerts boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_digest boolean NOT NULL DEFAULT false;
