import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { assertSeatAvailable, SeatLimitExceededError } from '@/lib/server/orgSeats';
import { logInviteAudit } from '@/lib/server/inviteAudit';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const bodySchema = z.object({
  invite_id: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const inviteId = parsed.data.invite_id;
    const { data: orgId } = await supabase.rpc('get_org_id_for_invite_id_if_recipient', {
      p_invite_id: inviteId,
    });
    if (orgId) {
      await assertSeatAvailable(orgId);
    }

    const { data, error } = await supabase.rpc('accept_org_invite_by_id', {
      p_invite_id: inviteId,
    });

    if (error) throw error;

    if (data?.ok === false) {
      const err = data?.error as string;
      if (err === 'email_mismatch') {
        return NextResponse.json(
          { error: 'This invite was sent to a different email address', code: 'EMAIL_MISMATCH' },
          { status: 403 },
        );
      }
      if (err === 'already_used' || err === 'revoked') {
        return NextResponse.json({ error: 'Invite no longer valid', code: err }, { status: 400 });
      }
      if (err === 'expired') {
        return NextResponse.json(
          { error: 'This invite has expired.', code: 'EXPIRED' },
          { status: 400 },
        );
      }
      if (err === 'invalid_invite') {
        return NextResponse.json({ error: 'Invite not found', code: 'INVALID_INVITE' }, { status: 404 });
      }
      return NextResponse.json({ error: err ?? 'Accept failed' }, { status: 400 });
    }

    const acceptedOrgId = data?.org_id as string | undefined;
    const actorEmail = user.email?.trim().toLowerCase() ?? '';
    if (actorEmail && acceptedOrgId) {
      await logInviteAudit(actorEmail, 'invite_accepted', {
        org_id: acceptedOrgId,
        accepted_by_user_id: user.id,
      });
    }

    return NextResponse.json({ ok: true, org_id: acceptedOrgId });
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (err instanceof SeatLimitExceededError) {
      return NextResponse.json(
        {
          error: err.message,
          code: 'PLAN_LIMIT_EXCEEDED',
          upgrade: true,
        },
        { status: 402 },
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
