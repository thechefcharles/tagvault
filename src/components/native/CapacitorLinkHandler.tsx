'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const APP_ORIGIN = 'https://tagvault-phi.vercel.app';

const ALLOWED_PATHS = ['/auth/callback', '/onboarding', '/app', '/share-import'];

function getPathFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.origin === APP_ORIGIN) {
      return (u.pathname || '/') + u.search;
    }
    if (u.protocol === 'tagvault:') {
      const path = (u.hostname && u.hostname !== 'localhost' ? '/' + u.hostname : '') + (u.pathname || '') + u.search;
      return path || '/';
    }
    return null;
  } catch {
    return null;
  }
}

function shouldNavigateToPath(path: string): boolean {
  return ALLOWED_PATHS.some((allowed) => path === allowed || path.startsWith(allowed + '/') || path.startsWith(allowed + '?'));
}

export function CapacitorLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
    if (!cap || cap.getPlatform?.() === 'web') return;

    import('@capacitor/app').then(({ App }) => {
      const navigate = (path: string) => {
        if (shouldNavigateToPath(path)) router.replace(path);
      };

      App.getLaunchUrl()
        .then(({ url }) => {
          if (url) {
            const path = getPathFromUrl(url);
            if (path) navigate(path);
          }
        })
        .catch(() => {});

      const listener = App.addListener('appUrlOpen', (event: { url: string }) => {
        const path = getPathFromUrl(event.url);
        if (path) navigate(path);
      });
      return () => {
        listener.then((l: { remove: () => Promise<void> }) => l.remove());
      };
    }).catch(() => {});

    return undefined;
  }, [router]);

  return null;
}
