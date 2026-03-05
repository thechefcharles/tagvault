-- Phase 16F: Inbox collection (system collection per org)

-- 1) Extend collections with system flags

ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS system_key text;

CREATE UNIQUE INDEX IF NOT EXISTS collections_org_system_key_unique
  ON public.collections(org_id, system_key)
  WHERE system_key IS NOT NULL;

-- 2) ensure_inbox_collection RPC
-- Creates (if missing) and returns the id of the Inbox system collection for an org.

CREATE OR REPLACE FUNCTION public.ensure_inbox_collection(p_org_id uuid, p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_collection_id uuid;
BEGIN
  -- Only allow org members to call
  IF NOT public.is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'not_org_member';
  END IF;

  SELECT id
  INTO v_collection_id
  FROM public.collections
  WHERE org_id = p_org_id
    AND system_key = 'inbox'
  LIMIT 1;

  IF v_collection_id IS NULL THEN
    INSERT INTO public.collections (org_id, name, is_system, system_key)
    VALUES (p_org_id, 'Inbox', true, 'inbox')
    RETURNING id INTO v_collection_id;
  END IF;

  RETURN v_collection_id;
END;
$$;

