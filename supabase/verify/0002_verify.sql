-- TagVault Baseline Schema Verification
-- Run these in Supabase SQL Editor to confirm migration 0002 applied correctly

-- =============================================================================
-- 1) Confirm tables exist
-- =============================================================================
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'organizations', 'org_members', 'vault_items')
ORDER BY table_name;
-- Expected: 4 rows

-- =============================================================================
-- 2) Confirm RLS is enabled
-- =============================================================================
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'organizations', 'org_members', 'vault_items')
ORDER BY tablename;
-- Expected: rowsecurity = true for all 4

-- =============================================================================
-- 3) Confirm policies exist
-- =============================================================================
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- =============================================================================
-- 4) Confirm helper functions exist
-- =============================================================================
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('is_org_member', 'is_org_admin', 'is_org_owner', 'set_updated_at', 'handle_new_user', 'handle_new_organization')
ORDER BY routine_name;
-- Expected: 6 rows

-- =============================================================================
-- 5) Sample test flow (run while authenticated as a test user)
-- Uncomment and run in Supabase SQL Editor AFTER signing in via the app.
-- Replace USER_ID and ORG_ID with actual UUIDs from your data.
-- =============================================================================

/*
-- Get current user id (run first)
SELECT auth.uid() AS my_user_id;

-- Create org (as authenticated user; owner_id must = auth.uid())
INSERT INTO public.organizations (name, slug, owner_id)
VALUES ('Test Org', 'test-org-' || substr(gen_random_uuid()::text, 1, 8), auth.uid())
RETURNING id, name, slug;

-- Verify org_members trigger added owner
SELECT * FROM public.org_members WHERE org_id = 'YOUR_ORG_ID';

-- Test helper functions (replace YOUR_ORG_ID)
SELECT public.is_org_member('YOUR_ORG_ID'::uuid);
SELECT public.is_org_admin('YOUR_ORG_ID'::uuid);
SELECT public.is_org_owner('YOUR_ORG_ID'::uuid);

-- Create vault item (replace YOUR_ORG_ID)
INSERT INTO public.vault_items (org_id, created_by, title, content)
VALUES ('YOUR_ORG_ID'::uuid, auth.uid(), 'Test Item', 'Sample content')
RETURNING id, title;

-- Select vault items (as org member)
SELECT * FROM public.vault_items WHERE org_id = 'YOUR_ORG_ID'::uuid;
*/
