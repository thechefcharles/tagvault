# Phase 16A: Capacitor App Shell

## Overview

Phase 16A wraps TagVault in Capacitor (iOS + Android) as a thin native shell. The app loads the deployed web app (`https://tagvault-phi.vercel.app`) inside a WebView. Auth callbacks, deep links, and external links are handled for native behavior.

## Prerequisites

- **Xcode** (macOS) for iOS
- **Android Studio** for Android
- **Node.js** + pnpm
- TagVault deployed at `https://tagvault-phi.vercel.app`

## Manual Setup Commands

```bash
# 1. Install dependencies
pnpm install

# 2. Ensure out/ exists (minimal fallback for Capacitor sync)
mkdir -p out
# out/index.html is committed; or create: echo '<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=https://tagvault-phi.vercel.app"></head><body>Loading…</body></html>' > out/index.html

# 3. Add native platforms (run once)
npx cap add ios
npx cap add android

# 4. Sync web assets to native projects
pnpm cap:sync

# 5. Open in IDE and run
pnpm cap:ios    # Opens Xcode
pnpm cap:android  # Opens Android Studio
```

## iOS Setup

1. Open project: `pnpm cap:ios`
2. Select a simulator or device
3. In Xcode:
   - **Bundle Identifier**: `com.tagvault.app` (or change in `capacitor.config.ts`)
   - **Signing & Capabilities**: Add your team for code signing
4. Run (⌘R)

## Android Setup

1. Open project: `pnpm cap:android`
2. In Android Studio:
   - **Build → Make Project**
   - Run on emulator or device

## Deep Link Testing

1. **Auth callback**: Log in via email magic link. Supabase redirects to `https://tagvault-phi.vercel.app/auth/callback?code=...`. In the app WebView, this loads and completes auth.
2. **appUrlOpen**: When the app is opened from a link (e.g. `tagvault://auth/callback` or universal link), `CapacitorLinkHandler` routes to the correct path.
3. **Share pages**: Open `https://tagvault-phi.vercel.app/share/[token]` in the app — should render unauthenticated.

## External Links

- "Open link" on items, "Manage Billing", and download signed URLs use `openExternal()`.
- On Capacitor, these open in the **system browser** (Safari/Chrome), not in the in-app WebView.
- On web, `window.open(..., '_blank')` is used.

## Safe Area

- `safe-area-top`, `safe-area-bottom` CSS classes and `env(safe-area-inset-*)` are used for the fixed header area.
- Install PWA button is **hidden** when running inside Capacitor (irrelevant in native shell).

## Known Limitations

- **Push notifications**: Not implemented yet (Phase 16B).
- **Biometrics / file share**: Future native plugins.
- **Offline**: App loads from the network; no offline caching of the full app in Capacitor mode.

## Configuration

| Setting | Value |
|---------|-------|
| `appId` | `com.tagvault.app` |
| `appName` | TagVault |
| `server.url` | `https://tagvault-phi.vercel.app` |
| `webDir` | `out` |

## Verification

- [ ] `pnpm lint` and `pnpm exec tsc --noEmit` pass
- [ ] iOS simulator loads TagVault from Vercel
- [ ] Login works; redirects to /app
- [ ] Share links (`/share/*`, `/share-item/*`) render unauthenticated
- [ ] Auth callback URL opened from background routes correctly
- [ ] External links (Open link, Manage Billing, Download) open in system browser
