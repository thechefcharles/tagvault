import { createAdminClient } from '@/lib/supabase/admin';
import { getBillingAccount, isPro } from '@/lib/billing';
import { getLimit, type Plan } from './limits';

export type Action =
  | 'items_create'
  | 'saved_searches_create'
  | 'alerts_create'
  | 'searches_run'
  | 'embeddings_enqueue';

export type Entitlements = { plan: Plan };

/** Effective plan: billing_accounts (Stripe) is source of truth; user_entitlements for manual overrides. */
export async function getUserEntitlements(userId: string): Promise<Entitlements> {
  const billing = await getBillingAccount(userId);
  if (isPro(billing.plan)) return { plan: 'pro' };

  const admin = createAdminClient();
  const { data } = await admin
    .from('user_entitlements')
    .select('plan')
    .eq('user_id', userId)
    .single();
  const plan = (data?.plan as Plan) ?? 'free';
  return { plan };
}

/** Get usage row for today; creates if missing. Uses admin for upsert (RLS may block insert). */
export async function getOrInitUsage(
  userId: string,
  date: Date = new Date(),
): Promise<{
  user_id: string;
  period_start: string;
  items_created: number;
  searches_run: number;
  alerts_created: number;
  saved_searches_created: number;
  embeddings_enqueued: number;
}> {
  const periodStart = date.toISOString().slice(0, 10); // YYYY-MM-DD
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from('usage_counters')
    .select('*')
    .eq('user_id', userId)
    .eq('period_start', periodStart)
    .single();

  if (existing) return existing as ReturnType<typeof getOrInitUsage> extends Promise<infer R> ? R : never;

  const { data: inserted, error } = await admin
    .from('usage_counters')
    .insert({ user_id: userId, period_start: periodStart })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      const { data: retry } = await admin
        .from('usage_counters')
        .select('*')
        .eq('user_id', userId)
        .eq('period_start', periodStart)
        .single();
      if (retry) return retry as ReturnType<typeof getOrInitUsage> extends Promise<infer R> ? R : never;
    }
    throw error;
  }
  return inserted as ReturnType<typeof getOrInitUsage> extends Promise<infer R> ? R : never;
}

/** Throws if the action would exceed plan limits. */
export async function assertWithinLimits({
  userId,
  action,
}: {
  userId: string;
  action: Action;
}): Promise<void> {
  const { plan } = await getUserEntitlements(userId);
  const today = new Date();

  switch (action) {
    case 'items_create': {
      const limit = getLimit(plan, 'items');
      const admin = createAdminClient();
      const { count } = await admin.from('items').select('*', { count: 'exact', head: true }).eq('user_id', userId);
      if ((count ?? 0) >= limit) {
        throw new EntitlementError(`Upgrade required: free plan limit reached for items (${limit}).`);
      }
      break;
    }
    case 'saved_searches_create': {
      const limit = getLimit(plan, 'saved_searches');
      const admin = createAdminClient();
      const { count } = await admin
        .from('saved_searches')
        .select('*', { count: 'exact', head: true })
        .eq('owner_user_id', userId);
      if ((count ?? 0) >= limit) {
        throw new EntitlementError(`Upgrade required: free plan limit reached for saved searches (${limit}).`);
      }
      break;
    }
    case 'alerts_create': {
      const limit = getLimit(plan, 'alerts');
      const admin = createAdminClient();
      const { count } = await admin.from('alerts').select('*', { count: 'exact', head: true }).eq('owner_user_id', userId);
      if ((count ?? 0) >= limit) {
        throw new EntitlementError(`Upgrade required: free plan limit reached for alerts (${limit}).`);
      }
      break;
    }
    case 'searches_run': {
      const limit = getLimit(plan, 'searches_per_day');
      const usage = await getOrInitUsage(userId, today);
      if (usage.searches_run >= limit) {
        throw new EntitlementError(`Upgrade required: free plan limit reached for searches per day (${limit}).`);
      }
      break;
    }
    case 'embeddings_enqueue': {
      const limit = getLimit(plan, 'embeddings_per_day');
      const usage = await getOrInitUsage(userId, today);
      if (usage.embeddings_enqueued >= limit) {
        throw new EntitlementError(`Upgrade required: free plan limit reached for embeddings per day (${limit}).`);
      }
      break;
    }
  }
}

const ACTION_COL: Record<Action, string> = {
  items_create: 'items_created',
  saved_searches_create: 'saved_searches_created',
  alerts_create: 'alerts_created',
  searches_run: 'searches_run',
  embeddings_enqueue: 'embeddings_enqueued',
};

/** Increment usage counters. Call after successful action. */
export async function incrementUsage({
  userId,
  action,
  by = 1,
}: {
  userId: string;
  action: Action;
  by?: number;
}): Promise<void> {
  const today = new Date();
  const periodStart = today.toISOString().slice(0, 10);
  const admin = createAdminClient();
  const col = ACTION_COL[action];

  const row = await getOrInitUsage(userId, today);
  const current = (row as Record<string, unknown>)[col] as number | undefined;
  const next = (current ?? 0) + by;

  const { error } = await admin
    .from('usage_counters')
    .update({ [col]: next })
    .eq('user_id', userId)
    .eq('period_start', periodStart);

  if (error) throw error;
}

export class EntitlementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EntitlementError';
  }
}
