import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const bodySchema = z.object({
  token: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const email = user.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json(
        { error: 'User email required to accept invite' },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('accept_org_invite', {
      p_token: parsed.data.token,
      p_user_email: email,
    });

    if (error) throw error;

    if (data?.ok === false) {
      const err = data?.error as string;
      if (err === 'not_logged_in') {
        return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
      }
      if (err === 'email_mismatch') {
        return NextResponse.json(
          { error: 'This invite was sent to a different email address' },
          { status: 403 },
        );
      }
      if (err === 'already_used') {
        return NextResponse.json({ error: 'Invite already used' }, { status: 400 });
      }
      if (err === 'expired') {
        return NextResponse.json({ error: 'Invite expired' }, { status: 400 });
      }
      if (err === 'invalid_token') {
        return NextResponse.json({ error: 'Invalid invite link' }, { status: 400 });
      }
      return NextResponse.json({ error: err ?? 'Accept failed' }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      org_id: data?.org_id,
    });
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
