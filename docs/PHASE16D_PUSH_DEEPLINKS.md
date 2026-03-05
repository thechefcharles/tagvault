# Phase 16D: Push Deep Links & Notification Tap Routing

## Purpose

Push notifications must deep link to the correct screen when the user taps them. This phase implements tap routing so alerts, digests, and (future) share pushes open the right in-app route.

## Example Flows

| Push type | Deep link target |
|-----------|------------------|
| Alert push | `/notifications?tab=alerts` |
| Digest push | `/notifications?tab=digest` |
| Future item share push | `/app/item/[id]` |

## Payload Contract

All push notifications sent via `sendPushToUsers` include a structured payload:

```json
{
  "title": "string",
  "body": "string",
  "url": "/notifications",
  "kind": "alert" | "digest" | "share",
  "data": {}
}
```

| Field | Description |
|-------|-------------|
| `title` | Notification title (OneSignal `headings.en`) |
| `body` | Notification body (OneSignal `contents.en`) |
| `url` | In-app path to open on tap; defaults to `/notifications` |
| `kind` | Push type; defaults to `"alert"` |
| `data` | Optional extra key-value pairs (e.g. `item_id` for future share pushes) |

On the client, OneSignal delivers these in `event.notification.additionalData` for both the click handler and `getInitialNotification()`.

## Verification Steps

### 1. Test alert push

1. Create a saved search and alert.
2. Add a new matching item.
3. Call process-due cron.
4. Receive push notification.
5. **Tap push** → app opens `/notifications?tab=alerts`.

### 2. Test digest push

1. Enable digest in notification preferences.
2. Trigger process-digest cron.
3. Receive digest push.
4. **Tap push** → app opens `/notifications?tab=digest`.

### 3. Test cold start

1. Force close the app.
2. Send an alert or digest push.
3. **Tap push** → app launches and opens the correct screen (`/notifications?tab=alerts` or `/notifications?tab=digest`).

### 4. Test background state

1. Open app, then background it (Home or app switcher).
2. Send push.
3. **Tap push** → app comes to foreground and navigates to the correct screen.

## Troubleshooting

### Cold start behavior

- When the app launches from a push, OneSignal may deliver the notification via `getInitialNotification()` instead of the click event.
- The app checks `getInitialNotification()` once on startup and navigates if a URL is present.
- If the WebView has not finished loading, navigation may be delayed; the handler waits for the app to be ready.

### Background state

- When the app is in the background, the `click` event fires when the user taps the notification.
- The handler uses Next.js `router.push()` for in-app navigation.

### Deep link fallback

- If `additionalData.url` is missing or invalid, the app falls back to `/notifications`.
- Invalid URLs (e.g. external domains) are sanitized; only same-origin paths are used.

### Debug logging

- In development, `[push-open]` logs appear in the console with the resolved URL.
- Sentry breadcrumbs record `push_open` with the URL for debugging in production.
