import 'server-only';
import { createServerClient } from '@/lib/supabase';
import { can, type AppModule, type Action } from '@/lib/permissions';

type GuardResult = { ok: false; error: string } | null;

/**
 * Call at the top of every mutation server action.
 * Returns an error result if the request is unauthenticated or forbidden;
 * returns null if the caller is allowed to proceed.
 */
export async function guard(module: AppModule, action: Action): Promise<GuardResult> {
  const db = createServerClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false, error: 'Unauthorized' };
  const role = (user.user_metadata?.role ?? '') as string;
  if (!can(role, module, action)) return { ok: false, error: 'Forbidden: insufficient permissions' };
  return null;
}

/** Returns the authenticated Supabase user, or null if unauthenticated. */
export async function getSessionUser() {
  const db = createServerClient();
  const { data: { user } } = await db.auth.getUser();
  return user ?? null;
}
