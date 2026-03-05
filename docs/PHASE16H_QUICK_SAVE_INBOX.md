# Phase 16H: Quick Save Inbox (items.inbox)

## Overview

Quick Save Mode makes sharing into TagVault "fast capture now, organize later". New items created from share-import or other quick-save flows land in an **Inbox**, and can be moved into the normal vault once they have a proper description.

This phase adds a minimal `items.inbox` flag, API filters, relaxed description rules for inbox items, and UI surfacing (Inbox toggle + pill).

## Schema

Migration: `0034_phase16h_quick_save_inbox.sql`

- **items**
  - New column `inbox boolean NOT NULL DEFAULT true`
  - Existing rows are backfilled to `inbox = false` so only new items default to inbox.
  - Index: `idx_items_org_inbox_created_at` on `(org_id, inbox, created_at DESC)` for efficient filtering.

RLS remains org-scoped via existing `items` policies.

## API Changes

### Items list

- **Route:** `GET /api/items`
- **New query param:** `inbox=1|0`
  - `inbox=1` → only inbox items
  - `inbox=0` → only non-inbox items (vault)
  - omitted → all items (existing behavior)
- Implementation:
  - `listItems({ orgId, userId, type, sort, limit, cursor, tagIds, inbox })` now accepts an optional `inbox?: boolean` and applies `eq('inbox', inbox)` when provided.
  - `/api/items` parses `inbox` and passes it through.

### Search

- **Route:** `GET /api/search`
- **New query param:** `inbox=1|0` (same semantics as above).
- Implementation:
  - `searchItemsHybrid` still returns all matching items for the query.
  - `/api/search` filters results in-process when `inbox` is provided:
    - `items = items.filter((i) => i.inbox === inbox)`

### Item creation (description rules)

- Shared validators in `src/lib/db/validators.ts`:
  - `baseItemSchema.description` is now `z.string().max(500)` (no min at schema layer).
  - `createItemSchema` includes optional `inbox?: boolean` and adds a refinement:
    - If `inbox === true`: description length can be `0–500`.
    - Else (non-inbox): description must be `12–500` characters.
  - Existing URL requirement for `type: 'link'` is unchanged.

- **Create endpoint:** `POST /api/items`
  - Uses `createItemSchema`.
  - For normal in-app creates (Quick Add), the client does **not** send `inbox`, so `inbox` defaults to `false` and the 12–500 char rule is enforced.
  - For share-import, the client sends `inbox: true`, so the description may be empty or short.
  - Files still use `/api/items/upload`.

- **File upload:** `POST /api/items/upload`
  - New form fields:
    - `source` (string, optional – `share_import` when coming from Share Import)
    - `inbox` (`'1'` or `'true'` when inbox=true)
  - Behavior:
    - If `source === 'share_import'` and `inbox` is truthy:
      - Description is optional, must be `0–500` characters.
    - Otherwise (normal in-app uploads):
      - File and description are required.
      - Description must be `12–500` characters (previous behavior preserved).
  - The created item is inserted via `createItem` with `payload.inbox` set accordingly.

### Item type

- `src/types/item.ts` updated:
  - `inbox: boolean` added to the `Item` type.

## Share-import Quick Save UX

The `/share-import` screen now treats inbox items specially:

- When opened in a Capacitor shell, it:
  - Reads the **queue** of pending share payloads via `SharePayloadPlugin.getPendingPayload()` (returns `{ payloads: PendingSharePayload[] }`).
  - Shows the **first** payload in a Quick Save form with:
    - Optional title.
    - Optional description (no min length).
    - Optional priority.
    - For URLs, a read-only Link box.
  - On **Save**:
    - Creates an item via:
      - `POST /api/items` for link/text (`inbox: true`).
      - `POST /api/items/upload` for files (`source=share_import`, `inbox=1`).
    - Marks the native queue entry as consumed (`clearPendingPayload({ index: 0 })`) and reloads the next payload if present.
  - On **Discard**:
    - Just removes the queue entry (`clearPendingPayload({ index: 0 })`) and shows the next or the empty state.

Result: sharing into TagVault can be “tap Save only” with no minimum description, and items are clearly marked as Inbox until you organize them.

## UI Surfacing

### Vault (/app)

- **Inbox vs Vault toggle**
  - In the item list header (`ItemList`), a small toggle:
    - **Inbox** → sets `?inbox=1` on `/app`.
    - **Vault** → sets `?inbox=0`.
  - The server-side `AppPage` reads `searchParams.inbox` and passes the boolean to `listItems` and to `VaultClient`.
  - `VaultClient` includes `inbox` when requesting more items from `/api/items` for pagination.

- **Inbox pill on cards**
  - In `ItemList`, each card shows:
    - Type badge (note/link/file) as before.
    - When `item.inbox === true`, a small **INBOX** pill:
      - Styles: subtle bordered amber pill to indicate “unprocessed”.

### Share Import

- The Quick Save form label for description is now **optional**, and there is no local “min 12 chars” validation.
- Server-side:
  - Inbox items created via Share Import are allowed to have empty/short descriptions.
  - Non-inbox items (Quick Add, normal creates) still require `12–500` characters.

## Validation Rules Summary

- **Normal items (inbox=false):**
  - Description required, 12–500 characters.
  - Enforced by:
    - `createItemSchema` refinement (when `inbox` is false or absent).
    - `/api/items/upload` for non-share-import uploads.
  - Quick Add UI also enforces this client-side.

- **Inbox items (inbox=true, typically from share-import):**
  - Description optional, 0–500 characters.
  - Enforced by:
    - `createItemSchema` refinement (`inbox === true` branch).
    - `/api/items/upload` when `source=share_import` and `inbox=1`.

## Manual Test Checklist

- **Schema**
  - [ ] Run migrations; `items.inbox` exists, index exists, existing rows have `inbox=false`.

- **Share-import**
  - [ ] From Safari: share a URL to TagVault → open TagVault → `/share-import` shows the URL; hit Save without typing a description → item is created with `inbox=true`, description empty.
  - [ ] From Notes: share text → same as above.
  - [ ] From Photos/Files (≤20MB) → file shares create file items with `inbox=true`.
  - [ ] Multiple shares in a row appear in the Share Import queue as “Item 1 of N”, and Save/Discard step through them.

- **Inbox filter**
  - [ ] `/app?inbox=1` shows only inbox items; `/app?inbox=0` shows only non-inbox items.
  - [ ] Toggling Inbox/Vault in the UI updates the query param and the list.
  - [ ] Pagination from Inbox view respects the filter.

- **Description enforcement**
  - [ ] Quick Add note/link/file still requires description ≥ 12 chars; server rejects shorter descriptions.
  - [ ] Share-import-created items can have empty descriptions and are marked `inbox=true`.
  - [ ] (If/when a “move to vault” action is added) moving out of Inbox should enforce the 12–500 rule.

- **Search**
  - [ ] `/api/search?q=...&inbox=1` returns only inbox items.
  - [ ] `/api/search?q=...&inbox=0` returns only non-inbox items.

## Commit Message Suggestion

`feat: phase 16h quick save inbox flag`

