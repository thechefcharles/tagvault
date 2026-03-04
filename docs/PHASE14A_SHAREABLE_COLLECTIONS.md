# Phase 14A: Shareable Collections (Public Links)

## Overview

Phase 14A adds public share links for collections. Users can create shareable links that allow unauthenticated access to a read-only view of a collection and its items. Share links can be revoked, rotated, and optionally expire.

## Schema

### collection_shares table

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `org_id` | uuid | FK to organizations |
| `collection_id` | uuid | FK to collections |
| `token` | text | Unique share token (used in URL) |
| `created_by` | uuid | FK to auth.users (nullable) |
| `created_at` | timestamptz | |
| `revoked_at` | timestamptz | When revoked; null = active |
| `expires_at` | timestamptz | Optional expiry |
| `last_accessed_at` | timestamptz | Last time share page/download was accessed |

- UNIQUE on `token`
- Index: `idx_collection_shares_org_collection` on `(org_id, collection_id)`
- Index: `idx_collection_shares_token` on `(token)`
- RLS: org members can SELECT, INSERT, UPDATE, DELETE

## RLS / RPC Design

### Public access via SECURITY DEFINER RPC

`get_shared_collection_by_token(p_token text)` returns JSON:

- `{ collection: { id, name }, items: [{ id, type, title, description, url, storage_path, mime_type, created_at }, ...] }`
- Returns `NULL` if token invalid, revoked, or expired

The RPC:

1. Looks up share by token
2. Checks `revoked_at IS NULL` and `expires_at` (if set) not in the past
3. Updates `last_accessed_at`
4. Returns collection + items

Callable by anon (no auth required). Public share page and download endpoint use this.

## Plan Limits

| Plan | Active shares |
|------|---------------|
| free | 0 |
| pro | 5 |
| team | 50 |

Active = `revoked_at IS NULL` AND (`expires_at IS NULL` OR `expires_at > now()`).

Enforced at create; returns 402 PLAN_LIMIT_EXCEEDED with upgrade CTA.

## API Routes

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/collections/[id]/shares` | GET | Required | List shares for collection |
| `/api/collections/[id]/shares` | POST | Required | Create share (rate limited 20/min) |
| `/api/collections/shares/[shareId]` | PATCH | Required | Revoke (`revoked: true`) or set `expires_at` |
| `/api/collections/shares/[shareId]/rotate` | POST | Required | Rotate token (revoke old, create new) |
| `/api/share/[token]/download/[itemId]` | GET | None | Get signed download URL (rate limited 60/min per IP) |

## UI

- **Collection page** (`/collections/[id]`): Share section with list of shares, "Create share link", "Copy link", "Rotate", "Revoke"; shows expiry/revoked state
- **Public share page** (`/share/[token]`): Read-only collection view—collection name, item list; link items open URL; note items show snippet; file items have Download button

## Verification Checklist

- [ ] Revoked token returns 404 on `/share/[token]` and download
- [ ] Expired token returns 404
- [ ] Valid token shows collection and items
- [ ] Org isolation: user A (org 1) cannot see/revoke shares for org 2
- [ ] Free plan: create share returns 402
- [ ] Pro: can create up to 5 active shares
- [ ] Team: can create up to 50 active shares
- [ ] Signed download URL works for file items in shared collection
- [ ] Rate limit: 429 on share create/rotate after limit
- [ ] `last_accessed_at` updates when share page or download is hit
