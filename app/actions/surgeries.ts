'use server';

import { prisma } from '@/lib/prisma';
import { getAllSurgeries as fetchAllSurgeries, createSurgery, updateSurgery, deleteSurgery, fromPrisma } from '@/lib/api/surgeries';
import { surgeryStatusFromApp } from '@/lib/prisma-enums';
import { auditLog, ensureRegionAccess, requireActor, scopedRegionWhere } from '@/lib/auth-server';
import type { Surgery } from '@/types';

export async function getAllSurgeries(): Promise<Surgery[]> {
  const actor = await requireActor('surgeries', 'view');
  if ('error' in actor) throw new Error(actor.error);
  return fetchAllSurgeries(scopedRegionWhere(actor));
}

type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

async function deriveScope(data: Omit<Surgery, 'id' | 'createdAt'>) {
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
  return patient?.campaignId ? { ...patient, campaignId: patient.campaignId } : null;
}

async function createInitialFollowUps(surgery: Surgery, performedAt: string) {
  const base = new Date(performedAt);
  const milestones: [string, number][] = [['Day1', 1], ['Week1', 7]];
  for (const [milestone, days] of milestones) {
    const exists = await prisma.followUp.findFirst({
      where: { surgeryId: surgery.id, milestone: milestone as never },
      select: { id: true },
    });
    if (exists) continue;
    await prisma.followUp.create({
      data: {
        patientId: surgery.patientId,
        patientName: surgery.patientName,
        surgeryId: surgery.id,
        campaignId: surgery.campaignId,
        region: surgery.region,
        milestone: milestone as never,
        dueDate: new Date(base.getTime() + days * 86400_000),
        status: 'Pending' as never,
        needsDoctorReview: false,
        complications: '',
        notes: '',
      },
    });
  }
}

export async function actionCreateSurgery(
  data: Omit<Surgery, 'id' | 'createdAt'>,
): Promise<ActionResult<Surgery>> {
  const actor = await requireActor('surgeries', 'create');
  if ('error' in actor) return { ok: false, error: actor.error };

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

    const surgery = await createSurgery({
      ...data,
      patientId: scope.id,
      patientName: scope.fullName,
      campaignId: scope.campaignId,
      region: scope.region,
      operationDistrict: scope.operationDistrict,
      completedById: data.status === 'Completed' ? actor.id : '',
      completedByName: data.status === 'Completed' ? actor.name : '',
    });
    if (surgery.status === 'Completed' && surgery.performedAt) {
      await createInitialFollowUps(surgery, surgery.performedAt);
    }
    await auditLog({
      actor,
      action: 'create',
      entity: 'Surgery',
      entityId: surgery.id,
      region: surgery.region,
      campaignId: surgery.campaignId,
      details: `Created surgery for ${surgery.patientName}`,
      after: surgery,
    });
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

    const updated = await updateSurgery(id, {
      ...data,
      patientId: scope.id,
      patientName: scope.fullName,
      campaignId: scope.campaignId,
      region: scope.region,
      operationDistrict: scope.operationDistrict,
      completedById: newStatusKey === 'Completed' ? actor.id : data.completedById,
      completedByName: newStatusKey === 'Completed' ? actor.name : data.completedByName,
    });

    if (newStatusKey === 'Completed' && beforeRow.status !== ('Completed' as never) && updated.performedAt) {
      await createInitialFollowUps(updated, updated.performedAt);
    }

    await auditLog({
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
    });
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
    await auditLog({
      actor,
      action: 'delete',
      entity: 'Surgery',
      entityId: id,
      region: before?.region,
      campaignId: before?.campaignId,
      details: before ? `Deleted surgery for ${before.patientName}` : 'Deleted surgery',
      before,
    });
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
