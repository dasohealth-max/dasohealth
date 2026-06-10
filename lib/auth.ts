'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useEffect, useState } from 'react';
import { can, canAccess, mustMaskPatient, type AppModule, type Action } from '@/lib/permissions';

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getClient() {
  return createBrowserClient(url, anon);
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

export async function signIn(email: string, password: string) {
  const { data, error } = await getClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  await getClient().auth.signOut();
}

export async function getSession() {
  const { data: { session } } = await getClient().auth.getSession();
  return session;
}

// ---------------------------------------------------------------------------
// SessionUser — shape used by Topbar and other components
// ---------------------------------------------------------------------------

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  initials: string;
  color: string;
}

function toSessionUser(user: {
  id: string;
  email?: string;
  user_metadata: Record<string, unknown>;
}): SessionUser {
  const m = user.user_metadata;
  return {
    id:       user.id,
    email:    user.email ?? '',
    name:     String(m.name     ?? ''),
    role:     String(m.role     ?? ''),
    initials: String(m.initials ?? ''),
    color:    String(m.color    ?? '#0d9488'),
  };
}

// ---------------------------------------------------------------------------
// Permission hook — reads role from Supabase user_metadata
// ---------------------------------------------------------------------------

export function usePermissions() {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    const sb = getClient();

    // Populate synchronously from cached session
    sb.auth.getSession().then(({ data: { session } }) => {
      setSessionUser(session?.user ? toSessionUser(session.user) : null);
    });

    // Keep in sync with auth state changes (sign-in, sign-out, token refresh)
    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      setSessionUser(session?.user ? toSessionUser(session.user) : null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const role = sessionUser?.role ?? '';
  return {
    role,
    user:        sessionUser,
    can:         (module: AppModule, action: Action) => can(role, module, action),
    canAccess:   (module: AppModule) => canAccess(role, module),
    maskPatient: mustMaskPatient(role),
  };
}
