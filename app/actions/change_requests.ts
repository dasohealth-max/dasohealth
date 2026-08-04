'use server';

import { z } from 'zod';
import { updateTag } from 'next/cache';
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
  notes?: string | null;
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
  requesterViewedAt: Date | null;
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
    notes: row.notes ?? '',
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
    requesterViewedAt: row.requesterViewedAt ? (row.requesterViewedAt as Date).toISOString() : undefined,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

const CreateSchema = z.object({
  entity: z.enum(['Patient', 'Surgery']),
  entityId: z.string().min(1, 'Entity ID is required'),
  entityLabel: z.string(),
  requestType: z.enum(['archive', 'cancel_surgery', 'correct', 'other']),
  reason: z.string().min(3, 'Please select or provide a reason'),
  notes: z.string().optional(),
  region: z.string().optional(),
  campaignId: z.string().optional(),
}).superRefine((value, context) => {
  if (value.reason === 'Other reason' && (value.notes ?? '').trim().length < 10) {
    context.addIssue({
      code: 'custom',
      path: ['notes'],
      message: 'Please provide additional notes (at least 10 characters)',
    });
  }
});

async function getChangeRequestTarget(entity: 'Patient' | 'Surgery', entityId: string) {
  if (entity === 'Patient') {
    const patient = await prisma.patient.findUnique({
      where: { id: entityId },
      select: { fullName: true, region: true, campaignId: true, archivedAt: true },
    });
    return patient ? {
      label: patient.fullName,
      region: patient.region,
      campaignId: patient.campaignId,
      archivedAt: patient.archivedAt,
      status: null,
    } : null;
  }

  const surgery = await prisma.surgery.findUnique({
    where: { id: entityId },
    select: { patientName: true, region: true, campaignId: true, archivedAt: true, status: true },
  });
  return surgery ? {
    label: surgery.patientName,
    region: surgery.region,
    campaignId: surgery.campaignId,
    archivedAt: surgery.archivedAt,
    status: surgery.status,
  } : null;
}

export async function actionCreateChangeRequest(
  input: z.infer<typeof CreateSchema>,
): Promise<ActionResult<ChangeRequest>> {
  const actor = await requireActor('changeRequests', 'create');
  if ('error' in actor) return { ok: false, error: actor.error };
  if (actor.role !== 'Project Manager') {
    return { ok: false, error: 'Only Project Managers can submit lifecycle requests' };
  }

  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (parsed.data.requestType === 'cancel_surgery' && parsed.data.entity !== 'Surgery') {
    return { ok: false, error: 'Surgery cancellation requests must target a surgery record' };
  }

  try {
    const target = await getChangeRequestTarget(parsed.data.entity, parsed.data.entityId);
    if (!target) return { ok: false, error: `${parsed.data.entity} not found` };
    if (target.archivedAt) return { ok: false, error: `${parsed.data.entity} is already archived` };
    if (
      parsed.data.requestType === 'cancel_surgery'
      && target.status !== 'Scheduled'
      && target.status !== 'Postponed'
    ) {
      return { ok: false, error: 'Only scheduled or postponed surgery placements can be cancelled' };
    }
    if (actor.assignedRegion !== target.region) {
      return { ok: false, error: 'Forbidden: region access denied' };
    }
    if (parsed.data.requestType === 'archive' || parsed.data.requestType === 'cancel_surgery') {
      const pendingCount = await prisma.changeRequest.count({
        where: {
          entity: parsed.data.entity,
          entityId: parsed.data.entityId,
          requestType: parsed.data.requestType,
          status: 'Pending',
        },
      });
      if (pendingCount > 0) {
        return {
          ok: false,
          error: parsed.data.requestType === 'archive'
            ? `An archive request for this ${parsed.data.entity.toLowerCase()} is already pending`
            : 'A cancellation request for this surgery is already pending',
        };
      }
    }

    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.changeRequest.create({
      data: {
        entity: parsed.data.entity,
        entityId: parsed.data.entityId,
        entityLabel: target.label,
        requestType: parsed.data.requestType,
        reason: parsed.data.reason.trim(),
        notes: (parsed.data.notes ?? '').trim(),
        requestedById: actor.id,
        requestedByName: actor.name,
        requestedByRole: actor.role,
        status: 'Pending',
        region: target.region,
        campaignId: target.campaignId,
      },
      });
      await auditLog({
        actor,
        action: 'create',
        entity: 'ChangeRequest',
        entityId: created.id,
        region: target.region,
        campaignId: target.campaignId,
        details: `Change request submitted for ${parsed.data.entity} ${target.label}: ${parsed.data.reason}${parsed.data.notes ? ` — ${parsed.data.notes}` : ''}`,
        after: created,
      }, tx);
      return created;
    });
    updateTag('change-requests');
    return { ok: true, data: fromRow(row) };
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002' && parsed.data.requestType === 'archive') {
      return { ok: false, error: `An archive request for this ${parsed.data.entity.toLowerCase()} is already pending` };
    }
    if ((e as { code?: string }).code === 'P2002' && parsed.data.requestType === 'cancel_surgery') {
      return { ok: false, error: 'A cancellation request for this surgery is already pending' };
    }
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function getChangeRequests(params: {
  status?: ChangeRequestStatus;
  view?: 'pending' | 'decided' | 'all';
  page: number;
  pageSize: number;
}): Promise<{ data: ChangeRequest[]; total: number }> {
  const actor = await requireActor('changeRequests', 'view');
  if ('error' in actor) throw new Error(actor.error);

  const isSuperAdmin = actor.role === 'Super Administrator';

  const statusFilter = params.view === 'decided'
    ? { status: { in: ['Approved', 'Rejected'] } }
    : params.view === 'pending'
      ? { status: 'Pending' }
      : params.status
        ? { status: params.status }
        : {};
  const where = {
    ...statusFilter,
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
  return getInboxBadgeCount();
}

export async function getInboxBadgeCount(): Promise<number> {
  const actor = await requireActor('changeRequests', 'view');
  if ('error' in actor) return 0;
  if (actor.role === 'Super Administrator') {
    return prisma.changeRequest.count({ where: { status: 'Pending' } });
  }
  if (actor.role !== 'Project Manager') return 0;
  return prisma.changeRequest.count({
    where: {
      requestedById: actor.id,
      status: { in: ['Approved', 'Rejected'] },
      requesterViewedAt: null,
    },
  });
}

export async function markInboxDecisionsViewed(): Promise<void> {
  const actor = await requireActor('changeRequests', 'view');
  if ('error' in actor || actor.role !== 'Project Manager') return;
  await prisma.changeRequest.updateMany({
    where: {
      requestedById: actor.id,
      status: { in: ['Approved', 'Rejected'] },
      requesterViewedAt: null,
    },
    data: { requesterViewedAt: new Date() },
  });
}

const ResolveSchema = z.object({
  resolution: z.enum(['Approved', 'Rejected']),
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

    const now = new Date();
    const row = await prisma.$transaction(async (tx) => {
      const resolutionData = {
        status: parsed.data.resolution,
        resolvedById: actor.id,
        resolvedByName: actor.name,
        resolutionNote: parsed.data.resolutionNote.trim(),
        resolvedAt: now,
      };
      const claimed = await tx.changeRequest.updateMany({
        where: { id, status: 'Pending' },
        data: resolutionData,
      });
      if (claimed.count !== 1) throw new Error('This request has already been resolved');

      const resolved = { ...existing, ...resolutionData, updatedAt: now };

    if (parsed.data.resolution === 'Approved' && existing.entity === 'Patient' && existing.requestType === 'archive') {
      const patient = await tx.patient.findUnique({ where: { id: existing.entityId } });
      if (!patient) throw new Error('Patient not found');
      if (patient.archivedAt) throw new Error('Patient is already archived');

      const archiveReason = `${existing.reason}${existing.notes ? ` — ${existing.notes}` : ''} — approved: ${parsed.data.resolutionNote.trim()}`;
      await tx.patient.update({
        where: { id: existing.entityId },
        data: {
          archivedAt: now,
          archivedById: actor.id,
          archivedByName: actor.name,
          archivedReason: archiveReason,
        },
      });
      await tx.surgery.updateMany({
        where: {
          patientId: existing.entityId,
          archivedAt: null,
          status: { in: ['Scheduled', 'Postponed'] },
        },
        data: {
          archivedAt: now,
          archivedById: actor.id,
          archivedByName: actor.name,
          archivedReason: archiveReason,
        },
      });
      await auditLog({
        actor,
        action: 'archive',
        entity: 'Patient',
        entityId: existing.entityId,
        region: existing.region ?? undefined,
        campaignId: existing.campaignId ?? undefined,
        details: `Archived patient ${existing.entityLabel} via approved request ${existing.id}: ${archiveReason}`,
        before: patient,
        after: { archivedAt: now, archivedById: actor.id, archivedReason: archiveReason },
      }, tx);
    }

    if (parsed.data.resolution === 'Approved' && existing.entity === 'Surgery' && existing.requestType === 'cancel_surgery') {
      const surgery = await tx.surgery.findUnique({ where: { id: existing.entityId } });
      if (!surgery) throw new Error('Surgery record not found');
      if (surgery.archivedAt) throw new Error('Surgery record is archived');
      if (surgery.status !== 'Scheduled' && surgery.status !== 'Postponed') {
        throw new Error('Only scheduled or postponed surgery placements can be cancelled');
      }
      await tx.surgery.update({
        where: { id: existing.entityId },
        data: {
          status: 'Cancelled',
          cancellationReason: existing.reason,
          cancellationNotes: existing.notes,
          cancelledAt: now,
          cancelledById: actor.id,
          cancelledByName: actor.name,
        },
      });
      await auditLog({
        actor,
        action: 'cancel',
        entity: 'Surgery',
        entityId: existing.entityId,
        region: existing.region ?? undefined,
        campaignId: existing.campaignId ?? undefined,
        details: `Cancelled surgery placement for ${existing.entityLabel} via approved request ${existing.id}: ${existing.reason}`,
        before: surgery,
        after: { status: 'Cancelled', cancellationReason: existing.reason, cancellationNotes: existing.notes },
      }, tx);
    }

    if (parsed.data.resolution === 'Approved' && existing.entity === 'Surgery' && existing.requestType === 'archive') {
      const surgery = await tx.surgery.findUnique({ where: { id: existing.entityId } });
      if (surgery && !surgery.archivedAt) {
        const archiveReason = `Approved via change request — ${parsed.data.resolutionNote.trim()}`;
        await tx.surgery.update({
            where: { id: existing.entityId },
            data: { archivedAt: now, archivedById: actor.id, archivedByName: actor.name, archivedReason: archiveReason },
          });
      }
    }

      await auditLog({
      actor,
      action: 'resolve',
      entity: 'ChangeRequest',
      entityId: id,
      region: existing.region ?? undefined,
      campaignId: existing.campaignId ?? undefined,
      details: `Change request ${parsed.data.resolution.toLowerCase()} for ${existing.entity} ${existing.entityLabel}: ${parsed.data.resolutionNote}`,
      before: existing,
      after: resolved,
      }, tx);
      return resolved;
    });
    if (parsed.data.resolution === 'Approved' && (existing.requestType === 'archive' || existing.requestType === 'cancel_surgery')) {
      updateTag('surgeries');
      updateTag('patients');
    }
    updateTag('change-requests');
    return { ok: true, data: fromRow(row) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
