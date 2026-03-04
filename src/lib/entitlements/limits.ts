/**
 * Plan limits — single source of truth for Free, Pro, Team.
 * Free: enforced limits. Pro: high/unlimited, 1 seat. Team: 5 seats.
 */

export type Plan = 'free' | 'pro' | 'team';

export const LIMITS = {
  free: {
    items: 100,
    saved_searches: 5,
    alerts: 2,
    searches_per_day: 50,
    embeddings_per_day: 200,
    seats: 1,
  },
  pro: {
    items: 1_000_000,
    saved_searches: 1_000,
    alerts: 100,
    searches_per_day: 10_000,
    embeddings_per_day: 10_000,
    seats: 1,
  },
  team: {
    items: 1_000_000,
    saved_searches: 1_000,
    alerts: 100,
    searches_per_day: 10_000,
    embeddings_per_day: 10_000,
    seats: 5,
  },
} as const;

export function getLimit(plan: Plan, key: keyof (typeof LIMITS)['free']): number {
  const limits = plan in LIMITS ? LIMITS[plan] : LIMITS.free;
  return limits[key];
}
