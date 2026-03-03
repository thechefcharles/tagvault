/**
 * Storage constants for TagVault.
 * Model: single-file-per-item — each item has at most one file via storage_path.
 * Bucket: vault (private, user-scoped paths {user_id}/{item_id}/{filename}).
 */
export const VAULT_BUCKET = "vault";

/** @deprecated Use for docs only — model is implicit in items.storage_path */
export const ITEM_FILE_MODEL = "single-file-per-item" as const;
