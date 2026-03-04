-- Phase 12D: Org roles/permissions hardening + seat enforcement
-- Ensures org_members role constraint, adds index for membership counts, RPC for invite lookup.

-- =============================================================================
-- 1) Ensure org_members role constraint and index
-- =============================================================================
-- org_members already has role CHECK IN ('owner','admin','member') from baseline
CREATE INDEX IF NOT EXISTS idx_org_members_org_id_count ON public.org_members(org_id);

-- =============================================================================
-- 2) RPC: get_invite_org_if_pending(p_token) — returns org_id if valid pending invite (for seat check before accept)
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
    AND expires_at > now();

  RETURN v_org_id;
END;
$$;

-- =============================================================================
-- 3) RPC: transfer_org_ownership(p_org_id, p_new_owner_user_id)
-- Caller must be owner. Demotes caller to admin, promotes target to owner.
-- Also updates organizations.owner_id.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.transfer_org_ownership(p_org_id uuid, p_new_owner_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
  END IF;
  IF NOT public.is_org_owner(p_org_id) THEN
    RAISE EXCEPTION 'Forbidden: only owner can transfer ownership';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.org_members WHERE org_id = p_org_id AND user_id = p_new_owner_user_id) THEN
    RAISE EXCEPTION 'Target user is not a member';
  END IF;

  UPDATE public.org_members SET role = 'admin' WHERE org_id = p_org_id AND user_id = auth.uid();
  UPDATE public.org_members SET role = 'owner' WHERE org_id = p_org_id AND user_id = p_new_owner_user_id;
  UPDATE public.organizations SET owner_id = p_new_owner_user_id WHERE id = p_org_id;
END;
$$;
