import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const patchSchema = z.object({
  role: z.enum(['owner', 'admin', 'member']),
});

async function getCallerAndTargetRoles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  callerId: string,
  targetUserId: string,
) {
  const { data: rows } = await supabase
    .from('org_members')
    .select('user_id, role')
    .eq('org_id', orgId)
    .in('user_id', [callerId, targetUserId]);

  const caller = rows?.find((r) => r.user_id === callerId);
  const target = rows?.find((r) => r.user_id === targetUserId);
  return { callerRole: caller?.role, targetRole: target?.role };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; userId: string }> },
) {
  try {
    const user = await requireUser();
    const { orgId, userId } = await params;
    if (!orgId || !userId) {
      return NextResponse.json({ error: 'Missing org or user id' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { callerRole, targetRole } = await getCallerAndTargetRoles(
      supabase,
      orgId,
      user.id,
      userId,
    );

    if (!callerRole || !targetRole) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    if (callerRole !== 'owner') {
      return NextResponse.json(
        { error: 'Only owner can change roles' },
        { status: 403 },
      );
    }
    if (targetRole === 'owner' && parsed.data.role !== 'owner') {
      return NextResponse.json(
        { error: 'Cannot change owner role; transfer ownership first' },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from('org_members')
      .update({ role: parsed.data.role })
      .eq('org_id', orgId)
      .eq('user_id', userId);

    if (error) throw error;
    return NextResponse.json({ ok: true });
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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orgId: string; userId: string }> },
) {
  try {
    const user = await requireUser();
    const { orgId, userId } = await params;
    if (!orgId || !userId) {
      return NextResponse.json({ error: 'Missing org or user id' }, { status: 400 });
    }

    const supabase = await createClient();
    const { callerRole, targetRole } = await getCallerAndTargetRoles(
      supabase,
      orgId,
      user.id,
      userId,
    );

    if (!callerRole || !targetRole) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    if (targetRole === 'owner') {
      return NextResponse.json(
        { error: 'Cannot remove owner; transfer ownership first' },
        { status: 400 },
      );
    }
    if (userId === user.id) {
      return NextResponse.json(
        { error: 'Use Leave org instead of removing yourself' },
        { status: 400 },
      );
    }
    if (callerRole === 'admin' && targetRole === 'admin') {
      return NextResponse.json(
        { error: 'Admin cannot remove another admin' },
        { status: 403 },
      );
    }
    if (callerRole === 'member') {
      return NextResponse.json({ error: 'Only owner or admin can remove members' }, { status: 403 });
    }

    const { error } = await supabase
      .from('org_members')
      .delete()
      .eq('org_id', orgId)
      .eq('user_id', userId);

    if (error) throw error;
    return NextResponse.json({ ok: true });
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
