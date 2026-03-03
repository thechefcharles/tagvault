# TagVault — Audit: Blocks 1–8 Spec vs Implementation

## Summary

The app was built through **Cursor Prompts 01–08** (Phases 1–8) and implements the intended features, but with notable schema and routing differences. This audit compares the spec to the current codebase.

---

## Block 1 — Foundation

| Spec | Status | Notes |
|------|--------|------|
| Next.js 14 App Router + TS strict | ✅ | `tsconfig.json` has `"strict": true` |
| Supabase Postgres + RLS | ✅ | All relevant tables use RLS |
| Supabase Storage private bucket | ✅ | `vault` bucket, private, user-scoped path |
| Supabase SSR auth | ✅ | `@supabase/ssr`, `server.ts`, `browser.ts` |
| Vercel deployment | ⚠️ | Not verified; config is deployable |
| Middleware route protection | ✅ | Protects `/app`, `/search`, `/saved-searches` |
| `lib/supabase/client.ts` | ⚠️ | Uses `browser.ts` instead (equivalent) |
| `lib/supabase/server.ts` | ✅ | Uses cookies, server client |
| Env vars | ✅ | `.env.example` has all required vars |

### Items schema differences

| Spec (Block 1) | Actual |
|----------------|--------|
| `source_title`, `source_domain` | ❌ Not in schema |
| `file_path`, `file_mime`, `file_size` | Uses `storage_path`, `mime_type`; no `file_size` |
| `owner_id` | `user_id` (different name, same purpose) |

### Route structure

| Spec | Actual |
|------|--------|
| `/(public)/login` | `/(auth)/login` |
| `/(app)/dashboard` | `/(app)/app` (main vault) |

---

## Block 2 — Authentication Layer

| Spec | Status | Notes |
|------|--------|------|
| Email/password auth | ✅ | Login, signup |
| Profiles table + auto-create | ✅ | `handle_new_user()` trigger |
| Profiles: `email`, `is_pro` | ⚠️ | Uses `username`, `full_name`, `avatar_url` instead |
| Protected routes | ✅ | Middleware redirects unauthenticated |
| Logout | ✅ | `LogoutButton` + API/logout |
| App shell layout | ✅ | `(app)/app/layout.tsx` |

### Gap: `/alerts` and `/notifications` not in middleware

**✅ Fixed (Ship Hardening):** Middleware now protects `pathname.startsWith("/alerts")` and `pathname.startsWith("/notifications")`. Verify: unauthenticated users are redirected to login.

---

## Block 3 — Core Product (Items CRUD + Upload)

| Spec | Status | Notes |
|------|--------|------|
| Items CRUD | ✅ | API + UI |
| File upload | ✅ | Via `storage_path` on items; `vault` bucket |
| Attachments table | ❌ | No separate `attachments` table; files stored per item |
| Bucket `item-attachments` | ❌ | Uses `vault` with `{user_id}/...` path |
| FTS base | ✅ | `search_tsv` in Phase 5 migration |
| List + detail + create | ✅ | `/app` list, Quick Add, `/app/item/[id]` |

### Structural differences

- Spec: `/dashboard/items`, `/dashboard/items/new`, `/dashboard/items/[id]/edit`
- Actual: Single `/app` page with list + Quick Add modal; `/app/item/[id]` for detail
- Spec: `content`, `tags` on items
- Actual: `title`, `description`; no `content` or `tags` on items

---

## Block 4 — Search Hardening

| Spec | Status | Notes |
|------|--------|------|
| Canonical query spec | ⚠️ | Simpler: `q`, `type`, `sort`; no tags, date range, hasAttachments |
| FTS ranking | ✅ | `ts_rank_cd`, hybrid search |
| Filters (tags, date, hasAttachments) | ❌ | Only `type` filter |
| Cursor pagination | ❌ | Uses offset/limit |
| Saved searches table | ✅ | Different schema (see Block 7) |

---

## Block 5 — Embeddings Foundation

| Spec | Status | Notes |
|------|--------|------|
| pgvector extension | ✅ | |
| `item_embeddings` table | ⚠️ | Embedding stored on `items` table; `embedding_queue` for jobs |
| `embedding_jobs` table | ⚠️ | `embedding_queue` used instead |
| Content hash for skip | ✅ | Via `needs_embedding` + queue |
| `/api/embeddings/enqueue` | ⚠️ | Trigger-based queue; Edge Function `index-embeddings` |
| `/api/embeddings/process` | ⚠️ | Edge Function handles processing |
| `/api/embeddings/backfill` | ⚠️ | Via queue backfill, not separate route |

---

## Block 6 — Hybrid Search

| Spec | Status | Notes |
|------|--------|------|
| `hybrid_search_items` RPC | ✅ | `rpc_search_items_hybrid` |
| FTS + semantic blending | ✅ | |
| API route | ✅ | `GET /api/search` (not POST /hybrid) |
| Query embedding server-side | ✅ | `getQueryEmbedding` |

---

## Block 7 — Saved Searches

| Spec | Status | Notes |
|------|--------|------|
| `saved_searches` table | ✅ | Different columns: `query`, `filters`, `sort`, `semantic_enabled`, `pinned` |
| CRUD API | ✅ | |
| Run endpoint | ✅ | `GET /api/saved-searches/[id]/run` |
| Save/run UI | ✅ | Modal, list, run from view |

---

## Block 8 — Alerts

| Spec | Status | Notes |
|------|--------|------|
| Alerts table | ✅ | Uses `frequency_minutes` instead of schedule enum |
| `alert_events` | ⚠️ | Implemented as `notifications` table (equivalent) |
| Diff strategy | ✅ | `alert_item_state` for dedupe |
| Cron endpoint | ✅ | `POST /api/alerts/process-due` |
| Inbox | ✅ | `/notifications` page |
| Create from saved search | ✅ | "Create alert" on saved search view |

---

## Gaps to Address

### 1. Middleware: protect `/alerts` and `/notifications` — ✅ Done

Middleware includes these paths. See `src/lib/supabase/middleware.ts`.

### 2. RLS on auxiliary tables (embedding_queue, search_queries) — ✅ Done

Migration `0010_rls_embedding_queue_search_queries.sql`: `embedding_queue` locked to service-role only; `search_queries` allows authenticated read/write. Run in Supabase SQL Editor if not applied via push.

### 3. Storage cleanup on item delete — ✅ Done

`DELETE /api/items/[id]` removes the storage object via admin client before deleting the DB row. See `src/app/api/items/[id]/route.ts`. UI calls this endpoint.

### 4. Block 1 items schema (optional)

The spec requested `source_title`, `source_domain`, `file_path`, `file_mime`, `file_size`. Current schema uses `storage_path`, `mime_type` and omits others. Align only if those fields are needed for product behavior.

### 5. Block 2 profiles schema (optional)

Spec had `email`, `is_pro`. Current has `username`, `full_name`, `avatar_url`. Add `email`/`is_pro` only if required for future features (e.g. Pro flag).

### 6. Block 3 attachments (optional)

Spec included a separate `attachments` table and `item-attachments` bucket. Current design embeds file info in items. Revisit only if multi-file per item is required.

### 7. Block 4 search filters (optional)

Spec had tags, date range, hasAttachments, cursor pagination. Current search is simpler. Add if product needs these filters.

---

## Ship Criteria Checklist (from specs)

| Criteria | Status |
|----------|--------|
| Login works | ✅ |
| Create/read item for self | ✅ |
| Cannot read another user's item (DB + API) | ✅ |
| Private storage, user-isolated | ✅ |
| No service role in browser | ✅ |
| Signup creates profile | ✅ |
| Logout invalidates session | ✅ |
| Protected routes redirect | ✅ /alerts, /notifications in middleware |
| CRUD items | ✅ |
| FTS / hybrid search | ✅ |
| Saved searches CRUD + run | ✅ |
| Alerts + Run now + notifications | ✅ |
| Cron process-due | ✅ |

---

## Conclusion

Core behavior for Blocks 1–8 is implemented. Ship hardening pass (2024): middleware protects `/alerts` and `/notifications`; RLS added for `embedding_queue` and `search_queries`; storage cleanup on item delete; two-user test plan in `docs/SHIP_CHECKLIST_BLOCKS_1-8.md`. Other differences are schema and UX choices that can be revisited when product requirements are clearer.
