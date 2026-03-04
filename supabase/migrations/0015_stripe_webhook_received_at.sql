-- Phase 09B: Add received_at for admin observability
ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS received_at timestamptz DEFAULT now();
