// This file configures the initialization of Sentry on the server.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN) && process.env.NODE_ENV === 'production',
  environment: process.env.NODE_ENV ?? process.env.SENTRY_ENVIRONMENT ?? 'development',
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1 : 0.1,
  enableLogs: true,
});
