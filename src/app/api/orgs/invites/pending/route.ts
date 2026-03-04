import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_pending_invites_for_user');

    if (error) throw error;

    const invites = (data ?? []).map(
      (row: { invite_id: string; org_id: string; org_name: string; role: string; expires_at: string }) => ({
        invite_id: row.invite_id,
        org_id: row.org_id,
        org_name: row.org_name,
        role: row.role,
        expires_at: row.expires_at,
      }),
    );

    return NextResponse.json({ invites });
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
