import { NextRequest, NextResponse } from 'next/server';
import { requireOrgRole } from '@/lib/server/orgAuth';
import { assertSeatAvailable, SeatLimitExceededError } from '@/lib/server/orgSeats';
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

    await requireOrgRole(orgId, ['owner', 'admin']);

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
      if (error.message.includes('Forbidden')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      throw error;
    }

    const inviteId = data?.invite_id as string;
    const token = data?.token as string;
    const origin = request.nextUrl.origin;
    const inviteLink = `${origin}/invite?token=${encodeURIComponent(token)}&org=${orgId}`;

    return NextResponse.json({
      invite_id: inviteId,
      invite_link: inviteLink,
      token,
      expires_in_days: 7,
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
    if (err instanceof Error && err.message.includes('Forbidden')) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
