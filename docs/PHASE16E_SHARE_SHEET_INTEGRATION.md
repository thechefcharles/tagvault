# Phase 16E: System Share Sheet Integration

## Overview

Phase 16E adds system share sheet integration for TagVault on iOS and Android. Users can share URLs, text, images, or other files from any app into TagVault. The shared content is passed to a `/share-import` page with a Quick Save flow.

## Architecture

```
[Share from Safari/Photos/etc]
        ↓
[iOS Share Extension] or [Android Intent Handler]
        ↓
[Store payload in App Group / SharedPreferences]
        ↓
[Open app at tagvault://share-import]
        ↓
[CapacitorLinkHandler routes to /share-import]
        ↓
[ShareImportClient reads payload via SharePayloadPlugin]
        ↓
[Quick Save form → POST /api/items or /api/items/upload]
```

## Payload Shape

```json
{
  "kind": "url" | "text" | "file",
  "url?: "https://...",
  "text?: "plain text",
  "fileName?: "image.png",
  "mimeType?: "image/png",
  "fileBase64?: "<base64 string>"
}
```

- **url**: `kind: "url"`, `url` required
- **text**: `kind: "text"`, `text` required  
- **file**: `kind: "file"`, `fileName`, `mimeType`, `fileBase64` (20MB limit on mobile)

## Files Delivered

| Path | Description |
|------|-------------|
| `src/lib/native/SharePayloadPlugin.ts` | Capacitor plugin TypeScript interface |
| `ios/App/App/SharePayloadPlugin.swift` | iOS plugin (reads/clears App Group UserDefaults) |
| `ios/App/App/MainViewController.swift` | Registers SharePayloadPlugin |
| `ios/ShareExtension/ShareViewController.swift` | Share Extension source |
| `ios/ShareExtension/Info.plist` | Share Extension Info.plist template |
| `android/App/app/src/main/java/com/tagvault/app/SharePayloadPlugin.kt` | Android Capacitor plugin |
| `android/App/app/src/main/java/com/tagvault/app/ShareIntentHandler.kt` | Android share intent handler |
| `src/app/(app)/share-import/page.tsx` | Share import page (server) |
| `src/app/(app)/share-import/ShareImportClient.tsx` | Share import client with Quick Save |
| `src/components/native/CapacitorLinkHandler.tsx` | Updated to route `/share-import` |
| `src/lib/supabase/middleware.ts` | Protected `/share-import`, preserves `next` on login redirect |

## API

- **Note/link shares**: `POST /api/items` (existing)
- **File shares**: `POST /api/items/upload` (existing)

No new API routes.

---

## Manual Setup: iOS

### 1. App Group (Main App)

1. Open `ios/App/App.xcworkspace` in Xcode
2. Select **App** target → **Signing & Capabilities**
3. Click **+ Capability** → **App Groups**
4. Add `group.com.tagvault.app`

### 2. Add Plugin Files to App Target

1. In Xcode, right‑click the **App** group → **Add Files to "App"…**
2. Add `SharePayloadPlugin.swift` and `MainViewController.swift` from `ios/App/App/`
3. Ensure they are in the **App** target (check Target Membership)

### 3. Main.storyboard

The storyboard was updated to use `MainViewController` instead of `CAPBridgeViewController`. Verify:

- **View Controller** → Custom Class: `MainViewController`, Module: `App`

### 4. Create Share Extension Target

1. **File** → **New** → **Target**
2. Choose **Share Extension**
3. Product Name: `ShareExtension`
4. Bundle Identifier: `com.tagvault.app.ShareExtension`
5. Click **Finish** (if asked to activate scheme, choose **Activate**)

### 5. Share Extension Capabilities

1. Select **ShareExtension** target → **Signing & Capabilities**
2. Add **App Groups** capability
3. Add `group.com.tagvault.app` (same as main app)

### 6. Share Extension Source

1. Remove the auto‑generated `ShareViewController.swift` in the ShareExtension group
2. Add the file `ios/ShareExtension/ShareViewController.swift` to the ShareExtension target
3. Replace the ShareExtension’s `Info.plist` contents with `ios/ShareExtension/Info.plist` (or merge the `NSExtension` and `NSExtensionAttributes` keys)

### 7. Info.plist Activation Rules

For the Share Extension, ensure `NSExtensionActivationSupports*` keys support:

- `public.url`, `public.text`, `public.image`, `public.movie`
- Or use the dict from `ios/ShareExtension/Info.plist`

### 8. Open Main App from Extension

The Share Extension calls `tagvault://share-import` to open the main app. Ensure:

- **App** target → **Info** → **URL Types** has a scheme `tagvault` (or add it)
- URL Identifier: `com.tagvault.app`
- URL Scheme: `tagvault`

---

## Manual Setup: Android

### 1. Add Android Platform (if not present)

```bash
npx cap add android
```

### 2. Add Plugin and Handler to Project

1. Copy or ensure these files exist:
   - `android/App/app/src/main/java/com/tagvault/app/SharePayloadPlugin.kt`
   - `android/App/app/src/main/java/com/tagvault/app/ShareIntentHandler.kt`

2. If Kotlin is not configured, add Kotlin to the project (or convert handlers to Java).

### 3. Register SharePayloadPlugin in MainActivity

In `MainActivity.kt` or `MainActivity.java`:

```kotlin
// Kotlin
override fun onCreate(savedInstanceState: Bundle?) {
    registerPlugin(SharePayloadPlugin::class.java)
    super.onCreate(savedInstanceState)
}
```

```java
// Java
@Override
public void onCreate(Bundle savedInstanceState) {
    registerPlugin(SharePayloadPlugin.class);
    super.onCreate(savedInstanceState);
}
```

### 4. Handle Share Intents in MainActivity

When the app is launched via Share (ACTION_SEND), store the payload and reopen with the share-import deep link so the WebView routes correctly:

```kotlin
// Kotlin - at the start of onCreate, before super.onCreate
override fun onCreate(savedInstanceState: Bundle?) {
    registerPlugin(SharePayloadPlugin::class.java)
    if (ShareIntentHandler.handleIntent(this, intent)) {
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("tagvault://share-import"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP))
        finish()
        return
    }
    super.onCreate(savedInstanceState)
}
```

```java
// Java
@Override
public void onCreate(Bundle savedInstanceState) {
    registerPlugin(SharePayloadPlugin.class);
    if (ShareIntentHandler.INSTANCE.handleIntent(this, getIntent())) {
        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("tagvault://share-import"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP));
        finish();
        return;
    }
    super.onCreate(savedInstanceState);
}
```

### 5. Intent Filters in AndroidManifest.xml

Add inside `<activity>` for the main launcher activity:

```xml
<intent-filter>
    <action android:name="android.intent.action.SEND" />
    <action android:name="android.intent.action.SEND_MULTIPLE" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="text/plain" />
    <data android:mimeType="image/*" />
    <data android:mimeType="video/*" />
    <data android:mimeType="*/*" />
</intent-filter>
```

This lets TagVault appear in the system share sheet for text, images, video, and other types.

### 6. Deep Link for share-import

Add an intent filter so `tagvault://share-import` opens the app and routes to `/share-import`:

```xml
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="tagvault" android:host="share-import" />
</intent-filter>
```

When handling ACTION_SEND (step 4), we `startActivity` with `tagvault://share-import`, which triggers this intent filter. Capacitor’s appUrlOpen and CapacitorLinkHandler then route the WebView to `/share-import`.

---

## Auditing the share flow (iOS)

When the share sheet shows a gray screen for a second then returns to Safari, the extension is running but the main app may not be opening. Use these steps to see what’s happening.

### 1. View Share Extension logs

1. Connect the iPhone via **USB**.
2. On Mac: open **Console.app** (Applications → Utilities).
3. Select the **iPhone** in the left sidebar.
4. In the search bar, enter: `com.tagvault.app.ShareExtension` or `Share`.
5. Trigger a share from Safari (e.g. share a link → choose TagVault).
6. In Console you should see lines like:
   - `Extracted payload kind=url` – extension got the link.
   - `openURL performed on responder` – open was sent.
   - `No responder for openURL:` – main app will not open (responder chain failed).

### 2. What to check

| Log / behavior | Meaning |
|----------------|--------|
| No “Extracted payload” | Safari didn’t pass a URL (e.g. wrong type) or extraction failed. |
| “No responder for openURL:” | Extension cannot open the app from this process; user may need to open TagVault manually; payload is still in App Group. |
| “openURL performed” but app doesn’t open | URL scheme or app not opening (e.g. iOS 18 restrictions). Try opening TagVault manually after sharing; go to `/share-import` to see if the payload is there. |
| App opens but blank / gray | WebView or auth: ensure you’re logged in; check Safari Web Inspector for the device for JS errors. |

### 3. Share Extension UI

The Share Extension shows “Saving to TagVault…” so you get a short message instead of an empty gray screen. After ~0.8s it dismisses. If the main app doesn’t open, open TagVault yourself and go to **Share Import** (or `/share-import`) to use the saved payload.

### 4. LSApplicationQueriesSchemes

The Share Extension’s `Info.plist` includes `LSApplicationQueriesSchemes` with `tagvault` so the system allows querying that URL scheme. Without it, opening the app from the extension can fail on some iOS versions.

---

## Verification

- [ ] iOS: Share a URL from Safari → TagVault appears in share sheet → Opens at `/share-import` → Quick Save works
- [ ] iOS: Share text → Same flow
- [ ] iOS: Share image → Same flow (within size limit)
- [ ] Android: Share URL/text/image → TagVault in share sheet → Opens app → `/share-import` shows payload → Quick Save works
- [ ] Web (non‑Capacitor): `/share-import` shows “Open from Share menu” message
- [ ] After save, payload is cleared; revisiting `/share-import` shows “none” state

## Limits

- **File size**: 20MB for base64-encoded file shares on mobile
- **Rate limits**: Uses existing `/api/items` and `/api/items/upload` limits (10/min upload, 30/min items)
