import { NextResponse } from 'next/server';
import { requireOrgMember } from '@/lib/server/orgAuth';
import { createClient } from '@/lib/supabase/server';

/** Leave an org. Owner cannot leave without transferring ownership first. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    if (!orgId) {
      return NextResponse.json({ error: 'Missing org id' }, { status: 400 });
    }

    const { user, membership } = await requireOrgMember(orgId);

    if (membership.role === 'owner') {
      return NextResponse.json(
        { error: 'Transfer ownership before leaving the org' },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from('org_members')
      .delete()
      .eq('org_id', orgId)
      .eq('user_id', user.id);

    if (error) throw error;

    const { data: profile } = await supabase
      .from('profiles')
      .select('active_org_id')
      .eq('id', user.id)
      .single();

    if (profile?.active_org_id === orgId) {
      const { data: other } = await supabase
        .from('org_members')
        .select('org_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();
      await supabase
        .from('profiles')
        .update({ active_org_id: other?.org_id ?? null })
        .eq('id', user.id);
    }

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
