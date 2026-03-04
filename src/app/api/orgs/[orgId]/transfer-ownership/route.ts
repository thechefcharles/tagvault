import { NextRequest, NextResponse } from 'next/server';
import { requireOrgOwner } from '@/lib/server/orgAuth';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const bodySchema = z.object({
  new_owner_user_id: z.string().uuid(),
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

    const { user } = await requireOrgOwner(orgId);

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const newOwnerId = parsed.data.new_owner_user_id;
    if (newOwnerId === user.id) {
      return NextResponse.json({ error: 'Already owner' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: newOwnerMember } = await supabase
      .from('org_members')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', newOwnerId)
      .single();

    if (!newOwnerMember) {
      return NextResponse.json({ error: 'Target user is not a member' }, { status: 404 });
    }

    await supabase.rpc('transfer_org_ownership', {
      p_org_id: orgId,
      p_new_owner_user_id: newOwnerId,
    });

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
