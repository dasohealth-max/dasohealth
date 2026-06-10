'use server';

import { getAllReferrals, createReferral, updateReferral, deleteReferral } from '@/lib/api/referrals';
import type { Referral } from '@/types';

export { getAllReferrals };

type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

export async function actionCreateReferral(
  data: Omit<Referral, 'id' | 'createdAt'>,
): Promise<ActionResult<Referral>> {
  try {
    if (!data.patientName.trim() || !data.campaignId || !data.locationId) {
      return { ok: false, error: 'Patient name, campaign, and location are required' };
    }
    return { ok: true, data: await createReferral(data) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionUpdateReferral(
  id: string,
  data: Omit<Referral, 'id' | 'createdAt'>,
): Promise<ActionResult<Referral>> {
  try {
    return { ok: true, data: await updateReferral(id, data) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionDeleteReferral(id: string): Promise<ActionResult> {
  try {
    await deleteReferral(id);
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
