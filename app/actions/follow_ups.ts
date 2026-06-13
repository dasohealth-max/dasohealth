'use server';

import { getAllFollowUps as fetchAllFollowUps, createFollowUp, updateFollowUp, deleteFollowUp, checkAndMarkOverdue as apiCheckAndMarkOverdue } from '@/lib/api/follow_ups';
import { auditLog, ensureRegionAccess, requireActor, scopedRegionWhere } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import type { FollowUp } from '@/types';

export async function getAllFollowUps(): Promise<FollowUp[]> {
  const actor = await requireActor('followups', 'view');
  if ('error' in actor) throw new Error(actor.error);
  return fetchAllFollowUps(scopedRegionWhere(actor));
}

export async function checkAndMarkOverdue(): Promise<void> {
  const actor = await requireActor('followups', 'edit');
  if ('error' in actor) throw new Error(actor.error);
  return apiCheckAndMarkOverdue(scopedRegionWhere(actor));
}

type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

async function getSurgeryScope(surgeryId: string) {
  return prisma.surgery.findUnique({
    where: { id: surgeryId },
    select: { region: true, campaignId: true, patientId: true, patientName: true },
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
      completedById: data.status === 'Completed' ? actor.id : '',
      completedByName: data.status === 'Completed' ? actor.name : '',
    });
    await auditLog({
      actor,
      action: 'create',
      entity: 'FollowUp',
      entityId: followUp.id,
      region: followUp.region,
      campaignId: followUp.campaignId,
      details: `Created follow-up for ${followUp.patientName}`,
      after: followUp,
    });
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
      completedById: data.status === 'Completed' ? actor.id : data.completedById,
      completedByName: data.status === 'Completed' ? actor.name : data.completedByName,
    });
    await auditLog({
      actor,
      action: 'update',
      entity: 'FollowUp',
      entityId: followUp.id,
      region: followUp.region,
      campaignId: followUp.campaignId,
      details: followUp.status === 'Completed'
        ? `Completed follow-up for ${followUp.patientName}`
        : `Updated follow-up for ${followUp.patientName}`,
      before,
      after: followUp,
    });
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
    await auditLog({
      actor,
      action: 'delete',
      entity: 'FollowUp',
      entityId: id,
      region: before?.region,
      campaignId: before?.campaignId,
      details: before ? `Deleted follow-up for ${before.patientName}` : 'Deleted follow-up',
      before,
    });
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
