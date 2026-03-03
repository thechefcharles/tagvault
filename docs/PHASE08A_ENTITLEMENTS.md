# Phase 8A: Entitlements + Usage Limits

## Overview

Plan-aware control layer for enforcing usage limits before any Stripe integration. Free plan has defined limits; Pro plan has high/unlimited limits.

## Schema

### plan_t enum

- `free`
- `pro`

### user_entitlements

| Column     | Type      | Notes                    |
|------------|-----------|--------------------------|
| user_id    | uuid PK   | FK auth.users            |
| plan       | plan_t    | DEFAULT 'free'           |
| created_at | timestamptz |                          |
| updated_at | timestamptz |                          |

- Provisioned automatically on signup (trigger on profiles insert)
- Backfill for existing users in migration

### usage_counters

| Column                 | Type    | Notes              |
|------------------------|---------|--------------------|
| user_id                | uuid    | FK auth.users      |
| period_start           | date    | PK (user_id, period_start) |
| items_created          | int     | DEFAULT 0          |
| searches_run           | int     | DEFAULT 0          |
| alerts_created         | int     | DEFAULT 0          |
| saved_searches_created | int     | DEFAULT 0          |
| embeddings_enqueued    | int     | DEFAULT 0          |
| updated_at             | timestamptz |                  |

## Limits (Free vs Pro)

Defined in `src/lib/entitlements/limits.ts`:

| Limit               | Free | Pro  |
|---------------------|------|------|
| items               | 100  | 1M   |
| saved_searches      | 5    | 1000 |
| alerts              | 2    | 100  |
| searches_per_day    | 50   | 10K  |
| embeddings_per_day  | 200  | 10K  |

## Enforcement Points

| Action                 | Location                        | Limit checked                          |
|------------------------|---------------------------------|----------------------------------------|
| Item create (note/link)| POST /api/items                 | items, embeddings_enqueue               |
| Item create (file)     | POST /api/items/upload          | items, embeddings_enqueue               |
| Item update (title/desc)| PATCH /api/items/[id]          | embeddings_enqueue (when changed)       |
| Saved search create    | POST /api/saved-searches        | saved_searches                          |
| Alert create           | POST /api/alerts                | alerts                                  |
| Search run             | GET /api/search                 | searches_per_day (only when q non-empty)|
| Embedding enqueue      | Item create/update (pre-check)  | embeddings_per_day                      |

## Error Handling

- **HTTP 402** (Payment Required) for plan limit exceeded
- **Code:** `PLAN_LIMIT_EXCEEDED`
- **Message:** `Upgrade required: free plan limit reached for <resource> (<limit>).`
- UI surfaces via `getErrorMessage()` and displays inline (Quick Add, modals, search).

## RLS

- `user_entitlements`: SELECT own row only
- `usage_counters`: SELECT, INSERT, UPDATE own rows
- Server uses admin client for entitlements/usage (bypasses RLS where needed)

## Validation

1. Create two users; confirm each has `user_entitlements` row
2. Create 101 items as free user → 101st blocked
3. Create 6 saved searches → 6th blocked
4. Create 3 alerts → 3rd blocked
5. Run >50 searches/day → blocked
6. Set `plan=pro` in DB for a user → limits bypassed
