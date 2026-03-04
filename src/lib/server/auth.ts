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

export async function requireNoUser(): Promise<void> {
  const user = await getCurrentUser();
  if (user) {
    throw new Error('Already authenticated');
  }
}
