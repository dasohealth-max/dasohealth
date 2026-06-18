import 'server-only';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { campaignTypeFromApp, campaignTypeToApp } from '@/lib/prisma-enums';
import type { Campaign, CampaignRegion } from '@/types';
import type { Prisma } from '@/lib/generated/prisma/client';

type CampaignRow = NonNullable<Awaited<ReturnType<typeof prisma.campaign.findFirst>>>;
type CampaignRegionRow = NonNullable<Awaited<ReturnType<typeof prisma.campaignRegion.findFirst>>>;

export type CampaignInput = Pick<
  Campaign,
  | 'name'
  | 'type'
  | 'status'
  | 'region'
  | 'operationDistrict'
  | 'projectManagerId'
  | 'projectManagerName'
  | 'startDate'
  | 'endDate'
  | 'description'
  | 'notes'
>;

export type CampaignRegionInput = Pick<
  CampaignRegion,
  | 'campaignId'
  | 'type'
  | 'region'
  | 'operationDistrict'
  | 'regionalManagerId'
  | 'regionalManagerName'
  | 'doctorName'
  | 'targetPatients'
  | 'targetScreenings'
  | 'targetSurgeries'
  | 'startDate'
  | 'endDate'
  | 'status'
  | 'notes'
>;

export function parseDateOnly(value: string, field: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${field} must be a valid date`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${field} must be a valid date`);
  }

  return date;
}

function dateOnly(value: Date): string {
  return value.toISOString().split('T')[0];
}

export function normalizeDoctorName(value: string): string | null {
  const normalized = value.trim().replace(/\s+/g, ' ').toLowerCase();
  return normalized || null;
}

export function fromPrismaCampaignRegion(row: CampaignRegionRow): CampaignRegion {
  return {
    id: row.id,
    campaignId: row.campaignId,
    type: campaignTypeToApp(row.type) as CampaignRegion['type'],
    region: row.region,
    operationDistrict: row.operationDistrict,
    regionalManagerId: row.regionalManagerId,
    regionalManagerName: row.regionalManagerName,
    doctorName: row.doctorName,
    doctorNameKey: row.doctorNameKey ?? undefined,
    targetPatients: row.targetPatients,
    targetScreenings: row.targetScreenings,
    targetSurgeries: row.targetSurgeries,
    startDate: dateOnly(row.startDate as Date),
    endDate: dateOnly(row.endDate as Date),
    status: row.status === 'OnTrack' ? 'On Track' : row.status as CampaignRegion['status'],
    notes: row.notes,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

export function fromPrisma(row: CampaignRow & { regions?: CampaignRegionRow[] }): Campaign {
  const regions = row.regions?.map(fromPrismaCampaignRegion);
  const totals = regions?.reduce(
    (sum, region) => ({
      targetPatients: sum.targetPatients + region.targetPatients,
      targetScreenings: sum.targetScreenings + region.targetScreenings,
      targetSurgeries: sum.targetSurgeries + region.targetSurgeries,
    }),
    { targetPatients: 0, targetScreenings: 0, targetSurgeries: 0 },
  );

  return {
    id: row.id,
    name: row.name,
    type: campaignTypeToApp(row.type) as Campaign['type'],
    status: row.status as Campaign['status'],
    region: row.region,
    operationDistrict: row.operationDistrict,
    projectManagerId: row.projectManagerId,
    projectManagerName: row.projectManagerName,
    startDate: dateOnly(row.startDate as Date),
    endDate: dateOnly(row.endDate as Date),
    budget: Number(row.budget),
    donors: row.donors,
    targetScreenings: totals?.targetScreenings ?? row.targetScreenings,
    targetSurgeries: totals?.targetSurgeries ?? row.targetSurgeries,
    targetFollowUps: row.targetFollowUps,
    description: row.description,
    notes: row.notes ?? '',
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date | undefined)?.toISOString() ?? (row.createdAt as Date).toISOString(),
    regions,
  };
}

export const getAllCampaigns = unstable_cache(
  async (where: Prisma.CampaignWhereInput = {}): Promise<Campaign[]> => {
    const rows = await prisma.campaign.findMany({
      where,
      include: { regions: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(fromPrisma);
  },
  ['campaigns-list'],
  { revalidate: 60, tags: ['campaigns'] },
);

export async function getCampaignById(id: string): Promise<Campaign | null> {
  const row = await prisma.campaign.findUnique({
    where: { id },
    include: { regions: { orderBy: { createdAt: 'asc' } } },
  });
  return row ? fromPrisma(row) : null;
}

export async function createCampaign(data: CampaignInput): Promise<Campaign> {
  const row = await prisma.campaign.create({
    data: {
      name: data.name,
      type: campaignTypeFromApp(data.type) as never,
      status: data.status as never,
      region: data.region,
      operationDistrict: data.operationDistrict,
      projectManagerId: data.projectManagerId,
      projectManagerName: data.projectManagerName,
      startDate: parseDateOnly(data.startDate, 'Start date'),
      endDate: parseDateOnly(data.endDate, 'End date'),
      description: data.description,
      notes: data.notes,
    },
    include: { regions: true },
  });
  return fromPrisma(row);
}

export async function updateCampaign(id: string, data: CampaignInput): Promise<Campaign> {
  const row = await prisma.campaign.update({
    where: { id },
    data: {
      name: data.name,
      type: campaignTypeFromApp(data.type) as never,
      status: data.status as never,
      region: data.region,
      operationDistrict: data.operationDistrict,
      projectManagerId: data.projectManagerId,
      projectManagerName: data.projectManagerName,
      startDate: parseDateOnly(data.startDate, 'Start date'),
      endDate: parseDateOnly(data.endDate, 'End date'),
      description: data.description,
      notes: data.notes,
    },
    include: { regions: { orderBy: { createdAt: 'asc' } } },
  });
  return fromPrisma(row);
}

export async function deleteCampaign(id: string): Promise<void> {
  await prisma.campaign.delete({ where: { id } });
}

export async function createCampaignRegion(data: CampaignRegionInput): Promise<CampaignRegion> {
  const row = await prisma.campaignRegion.create({
    data: {
      campaignId: data.campaignId,
      type: campaignTypeFromApp(data.type) as never,
      region: data.region,
      operationDistrict: data.operationDistrict,
      regionalManagerId: data.regionalManagerId,
      regionalManagerName: data.regionalManagerName,
      doctorName: data.doctorName.trim().replace(/\s+/g, ' '),
      doctorNameKey: normalizeDoctorName(data.doctorName),
      targetPatients: data.targetPatients,
      targetScreenings: data.targetScreenings,
      targetSurgeries: data.targetSurgeries,
      startDate: parseDateOnly(data.startDate, 'Start date'),
      endDate: parseDateOnly(data.endDate, 'End date'),
      status: data.status === 'On Track' ? 'OnTrack' : data.status as never,
      notes: data.notes,
    },
  });
  return fromPrismaCampaignRegion(row);
}

export async function updateCampaignRegion(id: string, data: Omit<CampaignRegionInput, 'campaignId'>): Promise<CampaignRegion> {
  const row = await prisma.campaignRegion.update({
    where: { id },
    data: {
      region: data.region,
      type: campaignTypeFromApp(data.type) as never,
      operationDistrict: data.operationDistrict,
      regionalManagerId: data.regionalManagerId,
      regionalManagerName: data.regionalManagerName,
      doctorName: data.doctorName.trim().replace(/\s+/g, ' '),
      doctorNameKey: normalizeDoctorName(data.doctorName),
      targetPatients: data.targetPatients,
      targetScreenings: data.targetScreenings,
      targetSurgeries: data.targetSurgeries,
      startDate: parseDateOnly(data.startDate, 'Start date'),
      endDate: parseDateOnly(data.endDate, 'End date'),
      status: data.status === 'On Track' ? 'OnTrack' : data.status as never,
      notes: data.notes,
    },
  });
  return fromPrismaCampaignRegion(row);
}

export async function deleteCampaignRegion(id: string): Promise<void> {
  await prisma.campaignRegion.delete({ where: { id } });
}
