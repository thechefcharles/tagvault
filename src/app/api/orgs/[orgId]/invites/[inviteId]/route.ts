import { NextResponse } from 'next/server';
import { requireOrgRole } from '@/lib/server/orgAuth';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orgId: string; inviteId: string }> },
) {
  try {
    const { orgId, inviteId } = await params;
    if (!orgId || !inviteId) {
      return NextResponse.json({ error: 'Missing org or invite id' }, { status: 400 });
    }

    await requireOrgRole(orgId, ['owner', 'admin']);

    const supabase = await createClient();
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
    if (err instanceof Error && err.message.includes('Forbidden')) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
