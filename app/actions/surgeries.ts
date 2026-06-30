'use server';

import { z } from 'zod';
import { updateTag } from 'next/cache';
import { after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAllSurgeries as fetchAllSurgeries, createSurgery, updateSurgery, deleteSurgery, fromPrisma, attachScreeningResults } from '@/lib/api/surgeries';
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
}, scopedRegion?: string): Prisma.SurgeryWhereInput {
  const region = scopedRegion ?? (params.region || undefined);
  return {
    ...(region && { region }),
    ...(params.status && { status: surgeryStatusFromApp(params.status) as never }),
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
  page: number;
  pageSize: number;
}): Promise<{ data: Surgery[]; total: number }> {
  const actor = await requireActor('surgeries', 'view');
  if ('error' in actor) throw new Error(actor.error);
  const regionScope = scopedRegionWhere(actor) as { region?: string };
  const where = surgeryWhere(params, regionScope.region);

  const pageSize = Math.min(Math.max(1, params.pageSize), 200);
  const page = Math.max(1, params.page);
  const skip = (page - 1) * pageSize;
  const [rows, total] = await Promise.all([
    prisma.surgery.findMany({
      where,
      skip,
      take: pageSize,
      include: {
        patient: { select: SURGERY_PATIENT_SELECT },
      },
      orderBy: { scheduledAt: 'desc' },
    }),
    prisma.surgery.count({ where }),
  ]);

  return { data: await attachScreeningResults(rows), total };
}

export async function getPrintableWaitingSurgeries(params: {
  search?: string;
  region?: string;
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

async function createInitialFollowUps(surgery: Surgery, performedAt: string) {
  const base = new Date(performedAt);
  for (const rule of ACTIVE_FOLLOW_UP_SCHEDULE) {
    const exists = await prisma.followUp.findFirst({
      where: { surgeryId: surgery.id, milestone: rule.prismaMilestone as never },
      select: { id: true },
    });
    if (exists) continue;
    try {
      await prisma.followUp.create({
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

  const rows = await prisma.followUp.findMany({
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
    if (data.status === 'Completed' && !data.performedAt) {
      return { ok: false, error: 'Actual surgery completion date is required' };
    }

    const surgery = {
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
      })),
      patientCode: scope.patientCode,
    };
    if (surgery.status === 'Completed' && surgery.performedAt) {
      await createInitialFollowUps(surgery, surgery.performedAt);
      updateTag('follow-ups');
    }
    updateTag('surgeries');
    after(() => auditLog({
      actor,
      action: 'create',
      entity: 'Surgery',
      entityId: surgery.id,
      region: surgery.region,
      campaignId: surgery.campaignId,
      details: `Created surgery for ${surgery.patientName}`,
      after: surgery,
    }));
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

    const updated = {
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
      })),
      patientCode: scope.patientCode,
    };

    if (newStatusKey === 'Completed' && updated.performedAt) {
      await createInitialFollowUps(updated, updated.performedAt);
      updateTag('follow-ups');
    }
    updateTag('surgeries');
    after(() => auditLog({
      actor,
      action: 'update',
      entity: 'Surgery',
      entityId: updated.id,
      region: updated.region,
      campaignId: updated.campaignId,
      details: newStatusKey === 'Completed'
        ? `Marked surgery completed for ${updated.patientName}`
        : `Updated surgery for ${updated.patientName}`,
      before: fromPrisma(beforeRow),
      after: updated,
    }));
    return { ok: true, data: updated };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionDeleteSurgery(id: string): Promise<ActionResult> {
  const actor = await requireActor('surgeries', 'delete');
  if ('error' in actor) return { ok: false, error: actor.error };

  try {
    const before = await prisma.surgery.findUnique({ where: { id } });
    if (before) {
      const denied = ensureRegionAccess(actor, before.region);
      if (denied) return denied;
    }
    await deleteSurgery(id);
    updateTag('surgeries');
    after(() => auditLog({
      actor,
      action: 'delete',
      entity: 'Surgery',
      entityId: id,
      region: before?.region,
      campaignId: before?.campaignId,
      details: before ? `Deleted surgery for ${before.patientName}` : 'Deleted surgery',
      before,
    }));
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
