'use server';

import { getAllCampaigns, createCampaign, updateCampaign, deleteCampaign } from '@/lib/api/campaigns';
import { guard } from '@/lib/auth-server';
import type { Campaign } from '@/types';

export { getAllCampaigns };

type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

export async function actionCreateCampaign(
  data: Omit<Campaign, 'id' | 'createdAt'>
): Promise<ActionResult<Campaign>> {
  const denied = await guard('campaigns', 'create');
  if (denied) return denied;

  try {
    return { ok: true, data: await createCampaign(data) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionUpdateCampaign(
  id: string,
  data: Omit<Campaign, 'id' | 'createdAt'>
): Promise<ActionResult<Campaign>> {
  const denied = await guard('campaigns', 'edit');
  if (denied) return denied;

  try {
    return { ok: true, data: await updateCampaign(id, data) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionDeleteCampaign(id: string): Promise<ActionResult> {
  const denied = await guard('campaigns', 'delete');
  if (denied) return denied;

  try {
    await deleteCampaign(id);
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
