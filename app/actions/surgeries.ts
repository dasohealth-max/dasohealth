'use server';

import { z } from 'zod';
import { updateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getAllSurgeries as fetchAllSurgeries, createSurgery, updateSurgery, fromPrisma, attachScreeningResults } from '@/lib/api/surgeries';
import { surgeryStatusFromApp, vaGradeToApp } from '@/lib/prisma-enums';
import { auditLog, ensureRegionAccess, requireActor, scopedRegionWhere } from '@/lib/auth-server';
import type { Surgery } from '@/types';
import { Prisma } from '@/lib/generated/prisma/client';
import { ACTIVE_FOLLOW_UP_SCHEDULE, addDays as addScheduleDays } from '@/lib/follow-up-schedule';

const PRINT_LIMIT = 1000;

const SurgerySchema = z.object({
  patientId: z.string().min(1, 'Patient is required'),
  campaignId: z.string().min(1, 'Campaign is required'),
  createdFromScreeningId: z.string().optional(),
  surgeonName: z.string(),
  eye: z.enum(['Right', 'Left', 'Both']),
  lensType: z.enum(['PMMA', 'Foldable Acrylic', 'Hydrophilic', 'Hydrophobic']),
  scheduledAt: z.string().min(1, 'Scheduled date is required'),
  performedAt: z.string().optional(),
  status: z.enum(['Scheduled', 'Completed', 'Cancelled', 'Postponed']),
  preOpVA: z.string(),
  postOpVA: z.string().optional(),
  complications: z.string(),
  intraopNotes: z.string(),
  patientName: z.string().optional(),
  region: z.string().optional(),
  operationDistrict: z.string().optional(),
  completedById: z.string().optional(),
  completedByName: z.string().optional(),
});

const SURGERY_PATIENT_SELECT = {
  patientCode: true,
  phone: true,
  emergencyPhone: true,
  dateOfBirth: true,
  birthDateSource: true,
  ageYearsAtRegistration: true,
} as const;

function surgeryWhere(params: {
  search?: string;
  region?: string;
  status?: string;
  statuses?: string[];
  scheduledFrom?: string;
  scheduledTo?: string;
  performedFrom?: string;
  performedTo?: string;
}, scopedRegion?: string): Prisma.SurgeryWhereInput {
  const region = scopedRegion ?? (params.region || undefined);

  const statusClause = params.statuses && params.statuses.length > 0
    ? { status: { in: params.statuses.map((s) => surgeryStatusFromApp(s)) as never[] } }
    : params.status
      ? { status: surgeryStatusFromApp(params.status) as never }
      : {};

  const scheduledAtClause = (params.scheduledFrom || params.scheduledTo) ? {
    scheduledAt: {
      ...(params.scheduledFrom ? { gte: new Date(params.scheduledFrom) } : {}),
      ...(params.scheduledTo ? { lte: new Date(params.scheduledTo + 'T23:59:59.999Z') } : {}),
    },
  } : {};

  const performedAtClause = (params.performedFrom || params.performedTo) ? {
    performedAt: {
      ...(params.performedFrom ? { gte: new Date(params.performedFrom) } : {}),
      ...(params.performedTo ? { lte: new Date(params.performedTo + 'T23:59:59.999Z') } : {}),
    },
  } : {};

  return {
    archivedAt: null,
    ...(region && { region }),
    ...statusClause,
    ...scheduledAtClause,
    ...performedAtClause,
    ...(params.search && {
      OR: [
        { patientName: { contains: params.search, mode: 'insensitive' } },
        { region: { contains: params.search, mode: 'insensitive' } },
        { surgeonName: { contains: params.search, mode: 'insensitive' } },
        { patient: { patientCode: { contains: params.search, mode: 'insensitive' } } },
        { patient: { phone: { contains: params.search } } },
      ],
    }),
  };
}

export async function getAllSurgeries(): Promise<Surgery[]> {
  const actor = await requireActor('surgeries', 'view');
  if ('error' in actor) throw new Error(actor.error);
  return fetchAllSurgeries(scopedRegionWhere(actor));
}

export async function getSurgeriesPaginated(params: {
  search?: string;
  region?: string;
  status?: string;
  statuses?: string[];
  scheduledFrom?: string;
  scheduledTo?: string;
  performedFrom?: string;
  performedTo?: string;
  page: number;
  pageSize: number;
  sortAsc?: boolean;
}): Promise<{ data: Surgery[]; total: number; patientTotal: number }> {
  const actor = await requireActor('surgeries', 'view');
  if ('error' in actor) throw new Error(actor.error);
  const regionScope = scopedRegionWhere(actor) as { region?: string };
  const where = surgeryWhere(params, regionScope.region);

  const pageSize = Math.min(Math.max(1, params.pageSize), 200);
  const page = Math.max(1, params.page);
  const skip = (page - 1) * pageSize;
  const [rows, total, patientGroups] = await Promise.all([
    prisma.surgery.findMany({
      where,
      skip,
      take: pageSize,
      include: {
        patient: { select: SURGERY_PATIENT_SELECT },
      },
      orderBy: { scheduledAt: params.sortAsc ? 'asc' : 'desc' },
    }),
    prisma.surgery.count({ where }),
    prisma.surgery.groupBy({
      by: ['patientId'],
      where,
    }),
  ]);

  return { data: await attachScreeningResults(rows), total, patientTotal: patientGroups.length };
}

export async function getPrintableWaitingSurgeries(params: {
  search?: string;
  region?: string;
  scheduledFrom?: string;
  scheduledTo?: string;
}): Promise<{ data: Surgery[]; total: number; truncated: boolean; limit: number }> {
  const actor = await requireActor('surgeries', 'view');
  if ('error' in actor) throw new Error(actor.error);

  const regionScope = scopedRegionWhere(actor) as { region?: string };
  const where = surgeryWhere({ ...params, status: 'Scheduled' }, regionScope.region);

  const [rows, total] = await Promise.all([
    prisma.surgery.findMany({
      where,
      take: PRINT_LIMIT,
      include: { patient: { select: SURGERY_PATIENT_SELECT } },
      orderBy: { scheduledAt: 'asc' },
    }),
    prisma.surgery.count({ where }),
  ]);

  return {
    data: await attachScreeningResults(rows),
    total,
    truncated: total > rows.length,
    limit: PRINT_LIMIT,
  };
}

export async function getPrintableHistorySurgeries(params: {
  search?: string;
  region?: string;
  performedFrom?: string;
  performedTo?: string;
}): Promise<{ data: Surgery[]; total: number; truncated: boolean; limit: number }> {
  const actor = await requireActor('surgeries', 'view');
  if ('error' in actor) throw new Error(actor.error);

  const regionScope = scopedRegionWhere(actor) as { region?: string };
  const where = surgeryWhere(
    { ...params, statuses: ['Completed', 'Cancelled', 'Postponed'] },
    regionScope.region,
  );

  const [rows, total] = await Promise.all([
    prisma.surgery.findMany({
      where,
      take: PRINT_LIMIT,
      include: { patient: { select: SURGERY_PATIENT_SELECT } },
      orderBy: { scheduledAt: 'desc' },
    }),
    prisma.surgery.count({ where }),
  ]);

  return {
    data: await attachScreeningResults(rows),
    total,
    truncated: total > rows.length,
    limit: PRINT_LIMIT,
  };
}

type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };
function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

async function deriveScope(data: Omit<Surgery, 'id' | 'createdAt'>) {
  const patient = await prisma.patient.findUnique({
    where: { id: data.patientId },
    select: {
      id: true,
      patientCode: true,
      fullName: true,
      campaignId: true,
      campaignRegionId: true,
      region: true,
      operationDistrict: true,
      campaignRegion: { select: { doctorName: true } },
    },
  });
  return patient?.campaignId ? { ...patient, campaignId: patient.campaignId } : null;
}

function preOpVaForScreeningEye(screening: {
  eye: string;
  vaRightUnaided: unknown;
  vaLeftUnaided: unknown;
}) {
  const right = vaGradeToApp(String(screening.vaRightUnaided));
  const left = vaGradeToApp(String(screening.vaLeftUnaided));
  if (screening.eye === 'Right') return right;
  if (screening.eye === 'Left') return left;
  return `Right: ${right} / Left: ${left}`;
}

async function getLinkedScreeningForSurgery(screeningId?: string | null) {
  if (!screeningId) return null;
  return prisma.screening.findUnique({
    where: { id: screeningId },
    select: { id: true, eye: true, vaRightUnaided: true, vaLeftUnaided: true },
  });
}

async function createInitialFollowUps(
  surgery: Surgery,
  performedAt: string,
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const base = new Date(performedAt);
  for (const rule of ACTIVE_FOLLOW_UP_SCHEDULE) {
    const exists = await db.followUp.findFirst({
      where: { surgeryId: surgery.id, milestone: rule.prismaMilestone as never },
      select: { id: true },
    });
    if (exists) continue;
    try {
      await db.followUp.create({
        data: {
          patientId: surgery.patientId,
          patientName: surgery.patientName,
          surgeryId: surgery.id,
          campaignId: surgery.campaignId,
          campaignRegionId: surgery.campaignRegionId,
          region: surgery.region,
          milestone: rule.prismaMilestone as never,
          dueDate: addScheduleDays(base, rule.dueOffsetDays),
          status: 'Pending' as never,
          needsDoctorReview: false,
          doctorReviewStatus: 'NotNeeded' as never,
          complications: '',
          notes: '',
          doctorName: surgery.surgeonName,
          doctorDiagnosis: '',
          doctorTreatmentPlan: '',
          doctorNotes: '',
        },
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
    }
  }

  const rows = await db.followUp.findMany({
    where: { surgeryId: surgery.id },
    select: { milestone: true },
  });
  const existingMilestones = new Set(rows.map((row) => String(row.milestone)));
  const missing = ACTIVE_FOLLOW_UP_SCHEDULE
    .map((rule) => rule.prismaMilestone)
    .filter((milestone) => !existingMilestones.has(milestone));
  if (missing.length > 0) {
    throw new Error(`Missing follow-up milestones after surgery completion: ${missing.join(', ')}`);
  }
}

export async function actionCreateSurgery(
  data: Omit<Surgery, 'id' | 'createdAt'>,
): Promise<ActionResult<Surgery>> {
  const actor = await requireActor('surgeries', 'create');
  if ('error' in actor) return { ok: false, error: actor.error };

  const parsed = SurgerySchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    if (!data.patientId || !data.campaignId) {
      return { ok: false, error: 'Patient and campaign are required' };
    }
    const scope = await deriveScope(data);
    if (!scope) return { ok: false, error: 'Patient campaign not found' };
    const denied = ensureRegionAccess(actor, scope.region);
    if (denied) return denied;

    const existingSurgery = await prisma.surgery.findFirst({
      where: { patientId: data.patientId, status: { notIn: ['Cancelled'] as never[] } },
      select: { id: true, status: true },
    });
    if (existingSurgery) {
      return { ok: false, error: 'This patient already has a surgery record — update the existing surgery instead of creating a new one' };
    }

    if (data.status === 'Completed' && !data.performedAt) {
      return { ok: false, error: 'Actual surgery completion date is required' };
    }

    const surgery = await prisma.$transaction(async (tx) => {
      const created = {
      ...(await createSurgery({
      ...data,
      patientId: scope.id,
      patientName: scope.fullName,
      patientCode: scope.patientCode,
      campaignId: scope.campaignId,
      campaignRegionId: scope.campaignRegionId ?? undefined,
      region: scope.region,
      operationDistrict: scope.operationDistrict,
      surgeonName: scope.campaignRegion?.doctorName || data.surgeonName.trim() || '',
      completedById: data.status === 'Completed' ? actor.id : '',
      completedByName: data.status === 'Completed' ? actor.name : '',
      }, tx)),
      patientCode: scope.patientCode,
      };
      if (created.status === 'Completed' && created.performedAt) {
        await createInitialFollowUps(created, created.performedAt, tx);
      }
      await auditLog({
        actor,
        action: 'create',
        entity: 'Surgery',
        entityId: created.id,
        region: created.region,
        campaignId: created.campaignId,
        details: `Created surgery for ${created.patientName}`,
        after: created,
      }, tx);
      return created;
    });
    if (surgery.status === 'Completed' && surgery.performedAt) {
      updateTag('follow-ups');
    }
    updateTag('surgeries');
    return { ok: true, data: surgery };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionUpdateSurgery(
  id: string,
  data: Omit<Surgery, 'id' | 'createdAt'>,
): Promise<ActionResult<Surgery>> {
  const actor = await requireActor('surgeries', 'edit');
  if ('error' in actor) return { ok: false, error: actor.error };

  const parsed = SurgerySchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    const beforeRow = await prisma.surgery.findUnique({ where: { id } });
    if (!beforeRow) return { ok: false, error: 'Surgery not found' };
    const beforeDenied = ensureRegionAccess(actor, beforeRow.region);
    if (beforeDenied) return beforeDenied;

    const scope = await deriveScope(data);
    if (!scope) return { ok: false, error: 'Patient campaign not found' };
    const denied = ensureRegionAccess(actor, scope.region);
    if (denied) return denied;

    const newStatusKey = surgeryStatusFromApp(data.status);
    if (newStatusKey === 'Completed' && !data.performedAt) {
      return { ok: false, error: 'Actual surgery completion date is required' };
    }
    const linkedScreeningId = data.createdFromScreeningId || beforeRow.createdFromScreeningId;
    const linkedScreening = await getLinkedScreeningForSurgery(linkedScreeningId);
    const shouldSyncFromScreening = linkedScreening && String(beforeRow.status) !== 'Completed';
    const eye = shouldSyncFromScreening
      ? (linkedScreening.eye as Surgery['eye'])
      : (beforeRow.eye as Surgery['eye']);
    const preOpVA = shouldSyncFromScreening
      ? preOpVaForScreeningEye(linkedScreening)
      : data.preOpVA;

    const updated = await prisma.$transaction(async (tx) => {
      const result = {
      ...(await updateSurgery(id, {
      ...data,
      patientId: scope.id,
      patientName: scope.fullName,
      patientCode: scope.patientCode,
      campaignId: scope.campaignId,
      campaignRegionId: scope.campaignRegionId ?? undefined,
      region: scope.region,
      operationDistrict: scope.operationDistrict,
      createdFromScreeningId: linkedScreeningId ?? undefined,
      surgeonName: scope.campaignRegion?.doctorName || beforeRow.surgeonName || data.surgeonName.trim() || '',
      eye,
      preOpVA,
      completedById: newStatusKey === 'Completed' ? actor.id : data.completedById,
      completedByName: newStatusKey === 'Completed' ? actor.name : data.completedByName,
      }, tx)),
      patientCode: scope.patientCode,
      };

      if (newStatusKey === 'Completed' && result.performedAt) {
        await createInitialFollowUps(result, result.performedAt, tx);
      }
      await auditLog({
        actor,
        action: 'update',
        entity: 'Surgery',
        entityId: result.id,
        region: result.region,
        campaignId: result.campaignId,
        details: newStatusKey === 'Completed'
          ? `Marked surgery completed for ${result.patientName}`
          : `Updated surgery for ${result.patientName}`,
        before: fromPrisma(beforeRow),
        after: result,
      }, tx);
      return result;
    });

    if (newStatusKey === 'Completed' && updated.performedAt) {
      updateTag('follow-ups');
    }
    updateTag('surgeries');
    return { ok: true, data: updated };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionDeleteSurgery(_id: string): Promise<ActionResult> {
  void _id;
  // Hard deletion of surgery records is permanently blocked to preserve accountability.
  // Super Administrators must use actionArchiveSurgery with a mandatory reason instead.
  return {
    ok: false,
    error: 'Surgery records cannot be permanently deleted. Contact your Super Administrator to archive this record if a correction is needed.',
  };
}

export async function actionRemoveSurgeryPatient(
  surgeryId: string,
  reason: string,
  notes?: string,
): Promise<ActionResult<null>> {
  return actionCancelSurgeryPlacement(surgeryId, reason, notes);
}

export async function actionCancelSurgeryPlacement(
  surgeryId: string,
  reason: string,
  notes?: string,
): Promise<ActionResult<null>> {
  const actor = await requireActor('surgeries', 'delete');
  if ('error' in actor) return { ok: false, error: actor.error };
  if (actor.role !== 'Super Administrator') {
    return { ok: false, error: 'Only Super Administrators can cancel surgery placements directly' };
  }
  const cancellationReason = reason.trim();
  const cancellationNotes = notes?.trim() ?? '';
  if (!cancellationReason) return { ok: false, error: 'Cancellation reason is required' };
  if (cancellationReason === 'Other reason' && !cancellationNotes) {
    return { ok: false, error: 'Additional notes are required for Other reason' };
  }

  try {
    const surgery = await prisma.surgery.findUnique({ where: { id: surgeryId } });
    if (!surgery) return { ok: false, error: 'Surgery record not found' };
    if (surgery.archivedAt) return { ok: false, error: 'This surgery is already archived' };
    if (String(surgery.status) !== 'Scheduled') {
      return { ok: false, error: 'Only patients in the waiting queue (Scheduled status) can be removed this way' };
    }
    const denied = ensureRegionAccess(actor, surgery.region);
    if (denied) return denied;

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.surgery.update({
        where: { id: surgeryId },
        data: {
          status: 'Cancelled',
          cancellationReason,
          cancellationNotes,
          cancelledAt: now,
          cancelledById: actor.id,
          cancelledByName: actor.name,
        },
      });

      await auditLog({
        actor, action: 'cancel', entity: 'Surgery', entityId: surgeryId,
        region: surgery.region, campaignId: surgery.campaignId,
        details: `Cancelled surgery placement — ${cancellationReason}${cancellationNotes ? ` — ${cancellationNotes}` : ''} (patient: ${surgery.patientName})`,
        before: surgery,
      }, tx);
    });

    updateTag('surgeries');

    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionArchiveSurgery(id: string, reason: string): Promise<ActionResult> {
  const actor = await requireActor('surgeries', 'delete');
  if ('error' in actor) return { ok: false, error: actor.error };
  if (actor.role !== 'Super Administrator') {
    return { ok: false, error: 'Only Super Administrators can archive surgery records' };
  }
  if (!reason.trim()) return { ok: false, error: 'Archive reason is required' };

  try {
    const before = await prisma.surgery.findUnique({ where: { id } });
    if (!before) return { ok: false, error: 'Surgery not found' };
    const denied = ensureRegionAccess(actor, before.region);
    if (denied) return denied;
    if (before.archivedAt) return { ok: false, error: 'Surgery is already archived' };

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.surgery.update({
        where: { id },
        data: {
          archivedAt: now,
          archivedById: actor.id,
          archivedByName: actor.name,
          archivedReason: reason.trim(),
        },
      });
      await auditLog({
        actor,
        action: 'archive',
        entity: 'Surgery',
        entityId: id,
        region: before.region,
        campaignId: before.campaignId,
        details: `Archived surgery for ${before.patientName} — reason: ${reason.trim()}`,
        before,
        after: { archivedAt: now, archivedById: actor.id, archivedReason: reason.trim() },
      }, tx);
    });
    updateTag('surgeries');
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
