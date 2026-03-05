/**
 * SharePayloadPlugin - Capacitor plugin for reading/clearing pending share payload queue
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
  /** Read pending share payload queue (newest last). Empty array when none. */
  getPendingPayload(): Promise<{ payloads: PendingSharePayload[] }>;
  /** Remove one item at index, or clear entire queue if index not provided. */
  clearPendingPayload(options?: { index?: number }): Promise<void>;
}

const SharePayloadPlugin = registerPlugin<SharePayloadPluginInterface>('SharePayload');

export { SharePayloadPlugin };
