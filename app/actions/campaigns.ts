'use server';

import { z } from 'zod';
import { updateTag } from 'next/cache';
import { after } from 'next/server';
import { getAllCampaigns as fetchAllCampaigns, createCampaign, updateCampaign, deleteCampaign, getCampaignById } from '@/lib/api/campaigns';
import { auditLog, ensureRegionAccess, requireActor, scopedRegionWhere } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { isCampaignRegion } from '@/lib/regions';
import type { Campaign } from '@/types';

type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

const CampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  type: z.enum(['Cataract', 'School Eye Health', 'Diabetic Retinopathy', 'Glaucoma', 'General']),
  status: z.enum(['Planned', 'Active', 'Completed', 'Suspended']),
  region: z.string().refine(isCampaignRegion, 'Valid region is required'),
  operationDistrict: z.string().min(1, 'Operation district/city is required'),
  projectManagerId: z.string().min(1, 'Project Manager is required'),
  projectManagerName: z.string().min(1, 'Project Manager is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  budget: z.number().min(0),
  donors: z.string(),
  targetScreenings: z.number().int().min(0),
  targetSurgeries: z.number().int().min(1),
  targetFollowUps: z.number().int().min(0),
  description: z.string(),
});

const BulkCampaignSchema = z.array(CampaignSchema).min(1, 'Choose at least one campaign to create');

async function findActiveCampaignConflict(region: string, excludingId?: string) {
  return prisma.campaign.findFirst({
    where: {
      region,
      status: 'Active',
      ...(excludingId ? { id: { not: excludingId } } : {}),
    },
    select: { name: true },
  });
}

export async function getAllCampaigns(): Promise<Campaign[]> {
  const actor = await requireActor('campaigns', 'view');
  if ('error' in actor) throw new Error(actor.error);
  return fetchAllCampaigns(scopedRegionWhere(actor));
}

export async function actionCreateCampaign(input: unknown): Promise<ActionResult<Campaign>> {
  const actor = await requireActor('campaigns', 'create');
  if ('error' in actor) return { ok: false, error: actor.error };

  const parsed = CampaignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const denied = ensureRegionAccess(actor, parsed.data.region);
  if (denied) return denied;

  try {
    if (parsed.data.status === 'Active') {
      const conflict = await findActiveCampaignConflict(parsed.data.region);
      if (conflict) return { ok: false, error: `${parsed.data.region} already has an active campaign: ${conflict.name}` };
    }
    const campaign = await createCampaign(parsed.data);
    updateTag('campaigns');
    after(() => auditLog({
      actor,
      action: 'create',
      entity: 'Campaign',
      entityId: campaign.id,
      region: campaign.region,
      campaignId: campaign.id,
      details: `Created campaign ${campaign.name} for ${campaign.region}`,
      after: campaign,
    }));
    return { ok: true, data: campaign };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionCreateCampaignsBulk(input: unknown): Promise<ActionResult<Campaign[]>> {
  const actor = await requireActor('campaigns', 'create');
  if ('error' in actor) return { ok: false, error: actor.error };

  const parsed = BulkCampaignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const activeRegions = new Set<string>();
  for (const campaignInput of parsed.data) {
    const denied = ensureRegionAccess(actor, campaignInput.region);
    if (denied) return denied;

    if (campaignInput.status === 'Active') {
      if (activeRegions.has(campaignInput.region)) {
        return { ok: false, error: `Only one active campaign can be created for ${campaignInput.region}` };
      }
      activeRegions.add(campaignInput.region);

      const conflict = await findActiveCampaignConflict(campaignInput.region);
      if (conflict) return { ok: false, error: `${campaignInput.region} already has an active campaign: ${conflict.name}` };
    }
  }

  try {
    const created: Campaign[] = [];
    for (const campaignInput of parsed.data) {
      const campaign = await createCampaign(campaignInput);
      created.push(campaign);
    }
    updateTag('campaigns');
    after(() => Promise.all(created.map(c => auditLog({
      actor,
      action: 'create',
      entity: 'Campaign',
      entityId: c.id,
      region: c.region,
      campaignId: c.id,
      details: `Created campaign ${c.name} for ${c.region}`,
      after: c,
    }))));
    return { ok: true, data: created };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionUpdateCampaign(id: string, input: unknown): Promise<ActionResult<Campaign>> {
  const actor = await requireActor('campaigns', 'edit');
  if ('error' in actor) return { ok: false, error: actor.error };

  const parsed = CampaignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const denied = ensureRegionAccess(actor, parsed.data.region);
  if (denied) return denied;

  try {
    const before = await getCampaignById(id);
    if (before) {
      const existingDenied = ensureRegionAccess(actor, before.region);
      if (existingDenied) return existingDenied;
    }
    if (parsed.data.status === 'Active') {
      const conflict = await findActiveCampaignConflict(parsed.data.region, id);
      if (conflict) return { ok: false, error: `${parsed.data.region} already has an active campaign: ${conflict.name}` };
    }
    const campaign = await updateCampaign(id, parsed.data);
    updateTag('campaigns');
    after(() => auditLog({
      actor,
      action: 'update',
      entity: 'Campaign',
      entityId: campaign.id,
      region: campaign.region,
      campaignId: campaign.id,
      details: before?.projectManagerId !== campaign.projectManagerId
        ? `Changed campaign manager to ${campaign.projectManagerName}`
        : `Updated campaign ${campaign.name}`,
      before,
      after: campaign,
    }));
    return { ok: true, data: campaign };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionDeleteCampaign(id: string): Promise<ActionResult> {
  const actor = await requireActor('campaigns', 'delete');
  if ('error' in actor) return { ok: false, error: actor.error };

  try {
    const before = await getCampaignById(id);
    if (before) {
      const denied = ensureRegionAccess(actor, before.region);
      if (denied) return denied;
    }
    await deleteCampaign(id);
    updateTag('campaigns');
    after(() => auditLog({
      actor,
      action: 'delete',
      entity: 'Campaign',
      entityId: id,
      region: before?.region,
      campaignId: id,
      details: before ? `Deleted campaign ${before.name}` : 'Deleted campaign',
      before,
    }));
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
