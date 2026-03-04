// This file configures the initialization of Sentry on the server.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

const env = process.env.VERCEL_ENV ?? process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development';
const release = process.env.SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA ?? undefined;

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN) && process.env.NODE_ENV === 'production',
  environment: env,
  release,
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1 : 0.1,
  enableLogs: true,
  beforeSend(event) {
    if (event.request) {
      delete event.request.cookies;
      delete event.request.headers;
      if (event.request.data) delete event.request.data;
    }
    return event;
  },
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.category === 'http' && breadcrumb.data) {
      breadcrumb.data = {
        url: breadcrumb.data.url,
        status_code: breadcrumb.data.status_code,
        method: breadcrumb.data.method,
      };
    }
    return breadcrumb;
  },
});
