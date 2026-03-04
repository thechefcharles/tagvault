-- Phase 15C: Automated backups (Pro/Team)
-- org_backups table + org-backups storage bucket

-- =============================================================================
-- 1) ORG_BACKUPS TABLE
-- =============================================================================
CREATE TABLE public.org_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  storage_path text NOT NULL,
  size_bytes int,
  sha256 text,
  status text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'failed')),
  error_message text
);

CREATE INDEX idx_org_backups_org_created
  ON public.org_backups(org_id, created_at DESC);

ALTER TABLE public.org_backups ENABLE ROW LEVEL SECURITY;

-- RLS: org members can SELECT; INSERT/UPDATE only via service role (enforced by policy)
CREATE POLICY "org_backups_select_org_member" ON public.org_backups
  FOR SELECT USING (public.is_org_member(org_id));

-- No INSERT/UPDATE policy for authenticated; cron uses service role which bypasses RLS.
-- To restrict: create policy that blocks anon/authenticated insert; service role bypasses.

-- =============================================================================
-- 2) STORAGE BUCKET org-backups (private)
-- =============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('org-backups', 'org-backups', false, 52428800)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800;

-- Service role (cron, download signed URLs) bypasses RLS; no additional policies needed.
