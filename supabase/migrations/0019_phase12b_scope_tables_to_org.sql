-- Phase 12B: Scope items and billing_accounts to org; backfill; RLS

-- =============================================================================
-- 1) ITEMS: add org_id, backfill, NOT NULL
-- =============================================================================
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Backfill: set org_id from profile.active_org_id (set by 0018)
UPDATE public.items i
SET org_id = p.active_org_id
FROM public.profiles p
WHERE p.id = i.user_id AND i.org_id IS NULL AND p.active_org_id IS NOT NULL;

-- Fallback: org where user is owner
UPDATE public.items i
SET org_id = o.id
FROM public.organizations o
WHERE o.owner_id = i.user_id AND i.org_id IS NULL;

-- Last resort: any org the user is a member of
UPDATE public.items i
SET org_id = (SELECT om.org_id FROM public.org_members om WHERE om.user_id = i.user_id LIMIT 1)
WHERE i.org_id IS NULL;

ALTER TABLE public.items
  ALTER COLUMN org_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_items_org_id ON public.items(org_id);
CREATE INDEX IF NOT EXISTS idx_items_org_created ON public.items(org_id, created_at DESC);

-- RLS: replace user-only with org membership
DROP POLICY IF EXISTS "items_select_own" ON public.items;
DROP POLICY IF EXISTS "items_insert_own" ON public.items;
DROP POLICY IF EXISTS "items_update_own" ON public.items;
DROP POLICY IF EXISTS "items_delete_own" ON public.items;

CREATE POLICY "items_select_org_member" ON public.items
  FOR SELECT USING (public.is_org_member(org_id));

CREATE POLICY "items_insert_org_member" ON public.items
  FOR INSERT WITH CHECK (
    public.is_org_member(org_id) AND auth.uid() = user_id
  );

CREATE POLICY "items_update_org_member" ON public.items
  FOR UPDATE USING (public.is_org_member(org_id));

CREATE POLICY "items_delete_org_member" ON public.items
  FOR DELETE USING (public.is_org_member(org_id));

-- =============================================================================
-- 2) BILLING_ACCOUNTS: add org_id, backfill, NOT NULL, UNIQUE
-- =============================================================================
ALTER TABLE public.billing_accounts
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Backfill: one row per user -> set org_id to that user's personal org
UPDATE public.billing_accounts ba
SET org_id = p.active_org_id
FROM public.profiles p
WHERE p.id = ba.user_id AND ba.org_id IS NULL;

-- If profile had no active_org_id, use org where user is owner
UPDATE public.billing_accounts ba
SET org_id = (
  SELECT o.id FROM public.organizations o WHERE o.owner_id = ba.user_id LIMIT 1
)
WHERE ba.org_id IS NULL;

ALTER TABLE public.billing_accounts
  ALTER COLUMN org_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_accounts_org_id ON public.billing_accounts(org_id);

-- One row per org: switch primary key from user_id to org_id
ALTER TABLE public.billing_accounts DROP CONSTRAINT IF EXISTS billing_accounts_pkey;
ALTER TABLE public.billing_accounts ADD PRIMARY KEY (org_id);

-- RLS: allow access if user is member of the org
DROP POLICY IF EXISTS "billing_accounts_select_own" ON public.billing_accounts;
DROP POLICY IF EXISTS "billing_accounts_insert_own" ON public.billing_accounts;
DROP POLICY IF EXISTS "billing_accounts_update_own" ON public.billing_accounts;

CREATE POLICY "billing_accounts_select_org_member" ON public.billing_accounts
  FOR SELECT USING (public.is_org_member(org_id));

CREATE POLICY "billing_accounts_insert_org_member" ON public.billing_accounts
  FOR INSERT WITH CHECK (
    public.is_org_member(org_id) AND auth.uid() = user_id
  );

CREATE POLICY "billing_accounts_update_org_member" ON public.billing_accounts
  FOR UPDATE USING (public.is_org_member(org_id));

-- =============================================================================
-- 3) SAVED_SEARCHES: backfill org_id for rows that have owner_user_id only
-- Constraint requires (owner_user_id, org_id) mutually exclusive: set owner_user_id = NULL when setting org_id
-- =============================================================================
UPDATE public.saved_searches s
SET org_id = p.active_org_id, owner_user_id = NULL
FROM public.profiles p
WHERE p.id = s.owner_user_id AND s.org_id IS NULL AND s.owner_user_id IS NOT NULL AND p.active_org_id IS NOT NULL;

UPDATE public.saved_searches s
SET org_id = (SELECT o.id FROM public.organizations o WHERE o.owner_id = s.owner_user_id LIMIT 1), owner_user_id = NULL
WHERE s.org_id IS NULL AND s.owner_user_id IS NOT NULL;

-- RLS: allow by org membership (and keep owner_user_id for personal scope if we keep dual scope; spec says pivot to org_id)
-- Existing policies are owner-based; add org-based or replace. Replace with org membership.
DROP POLICY IF EXISTS "saved_searches_select_own" ON public.saved_searches;
DROP POLICY IF EXISTS "saved_searches_insert_own" ON public.saved_searches;
DROP POLICY IF EXISTS "saved_searches_update_own" ON public.saved_searches;
DROP POLICY IF EXISTS "saved_searches_delete_own" ON public.saved_searches;

CREATE POLICY "saved_searches_select_org" ON public.saved_searches
  FOR SELECT USING (
    (org_id IS NOT NULL AND public.is_org_member(org_id))
    OR (owner_user_id = auth.uid())
  );
CREATE POLICY "saved_searches_insert_org" ON public.saved_searches
  FOR INSERT WITH CHECK (
    (org_id IS NOT NULL AND public.is_org_member(org_id) AND owner_user_id IS NULL)
    OR (owner_user_id = auth.uid() AND org_id IS NULL)
  );
CREATE POLICY "saved_searches_update_org" ON public.saved_searches
  FOR UPDATE USING (
    (org_id IS NOT NULL AND public.is_org_member(org_id))
    OR (owner_user_id = auth.uid())
  );
CREATE POLICY "saved_searches_delete_org" ON public.saved_searches
  FOR DELETE USING (
    (org_id IS NOT NULL AND public.is_org_member(org_id))
    OR (owner_user_id = auth.uid())
  );

-- =============================================================================
-- 4) ALERTS: backfill org_id; RLS by org membership
-- Constraint requires (owner_user_id, org_id) mutually exclusive: set owner_user_id = NULL when setting org_id
-- =============================================================================
UPDATE public.alerts a
SET org_id = p.active_org_id, owner_user_id = NULL
FROM public.profiles p
WHERE p.id = a.owner_user_id AND a.org_id IS NULL AND a.owner_user_id IS NOT NULL AND p.active_org_id IS NOT NULL;

UPDATE public.alerts a
SET org_id = (SELECT o.id FROM public.organizations o WHERE o.owner_id = a.owner_user_id LIMIT 1), owner_user_id = NULL
WHERE a.org_id IS NULL AND a.owner_user_id IS NOT NULL;

DROP POLICY IF EXISTS "alerts_select_own" ON public.alerts;
DROP POLICY IF EXISTS "alerts_insert_own" ON public.alerts;
DROP POLICY IF EXISTS "alerts_update_own" ON public.alerts;
DROP POLICY IF EXISTS "alerts_delete_own" ON public.alerts;

CREATE POLICY "alerts_select_org" ON public.alerts
  FOR SELECT USING (
    (org_id IS NOT NULL AND public.is_org_member(org_id))
    OR (owner_user_id = auth.uid())
  );
CREATE POLICY "alerts_insert_org" ON public.alerts
  FOR INSERT WITH CHECK (
    (org_id IS NOT NULL AND public.is_org_member(org_id))
    OR (owner_user_id = auth.uid())
  );
CREATE POLICY "alerts_update_org" ON public.alerts
  FOR UPDATE USING (
    (org_id IS NOT NULL AND public.is_org_member(org_id))
    OR (owner_user_id = auth.uid())
  );
CREATE POLICY "alerts_delete_org" ON public.alerts
  FOR DELETE USING (
    (org_id IS NOT NULL AND public.is_org_member(org_id))
    OR (owner_user_id = auth.uid())
  );

-- =============================================================================
-- 5) NOTIFICATIONS: scope by org (owner_user_id stays for who receives; filter by org in app)
-- =============================================================================
-- notifications: keep owner_user_id; add index on org_id for filtering. RLS stays owner-based or add org.
-- Spec: "access allowed only if the row's org_id is in the user's membership set"
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

UPDATE public.notifications n
SET org_id = p.active_org_id
FROM public.profiles p
WHERE p.id = n.owner_user_id AND n.org_id IS NULL;

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;

CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (owner_user_id = auth.uid());
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (owner_user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_notifications_org ON public.notifications(owner_user_id, org_id, created_at DESC);
