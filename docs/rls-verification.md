# RLS Verification Checklist

Use this checklist to verify that Row Level Security (RLS) and storage isolation are correctly enforced.

**Storage model:** single-file-per-item. Each item has at most one file via `storage_path` on the `items` table. Bucket: `vault`. Path convention: `{user_id}/{item_id}/{filename}`.

---

## Prerequisites

- Two user accounts (User A, User B) with different emails
- Ability to inspect network requests (browser DevTools) or use Postman/curl

---

## Steps

### 1. User A — Create item with file

1. Log in as User A
2. Create an item with file upload (Quick Add → file tab)
3. Confirm the item appears in the list
4. Note the item ID from the URL when viewing: `/app/item/{id}`

### 2. User B — Cannot see User A items

1. Log out, log in as User B
2. Go to `/app` — User A's items must **not** appear in the list
3. Search (if applicable) — User A's items must **not** appear in results

### 3. User B — Cannot access User A item by ID

1. As User B, call `DELETE /api/items/{A_ITEM_ID}` (e.g. via browser console or Postman):
   ```js
   fetch('/api/items/A_ITEM_ID', { method: 'DELETE', credentials: 'include' })
   ```
2. Expected: **404** or **403** (not found / forbidden)
3. User A's item must still exist

### 4. User A — Delete item, verify storage cleanup

1. Log in as User A
2. Delete the item (from item detail page → Delete)
3. Confirm:
   - Item disappears from list
   - In Supabase Dashboard → Storage → bucket `vault` → the path `{user_a_id}/{item_id}/...` is **gone**

### 5. User A — Delete item without file

1. As User A, create a link or note (no file upload)
2. Delete it from the detail page
3. Confirm item disappears; no storage object was involved

---

## If User B sees User A's items (RLS broken)

1. **Verify RLS in Supabase**  
   Supabase Dashboard → Database → Tables → `items` → RLS should be **enabled**.

2. **Check policies**  
   Run `supabase/verify/0003_verify_rls.sql` in the SQL Editor and confirm policies exist.

3. **Confirm migrations ran**  
   Run `0003_phase_04_items.sql` (or equivalent) so that the `items` table and RLS policies exist.

4. **Re-apply RLS if needed**  
   In SQL Editor:
   ```sql
   ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
   -- Drop and recreate if policies are wrong:
   DROP POLICY IF EXISTS "items_select_own" ON public.items;
   CREATE POLICY "items_select_own" ON public.items
     FOR SELECT USING (auth.uid() = user_id);
   -- (repeat for insert, update, delete)
   ```

5. **Log out and log back in**  
   Use the Log out button, then log in as User B again so the session and cookies are correct.

---

## What to test (copy/paste)

- [ ] User A creates item with file → appears
- [ ] User B cannot see User A items in list/search
- [ ] User B cannot DELETE User A's item (404/403)
- [ ] User A deletes item → item gone, storage object removed in Supabase
- [ ] User A deletes link/note (no file) → item gone, no errors
