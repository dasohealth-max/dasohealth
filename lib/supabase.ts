import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Singleton browser client — safe to import in 'use client' components.
 * Uses the anon key and respects Row Level Security policies.
 */
export const supabase: SupabaseClient = createClient(url, anon);

/**
 * Factory that creates a fresh browser/anon client.
 * Use when you need a per-request instance rather than the singleton.
 */
export function createBrowserClient(): SupabaseClient {
  return createClient(url, anon);
}

/**
 * Factory for a privileged server-side client.
 * Uses the service-role key which bypasses RLS — ONLY call this in:
 *   - Server Actions  (app/actions/*.ts)
 *   - Route Handlers  (app/api/[...]/route.ts)
 *
 * Never import or call this in Client Components — the service-role key
 * must never reach the browser bundle.
 */
export function createServerClient(): SupabaseClient {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
