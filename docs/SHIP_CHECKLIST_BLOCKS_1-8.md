# Ship Checklist — Blocks 1–8

Two-user verification plan to confirm cross-user isolation and core workflows before shipping.

## Prerequisites

- Two test accounts (User A, User B)
- Dev server running: `npm run dev`
- Supabase project with migrations applied
- `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (server-only, for storage delete)

---

## 1. List / Search Isolation

| Step | Action | Expected |
|------|--------|----------|
| 1.1 | Log in as User A. Add 2–3 items (notes, links, files). | Items appear in vault. |
| 1.2 | Log out. Log in as User B. | Redirected to vault. |
| 1.3 | View vault list. | **User B sees 0 items** (User A’s items not visible). |
| 1.4 | Search for text that appears in User A’s items. | **User B gets 0 results**. |
| 1.5 | Add 1–2 items as User B. | Items appear. |
| 1.6 | Log out. Log in as User A. | User A’s original items visible. User B’s items not visible. |

---

## 2. Saved Searches Visibility

| Step | Action | Expected |
|------|--------|----------|
| 2.1 | As User A: run a search, save it (name it "A's search"). | Saved search created. |
| 2.2 | Log out. Log in as User B. | Redirected. |
| 2.3 | Go to Saved Searches. | **User B does not see "A's search"**. |
| 2.4 | Create a saved search as User B ("B's search"). | Saved search created. |
| 2.5 | Log in as User A. Open Saved Searches. | Only "A's search" visible. "B's search" not visible. |

---

## 3. Alerts & Notifications Access

| Step | Action | Expected |
|------|--------|----------|
| 3.1 | As User A: create an alert from a saved search. | Alert created. |
| 3.2 | Log out. Log in as User B. | Redirected. |
| 3.3 | Visit `/alerts`. | **User B sees their own alerts only** (none from User A). |
| 3.4 | Visit `/notifications`. | **User B sees their own notifications only**. |
| 3.5 | (Optional) Trigger alert run for User A, create notification. | User A receives notification. User B does not see it. |

---

## 4. Storage Cleanup After Delete

| Step | Action | Expected |
|------|--------|----------|
| 4.1 | As User A: add a **file** item (Quick Add → File tab, upload a small file). | File item created. |
| 4.2 | Note the item ID from the URL or network tab. | e.g. `/app/item/abc-123` |
| 4.3 | Delete the item (item detail → Delete). | Item removed from list. |
| 4.4 | In Supabase Storage → bucket `vault` → `{user_a_id}/` | **No folder for that item ID** (or file removed). Storage object cleaned up. |

---

## 5. Protected Routes

| Step | Action | Expected |
|------|--------|----------|
| 5.1 | Log out. | Session cleared. |
| 5.2 | Visit `/app`, `/search`, `/saved-searches`, `/alerts`, `/notifications` directly. | Redirected to `/login` for all. |
| 5.3 | Visit `/login` when logged in. | Redirected to `/app`. |

---

## Verification Commands

```bash
npm run lint
npm run build   # or tsc --noEmit if available
```

---

## Env Vars

| Var | Required | Notes |
|-----|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only (items delete + storage cleanup) |
| `OPENAI_API_KEY` | For semantic search | Optional; FTS works without it |
