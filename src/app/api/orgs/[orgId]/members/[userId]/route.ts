import { NextRequest, NextResponse } from 'next/server';
import {
  requireOrgOwner,
  requireOrgRole,
  type OrgRole,
} from '@/lib/server/orgAuth';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const patchSchema = z.object({
  role: z.enum(['admin', 'member']),
});

async function getTargetRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  targetUserId: string,
) {
  const { data } = await supabase
    .from('org_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', targetUserId)
    .single();
  return data?.role as OrgRole | null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; userId: string }> },
) {
  try {
    const { orgId, userId } = await params;
    if (!orgId || !userId) {
      return NextResponse.json({ error: 'Missing org or user id' }, { status: 400 });
    }

    await requireOrgOwner(orgId);

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const targetRole = await getTargetRole(supabase, orgId, userId);

    if (!targetRole) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }
    if (targetRole === 'owner') {
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
    const { orgId, userId } = await params;
    if (!orgId || !userId) {
      return NextResponse.json({ error: 'Missing org or user id' }, { status: 400 });
    }

    const { user, membership } = await requireOrgRole(orgId, ['owner', 'admin']);

    const supabase = await createClient();
    const targetRole = await getTargetRole(supabase, orgId, userId);

    if (!targetRole) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }
    if (targetRole === 'owner') {
      return NextResponse.json(
        { error: 'Cannot remove owner; transfer ownership first' },
        { status: 403 },
      );
    }
    if (userId === user.id) {
      return NextResponse.json(
        { error: 'Use Leave org instead of removing yourself' },
        { status: 400 },
      );
    }
    if (membership.role === 'admin' && targetRole === 'admin') {
      return NextResponse.json(
        { error: 'Admin cannot remove another admin' },
        { status: 403 },
      );
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
