'use server';

import { getAllFollowUps as fetchAllFollowUps, createFollowUp, updateFollowUp, deleteFollowUp, checkAndMarkOverdue as apiCheckAndMarkOverdue } from '@/lib/api/follow_ups';
import { guard } from '@/lib/auth-server';
import type { FollowUp } from '@/types';

export async function getAllFollowUps(): Promise<FollowUp[]> {
  const denied = await guard('followups', 'view');
  if (denied) throw new Error(denied.error);
  return fetchAllFollowUps();
}

export async function checkAndMarkOverdue(): Promise<void> {
  const denied = await guard('followups', 'edit');
  if (denied) throw new Error(denied.error);
  return apiCheckAndMarkOverdue();
}

type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

export async function actionCreateFollowUp(
  data: Omit<FollowUp, 'id' | 'createdAt'>,
): Promise<ActionResult<FollowUp>> {
  const denied = await guard('followups', 'create');
  if (denied) return denied;

  try {
    if (!data.patientId || !data.surgeryId || !data.campaignId || !data.dueDate) {
      return { ok: false, error: 'Surgery, campaign, and due date are required' };
    }
    return { ok: true, data: await createFollowUp(data) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionUpdateFollowUp(
  id: string,
  data: Omit<FollowUp, 'id' | 'createdAt'>,
): Promise<ActionResult<FollowUp>> {
  const denied = await guard('followups', 'edit');
  if (denied) return denied;

  try {
    return { ok: true, data: await updateFollowUp(id, data) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionDeleteFollowUp(id: string): Promise<ActionResult> {
  const denied = await guard('followups', 'delete');
  if (denied) return denied;

  try {
    await deleteFollowUp(id);
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
