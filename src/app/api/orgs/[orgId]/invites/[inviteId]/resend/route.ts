import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { rateLimitOrThrow, RateLimitError, getRateLimitKey } from '@/lib/rateLimit';
import { requireOrgRole } from '@/lib/server/orgAuth';
import { logInviteAudit } from '@/lib/server/inviteAudit';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; inviteId: string }> },
) {
  try {
    const { orgId, inviteId } = await params;
    if (!orgId || !inviteId) {
      return NextResponse.json({ error: 'Missing org or invite id' }, { status: 400 });
    }

    const { user } = await requireOrgRole(orgId, ['owner', 'admin']);
    const key = getRateLimitKey('orgs:invites', request, user.id);
    await rateLimitOrThrow({ key, limit: 10, windowSec: 60 });

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('resend_org_invite', {
      p_invite_id: inviteId,
    });

    if (error) {
      if (error.message.includes('Forbidden') || error.message.includes('not owner or admin')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (error.message.includes('already accepted') || error.message.includes('already revoked')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
      }
      Sentry.addBreadcrumb({
        category: 'invite',
        message: 'resend_org_invite failed',
        data: { area: 'orgs', action: 'invite_resend', org_id: orgId, invite_id: inviteId },
      });
      throw error;
    }

    const token = data?.token as string;
    const expiresAt = data?.expires_at as string;
    const origin = request.nextUrl.origin;
    const inviteLink = `${origin}/invite?token=${encodeURIComponent(token)}&org=${orgId}`;

    const actorEmail = user.email?.trim().toLowerCase() ?? '';
    if (actorEmail) {
      const { data: inviteRow } = await supabase
        .from('org_invites')
        .select('email')
        .eq('id', inviteId)
        .eq('org_id', orgId)
        .single();
      await logInviteAudit(actorEmail, 'invite_resent', {
        org_id: orgId,
        invite_id: inviteId,
        invite_email: (inviteRow as { email?: string } | null)?.email,
      });
    }

    return NextResponse.json({
      invite_link: inviteLink,
      expires_at: expiresAt,
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
    if (err instanceof Error && err.message.includes('Forbidden')) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
