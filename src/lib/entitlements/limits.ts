/**
 * Plan limits — single source of truth for Free, Pro, Team.
 * Free: enforced limits. Pro: high/unlimited, 1 seat. Team: 5 seats.
 */

export type Plan = 'free' | 'pro' | 'team';

export const BACKUP_RETENTION_DAYS = {
  free: 0,
  pro: 30,
  team: 90,
} as const;

export const LIMITS = {
  free: {
    backups_enabled: false,
    items: 100,
    saved_searches: 5,
    alerts: 2,
    searches_per_day: 50,
    embeddings_per_day: 200,
    seats: 1,
    tags: 20,
    collections: 3,
    collection_shares: 0,
    item_shares: 0,
  },
  pro: {
    backups_enabled: true,
    items: 1_000_000,
    saved_searches: 1_000,
    alerts: 100,
    searches_per_day: 10_000,
    embeddings_per_day: 10_000,
    seats: 1,
    tags: 200,
    collections: 50,
    collection_shares: 5,
    item_shares: 25,
  },
  team: {
    backups_enabled: true,
    items: 1_000_000,
    saved_searches: 1_000,
    alerts: 100,
    searches_per_day: 10_000,
    embeddings_per_day: 10_000,
    seats: 5,
    tags: 500,
    collections: 200,
    collection_shares: 50,
    item_shares: 250,
  },
} as const;

type NumericLimitKey = Exclude<keyof (typeof LIMITS)['free'], 'backups_enabled'>;

export function getLimit(plan: Plan, key: NumericLimitKey): number {
  const limits = plan in LIMITS ? LIMITS[plan] : LIMITS.free;
  return limits[key] as number;
}

export function getBackupsEnabled(plan: Plan): boolean {
  const limits = plan in LIMITS ? LIMITS[plan] : LIMITS.free;
  return Boolean(limits.backups_enabled);
}

export function getBackupRetentionDays(plan: Plan): number {
  return plan in BACKUP_RETENTION_DAYS ? BACKUP_RETENTION_DAYS[plan] : 0;
}
