# TagVault Architecture

## Folder Structure

```
src/
├── app/                    # Next.js App Router routes
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Home (public)
│   ├── login/              # Auth
│   │   └── page.tsx
│   └── dashboard/          # Protected area
│       └── page.tsx        # Future: items CRUD will live here
├── components/             # Reusable UI components
├── lib/                    # Shared utilities
│   ├── supabase/
│   │   ├── browser.ts      # Client-side Supabase client
│   │   ├── server.ts       # Server-side Supabase client (RSC)
│   │   └── middleware.ts   # Session refresh + redirects
│   └── server/             # Server-only utilities
│       ├── env.ts          # Environment validation
│       └── auth.ts         # getCurrentUser, requireUser, requireNoUser
└── types/                  # Shared TypeScript types
    └── index.ts
```

## Server vs Client Separation

- **Server Components** (default): Use `@/lib/supabase/server` and `@/lib/server/*`. No `"use client"`.
- **Client Components**: Use `@/lib/supabase/browser` for auth (e.g. login form, logout). Must have `"use client"`.
- **Route Handlers / API routes**: Use `@/lib/supabase/server` or a service-role client if admin access is needed.

## Supabase Client Usage

| Context | Import | Key used |
|---------|--------|----------|
| Browser (Client Components) | `@/lib/supabase/browser` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Server Components, Server Actions, Route Handlers | `@/lib/supabase/server` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Middleware | `@/lib/supabase/middleware` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

The anon key is safe to expose; Row Level Security (RLS) in the database restricts data access.

## Service Role Key (Server-Only)

`SUPABASE_SERVICE_ROLE_KEY` bypasses RLS and should **never** be used in:

- Client Components
- Middleware
- Any code that runs in the browser

Use it only in server-side code when you need admin-level operations (e.g. server-side mutations that bypass RLS). It must not be imported in files that are bundled for the client.

## Storage Model

- **Bucket:** `vault` (private)
- **Model:** single-file-per-item — each item has at most one file via `items.storage_path`
- **Path convention:** `{user_id}/{item_id}/{filename}`

`items.storage_path` is the authoritative pointer. Deleting an item must remove the storage object (see `docs/rls-verification.md`).

## Items Feature

Items CRUD lives under `/app` and `/app/item/[id]`. The database schema defines `items` with:

- `description` (required text)
- `priority` (integer 1–20)
- `created_at` / `updated_at` timestamps

RLS will enforce that users can only access their own items.
