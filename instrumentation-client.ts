import * as Sentry from '@sentry/nextjs';

// Sentry.init is in sentry.client.config.ts - do not duplicate here or Session Replay will error
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
