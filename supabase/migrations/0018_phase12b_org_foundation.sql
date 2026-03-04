-- Phase 12B: Org foundation — active_org_id, ensure_personal_org, trigger
-- Uses existing public.organizations and public.org_members (no new orgs table).

-- =============================================================================
-- 1) PROFILES: active_org_id
-- =============================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_active_org_id ON public.profiles(active_org_id);

-- =============================================================================
-- 2) ensure_personal_org (SECURITY DEFINER)
-- For given user_id: if no org exists where owner_id = user_id, create one
-- named "Personal", add org_members row (owner), set profiles.active_org_id.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.ensure_personal_org(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_slug text;
BEGIN
  -- Find existing personal org (owner = this user)
  SELECT id INTO v_org_id
  FROM public.organizations
  WHERE owner_id = p_user_id
  LIMIT 1;

  IF v_org_id IS NOT NULL THEN
    -- Ensure org_members row exists
    INSERT INTO public.org_members (org_id, user_id, role)
    VALUES (v_org_id, p_user_id, 'owner')
    ON CONFLICT (org_id, user_id) DO NOTHING;

    -- Ensure profile has active_org_id set
    UPDATE public.profiles
    SET active_org_id = v_org_id
    WHERE id = p_user_id AND active_org_id IS NULL;

    RETURN v_org_id;
  END IF;

  -- Create new org (slug must be unique; use uuid suffix)
  v_slug := 'personal-' || replace(p_user_id::text, '-', '');
  INSERT INTO public.organizations (name, slug, owner_id)
  VALUES ('Personal', v_slug, p_user_id)
  RETURNING id INTO v_org_id;

  -- org_members row is created by existing trigger on_organization_created

  -- Set profile active_org_id
  UPDATE public.profiles
  SET active_org_id = v_org_id
  WHERE id = p_user_id;

  RETURN v_org_id;
END;
$$;

-- =============================================================================
-- 3) Extend handle_new_user: after profile insert, ensure personal org
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;

  -- Ensure personal org exists and profile.active_org_id is set
  PERFORM public.ensure_personal_org(NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- RPC for app to call: ensure personal org for current user, return active_org_id
CREATE OR REPLACE FUNCTION public.ensure_my_personal_org()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.ensure_personal_org(auth.uid());
$$;

-- Backfill: ensure every existing profile has a personal org and active_org_id
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE active_org_id IS NULL
  LOOP
    PERFORM public.ensure_personal_org(r.id);
  END LOOP;
END;
$$;
