'use server';

import { z } from 'zod';
import { updateTag } from 'next/cache';
import { after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAllSurgeries as fetchAllSurgeries, createSurgery, updateSurgery, deleteSurgery, fromPrisma, attachScreeningResults } from '@/lib/api/surgeries';
import { surgeryStatusFromApp } from '@/lib/prisma-enums';
import { auditLog, ensureRegionAccess, requireActor, scopedRegionWhere } from '@/lib/auth-server';
import type { Surgery } from '@/types';
import { Prisma } from '@/lib/generated/prisma/client';

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

  const where: Prisma.SurgeryWhereInput = {
    ...scopedRegionWhere(actor),
    ...(params.region && { region: params.region }),
    ...(params.status && { status: surgeryStatusFromApp(params.status) as never }),
    ...(params.search && {
      OR: [
        { patientName: { contains: params.search, mode: 'insensitive' } },
        { region: { contains: params.search, mode: 'insensitive' } },
        { surgeonName: { contains: params.search, mode: 'insensitive' } },
        { patient: { patientCode: { contains: params.search, mode: 'insensitive' } } },
      ],
    }),
  };

  const pageSize = Math.min(Math.max(1, params.pageSize), 200);
  const page = Math.max(1, params.page);
  const skip = (page - 1) * pageSize;
  const [rows, total] = await Promise.all([
    prisma.surgery.findMany({
      where,
      skip,
      take: pageSize,
      include: { patient: { select: { patientCode: true } } },
      orderBy: { scheduledAt: 'desc' },
    }),
    prisma.surgery.count({ where }),
  ]);

  return { data: await attachScreeningResults(rows), total };
}

type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };
const REQUIRED_FOLLOW_UP_MILESTONES = [
  ['Day1', 1],
  ['Week1', 7],
  ['Month1', 30],
] as const;

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

async function createInitialFollowUps(surgery: Surgery, performedAt: string) {
  const base = new Date(performedAt);
  for (const [milestone, days] of REQUIRED_FOLLOW_UP_MILESTONES) {
    const exists = await prisma.followUp.findFirst({
      where: { surgeryId: surgery.id, milestone: milestone as never },
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
          milestone: milestone as never,
          dueDate: new Date(base.getTime() + days * 86400_000),
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
  const missing = REQUIRED_FOLLOW_UP_MILESTONES
    .map(([milestone]) => milestone)
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
      surgeonName: scope.campaignRegion?.doctorName || beforeRow.surgeonName || data.surgeonName.trim() || '',
      eye: beforeRow.eye as Surgery['eye'],
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
