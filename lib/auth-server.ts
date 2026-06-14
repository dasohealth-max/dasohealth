import 'server-only';
import { createServerClient as createSsrClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { can, type AppModule, type Action } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/lib/generated/prisma/client';

type GuardResult = { ok: false; error: string } | null;

export interface ServerActor {
  id: string;
  email: string;
  name: string;
  role: string;
  assignedRegion?: string;
}

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
          } catch { /* read-only context in server actions */ }
        },
      },
    }
  );
  const { data: { user } } = await client.auth.getUser();
  return user ?? null;
}

export async function getActor(): Promise<ServerActor | null> {
  const user = await getAuthUser();
  if (!user) return null;
  const appMeta = user.app_metadata ?? {};
  const userMeta = user.user_metadata ?? {};
  return {
    id: user.id,
    email: user.email ?? '',
    name: String(userMeta.name ?? user.email ?? 'Unknown user'),
    role: String(appMeta.role ?? userMeta.role ?? ''),
    assignedRegion: (appMeta.assignedRegion ?? userMeta.assignedRegion)
      ? String(appMeta.assignedRegion ?? userMeta.assignedRegion)
      : undefined,
  };
}

export async function guard(module: AppModule, action: Action): Promise<GuardResult> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: 'Unauthorized' };
  if (!can(actor.role, module, action)) return { ok: false, error: 'Forbidden: insufficient permissions' };
  return null;
}

export async function requireActor(module: AppModule, action: Action): Promise<ServerActor | { error: string }> {
  const actor = await getActor();
  if (!actor) return { error: 'Unauthorized' };
  if (!can(actor.role, module, action)) return { error: 'Forbidden: insufficient permissions' };
  return actor;
}

export function isSuperAdmin(actor: ServerActor): boolean {
  return actor.role === 'Super Administrator';
}

export function scopedRegionWhere(actor: ServerActor) {
  return isSuperAdmin(actor) ? {} : { region: actor.assignedRegion ?? '__no_region__' };
}

export function ensureRegionAccess(actor: ServerActor, region: string): GuardResult {
  if (isSuperAdmin(actor)) return null;
  if (!actor.assignedRegion) return { ok: false, error: 'User is not assigned to a region' };
  if (actor.assignedRegion !== region) return { ok: false, error: 'Forbidden: region access denied' };
  return null;
}

export async function auditLog(input: {
  actor: ServerActor;
  action: string;
  entity: string;
  entityId: string;
  region?: string | null;
  campaignId?: string | null;
  details?: string;
  before?: unknown;
  after?: unknown;
}) {
  const toJson = (value: unknown): Prisma.InputJsonValue | undefined =>
    value === undefined ? undefined : JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

  await prisma.auditLog.create({
    data: {
      actor: `${input.actor.name} (${input.actor.role})`,
      actorId: input.actor.id,
      actorName: input.actor.name,
      actorRole: input.actor.role,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      region: input.region ?? null,
      campaignId: input.campaignId ?? null,
      details: input.details ?? '',
      before: toJson(input.before),
      after: toJson(input.after),
    },
  });
}

export async function getSessionUser() {
  return getAuthUser();
}
