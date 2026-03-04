import * as Sentry from '@sentry/nextjs';

const env = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development';
const release = process.env.VERCEL_GIT_COMMIT_SHA ?? undefined;

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.NODE_ENV === 'production',
  environment: env,
  release,
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [Sentry.replayIntegration()],
});
