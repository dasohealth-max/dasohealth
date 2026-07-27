'use server';

import { z } from 'zod';
import { updateTag } from 'next/cache';
import { after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auditLog, requireActor } from '@/lib/auth-server';
import type { ChangeRequest, ChangeRequestStatus } from '@/types';

type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

function fromRow(row: {
  id: string;
  entity: string;
  entityId: string;
  entityLabel: string;
  requestType: string;
  reason: string;
  requestedById: string;
  requestedByName: string;
  requestedByRole: string;
  status: string;
  region: string | null;
  campaignId: string | null;
  resolvedById: string | null;
  resolvedByName: string | null;
  resolutionNote: string;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): ChangeRequest {
  return {
    id: row.id,
    entity: row.entity,
    entityId: row.entityId,
    entityLabel: row.entityLabel,
    requestType: row.requestType as ChangeRequest['requestType'],
    reason: row.reason,
    requestedById: row.requestedById,
    requestedByName: row.requestedByName,
    requestedByRole: row.requestedByRole,
    status: row.status as ChangeRequestStatus,
    region: row.region ?? undefined,
    campaignId: row.campaignId ?? undefined,
    resolvedById: row.resolvedById ?? undefined,
    resolvedByName: row.resolvedByName ?? undefined,
    resolutionNote: row.resolutionNote,
    resolvedAt: row.resolvedAt ? (row.resolvedAt as Date).toISOString() : undefined,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

const CreateSchema = z.object({
  entity: z.enum(['Patient', 'Surgery']),
  entityId: z.string().min(1, 'Entity ID is required'),
  entityLabel: z.string(),
  requestType: z.enum(['archive', 'correct', 'other']),
  reason: z.string().min(10, 'Please provide a detailed reason (at least 10 characters)'),
  region: z.string().optional(),
  campaignId: z.string().optional(),
});

export async function actionCreateChangeRequest(
  input: z.infer<typeof CreateSchema>,
): Promise<ActionResult<ChangeRequest>> {
  const actor = await requireActor('changeRequests', 'create');
  if ('error' in actor) return { ok: false, error: actor.error };

  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    const row = await prisma.changeRequest.create({
      data: {
        entity: parsed.data.entity,
        entityId: parsed.data.entityId,
        entityLabel: parsed.data.entityLabel,
        requestType: parsed.data.requestType,
        reason: parsed.data.reason.trim(),
        requestedById: actor.id,
        requestedByName: actor.name,
        requestedByRole: actor.role,
        status: 'Pending',
        region: parsed.data.region ?? null,
        campaignId: parsed.data.campaignId ?? null,
      },
    });
    updateTag('change-requests');
    after(() => auditLog({
      actor,
      action: 'create',
      entity: 'ChangeRequest',
      entityId: row.id,
      region: parsed.data.region,
      campaignId: parsed.data.campaignId,
      details: `Change request submitted for ${parsed.data.entity} ${parsed.data.entityLabel}: ${parsed.data.reason}`,
      after: row,
    }));
    return { ok: true, data: fromRow(row) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function getChangeRequests(params: {
  status?: ChangeRequestStatus;
  page: number;
  pageSize: number;
}): Promise<{ data: ChangeRequest[]; total: number }> {
  const actor = await requireActor('changeRequests', 'view');
  if ('error' in actor) throw new Error(actor.error);

  const isSuperAdmin = actor.role === 'Super Administrator';

  const where = {
    ...(params.status && { status: params.status }),
    ...(!isSuperAdmin && { requestedById: actor.id }),
  };

  const pageSize = Math.min(Math.max(1, params.pageSize), 100);
  const page = Math.max(1, params.page);
  const skip = (page - 1) * pageSize;

  const [rows, total] = await Promise.all([
    prisma.changeRequest.findMany({ where, skip, take: pageSize, orderBy: { createdAt: 'desc' } }),
    prisma.changeRequest.count({ where }),
  ]);

  return { data: rows.map(fromRow), total };
}

export async function getPendingChangeRequestCount(): Promise<number> {
  const actor = await requireActor('changeRequests', 'view');
  if ('error' in actor) return 0;
  if (actor.role !== 'Super Administrator') return 0;
  return prisma.changeRequest.count({ where: { status: 'Pending' } });
}

const ResolveSchema = z.object({
  resolution: z.enum(['Approved', 'Rejected', 'Resolved']),
  resolutionNote: z.string().min(1, 'Resolution note is required'),
});

export async function actionResolveChangeRequest(
  id: string,
  input: z.infer<typeof ResolveSchema>,
): Promise<ActionResult<ChangeRequest>> {
  const actor = await requireActor('changeRequests', 'approve');
  if ('error' in actor) return { ok: false, error: actor.error };
  if (actor.role !== 'Super Administrator') {
    return { ok: false, error: 'Only Super Administrators can resolve change requests' };
  }

  const parsed = ResolveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    const existing = await prisma.changeRequest.findUnique({ where: { id } });
    if (!existing) return { ok: false, error: 'Change request not found' };
    if (existing.status !== 'Pending') return { ok: false, error: 'This request has already been resolved' };

    const row = await prisma.changeRequest.update({
      where: { id },
      data: {
        status: parsed.data.resolution,
        resolvedById: actor.id,
        resolvedByName: actor.name,
        resolutionNote: parsed.data.resolutionNote.trim(),
        resolvedAt: new Date(),
      },
    });
    updateTag('change-requests');
    after(() => auditLog({
      actor,
      action: 'resolve',
      entity: 'ChangeRequest',
      entityId: id,
      region: existing.region ?? undefined,
      campaignId: existing.campaignId ?? undefined,
      details: `Change request ${parsed.data.resolution.toLowerCase()} for ${existing.entity} ${existing.entityLabel}: ${parsed.data.resolutionNote}`,
      before: existing,
      after: row,
    }));
    return { ok: true, data: fromRow(row) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
