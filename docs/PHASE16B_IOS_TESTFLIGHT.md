# Phase 16B: iOS Distribution Setup (TestFlight)

## Overview

Phase 16B documents the copy/paste checklist for shipping TagVault iOS builds to testers via TestFlight. The app is a Capacitor shell that loads the production web app from Vercel.

---

## 1. Project Identity

| Setting | Value |
|---------|-------|
| **Bundle ID** | `com.tagvault.app` |
| **App Name** | TagVault |
| **Server URL** | `https://tagvault-phi.vercel.app` |
| **webDir** | `out` |

**Notes:**
- Use `com.<yourname>.tagvault` if you haven't reserved `com.tagvault.app` yet.
- `capacitor.config.ts` defines these; run `npx cap sync` after changes.

---

## 2. Apple Developer / App Store Connect Record

1. **Apple Developer Program**  
   Enroll at https://developer.apple.com (required for TestFlight).

2. **Create App in App Store Connect**
   - Go to https://appstoreconnect.apple.com → **My Apps** → **+** → **New App**.
   - Platform: iOS.
   - Name: **TagVault**.
   - Primary Language: English.
   - Bundle ID: Select or create `com.tagvault.app` (must match Xcode).
   - SKU: e.g. `tagvault-ios`.

3. **Agreements & Tax**
   - Complete all required agreements and banking/tax if needed for paid apps.

---

## 3. Xcode Signing (Automatic)

1. Open project: `pnpm cap:ios` (or `npx cap open ios`).
2. Select the **App** target.
3. **Signing & Capabilities** tab:
   - Check **Automatically manage signing**.
   - **Team**: Select your Apple Developer team.
   - **Bundle Identifier**: `com.tagvault.app` (must match App Store Connect).
4. Ensure **Provisioning Profile** shows "(Xcode Managed Profile)".

---

## 4. Build, Archive & Upload

1. **Select destination**  
   **Product** → **Destination** → **Any iOS Device (arm64)** (not simulator).

2. **Archive**  
   **Product** → **Archive**. Wait for build to complete.

3. **Organizer**  
   Window opens; select the archive → **Distribute App**.

4. **Distribution method**  
   - **App Store Connect** → Next.  
   - **Upload** → Next.  
   - Options: default (App Thinning, bitcode per project) → Next.

5. **Signing**  
   **Automatically manage signing** → Next.

6. **Upload**  
   Review and click **Upload**. Wait for processing.

7. **Processing**  
   In App Store Connect → **TestFlight**, the build appears after processing (5–30 min).

---

## 5. TestFlight Internal Testing Groups

1. App Store Connect → **My Apps** → **TagVault** → **TestFlight**.
2. **Internal Testing** → **+** to create group (e.g. "Team").
3. Add testers by Apple ID email (App Store Connect users with Admin, App Manager, or Developer role).
4. Internal testers get builds immediately after processing; no Beta App Review.

---

## 6. Adding External Testers

1. **External Testing** → **+** to create group (e.g. "Friends").
2. Add testers by email.
3. Submit for **Beta App Review** (required for first build; typically 24–48 h).
4. Once approved, testers receive an invite via the **TestFlight** app.

---

## 7. Release Cadence

| Build Type | Version Format | When |
|------------|----------------|------|
| TestFlight | `1.0.0(12)` = CFBundleShortVersionString(CFBundleVersion) | Each upload |
| App Store | Same as TestFlight, then submit for review | When ready to ship |

**Version bumps:**
- Increment **CFBundleVersion** (build number) for every TestFlight/App Store upload.
- Increment **CFBundleShortVersionString** when releasing a new public version.

**SENTRY_RELEASE:**  
Set `SENTRY_RELEASE=1.0.0(12)` (or matching version) in Vercel for App Store builds so the health endpoint (`/api/health`) and Sentry use the same identifier. Vercel → Project → Settings → Environment Variables. See `.env.example` for the note on semantic versions.

---

## 8. TagVault URLs & Values to Verify

| Resource | URL / Value |
|----------|-------------|
| **App URL (Vercel)** | `https://tagvault-phi.vercel.app` |
| **Auth callback** | `https://tagvault-phi.vercel.app/auth/callback` |
| **Onboarding** | `https://tagvault-phi.vercel.app/onboarding` |
| **Main app** | `https://tagvault-phi.vercel.app/app` |
| **Share (collection)** | `https://tagvault-phi.vercel.app/share/[token]` |
| **Share (item)** | `https://tagvault-phi.vercel.app/share-item/[token]` |
| **Health endpoint** | `https://tagvault-phi.vercel.app/api/health` |

Supabase must have `https://tagvault-phi.vercel.app/auth/callback` in **Authentication → URL Configuration → Redirect URLs**.

---

## 9. Common Failures

### Auth callback redirects

- **Symptom:** Login hangs or fails; magic link redirect doesn’t work in app.
- **Cause:** Redirect URL not allowed or wrong origin.
- **Fix:** Add `https://tagvault-phi.vercel.app/auth/callback` to Supabase redirect URLs. Ensure no trailing slash mismatch.

### Universal Links

- **Symptom:** Links like `https://tagvault-phi.vercel.app/...` open in Safari instead of the app.
- **Cause:** `apple-app-site-association` not served or incorrect.
- **Fix:** Serve AASA at `https://tagvault-phi.vercel.app/.well-known/apple-app-site-association`. Configure associated domains in Xcode (Capacitor).

### Missing icons

- **Symptom:** Blank icon or generic placeholder.
- **Cause:** App icon not set or wrong size.
- **Fix:** Add icons in `ios/App/App/Assets.xcassets/AppIcon.appiconset` per Apple sizes (e.g. 1024×1024).

### Wrong team

- **Symptom:** Signing error; "No profiles for 'com.tagvault.app'".
- **Cause:** Bundle ID or team mismatch.
- **Fix:** Ensure Bundle ID matches App Store Connect; select correct team in Xcode Signing.

### Entitlements mismatch

- **Symptom:** Push, keychain, or capability errors.
- **Cause:** Capability in Xcode not in provisioning profile.
- **Fix:** Re-sync signing; regenerate provisioning profile; check entitlements file for typos.

---

## 10. Verification

- [ ] `pnpm cap:sync` runs without errors
- [ ] Xcode archive builds and uploads
- [ ] Build appears in TestFlight after processing
- [ ] Internal testers can install via TestFlight
- [ ] Login (magic link) works in app
- [ ] `/app`, `/onboarding`, share pages load correctly
- [ ] Health endpoint returns expected version
