import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orgId: string; inviteId: string }> },
) {
  try {
    const user = await requireUser();
    const { orgId, inviteId } = await params;
    if (!orgId || !inviteId) {
      return NextResponse.json({ error: 'Missing org or invite id' }, { status: 400 });
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
        { error: 'Only owner or admin can revoke invites' },
        { status: 403 },
      );
    }

    const { error } = await supabase
      .from('org_invites')
      .delete()
      .eq('id', inviteId)
      .eq('org_id', orgId);

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
