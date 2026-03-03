// Sentry client init is in sentry.client.config.ts - do NOT duplicate init here
// or Session Replay will error: "Multiple Sentry Session Replay instances are not supported"
import * as Sentry from '@sentry/nextjs';

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
