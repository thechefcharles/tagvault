/**
 * Log invite lifecycle events to admin_audit_log (service-role insert).
 * Used by invite send/resend/revoke/accept API routes.
 */

import { createAdminClient } from '@/lib/supabase/admin';

export type InviteAuditAction = 'invite_sent' | 'invite_resent' | 'invite_revoked' | 'invite_accepted';

export type InviteAuditMetadata = {
  org_id?: string;
  invite_id?: string;
  invite_email?: string;
  accepted_by_user_id?: string;
  [key: string]: unknown;
};

export async function logInviteAudit(
  actorEmail: string,
  action: InviteAuditAction,
  metadata: InviteAuditMetadata = {},
): Promise<void> {
  const admin = createAdminClient();
  await admin.from('admin_audit_log').insert({
    admin_email: actorEmail,
    action,
    target_user_id: null,
    metadata: { ...metadata },
  });
}
