'use server';

import { getAllFollowUps, createFollowUp, updateFollowUp, deleteFollowUp, checkAndMarkOverdue } from '@/lib/api/follow_ups';
import type { FollowUp } from '@/types';

export { getAllFollowUps, checkAndMarkOverdue };

type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

export async function actionCreateFollowUp(
  data: Omit<FollowUp, 'id' | 'createdAt'>,
): Promise<ActionResult<FollowUp>> {
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
  try {
    return { ok: true, data: await updateFollowUp(id, data) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionDeleteFollowUp(id: string): Promise<ActionResult> {
  try {
    await deleteFollowUp(id);
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
