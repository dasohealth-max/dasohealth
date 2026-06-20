'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useEffect, useState } from 'react';
import { can, canAccess, mustMaskPatient, type AppModule, type Action } from '@/lib/permissions';

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const AUTH_NETWORK_ERROR = 'Authentication service is unreachable. Check your internet connection or Supabase status, then try again.';

function getClient() {
  return createBrowserClient(url, anon);
}

function isAuthNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes('failed to fetch') ||
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('econnreset') ||
    message.includes('timeout');
}

function normalizeAuthError(error: unknown): Error {
  return isAuthNetworkError(error)
    ? new Error(AUTH_NETWORK_ERROR)
    : error instanceof Error
      ? error
      : new Error('Authentication failed.');
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

export async function signIn(email: string, password: string) {
  try {
    const { data, error } = await getClient().auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.session;
  } catch (error) {
    throw normalizeAuthError(error);
  }
}

export async function signOut() {
  try {
    await getClient().auth.signOut();
  } catch (error) {
    if (!isAuthNetworkError(error)) throw error;
  }
}

export async function getSession() {
  try {
    const { data: { session } } = await getClient().auth.getSession();
    return session;
  } catch (error) {
    if (isAuthNetworkError(error)) return null;
    throw error;
  }
}

// ---------------------------------------------------------------------------
// SessionUser — shape used by Topbar and other components
// ---------------------------------------------------------------------------

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  assignedRegion?: string;
  initials: string;
  color: string;
}

function toSessionUser(user: {
  id: string;
  email?: string;
  user_metadata: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}): SessionUser {
  const m = user.user_metadata;
  const a = user.app_metadata ?? {};
  return {
    id:       user.id,
    email:    user.email ?? '',
    name:     String(m.name     ?? ''),
    role:     String(a.role     ?? m.role ?? ''),
    assignedRegion: (a.assignedRegion ?? m.assignedRegion)
      ? String(a.assignedRegion ?? m.assignedRegion)
      : undefined,
    initials: String(m.initials ?? ''),
    color:    String(m.color    ?? '#0d9488'),
  };
}

export async function getUser() {
  try {
    const { data: { user } } = await getClient().auth.getUser();
    return user;
  } catch (error) {
    if (isAuthNetworkError(error)) return null;
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Permission hook — reads role from Supabase user_metadata
// ---------------------------------------------------------------------------

export function usePermissions() {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    const sb = getClient();

    // Populate synchronously from cached session
    sb.auth.getSession()
      .then(({ data: { session } }) => {
        setSessionUser(session?.user ? toSessionUser(session.user) : null);
      })
      .catch((error) => {
        if (!isAuthNetworkError(error)) throw error;
        setSessionUser(null);
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
    maskPatient: mustMaskPatient(),
  };
}
