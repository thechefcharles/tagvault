import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/auth';
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
    const user = await requireUser();
    const { orgId } = await params;
    if (!orgId) {
      return NextResponse.json({ error: 'Missing org id' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data: myMember } = await supabase
      .from('org_members')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .single();

    if (!myMember || !['owner', 'admin'].includes(myMember.role)) {
      return NextResponse.json(
        { error: 'Only owner or admin can invite' },
        { status: 403 },
      );
    }

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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
