-- TagVault Baseline Schema
-- Migration: 0002
-- Creates: extensions, tables, RLS, helper functions, triggers

-- =============================================================================
-- 1) EXTENSIONS
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- =============================================================================
-- 2) UPDATED_AT TRIGGER
-- =============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 3) TABLES
-- =============================================================================

-- Profiles: 1:1 with auth.users
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  full_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Organizations
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_organizations_owner_id ON public.organizations(owner_id);
CREATE INDEX idx_organizations_slug ON public.organizations(slug);

-- Org membership
CREATE TABLE public.org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id)
);

CREATE INDEX idx_org_members_org_id ON public.org_members(org_id);
CREATE INDEX idx_org_members_user_id ON public.org_members(user_id);

-- Vault items (core entity)
CREATE TABLE public.vault_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  title text NOT NULL,
  content text,
  tags text[] DEFAULT '{}'::text[],
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_vault_items_updated_at
  BEFORE UPDATE ON public.vault_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_vault_items_org_id ON public.vault_items(org_id);
CREATE INDEX idx_vault_items_created_by ON public.vault_items(created_by);

-- =============================================================================
-- 4) TRIGGER: Auto-add owner to org_members when org is created
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.org_members (org_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_organization_created
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization();

-- =============================================================================
-- 5) HELPER FUNCTIONS (auth.uid() + org_members)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = p_org_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_org_admin(p_org_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = p_org_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_org_owner(p_org_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = p_org_id
      AND user_id = auth.uid()
      AND role = 'owner'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =============================================================================
-- 6) RLS
-- =============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_items ENABLE ROW LEVEL SECURITY;

-- profiles: user can read/update own profile only
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- organizations: members read; owner creates; owner/admin update; owner delete
CREATE POLICY "organizations_select_members" ON public.organizations
  FOR SELECT USING (public.is_org_member(id));

CREATE POLICY "organizations_insert_own" ON public.organizations
  FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "organizations_update_admin" ON public.organizations
  FOR UPDATE USING (public.is_org_admin(id));

CREATE POLICY "organizations_delete_owner" ON public.organizations
  FOR DELETE USING (public.is_org_owner(id));

-- org_members: members read; owner/admin add/update/remove; user can remove self (leave)
CREATE POLICY "org_members_select_members" ON public.org_members
  FOR SELECT USING (public.is_org_member(org_id));

CREATE POLICY "org_members_insert_admin" ON public.org_members
  FOR INSERT
  WITH CHECK (public.is_org_admin(org_id));

CREATE POLICY "org_members_update_admin" ON public.org_members
  FOR UPDATE USING (public.is_org_admin(org_id));

CREATE POLICY "org_members_delete_admin_or_self" ON public.org_members
  FOR DELETE USING (
    public.is_org_admin(org_id) OR auth.uid() = user_id
  );

-- vault_items: members read; members create (created_by = auth.uid()); admin/owner OR creator can update; admin/owner only delete
CREATE POLICY "vault_items_select_members" ON public.vault_items
  FOR SELECT USING (public.is_org_member(org_id));

CREATE POLICY "vault_items_insert_members" ON public.vault_items
  FOR INSERT
  WITH CHECK (
    public.is_org_member(org_id) AND auth.uid() = created_by
  );

CREATE POLICY "vault_items_update_admin_or_creator" ON public.vault_items
  FOR UPDATE USING (
    public.is_org_admin(org_id) OR auth.uid() = created_by
  );

CREATE POLICY "vault_items_delete_admin_only" ON public.vault_items
  FOR DELETE USING (public.is_org_admin(org_id));

-- =============================================================================
-- 7) SIGNUP PROFILE TRIGGER
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
