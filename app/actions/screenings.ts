'use server';

import { z } from 'zod';
import { updateTag } from 'next/cache';
import { after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAllScreenings as fetchAllScreenings, createScreening, updateScreening, deleteScreening, fromPrisma as screeningFromPrisma } from '@/lib/api/screenings';
import { auditLog, ensureRegionAccess, requireActor, scopedRegionWhere } from '@/lib/auth-server';
import type { Screening } from '@/types';
import type { Prisma } from '@/lib/generated/prisma/client';

const VAGradeEnum = z.enum(['6/6', '6/9', '6/12', '6/18', '6/24', '6/36', '6/60', '<6/60', 'CF', 'HM', 'PL', 'NPL']);

const ScreeningSchema = z.object({
  patientId: z.string().min(1, 'Patient is required'),
  campaignId: z.string().min(1, 'Campaign is required'),
  screenedAt: z.string().min(1, 'Screening date is required'),
  vaRightUnaided: VAGradeEnum,
  vaLeftUnaided: VAGradeEnum,
  vaRightCorrected: VAGradeEnum.optional(),
  vaLeftCorrected: VAGradeEnum.optional(),
  iopRight: z.number().optional(),
  iopLeft: z.number().optional(),
  cataractSuspected: z.boolean(),
  glaucomaSuspected: z.boolean(),
  diabeticRetinopathy: z.boolean(),
  otherFindings: z.string(),
  medicalHistory: z.string(),
  currentMedications: z.string(),
  recommendation: z.enum(['No Surgery - Release', 'Refer for Surgery', 'Positive', 'Further Investigation', 'Glasses', 'Follow-up']),
  notes: z.string(),
  patientName: z.string().optional(),
  region: z.string().optional(),
  operationDistrict: z.string().optional(),
  screenedBy: z.string().optional(),
  screenedById: z.string().optional(),
  screenedByName: z.string().optional(),
});

export async function getAllScreenings(): Promise<Screening[]> {
  const actor = await requireActor('screening', 'view');
  if ('error' in actor) throw new Error(actor.error);
  return fetchAllScreenings(scopedRegionWhere(actor));
}

export async function getScreeningHistoryPaginated(params: {
  search?: string;
  page: number;
  pageSize: number;
}): Promise<{ data: Screening[]; total: number }> {
  const actor = await requireActor('screening', 'view');
  if ('error' in actor) throw new Error(actor.error);

  const where: Prisma.ScreeningWhereInput = {
    ...scopedRegionWhere(actor),
    ...(params.search && {
      OR: [
        { patientName: { contains: params.search, mode: 'insensitive' } },
        { region: { contains: params.search, mode: 'insensitive' } },
      ],
    }),
  };

  const pageSize = Math.min(Math.max(1, params.pageSize), 200);
  const page = Math.max(1, params.page);
  const skip = (page - 1) * pageSize;
  const [rows, total] = await Promise.all([
    prisma.screening.findMany({ where, skip, take: pageSize, orderBy: { screenedAt: 'desc' } }),
    prisma.screening.count({ where }),
  ]);

  return { data: rows.map(screeningFromPrisma), total };
}

type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

async function deriveScope(data: Omit<Screening, 'id' | 'createdAt'>) {
  const patient = await prisma.patient.findUnique({
    where: { id: data.patientId },
    select: {
      id: true,
      fullName: true,
      campaignId: true,
      region: true,
      operationDistrict: true,
    },
  });
  if (!patient?.campaignId) return null;
  return { ...patient, campaignId: patient.campaignId };
}

async function routeSurgery(screening: Screening, preOpVa: string) {
  if (screening.recommendation !== 'Refer for Surgery') return;
  const existing = await prisma.surgery.findFirst({
    where: { createdFromScreeningId: screening.id },
    select: { id: true },
  });

  const data = {
    patientId: screening.patientId,
    patientName: screening.patientName,
    campaignId: screening.campaignId,
    region: screening.region,
    operationDistrict: screening.operationDistrict,
    createdFromScreeningId: screening.id,
    eye: 'Left' as never,
    lensType: 'FoldableAcrylic' as never,
    scheduledAt: new Date(Date.now() + 7 * 86400_000),
    status: 'Scheduled' as never,
    preOpVa,
    complications: '',
    intraopNotes: `Created automatically from screening by ${screening.screenedByName || screening.screenedBy}. ${screening.notes}`.trim(),
  };

  if (existing) {
    await prisma.surgery.update({ where: { id: existing.id }, data });
  } else {
    await prisma.surgery.create({ data });
  }
}

export async function actionCreateScreening(
  data: Omit<Screening, 'id' | 'createdAt'>,
): Promise<ActionResult<Screening>> {
  const actor = await requireActor('screening', 'create');
  if ('error' in actor) return { ok: false, error: actor.error };

  const parsed = ScreeningSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    if (!data.patientId || !data.campaignId) {
      return { ok: false, error: 'Patient and campaign are required' };
    }
    const scope = await deriveScope(data);
    if (!scope) return { ok: false, error: 'Patient campaign not found' };
    const denied = ensureRegionAccess(actor, scope.region);
    if (denied) return denied;

    const screening = await createScreening({
      ...data,
      patientId: scope.id,
      patientName: scope.fullName,
      campaignId: scope.campaignId,
      region: scope.region,
      operationDistrict: scope.operationDistrict,
      screenedBy: actor.name,
      screenedById: actor.id,
      screenedByName: actor.name,
    });
    await prisma.patient.update({
      where: { id: data.patientId },
      data: { screeningStatus: 'Screened' },
    });
    await routeSurgery(screening, data.vaRightUnaided);
    updateTag('screenings');
    updateTag('patients');
    updateTag('surgeries');
    after(() => auditLog({
      actor,
      action: 'create',
      entity: 'Screening',
      entityId: screening.id,
      region: screening.region,
      campaignId: screening.campaignId,
      details: `Completed screening for ${screening.patientName}`,
      after: screening,
    }));
    return { ok: true, data: screening };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionUpdateScreening(
  id: string,
  data: Omit<Screening, 'id' | 'createdAt'>,
): Promise<ActionResult<Screening>> {
  const actor = await requireActor('screening', 'edit');
  if ('error' in actor) return { ok: false, error: actor.error };

  const parsed = ScreeningSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    if (!data.patientId || !data.campaignId) {
      return { ok: false, error: 'Patient and campaign are required' };
    }
    const beforeRow = await prisma.screening.findUnique({ where: { id } });
    if (!beforeRow) return { ok: false, error: 'Screening not found' };
    const beforeDenied = ensureRegionAccess(actor, beforeRow.region);
    if (beforeDenied) return beforeDenied;

    const scope = await deriveScope(data);
    if (!scope) return { ok: false, error: 'Patient campaign not found' };
    const denied = ensureRegionAccess(actor, scope.region);
    if (denied) return denied;

    const screening = await updateScreening(id, {
      ...data,
      patientId: scope.id,
      patientName: scope.fullName,
      campaignId: scope.campaignId,
      region: scope.region,
      operationDistrict: scope.operationDistrict,
      screenedBy: data.screenedBy || actor.name,
      screenedById: data.screenedById || actor.id,
      screenedByName: data.screenedByName || actor.name,
    });
    await routeSurgery(screening, data.vaRightUnaided);
    updateTag('screenings');
    updateTag('patients');
    updateTag('surgeries');
    after(() => auditLog({
      actor,
      action: 'update',
      entity: 'Screening',
      entityId: screening.id,
      region: screening.region,
      campaignId: screening.campaignId,
      details: `Updated screening for ${screening.patientName}`,
      before: beforeRow,
      after: screening,
    }));
    return { ok: true, data: screening };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionDeleteScreening(id: string): Promise<ActionResult> {
  const actor = await requireActor('screening', 'delete');
  if ('error' in actor) return { ok: false, error: actor.error };

  try {
    const before = await prisma.screening.findUnique({ where: { id } });
    if (before) {
      const denied = ensureRegionAccess(actor, before.region);
      if (denied) return denied;
    }
    await deleteScreening(id);
    updateTag('screenings');
    after(() => auditLog({
      actor,
      action: 'delete',
      entity: 'Screening',
      entityId: id,
      region: before?.region,
      campaignId: before?.campaignId,
      details: 'Deleted screening',
      before,
    }));
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
