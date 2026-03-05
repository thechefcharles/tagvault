import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@capacitor/core',
    '@capacitor/app',
    '@capacitor/browser',
    'onesignal-cordova-plugin',
  ],
};

export default withSentryConfig(nextConfig, {
  org: 'tagvault',
  project: 'javascript-nextjs',
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: '/monitoring',
  webpack: {
    automaticVercelMonitors: true,
    treeshake: { removeDebugLogging: true },
  },
});
