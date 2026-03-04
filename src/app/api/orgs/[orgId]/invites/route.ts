import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { rateLimitOrThrow, RateLimitError, getRateLimitKey } from '@/lib/rateLimit';
import { requireOrgRole } from '@/lib/server/orgAuth';
import { assertSeatAvailable, SeatLimitExceededError } from '@/lib/server/orgSeats';
import { logInviteAudit } from '@/lib/server/inviteAudit';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const bodySchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member']).default('member'),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    if (!orgId) {
      return NextResponse.json({ error: 'Missing org id' }, { status: 400 });
    }

    const { user } = await requireOrgRole(orgId, ['owner', 'admin']);
    const key = getRateLimitKey('orgs:invites', request, user.id);
    await rateLimitOrThrow({ key, limit: 10, windowSec: 60 });

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    await assertSeatAvailable(orgId);

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('create_org_invite', {
      p_org_id: orgId,
      p_email: parsed.data.email,
      p_role: parsed.data.role,
    });

    if (error) {
      Sentry.addBreadcrumb({
        category: 'invite',
        message: 'create_org_invite failed',
        data: { area: 'orgs', action: 'invite_sent', org_id: orgId },
      });
      if (error.message.includes('Forbidden')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      throw error;
    }

    const inviteId = data?.invite_id as string;
    const token = data?.token as string;
    const origin = request.nextUrl.origin;
    const inviteLink = `${origin}/invite?token=${encodeURIComponent(token)}&org=${orgId}`;

    const actorEmail = user.email?.trim().toLowerCase() ?? '';
    if (actorEmail) {
      await logInviteAudit(actorEmail, 'invite_sent', {
        org_id: orgId,
        invite_id: inviteId,
        invite_email: parsed.data.email,
      });
    }

    return NextResponse.json({
      invite_id: inviteId,
      invite_link: inviteLink,
      token,
      expires_in_days: 7,
    });
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Too many requests', retry_after: err.retryAfter },
        { status: 429, headers: err.headers },
      );
    }
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
    if (err instanceof Error && err.message.includes('Forbidden')) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
