-- Phase 15B: Export/Import - external_id for idempotent merge
-- Used for data portability: export/import uses incoming ids as external_id to avoid duplicates

-- =============================================================================
-- 1) ITEMS
-- =============================================================================
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS external_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_items_org_external_id
  ON public.items(org_id, external_id)
  WHERE external_id IS NOT NULL;

-- =============================================================================
-- 2) TAGS
-- =============================================================================
ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS external_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_org_external_id
  ON public.tags(org_id, external_id)
  WHERE external_id IS NOT NULL;

-- =============================================================================
-- 3) COLLECTIONS
-- =============================================================================
ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS external_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_collections_org_external_id
  ON public.collections(org_id, external_id)
  WHERE external_id IS NOT NULL;

-- =============================================================================
-- 4) SAVED_SEARCHES
-- =============================================================================
ALTER TABLE public.saved_searches
  ADD COLUMN IF NOT EXISTS external_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_searches_org_external_id
  ON public.saved_searches(org_id, external_id)
  WHERE org_id IS NOT NULL AND external_id IS NOT NULL;

-- =============================================================================
-- 5) ALERTS
-- =============================================================================
ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS external_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_org_external_id
  ON public.alerts(org_id, external_id)
  WHERE org_id IS NOT NULL AND external_id IS NOT NULL;
