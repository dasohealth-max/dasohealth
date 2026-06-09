'use client';

import { can, canAccess, mustMaskPatient, type AppModule, type Action } from '@/lib/permissions';

export interface SessionUser {
  email: string;
  name: string;
  role: string;
  initials: string;
  color: string;
}

const KEY = 'ec_user';

export function getSession(): SessionUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSession(user: SessionUser) {
  localStorage.setItem(KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(KEY);
}

export function isAdmin(role: string) {
  return role === 'Super Administrator';
}

export function canWrite(role: string) {
  return role !== 'Donor User';
}

// ─── Permission hook ───────────────────────────────────────────────────────────
/** Use inside any 'use client' component to get role-aware permission helpers */
export function usePermissions() {
  const user   = getSession();
  const role   = user?.role ?? '';
  return {
    role,
    user,
    /** Can this role perform action on module? */
    can:        (module: AppModule, action: Action) => can(role, module, action),
    /** Can this role see module at all? */
    canAccess:  (module: AppModule) => canAccess(role, module),
    /** Should patient identifiers be hidden? */
    maskPatient: mustMaskPatient(role),
  };
}
