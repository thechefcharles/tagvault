# Phase 14B: Shareable Items (Public Links)

## Overview

Phase 14B adds public share links for individual items. Users can create shareable links that allow unauthenticated access to a read-only view of an item. Share links can be revoked, rotated, and optionally expire. Mirrors the collection shares pattern (Phase 14A).

## Schema

### item_shares table

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `org_id` | uuid | FK to organizations |
| `item_id` | uuid | FK to items |
| `token` | text | Unique share token (used in URL) |
| `created_by` | uuid | FK to auth.users (nullable) |
| `created_at` | timestamptz | |
| `revoked_at` | timestamptz | When revoked; null = active |
| `expires_at` | timestamptz | Optional expiry |
| `last_accessed_at` | timestamptz | Last time share page/download was accessed |

- UNIQUE on `token`
- Index: `idx_item_shares_org_item` on `(org_id, item_id)`
- Index: `idx_item_shares_token` on `(token)`
- RLS: org members can SELECT, INSERT, UPDATE, DELETE

## RLS / RPC Design

### Public access via SECURITY DEFINER RPC

`get_shared_item_by_token(p_token text)` returns JSON:

- `{ id, org_id, type, title, description, url, storage_path, mime_type, created_at }`
- Returns `NULL` if token invalid, revoked, or expired

The RPC exposes only the minimum fields needed for a public read-only view. Updates `last_accessed_at` on access.

## Plan Limits

| Plan | Active item shares |
|------|--------------------|
| free | 0 |
| pro | 25 |
| team | 250 |

Active = `revoked_at IS NULL` AND (`expires_at IS NULL` OR `expires_at > now()`).

Enforced at create; returns 402 PLAN_LIMIT_EXCEEDED with upgrade CTA.

## API Routes

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/items/[id]/shares` | GET | Required | List shares for item |
| `/api/items/[id]/shares` | POST | Required | Create share (rate limited 20/min) |
| `/api/items/shares/[shareId]` | PATCH | Required | Revoke (`revoked: true`) or set `expires_at` |
| `/api/items/shares/[shareId]/rotate` | POST | Required | Rotate token (revoke old, create new) |
| `/api/share-item/[token]/download` | GET | None | Get signed download URL for file items (rate limited 60/min per IP) |

## UI

- **Item detail page** (`/app/item/[id]`): Share section with list of shares, "Create share link", "Copy link", "Rotate", "Revoke"; shows expiry/revoked state
- **Public share page** (`/share-item/[token]`): Read-only item view—notes show snippet/body; links show URL and Open button; files show Download button

## Verification Checklist

- [ ] Revoked token returns 404 on `/share-item/[token]` and download
- [ ] Expired token returns 404
- [ ] Valid token shows item (note/link/file)
- [ ] Org isolation: user in org A cannot see/manage shares for items in org B
- [ ] Free plan: create share returns 402
- [ ] Pro: can create up to 25 active item shares
- [ ] Team: can create up to 250 active item shares
- [ ] Signed download URL works for file items
- [ ] Rate limit: 429 on share create/rotate after limit
- [ ] `last_accessed_at` updates when share page or download is hit
