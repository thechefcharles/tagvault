'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'tagvault-pwa-install-dismissed';

function getDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function setDismissed(): void {
  try {
    localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    // ignore
  }
}

export function InstallPwaButton() {
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissedState] = useState(true);
  const [installed, setInstalled] = useState(false);

  const isSharePage = pathname?.startsWith('/share') || pathname?.startsWith('/share-item');

  useEffect(() => {
    if (getDismissed()) {
      setDismissedState(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setDismissedState(false);
    };

    window.addEventListener('beforeinstallprompt', handler);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setDeferredPrompt(null);
    setDismissedState(true);
    setDismissed();
  };

  const handleDismiss = () => {
    setDismissedState(true);
    setDismissed();
    setDeferredPrompt(null);
  };

  if (isSharePage || installed || dismissed || !deferredPrompt) return null;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900">
      <button
        type="button"
        onClick={handleInstall}
        className="text-sm font-medium text-neutral-900 hover:underline dark:text-neutral-100"
      >
        Install TagVault
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        className="text-xs text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
