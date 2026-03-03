# Storage Orphan Cleanup (Manual)

If storage objects exist without a corresponding `items` row (e.g. from a failed delete or manual DB changes), they are orphans.

**Model:** single-file-per-item. Bucket: `vault`. Path: `{user_id}/{item_id}/{filename}`. The `items.storage_path` column is the authoritative pointer.

---

## Manual procedure (Supabase Dashboard)

### 1. List storage paths in DB

In Supabase SQL Editor:

```sql
SELECT id, user_id, storage_path
FROM public.items
WHERE storage_path IS NOT NULL
  AND storage_path != '';
```

### 2. Compare with Storage UI

1. Go to Storage → bucket `vault`
2. Browse by user folder: `{user_id}/{item_id}/...`
3. Any object whose path is **not** in the query result is a suspected orphan

### 3. Delete orphans manually

- In Storage UI: select orphan objects → Delete
- Or use Supabase Storage API / SQL if you have admin access

---

## Automated cleanup (future)

A future `/api/admin/storage/orphans` endpoint could:

1. List objects in `vault` (careful: expensive for large buckets)
2. Compare with `items.storage_path`
3. Return suspected orphans
4. Provide explicit DELETE with confirmation

Do not implement until you have a clear admin gating mechanism.
