# Phase 15B: Export / Import + Data Portability

## Overview

Phase 15B adds org-scoped data export and import so users can back up their data, migrate between orgs, and restore from backups. Export produces a single JSON file; import supports merge (add/update) and replace (owner-only, clear then import) modes.

## Export Schema

Export is returned as `application/json` with `Content-Disposition: attachment`. Filename: `tagvault-export-<orgId>-<YYYY-MM-DD>.json`.

```json
{
  "version": "1.0",
  "exported_at": "2025-03-02T12:00:00.000Z",
  "org": { "id": "uuid", "name": "Org Name" },
  "data": {
    "items": [...],
    "tags": [...],
    "item_tags": [...],
    "collections": [...],
    "collection_items": [...],
    "saved_searches": [...],
    "alerts": [...],
    "notification_preferences": [...]
  }
}
```

### What is Exported

- **items**: id, org_id, user_id, type, title, description, priority, url, storage_path, mime_type, created_at, updated_at
- **tags**: id, org_id, name, slug, created_at
- **item_tags**: item_id, tag_id, created_at
- **collections**: id, org_id, name, created_at
- **collection_items**: collection_id, item_id, created_at
- **saved_searches**: id, org_id, name, query, filters, sort, semantic_enabled, pinned, created_at, updated_at
- **alerts**: id, org_id, saved_search_id, source_type, source_id, tag_ids, name, enabled, frequency_minutes, notify_on_new, created_at, updated_at
- **notification_preferences**: user_id, org_id, digest_frequency, timezone, digest_time_local, created_at, updated_at

### What is NOT Exported

- `item_shares`, `collection_shares` (tokens, revoked state)
- `stripe_webhook_events`, billing secrets, CRON secrets
- Any token or secret fields
- Signed URLs (export includes `storage_path` for files, but not signed URLs)

## Import Rules

### Merge Mode (default)

- Uses incoming row `id` as `external_id` for deduplication.
- If a row with the same `external_id` exists in the org, it is **updated**.
- Otherwise a new row is **inserted**.
- Join tables (item_tags, collection_items) are upserted; duplicates are skipped.
- **notification_preferences**: Only rows for the importing user are applied. Other users’ prefs are ignored.
- **alerts**: `next_run_at` is set to `now() + frequency_minutes`.

### Replace Mode (owner-only)

- Requires org owner. Non-owners receive 403.
- Deletes existing org data in dependency order:
  collection_items → item_tags → alerts → saved_searches → collections → items → tags → notification_preferences
- Then performs a full import as in merge mode.

### Size Limits (413 if exceeded)

- items: 10,000
- tags: 2,000
- collections: 500
- saved_searches: 500
- alerts: 500

### Validation

- `version` must be `"1.0"`.
- Invalid or unsupported version returns 400.

## API Routes

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | /api/export | requireActiveOrg | Download org data as JSON |
| POST | /api/import | requireActiveOrg | Import from JSON; body may include `mode: "replace"` (owner-only) |

## UI

- **Settings → Data** (`/settings/data`): Export button, import file input, merge/replace mode toggle (replace visible only to owners).

## Manual Test Checklist

1. **Basic export/import**
   - Create tags, collections, items, saved searches, alerts.
   - Export JSON.
   - Create a new org, switch to it.
   - Import the file (merge mode).
   - Verify counts match (items, tags, collections, saved searches, alerts).

2. **Idempotency (merge mode)**
   - Import the same file twice.
   - Verify no duplicate items, tags, collections, or alerts.
   - Verify item_tags and collection_items are correct.

3. **Replace mode**
   - As org owner, enable Replace mode and import a file.
   - Verify existing data is cleared, then import is applied.
   - As non-owner, attempt replace mode; verify 403.

4. **Non-owner cannot replace**
   - Switch to an org where user is member but not owner.
   - Replace mode toggle should be hidden or disabled.
   - If replace is attempted via API, expect 403.

## Database

Migration `0029_phase15b_export_import.sql` adds:

- `external_id text` to items, tags, collections, saved_searches, alerts
- Unique index `(org_id, external_id)` where `external_id IS NOT NULL` for each table

## Sentry Tags

- Export errors: `area=export`, `org_id`
- Import errors: `area=import`, `org_id`, `mode`
