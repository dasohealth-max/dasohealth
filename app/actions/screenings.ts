'use server';

import { prisma } from '@/lib/prisma';
import { getAllScreenings as fetchAllScreenings, createScreening, updateScreening, deleteScreening } from '@/lib/api/screenings';
import { auditLog, ensureRegionAccess, requireActor, scopedRegionWhere } from '@/lib/auth-server';
import type { Screening } from '@/types';

export async function getAllScreenings(): Promise<Screening[]> {
  const actor = await requireActor('screening', 'view');
  if ('error' in actor) throw new Error(actor.error);
  return fetchAllScreenings(scopedRegionWhere(actor));
}

type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

async function deriveScope(data: Omit<Screening, 'id' | 'createdAt'>) {
  const patient = await prisma.patient.findUnique({
    where: { id: data.patientId },
    select: {
      id: true,
      fullName: true,
      campaignId: true,
      locationId: true,
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
    locationId: screening.locationId || null,
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
      locationId: scope.locationId ?? '',
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
    await auditLog({
      actor,
      action: 'create',
      entity: 'Screening',
      entityId: screening.id,
      region: screening.region,
      campaignId: screening.campaignId,
      details: `Completed screening for ${screening.patientName}`,
      after: screening,
    });
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
      locationId: scope.locationId ?? '',
      region: scope.region,
      operationDistrict: scope.operationDistrict,
      screenedBy: data.screenedBy || actor.name,
      screenedById: data.screenedById || actor.id,
      screenedByName: data.screenedByName || actor.name,
    });
    await routeSurgery(screening, data.vaRightUnaided);
    await auditLog({
      actor,
      action: 'update',
      entity: 'Screening',
      entityId: screening.id,
      region: screening.region,
      campaignId: screening.campaignId,
      details: `Updated screening for ${screening.patientName}`,
      before: beforeRow,
      after: screening,
    });
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
    await auditLog({
      actor,
      action: 'delete',
      entity: 'Screening',
      entityId: id,
      region: before?.region,
      campaignId: before?.campaignId,
      details: 'Deleted screening',
      before,
    });
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
