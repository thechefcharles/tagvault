import { createClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';

export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthenticated');
  }
  return user;
}

/** Requires auth and an active org; ensures personal org exists and profile.active_org_id is set. */
export async function requireActiveOrg(): Promise<{ user: User; activeOrgId: string }> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('active_org_id')
    .eq('id', user.id)
    .single();

  let activeOrgId = profile?.active_org_id as string | null;
  if (!activeOrgId) {
    const { data: orgId, error } = await supabase.rpc('ensure_my_personal_org');
    if (error) throw new Error('Failed to ensure personal org');
    activeOrgId = orgId as string | null;
  }
  if (!activeOrgId) throw new Error('No active org');
  return { user, activeOrgId };
}

/** Admin emails from ADMIN_EMAILS env (comma-separated). */
function getAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? '';
  return new Set(raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean));
}

/** Requires authenticated user whose email is in ADMIN_EMAILS. */
export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  const email = user.email?.trim().toLowerCase();
  if (!email) throw new Error('Admin access requires verified email');
  const admins = getAdminEmails();
  if (!admins.has(email)) throw new Error('Forbidden');
  return user;
}

/** Like requireAdmin but returns { user, email } for audit logging. */
export async function requireAdminWithEmail(): Promise<{ user: User; email: string }> {
  const user = await requireAdmin();
  const email = user.email?.trim().toLowerCase() ?? '';
  return { user, email };
}

export async function requireNoUser(): Promise<void> {
  const user = await getCurrentUser();
  if (user) {
    throw new Error('Already authenticated');
  }
}
