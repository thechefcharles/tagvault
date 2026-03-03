/**
 * Plan limits — single source of truth for Free vs Pro.
 * Free: enforced limits. Pro: high/unlimited.
 */

export type Plan = 'free' | 'pro';

export const LIMITS = {
  free: {
    items: 100,
    saved_searches: 5,
    alerts: 2,
    searches_per_day: 50,
    embeddings_per_day: 200,
  },
  pro: {
    items: 1_000_000,
    saved_searches: 1_000,
    alerts: 100,
    searches_per_day: 10_000,
    embeddings_per_day: 10_000,
  },
} as const;

export function getLimit(plan: Plan, key: keyof (typeof LIMITS)['free']): number {
  return LIMITS[plan][key];
}
