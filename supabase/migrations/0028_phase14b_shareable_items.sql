-- Phase 14B: Shareable Items (Public Links)

-- =============================================================================
-- 1) ITEM_SHARES
-- =============================================================================
CREATE TABLE public.item_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  token text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  expires_at timestamptz,
  last_accessed_at timestamptz,
  UNIQUE (token)
);

CREATE INDEX idx_item_shares_org_item
  ON public.item_shares(org_id, item_id);
CREATE INDEX idx_item_shares_token
  ON public.item_shares(token);

ALTER TABLE public.item_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "item_shares_select_org_member" ON public.item_shares
  FOR SELECT USING (public.is_org_member(org_id));

CREATE POLICY "item_shares_insert_org_member" ON public.item_shares
  FOR INSERT WITH CHECK (public.is_org_member(org_id));

CREATE POLICY "item_shares_update_org_member" ON public.item_shares
  FOR UPDATE USING (public.is_org_member(org_id));

CREATE POLICY "item_shares_delete_org_member" ON public.item_shares
  FOR DELETE USING (public.is_org_member(org_id));

-- =============================================================================
-- 2) SECURITY DEFINER RPC for public access (anon, no auth)
-- Returns item; null if revoked/expired/invalid
-- Exposes minimum fields for read-only view: type, title, description, url,
-- storage_path, mime_type, created_at, org_id (for reference)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_shared_item_by_token(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_share record;
  v_result json;
BEGIN
  IF p_token IS NULL OR trim(p_token) = '' THEN
    RETURN NULL;
  END IF;

  SELECT id, org_id, item_id, revoked_at, expires_at
  INTO v_share
  FROM public.item_shares
  WHERE token = p_token
  LIMIT 1;

  IF v_share IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_share.revoked_at IS NOT NULL THEN
    RETURN NULL;
  END IF;

  IF v_share.expires_at IS NOT NULL AND v_share.expires_at < now() THEN
    RETURN NULL;
  END IF;

  UPDATE public.item_shares
  SET last_accessed_at = now()
  WHERE id = v_share.id;

  SELECT json_build_object(
    'id', i.id,
    'org_id', i.org_id,
    'type', i.type,
    'title', i.title,
    'description', i.description,
    'url', i.url,
    'storage_path', i.storage_path,
    'mime_type', i.mime_type,
    'created_at', i.created_at
  ) INTO v_result
  FROM public.items i
  WHERE i.id = v_share.item_id
    AND i.org_id = v_share.org_id;

  RETURN v_result;
END;
$$;
