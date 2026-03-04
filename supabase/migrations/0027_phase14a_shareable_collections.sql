-- Phase 14A: Shareable Collections (Public Links)

-- =============================================================================
-- 1) COLLECTION_SHARES
-- =============================================================================
CREATE TABLE public.collection_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  token text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  expires_at timestamptz,
  last_accessed_at timestamptz,
  UNIQUE (token)
);

CREATE INDEX idx_collection_shares_org_collection
  ON public.collection_shares(org_id, collection_id);
CREATE INDEX idx_collection_shares_token
  ON public.collection_shares(token);

ALTER TABLE public.collection_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "collection_shares_select_org_member" ON public.collection_shares
  FOR SELECT USING (public.is_org_member(org_id));

CREATE POLICY "collection_shares_insert_org_member" ON public.collection_shares
  FOR INSERT WITH CHECK (public.is_org_member(org_id));

CREATE POLICY "collection_shares_update_org_member" ON public.collection_shares
  FOR UPDATE USING (public.is_org_member(org_id));

CREATE POLICY "collection_shares_delete_org_member" ON public.collection_shares
  FOR DELETE USING (public.is_org_member(org_id));

-- =============================================================================
-- 2) SECURITY DEFINER RPC for public access (anon, no auth)
-- Returns collection + items; null if revoked/expired/invalid
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_shared_collection_by_token(p_token text)
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

  SELECT id, org_id, collection_id, revoked_at, expires_at
  INTO v_share
  FROM public.collection_shares
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

  UPDATE public.collection_shares
  SET last_accessed_at = now()
  WHERE id = v_share.id;

  SELECT json_build_object(
    'collection', row_to_json(c),
    'items', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'id', i.id,
          'type', i.type,
          'title', i.title,
          'description', i.description,
          'url', i.url,
          'storage_path', i.storage_path,
          'mime_type', i.mime_type,
          'created_at', i.created_at
        )
      ), '[]'::json)
      FROM public.collection_items ci
      JOIN public.items i ON i.id = ci.item_id
      WHERE ci.collection_id = v_share.collection_id
        AND ci.org_id = v_share.org_id
      ORDER BY ci.created_at DESC
    )
  ) INTO v_result
  FROM public.collections c
  WHERE c.id = v_share.collection_id
    AND c.org_id = v_share.org_id;

  RETURN v_result;
END;
$$;
