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
import { ACTIVE_FOLLOW_UP_PRISMA_MILESTONES } from '@/lib/follow-up-schedule';

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

type FollowUpTab = 'due' | 'overdue' | 'missed' | 'needs-review' | 'review-completed' | 'all';

export type FollowUpGroup = {
  surgeryId: string;
  patientId: string;
  patientCode?: string;
  patientName: string;
  region: string;
  campaignId: string;
  campaignRegionId?: string;
  followUps: FollowUp[];
};

function tabWhere(tab: FollowUpTab): Prisma.FollowUpWhereInput {
  const activeMilestones = { milestone: { in: ACTIVE_FOLLOW_UP_PRISMA_MILESTONES as never[] } };
  if (tab === 'due') return { ...activeMilestones, status: 'Due' as never };
  if (tab === 'overdue') return { ...activeMilestones, status: 'Overdue' as never };
  if (tab === 'missed') return { ...activeMilestones, status: 'Missed' as never };
  if (tab === 'needs-review') return { ...activeMilestones, needsDoctorReview: true, doctorReviewStatus: 'Pending' as never };
  if (tab === 'review-completed') return { ...activeMilestones, doctorReviewStatus: 'Completed' as never };
  return activeMilestones;
}

export async function getFollowUpTabCounts(): Promise<Record<FollowUpTab, number>> {
  const actor = await requireActor('followups', 'view');
  if ('error' in actor) throw new Error(actor.error);
  const base = scopedRegionWhere(actor);

  const [due, overdue, missed, needsReview, reviewCompleted, all] = await Promise.all([
    prisma.followUp.count({ where: { ...base, ...tabWhere('due') } }),
    prisma.followUp.count({ where: { ...base, ...tabWhere('overdue') } }),
    prisma.followUp.count({ where: { ...base, ...tabWhere('missed') } }),
    prisma.followUp.count({ where: { ...base, ...tabWhere('needs-review') } }),
    prisma.followUp.count({ where: { ...base, ...tabWhere('review-completed') } }),
    prisma.followUp.count({ where: base }),
  ]);

  return { due, overdue, missed, 'needs-review': needsReview, 'review-completed': reviewCompleted, all };
}

export async function getFollowUpsPaginated(params: {
  tab: FollowUpTab;
  search?: string;
  page: number;
  pageSize: number;
}): Promise<{ data: FollowUpGroup[]; total: number }> {
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
  const [pageGroups, allGroups] = await Promise.all([
    prisma.followUp.groupBy({
      by: ['surgeryId'],
      where,
      skip,
      take: pageSize,
      _min: { dueDate: true },
      orderBy: { _min: { dueDate: 'asc' } },
    }),
    prisma.followUp.groupBy({ by: ['surgeryId'], where }),
  ]);
  const surgeryIds = pageGroups.map((group) => group.surgeryId);
  if (surgeryIds.length === 0) return { data: [], total: allGroups.length };

  const rows = await prisma.followUp.findMany({
    where: {
      ...scopedRegionWhere(actor),
      surgeryId: { in: surgeryIds },
      milestone: { in: ACTIVE_FOLLOW_UP_PRISMA_MILESTONES as never[] },
    },
    include: { patient: { select: { patientCode: true } } },
    orderBy: [{ surgeryId: 'asc' }, { dueDate: 'asc' }],
  });

  const grouped = new Map<string, FollowUp[]>();
  rows.forEach((row) => {
    const item = followUpFromPrisma(row);
    grouped.set(item.surgeryId, [...(grouped.get(item.surgeryId) ?? []), item]);
  });

  const data = surgeryIds.flatMap((surgeryId) => {
    const followUps = grouped.get(surgeryId) ?? [];
    const first = followUps[0];
    if (!first) return [];
    return [{
      surgeryId,
      patientId: first.patientId,
      patientCode: first.patientCode,
      patientName: first.patientName,
      region: first.region,
      campaignId: first.campaignId,
      campaignRegionId: first.campaignRegionId,
      followUps,
    }];
  });

  return { data, total: allGroups.length };
}

type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

async function getSurgeryScope(surgeryId: string) {
  return prisma.surgery.findUnique({
    where: { id: surgeryId },
    include: { patient: { select: { patientCode: true } } },
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

    const followUp = {
      ...(await createFollowUp({
      ...data,
      region: surgery.region,
      patientId: surgery.patientId,
      patientCode: surgery.patient?.patientCode,
      patientName: surgery.patientName,
      campaignId: surgery.campaignId,
      campaignRegionId: surgery.campaignRegionId ?? undefined,
      completedById: data.status === 'Completed' ? actor.id : '',
      completedByName: data.status === 'Completed' ? actor.name : '',
      })),
      patientCode: surgery.patient?.patientCode,
    };
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

    const followUp = {
      ...(await updateFollowUp(id, {
      ...data,
      region: surgery.region,
      patientId: surgery.patientId,
      patientCode: surgery.patient?.patientCode,
      patientName: surgery.patientName,
      campaignId: surgery.campaignId,
      campaignRegionId: surgery.campaignRegionId ?? undefined,
      completedById: data.status === 'Completed' ? actor.id : data.status === 'Missed' ? '' : data.completedById,
      completedByName: data.status === 'Completed' ? actor.name : data.status === 'Missed' ? '' : data.completedByName,
      doctorReviewedAt: data.doctorReviewStatus === 'Completed' && !data.doctorReviewedAt
        ? new Date().toISOString()
        : data.doctorReviewedAt,
      })),
      patientCode: surgery.patient?.patientCode,
    };
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
        : followUp.status === 'Missed'
          ? `Marked follow-up missed for ${followUp.patientName}`
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
