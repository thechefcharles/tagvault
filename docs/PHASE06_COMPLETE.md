# Phase 6 — Stability, Security, Performance, Polish (Complete)

Phase 6 from TagVault (3).pdf is implemented. Summary of changes:

## 6.1 Security Hardening

| Item | Status |
|------|--------|
| 6.1.1 API auth (`requireUser`) | ✅ Already in place |
| 6.1.2 Storage path enforcement | ✅ Server-side only, `{user_id}/{item_id}/filename` |
| 6.1.3 Input validation (Zod) | ✅ Type-specific constraints |
| 6.1.4 Rate limiting | ✅ In-memory, 30 req/min per user for items write endpoints |

## 6.2 Reliability

| Item | Status |
|------|--------|
| 6.2.1 Rollback on upload failure | ✅ DB rollback, storage cleanup on delete |
| 6.2.2 Standardized errors | ✅ `apiError()` / `apiOk()` in `src/lib/api/response.ts`; used for rate limit + routes |

## 6.3 Performance

| Item | Status |
|------|--------|
| 6.3.1 Cursor pagination | ✅ `listItems` + `/api/items` use cursor; `/api/search` returns `{ items, nextCursor }`; Load more on both |
| 6.3.2 Index verification | ✅ Via migrations |
| 6.3.3 Search UX | ✅ Debounce, min 2 chars, keep prior results while loading, Load more, Clear button |

## 6.4 UX Polish

| Item | Status |
|------|--------|
| 6.4.1 Loading/empty/error states | ✅ Empty state copy, loading skeleton on Load more |
| 6.4.2 Inline priority editing | ✅ Priority dropdown on each vault list row |
| 6.4.3 Quick Add improvements | ✅ Autofocus on description, Cmd/Ctrl+Enter to save, type-specific placeholders |

## 6.5 QA & Logging

| Item | Status |
|------|--------|
| 6.5.1 QA checklist | ✅ `docs/SHIP_CHECKLIST_BLOCKS_1-8.md` |
| 6.5.2 Error logging | ✅ `console.error` in items route catch blocks |

## Files Added/Modified

- `src/lib/api/response.ts` — apiError, apiOk, parseJson
- `src/lib/api/rate-limit.ts` — In-memory rate limiter
- `src/lib/db/items.ts` — listItems with cursor pagination
- `src/app/api/items/route.ts` — Pagination, rate limit, error logging
- `src/app/api/items/[id]/route.ts` — Rate limit on PATCH/DELETE
- `src/app/api/items/upload/route.ts` — Rate limit, error logging
- `src/app/(app)/app/page.tsx` — Pass limit, cursor, type, sort to VaultClient
- `src/app/(app)/app/VaultClient.tsx` — Client-side Load more, accumulate items
- `src/components/ItemList.tsx` — Inline priority, Load more, empty state, loading skeleton
- `src/components/QuickAddModal.tsx` — Autofocus, Cmd+Enter, placeholders
