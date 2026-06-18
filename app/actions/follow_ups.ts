'use server';

import { updateTag } from 'next/cache';
import { after } from 'next/server';
import {
  getAllFollowUps as fetchAllFollowUps,
  getAllMedications as fetchAllMedications,
  createFollowUp, updateFollowUp, deleteFollowUp,
  checkAndMarkOverdue as apiCheckAndMarkOverdue,
  getMedicationsForFollowUp as fetchMedications,
  createMedication, updateMedication, deleteMedication,
  fromPrisma as followUpFromPrisma,
} from '@/lib/api/follow_ups';
import { auditLog, ensureRegionAccess, requireActor, scopedRegionWhere } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import type { FollowUp, FollowUpMedication } from '@/types';
import type { Prisma } from '@/lib/generated/prisma/client';

export async function getAllFollowUps(): Promise<FollowUp[]> {
  const actor = await requireActor('followups', 'view');
  if ('error' in actor) throw new Error(actor.error);
  return fetchAllFollowUps(scopedRegionWhere(actor));
}

export async function getAllMedications(): Promise<FollowUpMedication[]> {
  const actor = await requireActor('followups', 'view');
  if ('error' in actor) throw new Error(actor.error);
  return fetchAllMedications(scopedRegionWhere(actor));
}

export async function checkAndMarkOverdue(): Promise<void> {
  const actor = await requireActor('followups', 'edit');
  if ('error' in actor) throw new Error(actor.error);
  await apiCheckAndMarkOverdue(scopedRegionWhere(actor));
}

export async function getMedicationsForFollowUp(followUpId: string): Promise<FollowUpMedication[]> {
  const actor = await requireActor('followups', 'view');
  if ('error' in actor) throw new Error(actor.error);
  const followUp = await prisma.followUp.findUnique({
    where: { id: followUpId },
    select: { region: true },
  });
  if (!followUp) throw new Error('Follow-up not found');
  const denied = ensureRegionAccess(actor, followUp.region);
  if (denied) throw new Error(denied.error);
  return fetchMedications(followUpId);
}

type FollowUpTab = 'due' | 'overdue' | 'needs-review' | 'review-completed' | 'all';

function tabWhere(tab: FollowUpTab): Prisma.FollowUpWhereInput {
  if (tab === 'due') return { status: { in: ['Pending', 'Due'] as never[] } };
  if (tab === 'overdue') return { status: 'Overdue' as never };
  if (tab === 'needs-review') return { needsDoctorReview: true, doctorReviewStatus: 'Pending' as never };
  if (tab === 'review-completed') return { doctorReviewStatus: 'Completed' as never };
  return {};
}

export async function getFollowUpTabCounts(): Promise<Record<FollowUpTab, number>> {
  const actor = await requireActor('followups', 'view');
  if ('error' in actor) throw new Error(actor.error);
  const base = scopedRegionWhere(actor);

  const [due, overdue, needsReview, reviewCompleted, all] = await Promise.all([
    prisma.followUp.count({ where: { ...base, ...tabWhere('due') } }),
    prisma.followUp.count({ where: { ...base, ...tabWhere('overdue') } }),
    prisma.followUp.count({ where: { ...base, ...tabWhere('needs-review') } }),
    prisma.followUp.count({ where: { ...base, ...tabWhere('review-completed') } }),
    prisma.followUp.count({ where: base }),
  ]);

  return { due, overdue, 'needs-review': needsReview, 'review-completed': reviewCompleted, all };
}

export async function getFollowUpsPaginated(params: {
  tab: FollowUpTab;
  search?: string;
  page: number;
  pageSize: number;
}): Promise<{ data: FollowUp[]; total: number }> {
  const actor = await requireActor('followups', 'view');
  if ('error' in actor) throw new Error(actor.error);

  const where: Prisma.FollowUpWhereInput = {
    ...scopedRegionWhere(actor),
    ...tabWhere(params.tab),
    ...(params.search && {
      OR: [
        { patientName: { contains: params.search, mode: 'insensitive' } },
        { region: { contains: params.search, mode: 'insensitive' } },
        { patient: { patientCode: { contains: params.search, mode: 'insensitive' } } },
      ],
    }),
  };

  const pageSize = Math.min(Math.max(1, params.pageSize), 200);
  const page = Math.max(1, params.page);
  const skip = (page - 1) * pageSize;
  const [rows, total] = await Promise.all([
    prisma.followUp.findMany({ where, skip, take: pageSize, orderBy: { dueDate: 'asc' } }),
    prisma.followUp.count({ where }),
  ]);

  return { data: rows.map(followUpFromPrisma), total };
}

type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

async function getSurgeryScope(surgeryId: string) {
  return prisma.surgery.findUnique({
    where: { id: surgeryId },
    select: { region: true, campaignId: true, campaignRegionId: true, patientId: true, patientName: true },
  });
}

export async function actionCreateFollowUp(
  data: Omit<FollowUp, 'id' | 'createdAt'>,
): Promise<ActionResult<FollowUp>> {
  const actor = await requireActor('followups', 'create');
  if ('error' in actor) return { ok: false, error: actor.error };

  try {
    if (!data.patientId || !data.surgeryId || !data.campaignId || !data.dueDate) {
      return { ok: false, error: 'Surgery, campaign, and due date are required' };
    }
    const surgery = await getSurgeryScope(data.surgeryId);
    if (!surgery) return { ok: false, error: 'Surgery not found' };
    const denied = ensureRegionAccess(actor, surgery.region);
    if (denied) return denied;

    const followUp = await createFollowUp({
      ...data,
      region: surgery.region,
      patientId: surgery.patientId,
      patientName: surgery.patientName,
      campaignId: surgery.campaignId,
      campaignRegionId: surgery.campaignRegionId ?? undefined,
      completedById: data.status === 'Completed' ? actor.id : '',
      completedByName: data.status === 'Completed' ? actor.name : '',
    });
    updateTag('follow-ups');
    after(() => auditLog({
      actor,
      action: 'create',
      entity: 'FollowUp',
      entityId: followUp.id,
      region: followUp.region,
      campaignId: followUp.campaignId,
      details: `Created follow-up for ${followUp.patientName}`,
      after: followUp,
    }));
    return { ok: true, data: followUp };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionUpdateFollowUp(
  id: string,
  data: Omit<FollowUp, 'id' | 'createdAt'>,
): Promise<ActionResult<FollowUp>> {
  const actor = await requireActor('followups', 'edit');
  if ('error' in actor) return { ok: false, error: actor.error };

  try {
    const before = await prisma.followUp.findUnique({ where: { id } });
    if (!before) return { ok: false, error: 'Follow-up not found' };
    const beforeDenied = ensureRegionAccess(actor, before.region);
    if (beforeDenied) return beforeDenied;

    const surgery = await getSurgeryScope(data.surgeryId);
    if (!surgery) return { ok: false, error: 'Surgery not found' };
    const denied = ensureRegionAccess(actor, surgery.region);
    if (denied) return denied;

    const followUp = await updateFollowUp(id, {
      ...data,
      region: surgery.region,
      patientId: surgery.patientId,
      patientName: surgery.patientName,
      campaignId: surgery.campaignId,
      campaignRegionId: surgery.campaignRegionId ?? undefined,
      completedById: data.status === 'Completed' ? actor.id : data.completedById,
      completedByName: data.status === 'Completed' ? actor.name : data.completedByName,
      doctorReviewedAt: data.doctorReviewStatus === 'Completed' && !data.doctorReviewedAt
        ? new Date().toISOString()
        : data.doctorReviewedAt,
    });
    updateTag('follow-ups');
    after(() => auditLog({
      actor,
      action: 'update',
      entity: 'FollowUp',
      entityId: followUp.id,
      region: followUp.region,
      campaignId: followUp.campaignId,
      details: followUp.status === 'Completed'
        ? `Completed follow-up for ${followUp.patientName}`
        : followUp.doctorReviewStatus === 'Completed'
          ? `Recorded doctor review for ${followUp.patientName}`
          : `Updated follow-up for ${followUp.patientName}`,
      before,
      after: followUp,
    }));
    return { ok: true, data: followUp };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionDeleteFollowUp(id: string): Promise<ActionResult> {
  const actor = await requireActor('followups', 'delete');
  if ('error' in actor) return { ok: false, error: actor.error };

  try {
    const before = await prisma.followUp.findUnique({ where: { id } });
    if (before) {
      const denied = ensureRegionAccess(actor, before.region);
      if (denied) return denied;
    }
    await deleteFollowUp(id);
    updateTag('follow-ups');
    after(() => auditLog({
      actor,
      action: 'delete',
      entity: 'FollowUp',
      entityId: id,
      region: before?.region,
      campaignId: before?.campaignId,
      details: before ? `Deleted follow-up for ${before.patientName}` : 'Deleted follow-up',
      before,
    }));
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionCreateMedication(
  data: Omit<FollowUpMedication, 'id' | 'createdAt'>,
): Promise<ActionResult<FollowUpMedication>> {
  const actor = await requireActor('followups', 'edit');
  if ('error' in actor) return { ok: false, error: actor.error };

  try {
    const followUp = await prisma.followUp.findUnique({ where: { id: data.followUpId }, select: { region: true } });
    if (!followUp) return { ok: false, error: 'Follow-up not found' };
    const denied = ensureRegionAccess(actor, followUp.region);
    if (denied) return denied;

    const med = await createMedication(data);
    updateTag('follow-ups');
    return { ok: true, data: med };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionUpdateMedication(
  id: string,
  data: Omit<FollowUpMedication, 'id' | 'createdAt'>,
): Promise<ActionResult<FollowUpMedication>> {
  const actor = await requireActor('followups', 'edit');
  if ('error' in actor) return { ok: false, error: actor.error };

  try {
    const existing = await prisma.followUpMedication.findUnique({
      where: { id },
      include: { followUp: { select: { region: true } } },
    });
    if (!existing) return { ok: false, error: 'Medication not found' };
    const denied = ensureRegionAccess(actor, existing.followUp.region);
    if (denied) return denied;

    const med = await updateMedication(id, data);
    updateTag('follow-ups');
    return { ok: true, data: med };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionDeleteMedication(id: string): Promise<ActionResult> {
  const actor = await requireActor('followups', 'edit');
  if ('error' in actor) return { ok: false, error: actor.error };

  try {
    const existing = await prisma.followUpMedication.findUnique({
      where: { id },
      include: { followUp: { select: { region: true } } },
    });
    if (existing) {
      const denied = ensureRegionAccess(actor, existing.followUp.region);
      if (denied) return denied;
    }
    await deleteMedication(id);
    updateTag('follow-ups');
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
