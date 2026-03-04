import { createClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';
import { requireActiveOrg, requireUser } from './auth';

export { requireActiveOrg };

export type OrgRole = 'owner' | 'admin' | 'member';

export type OrgMembership = {
  role: OrgRole;
  user_id: string;
  org_id: string;
};

/** Get membership for current user in org. Returns null if not a member. */
export async function getOrgMembership(orgId: string): Promise<OrgMembership | null> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from('org_members')
    .select('role, user_id, org_id')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .single();
  if (!data) return null;
  return { role: data.role as OrgRole, user_id: data.user_id, org_id: data.org_id };
}

/** Requires current user to be a member of org. Throws if not. */
export async function requireOrgMember(orgId: string): Promise<{ user: User; membership: OrgMembership }> {
  const membership = await getOrgMembership(orgId);
  if (!membership) {
    throw new Error('Forbidden: not a member of this org');
  }
  const user = await requireUser();
  return { user, membership };
}

/** Requires current user to have one of the given roles. Throws if not. */
export async function requireOrgRole(
  orgId: string,
  roles: OrgRole[],
): Promise<{ user: User; membership: OrgMembership }> {
  const { user, membership } = await requireOrgMember(orgId);
  if (!roles.includes(membership.role)) {
    throw new Error('Forbidden: insufficient role');
  }
  return { user, membership };
}

/** Requires current user to be org owner. */
export async function requireOrgOwner(orgId: string): Promise<{ user: User; membership: OrgMembership }> {
  return requireOrgRole(orgId, ['owner']);
}
