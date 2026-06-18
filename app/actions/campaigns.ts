'use server';

import { z } from 'zod';
import { updateTag } from 'next/cache';
import { after } from 'next/server';
import {
  createCampaign,
  createCampaignRegion,
  deleteCampaign,
  deleteCampaignRegion,
  getAllCampaigns as fetchAllCampaigns,
  getCampaignById,
  updateCampaign,
  updateCampaignRegion,
  normalizeDoctorName,
} from '@/lib/api/campaigns';
import { auditLog, ensureRegionAccess, isSuperAdmin, requireActor } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { campaignTypeFromApp } from '@/lib/prisma-enums';
import { isCampaignRegion } from '@/lib/regions';
import type { AuditLog, Campaign, CampaignRegion } from '@/types';
import type { Prisma } from '@/lib/generated/prisma/client';

type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

const CAMPAIGN_TYPES = ['Cataract Surgery Outreach', 'General Eye Screening', 'Mixed Outreach'] as const;
const CAMPAIGN_STATUSES = ['Planned', 'Active', 'Completed', 'Suspended'] as const;
const REGIONAL_PLAN_STATUSES = ['On Track', 'Behind', 'Completed', 'Suspended'] as const;

const CampaignSchema = z.object({
  name: z.string().trim().min(1, 'Campaign name is required'),
  type: z.enum(CAMPAIGN_TYPES),
  status: z.enum(CAMPAIGN_STATUSES),
  region: z.string().optional().default(''),
  operationDistrict: z.string().trim().optional().default(''),
  projectManagerId: z.string().optional().default(''),
  projectManagerName: z.string().optional().default(''),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  description: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

const CampaignRegionSchema = z.object({
  campaignId: z.string().min(1, 'Campaign is required'),
  type: z.enum(CAMPAIGN_TYPES),
  region: z.string().refine(isCampaignRegion, 'Valid region is required'),
  operationDistrict: z.string().trim().min(1, 'Operation district is required'),
  regionalManagerId: z.string().min(1, 'Project Manager is required'),
  regionalManagerName: z.string().min(1, 'Project Manager is required'),
  doctorName: z.string().trim().min(1, 'Doctor name is required'),
  targetPatients: z.number().int().min(0, 'Target patients must be 0 or more').optional().default(0),
  targetScreenings: z.number().int().min(0, 'Target screenings must be 0 or more').optional().default(0),
  targetSurgeries: z.number().int().min(0, 'Target surgeries must be 0 or more'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  status: z.enum(REGIONAL_PLAN_STATUSES),
  notes: z.string().optional().default(''),
});

function dateMs(value: string) {
  const time = new Date(`${value}T00:00:00.000Z`).getTime();
  return Number.isNaN(time) ? null : time;
}

function validateDateRange(startDate: string, endDate: string): string | null {
  const start = dateMs(startDate);
  const end = dateMs(endDate);
  if (start === null || end === null) return 'Dates must be valid';
  if (end < start) return 'End date must be after start date';
  return null;
}

async function getRegisteredUser(userId: string) {
  if (!userId) return null;
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true, assignedRegion: true, active: true },
  });
}

async function validateProjectManager(userId: string, userName: string, region: string): Promise<string | null> {
  const user = await getRegisteredUser(userId);
  if (!user) return 'Selected Project Manager must be a registered user';
  if (!user.active) return 'Selected Project Manager is inactive';
  if (user.role !== 'ProjectManager') return 'Selected campaign manager must have the Project Manager role';
  if (user.name !== userName) return 'Selected Project Manager does not match the registered user record';
  if (user.assignedRegion !== region) return `${user.name} is assigned to ${user.assignedRegion ?? 'no region'}, not ${region}`;
  return null;
}

async function validateRegionalManager(userId: string, userName: string, region: string): Promise<string | null> {
  if (!userId) return null;
  const user = await getRegisteredUser(userId);
  if (!user) return 'Selected Project Manager must be a registered user';
  if (!user.active) return 'Selected Project Manager is inactive';
  if (user.role !== 'ProjectManager') return 'Selected Project Manager must have the Project Manager role';
  if (user.name !== userName) return 'Selected Project Manager does not match the registered user record';
  if (user.assignedRegion !== region) return `${user.name} is assigned to ${user.assignedRegion ?? 'no region'}, not ${region}`;
  return null;
}

async function validateDoctorAssignment(doctorName: string, currentRegionId?: string): Promise<string | null> {
  const doctorNameKey = normalizeDoctorName(doctorName);
  if (!doctorNameKey) return 'Doctor name is required';
  const existing = await prisma.campaignRegion.findFirst({
    where: {
      doctorNameKey,
      ...(currentRegionId ? { id: { not: currentRegionId } } : {}),
    },
    select: { region: true, operationDistrict: true, doctorName: true },
  });
  if (!existing) return null;
  return `${existing.doctorName} is already assigned to ${existing.region} - ${existing.operationDistrict}`;
}

function campaignWhereForActor(actor: Awaited<ReturnType<typeof requireActor>>): Prisma.CampaignWhereInput {
  if ('error' in actor) return { id: '__forbidden__' };
  if (isSuperAdmin(actor)) return {};
  const region = actor.assignedRegion ?? '__no_region__';
  return { OR: [{ region }, { regions: { some: { region } } }] };
}

function canAccessCampaign(actor: Exclude<Awaited<ReturnType<typeof requireActor>>, { error: string }>, campaign: Campaign): { ok: false; error: string } | null {
  if (isSuperAdmin(actor)) return null;
  const region = actor.assignedRegion;
  if (!region) return { ok: false, error: 'User is not assigned to a region' };
  if (campaign.region === region || campaign.regions?.some((plan) => plan.region === region)) return null;
  return { ok: false, error: 'Forbidden: region access denied' };
}

function scopeCampaignForActor(
  actor: Exclude<Awaited<ReturnType<typeof requireActor>>, { error: string }>,
  campaign: Campaign,
): Campaign {
  if (isSuperAdmin(actor)) return campaign;
  const region = actor.assignedRegion;
  if (!region) return { ...campaign, regions: [] };
  return {
    ...campaign,
    regions: (campaign.regions ?? []).filter((plan) => plan.region === region),
  };
}

export async function getAllCampaigns(): Promise<Campaign[]> {
  const actor = await requireActor('campaigns', 'view');
  if ('error' in actor) throw new Error(actor.error);
  const campaigns = await fetchAllCampaigns(campaignWhereForActor(actor));
  return campaigns.map((campaign) => scopeCampaignForActor(actor, campaign));
}

export async function actionGetCampaignActivity(campaignId: string): Promise<AuditLog[]> {
  const actor = await requireActor('campaigns', 'view');
  if ('error' in actor) throw new Error(actor.error);
  const campaign = await getCampaignById(campaignId);
  if (!campaign) return [];
  const denied = canAccessCampaign(actor, campaign);
  if (denied) throw new Error(denied.error);

  const rows = await prisma.auditLog.findMany({
    where: {
      campaignId,
      ...(isSuperAdmin(actor) ? {} : { region: actor.assignedRegion ?? '__no_region__' }),
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return rows.map((row) => ({
    id: row.id,
    actor: row.actor,
    actorId: row.actorId,
    actorName: row.actorName,
    actorRole: row.actorRole,
    action: row.action,
    entity: row.entity,
    entityId: row.entityId,
    region: row.region ?? undefined,
    campaignId: row.campaignId ?? undefined,
    details: row.details,
    before: row.before ?? undefined,
    after: row.after ?? undefined,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function actionCreateCampaign(input: unknown): Promise<ActionResult<Campaign>> {
  const actor = await requireActor('campaigns', 'create');
  if ('error' in actor) return { ok: false, error: actor.error };

  const parsed = CampaignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (parsed.data.region) {
    if (!isCampaignRegion(parsed.data.region)) return { ok: false, error: 'Valid campaign region is required' };
    const denied = ensureRegionAccess(actor, parsed.data.region);
    if (denied) return denied;
  }
  const rangeError = validateDateRange(parsed.data.startDate, parsed.data.endDate);
  if (rangeError) return { ok: false, error: rangeError };
  if (parsed.data.projectManagerId || parsed.data.projectManagerName) {
    if (!parsed.data.region) return { ok: false, error: 'Campaign region is required when assigning a Project Manager' };
    const managerError = await validateProjectManager(parsed.data.projectManagerId, parsed.data.projectManagerName, parsed.data.region);
    if (managerError) return { ok: false, error: managerError };
  }

  try {
    const campaign = await createCampaign(parsed.data);
    updateTag('campaigns');
    after(() => auditLog({
      actor,
      action: 'create',
      entity: 'Campaign',
      entityId: campaign.id,
      campaignId: campaign.id,
      region: campaign.region || undefined,
      details: `Campaign created: ${campaign.name}`,
      after: campaign,
    }));
    return { ok: true, data: campaign };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionUpdateCampaign(id: string, input: unknown): Promise<ActionResult<Campaign>> {
  const actor = await requireActor('campaigns', 'edit');
  if ('error' in actor) return { ok: false, error: actor.error };

  const parsed = CampaignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (parsed.data.region) {
    if (!isCampaignRegion(parsed.data.region)) return { ok: false, error: 'Valid campaign region is required' };
    const newRegionDenied = ensureRegionAccess(actor, parsed.data.region);
    if (newRegionDenied) return newRegionDenied;
  }
  const rangeError = validateDateRange(parsed.data.startDate, parsed.data.endDate);
  if (rangeError) return { ok: false, error: rangeError };
  if (parsed.data.projectManagerId || parsed.data.projectManagerName) {
    if (!parsed.data.region) return { ok: false, error: 'Campaign region is required when assigning a Project Manager' };
    const managerError = await validateProjectManager(parsed.data.projectManagerId, parsed.data.projectManagerName, parsed.data.region);
    if (managerError) return { ok: false, error: managerError };
  }

  try {
    const before = await getCampaignById(id);
    if (!before) return { ok: false, error: 'Campaign not found' };
    const denied = canAccessCampaign(actor, before);
    if (denied) return denied;

    const invalidPlan = before.regions?.find((plan) => {
      const planStart = dateMs(plan.startDate);
      const planEnd = dateMs(plan.endDate);
      const parentStart = dateMs(parsed.data.startDate);
      const parentEnd = dateMs(parsed.data.endDate);
      return planStart === null || planEnd === null || parentStart === null || parentEnd === null || planStart < parentStart || planEnd > parentEnd;
    });
    if (invalidPlan) return { ok: false, error: `${invalidPlan.region} sub-region dates must stay within the parent campaign date range` };

    const campaign = await updateCampaign(id, parsed.data);
    updateTag('campaigns');
    after(() => auditLog({
      actor,
      action: 'update',
      entity: 'Campaign',
      entityId: campaign.id,
      campaignId: campaign.id,
      details: before.status !== campaign.status ? `Status changed to ${campaign.status}` : `Campaign updated: ${campaign.name}`,
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
      const denied = canAccessCampaign(actor, before);
      if (denied) return denied;
    }
    await deleteCampaign(id);
    updateTag('campaigns');
    after(() => auditLog({
      actor,
      action: 'delete',
      entity: 'Campaign',
      entityId: id,
      campaignId: id,
      details: before ? `Deleted campaign ${before.name}` : 'Deleted campaign',
      before,
    }));
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionCreateCampaignRegion(input: unknown): Promise<ActionResult<CampaignRegion>> {
  const actor = await requireActor('campaigns', 'create');
  if ('error' in actor) return { ok: false, error: actor.error };

  const parsed = CampaignRegionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const denied = ensureRegionAccess(actor, parsed.data.region);
  if (denied) return denied;
  const managerError = await validateRegionalManager(parsed.data.regionalManagerId, parsed.data.regionalManagerName, parsed.data.region);
  if (managerError) return { ok: false, error: managerError };
  const doctorError = await validateDoctorAssignment(parsed.data.doctorName);
  if (doctorError) return { ok: false, error: doctorError };

  try {
    const campaign = await getCampaignById(parsed.data.campaignId);
    if (!campaign) return { ok: false, error: 'Campaign not found' };
    const campaignDenied = canAccessCampaign(actor, campaign);
    if (campaignDenied) return campaignDenied;

    const rangeError = validateRegionalPlanDates(campaign, parsed.data.startDate, parsed.data.endDate);
    if (rangeError) return { ok: false, error: rangeError };
    const planType = campaignTypeFromApp(parsed.data.type) as never;

    const duplicate = await prisma.campaignRegion.findFirst({
      where: { campaignId: parsed.data.campaignId, region: parsed.data.region, type: planType },
      select: { id: true },
    });
    if (duplicate) return { ok: false, error: `${parsed.data.type} already exists for ${parsed.data.region} in this campaign` };

    const plan = await createCampaignRegion(parsed.data);
    updateTag('campaigns');
    after(() => auditLog({
      actor,
      action: 'create',
      entity: 'CampaignRegion',
      entityId: plan.id,
      region: plan.region,
      campaignId: plan.campaignId,
      details: `Sub-region added: ${plan.type} in ${plan.region}`,
      after: plan,
    }));
    return { ok: true, data: plan };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionUpdateCampaignRegion(id: string, input: unknown): Promise<ActionResult<CampaignRegion>> {
  const actor = await requireActor('campaigns', 'edit');
  if ('error' in actor) return { ok: false, error: actor.error };

  const parsed = CampaignRegionSchema.omit({ campaignId: true }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const denied = ensureRegionAccess(actor, parsed.data.region);
  if (denied) return denied;
  const managerError = await validateRegionalManager(parsed.data.regionalManagerId, parsed.data.regionalManagerName, parsed.data.region);
  if (managerError) return { ok: false, error: managerError };
  const doctorError = await validateDoctorAssignment(parsed.data.doctorName, id);
  if (doctorError) return { ok: false, error: doctorError };

  try {
    const before = await prisma.campaignRegion.findUnique({ where: { id } });
    if (!before) return { ok: false, error: 'Sub-region not found' };
    const beforeDenied = ensureRegionAccess(actor, before.region);
    if (beforeDenied) return beforeDenied;

    const campaign = await getCampaignById(before.campaignId);
    if (!campaign) return { ok: false, error: 'Campaign not found' };
    const rangeError = validateRegionalPlanDates(campaign, parsed.data.startDate, parsed.data.endDate);
    if (rangeError) return { ok: false, error: rangeError };
    const planType = campaignTypeFromApp(parsed.data.type) as never;

    if (before.region !== parsed.data.region || before.type !== planType) {
      const duplicate = await prisma.campaignRegion.findFirst({
        where: { campaignId: before.campaignId, region: parsed.data.region, type: planType, id: { not: id } },
        select: { id: true },
      });
      if (duplicate) return { ok: false, error: `${parsed.data.type} already exists for ${parsed.data.region} in this campaign` };
    }

    const plan = await updateCampaignRegion(id, parsed.data);
    updateTag('campaigns');
    after(() => auditLog({
      actor,
      action: 'update',
      entity: 'CampaignRegion',
      entityId: plan.id,
      region: plan.region,
      campaignId: plan.campaignId,
      details: before.status !== (plan.status === 'On Track' ? 'OnTrack' : plan.status) ? `Status changed to ${plan.status}` : `Region updated: ${plan.region}`,
      before,
      after: plan,
    }));
    return { ok: true, data: plan };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionDeleteCampaignRegion(id: string): Promise<ActionResult> {
  const actor = await requireActor('campaigns', 'delete');
  if ('error' in actor) return { ok: false, error: actor.error };

  try {
    const before = await prisma.campaignRegion.findUnique({ where: { id } });
    if (!before) return { ok: false, error: 'Sub-region not found' };
    const denied = ensureRegionAccess(actor, before.region);
    if (denied) return denied;

    await deleteCampaignRegion(id);
    updateTag('campaigns');
    after(() => auditLog({
      actor,
      action: 'delete',
      entity: 'CampaignRegion',
      entityId: id,
      region: before.region,
      campaignId: before.campaignId,
      details: `Region removed: ${before.region}`,
      before,
    }));
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function validateRegionalPlanDates(campaign: Campaign, startDate: string, endDate: string): string | null {
  const rangeError = validateDateRange(startDate, endDate);
  if (rangeError) return rangeError;
  const parentStart = dateMs(campaign.startDate);
  const parentEnd = dateMs(campaign.endDate);
  const start = dateMs(startDate);
  const end = dateMs(endDate);
  if (parentStart === null || parentEnd === null || start === null || end === null) return 'Dates must be valid';
  if (start < parentStart || end > parentEnd) return 'Region dates must fall within the parent campaign date range';
  return null;
}
