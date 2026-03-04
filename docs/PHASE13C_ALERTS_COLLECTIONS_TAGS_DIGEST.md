# Phase 13C: Collection/Tag Alerts + Delta Notifications + Digest

## Overview

Phase 13C extends alerts to support multiple source types (saved search, collection, tag filter), implements delta detection so users are only notified for new matches since the last run, and adds a digest cron that batches unread notifications into summary notifications.

## Schema Changes

### Alerts table (extended)

| Column       | Type         | Description                                           |
|-------------|--------------|-------------------------------------------------------|
| `source_type` | text         | `'saved_search'` \| `'collection'` \| `'tag_filter'` (default: `'saved_search'`) |
| `source_id` | uuid (nullable) | For saved_search: saved search id. For collection: collection id. Null for tag_filter. |
| `tag_ids`   | uuid[] (nullable) | For tag_filter only. Tags to filter by (ANY match).  |
| `last_cursor` | timestamptz (nullable) | Latest `matchAt` seen; used for delta detection.    |
| `last_run_at` | timestamptz (nullable) | Already existed; set after each run.                 |
| `saved_search_id` | uuid (nullable) | Now nullable; backfilled from source_id for legacy.   |

- Index: `idx_alerts_org_source_next` on `(org_id, source_type, next_run_at)`.
- CHECK: `source_type IN ('saved_search', 'collection', 'tag_filter')`.

### notification_preferences table (new)

| Column            | Type   | Description                                      |
|-------------------|--------|--------------------------------------------------|
| `user_id`         | uuid   | FK to auth.users                                 |
| `org_id`          | uuid   | FK to organizations                              |
| `digest_frequency`| text   | `'none'` \| `'daily'` \| `'weekly'` (default: `'none'`) |
| `timezone`        | text   | For future scheduling (default: `'UTC'`)         |
| `digest_time_local`| text  | HH:MM for future use                             |
| `last_digest_at`  | timestamptz | When digest was last created for this user/org |
| `created_at`, `updated_at` | timestamptz |                               |

- UNIQUE `(user_id, org_id)`.
- RLS: select/insert/update for org members.

## Alert Source Behaviors

### 1. saved_search

- Uses `source_id` or `saved_search_id` to load the saved search.
- Runs the saved search (query + filters including `tag_ids`) via `runSavedSearch`.
- `matchAt` = `items.created_at`.

### 2. collection

- Uses `source_id` (collection id).
- Fetches items in the collection via `collection_items` joined with `items`.
- `matchAt` = `collection_items.created_at` (when the item was added to the collection).
- MVP: no search text; purely “new items added to collection”.

### 3. tag_filter

- Uses `tag_ids`.
- Runs hybrid search with empty query and `tagIds` filter (recent sort).
- `matchAt` = `items.created_at`.

## Delta Rules

- Cutoff: `last_cursor ?? last_run_at ?? '1970-01-01'`.
- Only notify for matches where `matchAt > cutoff`.
- After each run: `last_cursor = max(matchAt)` of all matches, `last_run_at = now()`.
- One notification per alert run summarizing the new item IDs; no per-item rows.

## Digest Endpoint

**POST /api/notifications/process-digest**

- Requires `x-cron-secret` or `Authorization: Bearer <CRON_SECRET>`.
- Rate limit: 10 req/min per IP.
- Uses `withCronLock('cron:notifications:process-digest', ttl=120)`.
- For each org/user with `notification_preferences.digest_frequency` in `('daily', 'weekly')`:
  - Window: daily = 24h, weekly = 7 days.
  - Skip if `last_digest_at` is within the window.
  - Count unread notifications (excluding type `'digest'`) in the window.
  - If count > 0: insert a single `type = 'digest'` notification with `meta: { from: 'digest', unread_count }`.
  - MVP: underlying notifications are not marked read.
  - Update `last_digest_at` after creating digest.
- Response: `{ digestsCreated: number }`.
- Sentry tags: `area:cron`, `job:notifications_digest`.

## API Usage

### Create alert (collection)

```json
POST /api/alerts
{
  "source_type": "collection",
  "source_id": "<collection-uuid>",
  "name": "New in My Collection",
  "frequency_minutes": 60
}
```

### Create alert (tag filter)

```json
POST /api/alerts
{
  "source_type": "tag_filter",
  "tag_ids": ["<tag-uuid-1>", "<tag-uuid-2>"],
  "name": "Items tagged important",
  "frequency_minutes": 240
}
```

### Create alert (saved search)

```json
POST /api/alerts
{
  "source_type": "saved_search",
  "saved_search_id": "<saved-search-uuid>",
  "source_id": "<saved-search-uuid>",
  "name": "My saved search alert",
  "frequency_minutes": 60
}
```

## Verification Checklist

- [ ] **Alerts (saved_search)**: Create alert from saved search; run; new items generate notifications; subsequent run with no new items yields no notifications.
- [ ] **Alerts (tag_filter)**: Create alert from tag filter; run; new items with those tags generate notifications; delta only.
- [ ] **Alerts (collection)**: Create alert from collection page; run; new items added to collection generate notifications; delta only.
- [ ] **Cross-org**: Two users in two orgs; each sees only their org’s alerts and notifications.
- [ ] **Digest**: Insert `notification_preferences` with `digest_frequency = 'daily'`; create some unread notifications; call process-digest; one digest notification appears; lock prevents duplicate runs within TTL.
- [ ] **Cron endpoints**: Both process-due and process-digest return 401 without `CRON_SECRET`; 429 when rate limited (digest).

## Manual Verification (curl)

```bash
# Process due alerts
curl -X POST -H "x-cron-secret: $CRON_SECRET" https://your-app.vercel.app/api/alerts/process-due

# Process digest
curl -X POST -H "x-cron-secret: $CRON_SECRET" https://your-app.vercel.app/api/notifications/process-digest
```
