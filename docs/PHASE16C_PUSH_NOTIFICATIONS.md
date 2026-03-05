# Phase 16C: Push Notifications (Foundation)

## Overview

Phase 16C adds push notification support for TagVault’s Capacitor mobile apps using OneSignal. Alerts and digest crons send push to registered devices when user preferences allow. Web behavior is unchanged (no web push in this phase).

## Required Environment Variables

| Variable | Description |
|----------|-------------|
| `ONESIGNAL_APP_ID` | OneSignal App ID (Settings > Keys & IDs). Required for server-side send. |
| `ONESIGNAL_REST_API_KEY` | OneSignal REST API Key. Required for server-side send. |
| `NEXT_PUBLIC_ONESIGNAL_APP_ID` | Same as `ONESIGNAL_APP_ID`; exposed for native client init. |

## OneSignal Dashboard Setup

1. **Create app** at [onesignal.com](https://onesignal.com) or use existing.
2. **Configure platforms**:
   - **iOS**: Add Push Notifications capability, p8 token or p12 certificate.
   - **Android**: Add Firebase credentials.
3. **Keys & IDs** (Settings > Keys & IDs): Copy App ID and REST API Key.
4. Add redirect URL for magic links if needed: `https://tagvault-phi.vercel.app/auth/callback`.

## Database Migrations

```bash
supabase db push
# or
supabase migration up
```

Migrations:
- `0031_phase16c_push_devices.sql` — `push_devices` table for OneSignal `player_id` (subscription ID) per user/org.
- `0032_phase16c_notification_preferences_push.sql` — Adds `push_enabled`, `push_alerts`, `push_digest` to `notification_preferences`.

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/push/register` | POST | Registers device (`player_id`, `platform`). Rate limit 30/min per user. |
| `/api/push/unregister` | POST | Removes device for `player_id`. |
| `/api/notification-preferences` | GET | Returns push/digest prefs for active org. |
| `/api/notification-preferences` | PATCH | Updates `push_enabled`, `push_alerts`, `push_digest`. |

## Cron Integration

- **`/api/alerts/process-due`**: After creating an in-app notification for new alert matches, sends push with title “TagVault Alert”, body “New matches found”, `url: '/notifications'` if user has `push_alerts` enabled.
- **`/api/notifications/process-digest`**: After creating a digest notification, sends push with title “Your TagVault Digest”, body “Your saved items digest is ready”, `url: '/notifications'` if user has `push_digest` enabled.

## Verification Steps

### 1. Run migrations

```bash
supabase db push
```

### 2. Register device from iPhone build

1. Deploy app with OneSignal env vars set.
2. Build and run on a real device: `pnpm cap:ios` and select a device.
3. Open app, log in, accept push permission when prompted.
4. Verify device in Supabase: `SELECT * FROM push_devices;`

### 3. Trigger alert and confirm push

1. Create a saved search and alert.
2. Add a new matching item.
3. Call process-due:
   ```bash
   curl -X POST -H "x-cron-secret: $CRON_SECRET" https://tagvault-phi.vercel.app/api/alerts/process-due
   ```
4. Background or close the app; you should receive a push notification.

### 4. Trigger digest and confirm push

1. Set `notification_preferences.push_digest = true` and `digest_frequency = 'daily'` for a user.
2. Ensure some unread notifications.
3. Call process-digest:
   ```bash
   curl -X POST -H "x-cron-secret: $CRON_SECRET" https://tagvault-phi.vercel.app/api/notifications/process-digest
   ```
4. Background or close the app; you should receive a digest push.

### 5. Settings toggles

1. Open Settings > Notifications in the app.
2. Toggle push_enabled, push_alerts, push_digest.
3. Confirm prefs persist via GET/PATCH `/api/notification-preferences`.

## iOS-Specific Steps

1. In Xcode: Add Push Notifications capability to app target.
2. Add Background Modes capability, enable Remote notifications.
3. Add App Group: `group.com.tagvault.app.onesignal`.
4. Add Notification Service Extension (OneSignal docs) for rich notifications and confirmed delivery.
5. Add `handleApplicationNotifications: false` to `capacitor.config.ts` ios (already added).

## Android-Specific Steps

1. Configure OneSignal with Firebase credentials.
2. Build and run on device or emulator with Google Play Services.
3. Accept push permission when prompted.

## Limitations

- Deep link routing: push payload includes `url: '/notifications'` but routing on tap is not implemented yet.
- Web push is not supported in this phase.
- OneSignal Cordova plugin required: `onesignal-cordova-plugin`; run `pnpm install` and `npx cap sync` after adding.
