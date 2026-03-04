import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgEntitlements } from '@/lib/entitlements';

export type SeatUsage = {
  membersCount: number;
  pendingInvitesCount: number;
  seatLimit: number;
  overLimit: boolean;
};

/** Get current seat usage for an org. Uses admin client for counts. */
export async function getOrgSeatUsage(orgId: string): Promise<SeatUsage> {
  const admin = createAdminClient();
  const { seat_limit: seatLimit } = await getOrgEntitlements(orgId);

  const { count: membersCount } = await admin
    .from('org_members')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId);

  const { count: pendingInvitesCount } = await admin
    .from('org_invites')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .is('accepted_at', null)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString());

  const m = membersCount ?? 0;
  const p = pendingInvitesCount ?? 0;
  const overLimit = m + p >= seatLimit;

  return {
    membersCount: m,
    pendingInvitesCount: p,
    seatLimit,
    overLimit,
  };
}

export class SeatLimitExceededError extends Error {
  constructor(message = 'Seat limit reached. Upgrade to add more members.') {
    super(message);
    this.name = 'SeatLimitExceededError';
  }
}

/** Throws SeatLimitExceededError if adding one more (member or invite) would exceed seat limit. */
export async function assertSeatAvailable(orgId: string): Promise<void> {
  const usage = await getOrgSeatUsage(orgId);
  if (usage.membersCount + usage.pendingInvitesCount + 1 > usage.seatLimit) {
    throw new SeatLimitExceededError(
      `Seat limit reached (${usage.seatLimit}). Upgrade to add more members.`,
    );
  }
}
