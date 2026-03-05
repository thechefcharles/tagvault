-- Phase 16H: Quick Save Inbox flag on items

-- 1) Add inbox flag to items

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS inbox boolean NOT NULL DEFAULT true;

-- Backfill existing rows as non-inbox so only new items default to inbox=true
UPDATE public.items
SET inbox = false
WHERE inbox IS NULL;

-- 2) Index to support inbox filtering & ordering

CREATE INDEX IF NOT EXISTS idx_items_org_inbox_created_at
  ON public.items(org_id, inbox, created_at DESC);

