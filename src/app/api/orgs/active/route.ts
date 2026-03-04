import { NextRequest, NextResponse } from 'next/server';
import { requireActiveOrg } from '@/lib/server/auth';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const bodySchema = z.object({
  active_org_id: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireActiveOrg();
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data: member } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('org_id', parsed.data.active_org_id)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Not a member of this org' }, { status: 403 });
    }

    const { error } = await supabase
      .from('profiles')
      .update({ active_org_id: parsed.data.active_org_id })
      .eq('id', user.id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && (err.message === 'Unauthenticated' || err.message === 'No active org')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
