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
