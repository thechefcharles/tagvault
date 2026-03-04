import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    await requireUser();
    const { orgId } = await params;
    if (!orgId) {
      return NextResponse.json({ error: 'Missing org id' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_org_members', {
      p_org_id: orgId,
    });

    if (error) throw error;

    const members = (data ?? []).map((row: { user_id: string; role: string; email: string | null }) => ({
      user_id: row.user_id,
      role: row.role,
      email: row.email ?? undefined,
    }));

    return NextResponse.json({ members });
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
