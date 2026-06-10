'use server';

import { createServerClient } from '@/lib/supabase';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/auth-server';
import type { User } from '@/types';

type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// List all users from Supabase Auth (Super Admin only).
// ---------------------------------------------------------------------------
export async function actionGetAllUsers(): Promise<ActionResult<User[]>> {
  const denied = await guard('settings', 'view');
  if (denied) return denied;

  const db = createServerClient();
  const { data, error } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (error) return { ok: false, error: error.message };

  const users: User[] = data.users.map((u) => ({
    id:        u.id,
    name:      (u.user_metadata?.name as string) ?? u.email ?? 'Unknown',
    email:     u.email ?? '',
    role:      (u.user_metadata?.role as User['role']) ?? 'Screening Officer',
    initials:  (u.user_metadata?.initials as string) ?? '',
    color:     (u.user_metadata?.color as string) ?? '#0d9488',
    active:    !u.banned_until,
    createdAt: u.created_at,
  }));

  return { ok: true, data: users };
}

// ---------------------------------------------------------------------------
// Create a new Supabase Auth user with role stored in user_metadata.
// email_confirm: true skips the confirmation email (admin-created accounts).
// ---------------------------------------------------------------------------
export async function actionCreateUser(input: {
  email: string;
  password: string;
  name: string;
  role: string;
  initials: string;
  color: string;
}): Promise<ActionResult<{ id: string }>> {
  const denied = await guard('settings', 'create');
  if (denied) return denied;

  if (!input.email || !input.password || !input.name || !input.role) {
    return { ok: false, error: 'email, password, name and role are required' };
  }
  if (input.password.length < 6) {
    return { ok: false, error: 'Password must be at least 6 characters' };
  }

  const db = createServerClient();
  const { data, error } = await db.auth.admin.createUser({
    email:         input.email,
    password:      input.password,
    email_confirm: true,
    user_metadata: {
      name:     input.name,
      role:     input.role,
      initials: input.initials,
      color:    input.color,
    },
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { id: data.user.id } };
}

// ---------------------------------------------------------------------------
// Update a Supabase Auth user's metadata (name, role, initials, color).
// ---------------------------------------------------------------------------
export async function actionUpdateUserMetadata(
  userId: string,
  metadata: { name?: string; role?: string; initials?: string; color?: string }
): Promise<ActionResult> {
  const denied = await guard('settings', 'edit');
  if (denied) return denied;

  const db = createServerClient();
  const { error } = await db.auth.admin.updateUserById(userId, { user_metadata: metadata });

  if (error && !error.message.toLowerCase().includes('not found')) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: null };
}

// ---------------------------------------------------------------------------
// Delete a Supabase Auth user.
// ---------------------------------------------------------------------------
export async function actionDeleteUser(userId: string): Promise<ActionResult> {
  const denied = await guard('settings', 'delete');
  if (denied) return denied;

  const db = createServerClient();
  const { error } = await db.auth.admin.deleteUser(userId);

  if (error && !error.message.toLowerCase().includes('not found')) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: null };
}

// ---------------------------------------------------------------------------
// Get recent audit logs from the database.
// ---------------------------------------------------------------------------
export async function actionGetAuditLogs(limit = 100): Promise<ActionResult<{
  id: string; actor: string; action: string; entity: string;
  entityId: string; details: string; createdAt: string;
}[]>> {
  const denied = await guard('settings', 'view');
  if (denied) return denied;

  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return {
      ok: true,
      data: logs.map((l) => ({
        id:        l.id,
        actor:     l.actor,
        action:    l.action,
        entity:    l.entity,
        entityId:  l.entityId,
        details:   l.details,
        createdAt: (l.createdAt as Date).toISOString(),
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
