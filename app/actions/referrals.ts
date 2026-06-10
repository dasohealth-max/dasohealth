'use server';

import { getAllReferrals as fetchAllReferrals, createReferral, updateReferral, deleteReferral } from '@/lib/api/referrals';
import { guard } from '@/lib/auth-server';
import type { Referral } from '@/types';

export async function getAllReferrals(): Promise<Referral[]> {
  const denied = await guard('referrals', 'view');
  if (denied) throw new Error(denied.error);
  return fetchAllReferrals();
}

type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

export async function actionCreateReferral(
  data: Omit<Referral, 'id' | 'createdAt'>,
): Promise<ActionResult<Referral>> {
  const denied = await guard('referrals', 'create');
  if (denied) return denied;

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
  const denied = await guard('referrals', 'edit');
  if (denied) return denied;

  try {
    return { ok: true, data: await updateReferral(id, data) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionDeleteReferral(id: string): Promise<ActionResult> {
  const denied = await guard('referrals', 'delete');
  if (denied) return denied;

  try {
    await deleteReferral(id);
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
