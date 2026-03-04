import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { requireUser } from '@/lib/server/auth';
import { assertSeatAvailable, SeatLimitExceededError } from '@/lib/server/orgSeats';
import { logInviteAudit } from '@/lib/server/inviteAudit';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const bodySchema = z.object({
  token: z.string().min(1),
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

    const email = user.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json(
        { error: 'User email required to accept invite' },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data: orgIdData } = await supabase.rpc('get_invite_org_if_pending', {
      p_token: parsed.data.token,
    });
    const orgId = orgIdData as string | null;
    if (orgId) {
      await assertSeatAvailable(orgId);
    }

    const { data, error } = await supabase.rpc('accept_org_invite', {
      p_token: parsed.data.token,
      p_user_email: email,
    });

    if (error) throw error;

    if (data?.ok === false) {
      const err = data?.error as string;
      Sentry.addBreadcrumb({
        category: 'invite',
        message: 'accept_org_invite rejected',
        data: { area: 'orgs', action: 'invite_accept', status: err },
      });
      if (err === 'seat_limit_exceeded') {
        return NextResponse.json(
          {
            error: 'Seat limit reached. The organization cannot add more members.',
            code: 'PLAN_LIMIT_EXCEEDED',
            upgrade: true,
          },
          { status: 402 },
        );
      }
      if (err === 'not_logged_in') {
        return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
      }
      if (err === 'email_mismatch') {
        return NextResponse.json(
          { error: 'This invite was sent to a different email address', code: 'EMAIL_MISMATCH' },
          { status: 403 },
        );
      }
      if (err === 'already_used') {
        return NextResponse.json(
          { error: 'Invite already used', code: 'ALREADY_USED' },
          { status: 400 },
        );
      }
      if (err === 'expired') {
        return NextResponse.json(
          { error: 'This invite has expired. Ask your admin to resend it.', code: 'EXPIRED' },
          { status: 400 },
        );
      }
      if (err === 'invalid_token') {
        return NextResponse.json({ error: 'Invalid invite link', code: 'INVALID_TOKEN' }, { status: 400 });
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

    return NextResponse.json({
      ok: true,
      org_id: acceptedOrgId,
    });
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
    Sentry.captureException(err, {
      extra: { area: 'orgs', action: 'invite_accept' },
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
