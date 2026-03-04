-- Phase 12A: Admin audit log for plan overrides and ops actions

CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email text NOT NULL,
  action text NOT NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_audit_log_target ON public.admin_audit_log(target_user_id);
CREATE INDEX idx_admin_audit_log_created ON public.admin_audit_log(created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- No policies: service-role only (admin routes use createAdminClient)
