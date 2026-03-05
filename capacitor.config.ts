import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tagvault.app',
  appName: 'TagVault',
  webDir: 'out',
  // Production: loads deployed web app. For local dev, override with npm run dev URL.
  server: {
    url: 'https://tagvault-phi.vercel.app',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'automatic',
  },
};

export default config;
