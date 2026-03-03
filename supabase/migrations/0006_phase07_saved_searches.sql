-- Phase 7: Saved Searches
-- Migration: 0006

-- =============================================================================
-- 1) SAVED_SEARCHES TABLE
-- =============================================================================
CREATE TABLE public.saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  query text NOT NULL DEFAULT '',
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort text NOT NULL DEFAULT 'best_match',
  semantic_enabled boolean NOT NULL DEFAULT true,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saved_searches_scope_check CHECK (
    (owner_user_id IS NOT NULL AND org_id IS NULL) OR
    (owner_user_id IS NULL AND org_id IS NOT NULL)
  )
);

CREATE INDEX idx_saved_searches_owner ON public.saved_searches (owner_user_id, pinned, updated_at DESC)
  WHERE owner_user_id IS NOT NULL;

CREATE INDEX idx_saved_searches_org ON public.saved_searches (org_id, pinned, updated_at DESC)
  WHERE org_id IS NOT NULL;

CREATE TRIGGER set_saved_searches_updated_at
  BEFORE UPDATE ON public.saved_searches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 2) RLS
-- =============================================================================
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

-- Personal scope: owner_user_id = auth.uid()
CREATE POLICY "saved_searches_select_own" ON public.saved_searches
  FOR SELECT USING (owner_user_id = auth.uid());

CREATE POLICY "saved_searches_insert_own" ON public.saved_searches
  FOR INSERT WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "saved_searches_update_own" ON public.saved_searches
  FOR UPDATE USING (owner_user_id = auth.uid());

CREATE POLICY "saved_searches_delete_own" ON public.saved_searches
  FOR DELETE USING (owner_user_id = auth.uid());

-- TODO: Org scope policies when org saved searches are implemented
-- CREATE POLICY "saved_searches_select_org" ...
-- CREATE POLICY "saved_searches_insert_org" ...
-- etc.
