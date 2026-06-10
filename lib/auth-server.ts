import 'server-only';
import { createServerClient as createSsrClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { can, type AppModule, type Action } from '@/lib/permissions';

type GuardResult = { ok: false; error: string } | null;

async function getAuthUser() {
  const cookieStore = await cookies();
  const client = createSsrClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch { /* read-only context in server actions — safe to ignore */ }
        },
      },
    }
  );
  const { data: { user } } = await client.auth.getUser();
  return user ?? null;
}

export async function guard(module: AppModule, action: Action): Promise<GuardResult> {
  const user = await getAuthUser();
  if (!user) return { ok: false, error: 'Unauthorized' };
  const role = (user.user_metadata?.role ?? '') as string;
  if (!can(role, module, action)) return { ok: false, error: 'Forbidden: insufficient permissions' };
  return null;
}

export async function getSessionUser() {
  return getAuthUser();
}
