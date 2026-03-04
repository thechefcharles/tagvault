/**
 * Open URL in system browser (Capacitor) or new tab (web).
 * Use for external links (Stripe, shared item URLs, etc.) so they open outside the in-app webview.
 */
import { isCapacitor } from './capacitor';

export async function openExternal(url: string): Promise<void> {
  if (isCapacitor()) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url });
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
