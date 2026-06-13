import 'server-only';
import { prisma } from '@/lib/prisma';
import { campaignTypeToApp, campaignTypeFromApp } from '@/lib/prisma-enums';
import type { Campaign } from '@/types';

type Row = NonNullable<Awaited<ReturnType<typeof prisma.campaign.findFirst>>>;

export function fromPrisma(row: Row): Campaign {
  return {
    id: row.id,
    name: row.name,
    type: campaignTypeToApp(row.type) as Campaign['type'],
    status: row.status as Campaign['status'],
    region: row.region,
    operationDistrict: row.operationDistrict,
    projectManagerId: row.projectManagerId,
    projectManagerName: row.projectManagerName,
    startDate: (row.startDate as Date).toISOString().split('T')[0],
    endDate: (row.endDate as Date).toISOString().split('T')[0],
    budget: Number(row.budget),
    donors: row.donors,
    targetScreenings: row.targetScreenings,
    targetSurgeries: row.targetSurgeries,
    targetFollowUps: row.targetFollowUps,
    description: row.description,
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

export async function getAllCampaigns(where: { region?: string } = {}): Promise<Campaign[]> {
  const rows = await prisma.campaign.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(fromPrisma);
}

export async function getCampaignById(id: string): Promise<Campaign | null> {
  const row = await prisma.campaign.findUnique({ where: { id } });
  return row ? fromPrisma(row) : null;
}

export async function createCampaign(
  data: Omit<Campaign, 'id' | 'createdAt'>
): Promise<Campaign> {
  const { type, budget, ...rest } = data;
  const row = await prisma.campaign.create({
    data: {
      ...rest,
      type: campaignTypeFromApp(type) as never,
      budget,
    },
  });
  return fromPrisma(row);
}

export async function updateCampaign(
  id: string,
  data: Omit<Campaign, 'id' | 'createdAt'>
): Promise<Campaign> {
  const { type, budget, ...rest } = data;
  const row = await prisma.campaign.update({
    where: { id },
    data: {
      ...rest,
      type: campaignTypeFromApp(type) as never,
      budget,
    },
  });
  return fromPrisma(row);
}

export async function deleteCampaign(id: string): Promise<void> {
  await prisma.campaign.delete({ where: { id } });
}
