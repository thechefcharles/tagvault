'use client';

import { useEffect } from 'react';

/**
 * Registers the PWA service worker. Runs on all pages.
 * SW uses conservative caching (manifest + icons only); API/auth bypassed.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        if (process.env.NODE_ENV === 'development') {
          console.debug('[PWA] Service worker registered', reg.scope);
        }
      })
      .catch((err) => {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[PWA] SW registration failed:', err);
        }
      });
  }, []);

  return null;
}
