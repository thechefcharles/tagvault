import { NextRequest, NextResponse } from 'next/server';
import { requireActiveOrg } from '@/lib/server/auth';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export async function GET() {
  try {
    const { user } = await requireActiveOrg();
    const supabase = await createClient();

    const { data: memberships, error: errM } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id);

    if (errM) throw errM;
    const orgIds = Array.from(new Set((memberships ?? []).map((m) => m.org_id)));
    if (orgIds.length === 0) {
      return NextResponse.json([]);
    }

    const { data: orgs, error } = await supabase
      .from('organizations')
      .select('id, name, slug')
      .in('id', orgIds)
      .order('name');

    if (error) throw error;
    return NextResponse.json(orgs ?? []);
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

const createSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
});

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireActiveOrg();
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data: org, error } = await supabase
      .from('organizations')
      .insert({
        name: parsed.data.name,
        slug: parsed.data.slug,
        owner_id: user.id,
      })
      .select('id, name, slug')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Slug already taken' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json(org);
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
