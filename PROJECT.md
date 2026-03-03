# TagVault — Project Notes

## MVP Spec (Phase 0)

- **Product**: Fast "save anything" vault with required descriptions, priority 1–20, and keyword search
- **Stack**: Next.js 14, Supabase (auth, Postgres, storage), Vercel

## Decisions Locked

- Description required (min 12 chars)
- Priority 1–20, nullable
- No tags, no AI for core value (semantic search is optional enhancement)
- User-scoped storage path: `<user_id>/<item_id>/<filename>`

## Current Phase

Phase 6 complete. Phase 7 (production hardening) next.
