-- Run this in Supabase SQL Editor to verify RLS is correctly configured.
-- Expected: items table has RLS enabled and policies.

-- 1) Check RLS is enabled
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'items';
-- relrowsecurity should be true

-- 2) List policies on items
SELECT polname, polcmd, polroles::regrole[], pg_get_expr(polqual, polrelid) AS using_expr
FROM pg_policy
WHERE polrelid = 'public.items'::regclass;
-- Should show: items_select_own, items_insert_own, items_update_own, items_delete_own
-- Each should use auth.uid() = user_id

-- 3) Quick test: as a random user, items should return 0 (cannot see others)
-- Run as authenticated user in your app; this is for manual verification.
