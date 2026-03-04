import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { requireOrgRole } from '@/lib/server/orgAuth';
import { logInviteAudit } from '@/lib/server/inviteAudit';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orgId: string; inviteId: string }> },
) {
  try {
    const { orgId, inviteId } = await params;
    if (!orgId || !inviteId) {
      return NextResponse.json({ error: 'Missing org or invite id' }, { status: 400 });
    }

    const { user } = await requireOrgRole(orgId, ['owner', 'admin']);
    const supabase = await createClient();

    const { data: invite } = await supabase
      .from('org_invites')
      .select('email, accepted_at, revoked_at')
      .eq('id', inviteId)
      .eq('org_id', orgId)
      .single();

    if (!invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }
    if (invite.accepted_at) {
      return NextResponse.json({ error: 'Invite already accepted' }, { status: 400 });
    }
    if (invite.revoked_at) {
      return NextResponse.json({ ok: true });
    }

    const { error } = await supabase
      .from('org_invites')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', inviteId)
      .eq('org_id', orgId);

    if (error) {
      Sentry.addBreadcrumb({
        category: 'invite',
        message: 'invite revoke update failed',
        data: { area: 'orgs', action: 'invite_revoked', org_id: orgId, invite_id: inviteId },
      });
      throw error;
    }

    const actorEmail = user.email?.trim().toLowerCase() ?? '';
    if (actorEmail) {
      await logInviteAudit(actorEmail, 'invite_revoked', {
        org_id: orgId,
        invite_id: inviteId,
        invite_email: invite.email,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (err instanceof Error && err.message.includes('Forbidden')) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
