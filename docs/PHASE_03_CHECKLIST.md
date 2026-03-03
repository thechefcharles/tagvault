# Phase 3: Auth + Protected App Shell — Verification Checklist

## Local Development

- [ ] Run `npm run dev`
- [ ] App starts without errors at http://localhost:3000

## Protected Routes

- [ ] Visiting `/app` while signed out → redirects to `/login`
- [ ] Visiting `/login` while signed in → redirects to `/app`
- [ ] Visiting `/signup` while signed in → redirects to `/app`

## Auth Flows

- [ ] **Sign up**: Create new account at `/signup` → redirects to `/app` after success
- [ ] **Sign in**: Sign in at `/login` → redirects to `/app` after success
- [ ] **Sign out**: Click "Log out" on `/app` → redirects to `/login`

## Root Redirect

- [ ] Visiting `/` → redirects to `/app` (or `/login` if not authenticated)

## Vercel Deploy

- [ ] Project deploys successfully
- [ ] Env vars set in Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Production auth works (sign up, sign in, sign out)
