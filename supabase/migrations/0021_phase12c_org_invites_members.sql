-- Phase 12C: Org invites + member management
-- org_members already exists (0002); we add org_invites, profiles.email for member list, RPCs.

-- =============================================================================
-- 0) PROFILES.EMAIL (for member list + invite acceptance check)
-- =============================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text;

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Backfill profiles.email from auth.users (SECURITY DEFINER)
DO $$
BEGIN
  UPDATE public.profiles p
  SET email = u.email
  FROM auth.users u
  WHERE u.id = p.id AND (p.email IS NULL OR p.email <> u.email);
END;
$$;

-- New users get email set in handle_new_user (updated below)

-- =============================================================================
-- 1) ORG_INVITES TABLE
-- =============================================================================
CREATE TABLE public.org_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_invites_org_id ON public.org_invites(org_id);
CREATE INDEX idx_org_invites_email ON public.org_invites(org_id, email);
CREATE INDEX idx_org_invites_pending ON public.org_invites(org_id) WHERE accepted_at IS NULL AND expires_at > now();

ALTER TABLE public.org_invites ENABLE ROW LEVEL SECURITY;

-- org_invites: only owner/admin can select/insert/delete for their org
CREATE POLICY "org_invites_select_admin" ON public.org_invites
  FOR SELECT USING (public.is_org_admin(org_id));

CREATE POLICY "org_invites_insert_admin" ON public.org_invites
  FOR INSERT WITH CHECK (public.is_org_admin(org_id) AND created_by = auth.uid());

CREATE POLICY "org_invites_delete_admin" ON public.org_invites
  FOR DELETE USING (public.is_org_admin(org_id));

-- No UPDATE policy: acceptance done via RPC only (RPC uses service-like privileges via SECURITY DEFINER)

-- =============================================================================
-- 2) RPC: create_org_invite(p_org_id, p_email, p_role)
-- Returns invite_id and raw token (caller must be owner/admin of org).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.create_org_invite(
  p_org_id uuid,
  p_email text,
  p_role text DEFAULT 'member'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_hash text;
  v_invite_id uuid;
  v_expires_at timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;
  IF p_role IS NULL OR p_role NOT IN ('admin', 'member') THEN
    p_role := 'member';
  END IF;
  IF NOT public.is_org_admin(p_org_id) THEN
    RAISE EXCEPTION 'Forbidden: not owner or admin of this org';
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(sha256(v_token::bytea), 'hex');
  v_expires_at := now() + interval '7 days';

  INSERT INTO public.org_invites (org_id, email, role, token_hash, expires_at, created_by)
  VALUES (p_org_id, lower(trim(p_email)), p_role, v_hash, v_expires_at, auth.uid())
  RETURNING id INTO v_invite_id;

  RETURN jsonb_build_object('invite_id', v_invite_id, 'token', v_token);
END;
$$;

-- =============================================================================
-- 3) RPC: accept_org_invite(p_token, p_user_email)
-- Caller must be authenticated; p_user_email must match session (API passes auth user email).
-- Verifies invite.email = p_user_email, then inserts org_members and marks invite accepted.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.accept_org_invite(p_token text, p_user_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_invite record;
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_logged_in');
  END IF;
  IF p_user_email IS NULL OR trim(p_user_email) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'email_required');
  END IF;

  v_hash := encode(sha256(p_token::bytea), 'hex');
  SELECT id, org_id, email, role, accepted_at, expires_at
  INTO v_invite
  FROM public.org_invites
  WHERE token_hash = v_hash;

  IF v_invite.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  IF v_invite.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_used');
  END IF;
  IF v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;
  IF lower(trim(v_invite.email)) <> lower(trim(p_user_email)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'email_mismatch');
  END IF;

  INSERT INTO public.org_members (org_id, user_id, role)
  VALUES (v_invite.org_id, v_uid, v_invite.role)
  ON CONFLICT (org_id, user_id) DO UPDATE SET role = v_invite.role;

  UPDATE public.org_invites
  SET accepted_at = now(), accepted_by = v_uid
  WHERE id = v_invite.id;

  UPDATE public.profiles SET active_org_id = v_invite.org_id WHERE id = v_uid;

  RETURN jsonb_build_object('ok', true, 'org_id', v_invite.org_id);
END;
$$;

-- =============================================================================
-- 4) RPC: get_org_members(p_org_id) — returns user_id, role, email for org members (caller must be member)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_org_members(p_org_id uuid)
RETURNS TABLE(user_id uuid, role text, email text)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT om.user_id, om.role, p.email
  FROM public.org_members om
  JOIN public.profiles p ON p.id = om.user_id
  WHERE om.org_id = p_org_id
    AND public.is_org_member(p_org_id);
$$;

-- =============================================================================
-- 5) TRIGGER: set profiles.email on new user (for invite acceptance + member list)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO UPDATE SET email = COALESCE(public.profiles.email, EXCLUDED.email);

  PERFORM public.ensure_personal_org(NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
