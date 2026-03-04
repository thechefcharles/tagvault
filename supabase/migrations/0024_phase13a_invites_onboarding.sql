-- Phase 13A: Invitations v2 + onboarding — revoked_at, resend RPC, audit-ready indexes

-- =============================================================================
-- 1) org_invites: add revoked_at; allow UPDATE for revoke
-- =============================================================================
ALTER TABLE public.org_invites
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

-- Owner/admin may update (e.g. set revoked_at)
CREATE POLICY "org_invites_update_admin" ON public.org_invites
  FOR UPDATE USING (public.is_org_admin(org_id))
  WITH CHECK (true);

-- =============================================================================
-- 2) get_invite_org_if_pending: exclude revoked invites
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_invite_org_if_pending(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_org_id uuid;
BEGIN
  v_hash := encode(sha256(p_token::bytea), 'hex');
  SELECT org_id INTO v_org_id
  FROM public.org_invites
  WHERE token_hash = v_hash
    AND accepted_at IS NULL
    AND revoked_at IS NULL
    AND expires_at > now();

  RETURN v_org_id;
END;
$$;

-- =============================================================================
-- 3) RPC: resend_org_invite(p_invite_id) — rotate token, reset expires_at; returns new token
-- Caller must be owner/admin of the org. Invite must be pending (not accepted/revoked).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.resend_org_invite(p_invite_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite record;
  v_token text;
  v_hash text;
  v_expires_at timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;

  SELECT id, org_id, email, role, accepted_at, revoked_at, expires_at
  INTO v_invite
  FROM public.org_invites
  WHERE id = p_invite_id;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;
  IF NOT public.is_org_admin(v_invite.org_id) THEN
    RAISE EXCEPTION 'Forbidden: not owner or admin of this org';
  END IF;
  IF v_invite.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invite already accepted';
  END IF;
  IF v_invite.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invite already revoked';
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(sha256(v_token::bytea), 'hex');
  v_expires_at := now() + interval '7 days';

  UPDATE public.org_invites
  SET token_hash = v_hash, expires_at = v_expires_at
  WHERE id = p_invite_id;

  RETURN jsonb_build_object('token', v_token, 'expires_at', v_expires_at);
END;
$$;

-- =============================================================================
-- 4) Pending index: include revoked_at so “pending” lists are efficient
-- =============================================================================
DROP INDEX IF EXISTS public.idx_org_invites_pending;
CREATE INDEX idx_org_invites_pending ON public.org_invites(org_id)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

-- Index for “pending invites for this email” (onboarding)
CREATE INDEX IF NOT EXISTS idx_org_invites_email_pending ON public.org_invites(email)
  WHERE accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now();

-- =============================================================================
-- 5) RPC: get_pending_invites_for_user() — returns pending invites for current user's email
-- For onboarding / banner. Caller must be authenticated.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_pending_invites_for_user()
RETURNS TABLE(invite_id uuid, org_id uuid, org_name text, role text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  SELECT p.email INTO v_email FROM public.profiles p WHERE p.id = auth.uid();
  IF v_email IS NULL OR trim(v_email) = '' THEN
    RETURN;
  END IF;
  v_email := lower(trim(v_email));

  RETURN QUERY
  SELECT i.id, i.org_id, o.name, i.role, i.expires_at
  FROM public.org_invites i
  JOIN public.organizations o ON o.id = i.org_id
  WHERE lower(trim(i.email)) = v_email
    AND i.accepted_at IS NULL
    AND i.revoked_at IS NULL
    AND i.expires_at > now();
END;
$$;

-- =============================================================================
-- 6) RPC: get_org_id_for_invite_id_if_recipient(p_invite_id) — returns org_id if invite is for current user and pending
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_org_id_for_invite_id_if_recipient(p_invite_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_org_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT lower(trim(p.email)) INTO v_email FROM public.profiles p WHERE p.id = auth.uid();
  IF v_email IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT i.org_id INTO v_org_id
  FROM public.org_invites i
  WHERE i.id = p_invite_id
    AND i.accepted_at IS NULL
    AND i.revoked_at IS NULL
    AND i.expires_at > now()
    AND lower(trim(i.email)) = v_email;
  RETURN v_org_id;
END;
$$;

-- =============================================================================
-- 7) RPC: accept_org_invite_by_id(p_invite_id) — accept by invite id when invite email = current user
-- For onboarding "Join" when user is already logged in. Seat check must be done by caller.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.accept_org_invite_by_id(p_invite_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite record;
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_logged_in');
  END IF;

  SELECT p.email INTO v_email FROM public.profiles p WHERE p.id = auth.uid();
  IF v_email IS NULL OR trim(v_email) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'email_required');
  END IF;
  v_email := lower(trim(v_email));

  SELECT id, org_id, email, role, accepted_at, revoked_at, expires_at
  INTO v_invite
  FROM public.org_invites
  WHERE id = p_invite_id;

  IF v_invite.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_invite');
  END IF;
  IF v_invite.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_used');
  END IF;
  IF v_invite.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'revoked');
  END IF;
  IF v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;
  IF lower(trim(v_invite.email)) <> v_email THEN
    RETURN jsonb_build_object('ok', false, 'error', 'email_mismatch');
  END IF;

  INSERT INTO public.org_members (org_id, user_id, role)
  VALUES (v_invite.org_id, auth.uid(), v_invite.role)
  ON CONFLICT (org_id, user_id) DO UPDATE SET role = v_invite.role;

  UPDATE public.org_invites
  SET accepted_at = now(), accepted_by = auth.uid()
  WHERE id = p_invite_id;

  UPDATE public.profiles SET active_org_id = v_invite.org_id WHERE id = auth.uid();

  RETURN jsonb_build_object('ok', true, 'org_id', v_invite.org_id);
END;
$$;
