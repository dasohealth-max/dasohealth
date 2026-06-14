'use server';

import { createServerClient } from '@/lib/supabase';
import { prisma } from '@/lib/prisma';
import { auditLog, requireActor, scopedRegionWhere } from '@/lib/auth-server';
import { isCampaignRegion } from '@/lib/regions';
import { manageableRolesFor } from '@/lib/permissions';
import type { Role, User } from '@/types';

type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function toUser(u: {
  id: string;
  email?: string;
  created_at: string;
  banned_until?: string | null;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}): User {
  return {
    id: u.id,
    name: (u.user_metadata?.name as string) ?? u.email ?? 'Unknown',
    email: u.email ?? '',
    role: ((u.app_metadata?.role as string) || 'Screening Officer') as User['role'],
    assignedRegion: (u.app_metadata?.assignedRegion as string) || undefined,
    initials: (u.user_metadata?.initials as string) ?? '',
    color: (u.user_metadata?.color as string) ?? '#0d9488',
    active: !u.banned_until,
    createdAt: u.created_at,
  };
}

export async function actionGetAllUsers(): Promise<ActionResult<User[]>> {
  const actor = await requireActor('settings', 'view');
  if ('error' in actor) return { ok: false, error: actor.error };

  const db = createServerClient();
  const { data, error } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (error) return { ok: false, error: error.message };

  let users = data.users.map(toUser);
  if (actor.role !== 'Super Administrator') {
    users = users.filter((u) => u.assignedRegion === actor.assignedRegion);
  }
  return { ok: true, data: users };
}

export async function actionCreateUser(input: {
  email: string;
  password: string;
  name: string;
  role: string;
  assignedRegion?: string;
  initials: string;
  color: string;
}): Promise<ActionResult<{ id: string }>> {
  const actor = await requireActor('settings', 'create');
  if ('error' in actor) return { ok: false, error: actor.error };

  const allowedRoles = manageableRolesFor(actor.role);
  if (!allowedRoles.includes(input.role as Role)) {
    return { ok: false, error: 'You cannot create that role' };
  }

  const assignedRegion = actor.role === 'Project Manager'
    ? actor.assignedRegion
    : input.assignedRegion;

  if (!assignedRegion || !isCampaignRegion(assignedRegion)) {
    return { ok: false, error: 'Valid assigned region is required' };
  }
  if (!input.email || !input.password || !input.name || !input.role) {
    return { ok: false, error: 'email, password, name and role are required' };
  }
  if (input.password.length < 10) {
    return { ok: false, error: 'Password must be at least 10 characters' };
  }

  const db = createServerClient();
  const { data, error } = await db.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    app_metadata: { role: input.role, assignedRegion },
    user_metadata: { name: input.name, initials: input.initials, color: input.color },
  });

  if (error) return { ok: false, error: error.message };
  await auditLog({
    actor,
    action: 'create',
    entity: 'User',
    entityId: data.user.id,
    region: assignedRegion,
    details: `Created ${input.role} user ${input.name}`,
    after: { id: data.user.id, email: input.email, role: input.role, assignedRegion },
  });
  return { ok: true, data: { id: data.user.id } };
}

export async function actionUpdateUserMetadata(
  userId: string,
  metadata: { name?: string; role?: string; assignedRegion?: string; initials?: string; color?: string }
): Promise<ActionResult> {
  const actor = await requireActor('settings', 'edit');
  if ('error' in actor) return { ok: false, error: actor.error };

  const db = createServerClient();
  const current = await db.auth.admin.getUserById(userId);
  if (current.error) return { ok: false, error: current.error.message };
  const before = toUser(current.data.user);

  if (actor.role === 'Project Manager') {
    if (before.assignedRegion !== actor.assignedRegion) {
      return { ok: false, error: 'Forbidden: region access denied' };
    }
    const nextRole = metadata.role ?? before.role;
    if (!manageableRolesFor(actor.role).includes(nextRole as Role)) {
      return { ok: false, error: 'You cannot assign that role' };
    }
    metadata.assignedRegion = actor.assignedRegion;
  } else if (metadata.assignedRegion && !isCampaignRegion(metadata.assignedRegion)) {
    return { ok: false, error: 'Valid assigned region is required' };
  }

  const { error } = await db.auth.admin.updateUserById(userId, {
    app_metadata: {
      role: metadata.role ?? before.role,
      assignedRegion: metadata.assignedRegion ?? before.assignedRegion,
    },
    user_metadata: {
      name: metadata.name ?? before.name,
      initials: metadata.initials ?? before.initials,
      color: metadata.color ?? before.color,
    },
  });
  if (error && !error.message.toLowerCase().includes('not found')) {
    return { ok: false, error: error.message };
  }

  await auditLog({
    actor,
    action: 'update',
    entity: 'User',
    entityId: userId,
    region: metadata.assignedRegion ?? before.assignedRegion,
    details: `Updated user ${metadata.name ?? before.name}`,
    before,
    after: metadata,
  });
  return { ok: true, data: null };
}

export async function actionResetUserPassword(
  userId: string,
  password: string,
): Promise<ActionResult> {
  const actor = await requireActor('settings', 'edit');
  if ('error' in actor) return { ok: false, error: actor.error };

  if (password.length < 10) {
    return { ok: false, error: 'Password must be at least 10 characters' };
  }

  const db = createServerClient();
  const current = await db.auth.admin.getUserById(userId);
  if (current.error) return { ok: false, error: current.error.message };
  const target = toUser(current.data.user);

  if (actor.role === 'Project Manager') {
    if (target.assignedRegion !== actor.assignedRegion) {
      return { ok: false, error: 'Forbidden: region access denied' };
    }
    if (!manageableRolesFor(actor.role).includes(target.role)) {
      return { ok: false, error: 'You cannot reset that user password' };
    }
  }

  const { error } = await db.auth.admin.updateUserById(userId, { password });
  if (error) return { ok: false, error: error.message };

  await auditLog({
    actor,
    action: 'reset_password',
    entity: 'User',
    entityId: userId,
    region: target.assignedRegion,
    details: `Reset password for ${target.name}`,
    before: { id: target.id, email: target.email, role: target.role, assignedRegion: target.assignedRegion },
    after: { passwordReset: true },
  });
  return { ok: true, data: null };
}

export async function actionDeleteUser(userId: string): Promise<ActionResult> {
  const actor = await requireActor('settings', 'delete');
  if ('error' in actor) return { ok: false, error: actor.error };

  const db = createServerClient();
  const current = await db.auth.admin.getUserById(userId);
  const before = current.data?.user ? toUser(current.data.user) : null;
  if (actor.role === 'Project Manager' && before?.assignedRegion !== actor.assignedRegion) {
    return { ok: false, error: 'Forbidden: region access denied' };
  }

  const { error } = await db.auth.admin.deleteUser(userId);
  if (error && !error.message.toLowerCase().includes('not found')) {
    return { ok: false, error: error.message };
  }

  await auditLog({
    actor,
    action: 'delete',
    entity: 'User',
    entityId: userId,
    region: before?.assignedRegion,
    details: before ? `Deleted user ${before.name}` : 'Deleted user',
    before,
  });
  return { ok: true, data: null };
}

export async function actionGetAuditLogs(limit = 100): Promise<ActionResult<{
  id: string; actor: string; actorId: string; actorName: string; actorRole: string;
  action: string; entity: string; entityId: string; region?: string; campaignId?: string;
  details: string; createdAt: string;
}[]>> {
  const actor = await requireActor('settings', 'view');
  if ('error' in actor) return { ok: false, error: actor.error };

  try {
    const safeLimit = Math.min(Math.max(1, limit), 500);
    const logs = await prisma.auditLog.findMany({
      where: scopedRegionWhere(actor),
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
    });
    return {
      ok: true,
      data: logs.map((l) => ({
        id: l.id,
        actor: l.actor,
        actorId: l.actorId,
        actorName: l.actorName,
        actorRole: l.actorRole,
        action: l.action,
        entity: l.entity,
        entityId: l.entityId,
        region: l.region ?? undefined,
        campaignId: l.campaignId ?? undefined,
        details: l.details,
        createdAt: (l.createdAt as Date).toISOString(),
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
