/**
 * SharePayloadPlugin - Capacitor plugin for reading/clearing pending share payload
 * from iOS App Group UserDefaults or Android SharedPreferences.
 * Used by the share-import page after the app is opened from a system share sheet.
 */
import { registerPlugin } from '@capacitor/core';

export interface PendingSharePayload {
  kind: 'url' | 'text' | 'file';
  url?: string;
  text?: string;
  fileName?: string;
  mimeType?: string;
  fileBase64?: string;
}

export interface SharePayloadPluginInterface {
  /** Read pending share payload if any; returns null when none. */
  getPendingPayload(): Promise<{ payload: PendingSharePayload | null }>;
  /** Clear the pending payload after consuming. */
  clearPendingPayload(): Promise<void>;
}

const SharePayloadPlugin = registerPlugin<SharePayloadPluginInterface>('SharePayload');

export { SharePayloadPlugin };
