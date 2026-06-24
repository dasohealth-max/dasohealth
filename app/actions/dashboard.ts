'use server';

import { prisma } from '@/lib/prisma';
import { requireActor, isSuperAdmin, scopedRegionWhere } from '@/lib/auth-server';
import { fromPrisma as campaignFromPrisma } from '@/lib/api/campaigns';
import { REGIONAL_CAMPAIGN_AREAS } from '@/lib/regions';
import {
  campaignTargetSurgeriesForRegion,
  campaignsForRegion,
  registeredCampaignIds,
} from '@/lib/reporting';
import type { Campaign } from '@/types';
import type { Prisma } from '@/lib/generated/prisma/client';

export type DashboardRegionStatus = 'No Campaign' | 'No Activity' | 'Behind' | 'Active' | 'Strong';

export type DashboardRegionStats = {
  region: string;
  district: string;
  manager: string;
  campaignName: string;
  campaignStatus: string | null;
  campaignStart: string;
  campaignEnd: string;
  target: number;
  patients: number;
  screened: number;
  scheduled: number;
  completed: number;
  followUpsDone: number;
  followUpsDue: number;
  overdue: number;
  doctorReview: number;
  pct: number;
  status: DashboardRegionStatus;
};

type CountRow = {
  region: string;
  campaignId: string | null;
  _count: { _all: number };
};

type SurgeryCountRow = CountRow & {
  status: string;
};

type FollowUpCountRow = CountRow & {
  status: string;
  needsDoctorReview: boolean;
};

function computeStatus(campaignCount: number, patientCount: number, pct: number): DashboardRegionStatus {
  if (!campaignCount) return 'No Campaign';
  if (!patientCount) return 'No Activity';
  if (pct >= 75) return 'Strong';
  if (pct >= 25) return 'Active';
  return 'Behind';
}

function campaignWhereForActor(actor: Exclude<Awaited<ReturnType<typeof requireActor>>, { error: string }>): Prisma.CampaignWhereInput {
  if (isSuperAdmin(actor)) return {};
  if (actor.role === 'Project Manager') {
    return {
      OR: [
        { projectManagerId: actor.id },
        { regions: { some: { regionalManagerId: actor.id } } },
      ],
    };
  }
  const region = actor.assignedRegion ?? '__no_region__';
  return { OR: [{ region }, { regions: { some: { region } } }] };
}

function scopeCampaignForActor(
  actor: Exclude<Awaited<ReturnType<typeof requireActor>>, { error: string }>,
  campaign: Campaign,
): Campaign {
  if (isSuperAdmin(actor)) return campaign;
  if (actor.role === 'Project Manager') {
    return {
      ...campaign,
      regions: (campaign.regions ?? []).filter((plan) => plan.regionalManagerId === actor.id),
    };
  }
  const region = actor.assignedRegion;
  if (!region) return { ...campaign, regions: [] };
  return {
    ...campaign,
    regions: (campaign.regions ?? []).filter((plan) => plan.region === region),
  };
}

function countKey(region: string, campaignId: string | null | undefined, status?: string, needsDoctorReview?: boolean) {
  return [region, campaignId ?? '', status ?? '', needsDoctorReview === undefined ? '' : String(needsDoctorReview)].join('\u0000');
}

function countMap(rows: CountRow[]) {
  const map = new Map<string, number>();
  rows.forEach((row) => {
    map.set(countKey(row.region, row.campaignId), row._count._all);
  });
  return map;
}

function surgeryCountMap(rows: SurgeryCountRow[]) {
  const map = new Map<string, number>();
  rows.forEach((row) => {
    map.set(countKey(row.region, row.campaignId, row.status), row._count._all);
  });
  return map;
}

function followUpCountMap(rows: FollowUpCountRow[]) {
  const map = new Map<string, number>();
  rows.forEach((row) => {
    map.set(countKey(row.region, row.campaignId, row.status, row.needsDoctorReview), row._count._all);
  });
  return map;
}

function sumCampaignCounts(map: Map<string, number>, region: string, campaignIds: Set<string>, status?: string) {
  let total = 0;
  campaignIds.forEach((campaignId) => {
    total += map.get(countKey(region, campaignId, status)) ?? 0;
  });
  return total;
}

function sumFollowUps(
  map: Map<string, number>,
  region: string,
  campaignIds: Set<string>,
  options: { status?: string; needsDoctorReview?: boolean },
) {
  let total = 0;
  campaignIds.forEach((campaignId) => {
    if (options.needsDoctorReview === undefined) {
      total += map.get(countKey(region, campaignId, options.status, false)) ?? 0;
      total += map.get(countKey(region, campaignId, options.status, true)) ?? 0;
      return;
    }

    if (options.status === undefined) {
      ['Pending', 'Due', 'Overdue', 'Completed', 'Missed'].forEach((status) => {
        total += map.get(countKey(region, campaignId, status, options.needsDoctorReview)) ?? 0;
      });
      return;
    }

    total += map.get(countKey(region, campaignId, options.status, options.needsDoctorReview)) ?? 0;
  });
  return total;
}

export async function getDashboardRegionStats(): Promise<DashboardRegionStats[]> {
  const actor = await requireActor('dashboard', 'view');
  if ('error' in actor) throw new Error(actor.error);

  const campaignRows = await prisma.campaign.findMany({
    where: campaignWhereForActor(actor),
    include: { regions: { orderBy: { createdAt: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });
  const campaigns = campaignRows
    .map(campaignFromPrisma)
    .map((campaign) => scopeCampaignForActor(actor, campaign));
  const campaignIds = [...registeredCampaignIds(campaigns)];

  const [patientRows, screeningRows, surgeryRows, followUpRows] = campaignIds.length === 0
    ? [[], [], [], []]
    : await Promise.all([
        prisma.patient.groupBy({
          by: ['region', 'campaignId'],
          where: { ...scopedRegionWhere(actor), campaignId: { in: campaignIds } },
          _count: { _all: true },
        }),
        prisma.screening.groupBy({
          by: ['region', 'campaignId'],
          where: { ...scopedRegionWhere(actor), campaignId: { in: campaignIds } },
          _count: { _all: true },
        }),
        prisma.surgery.groupBy({
          by: ['region', 'campaignId', 'status'],
          where: { ...scopedRegionWhere(actor), campaignId: { in: campaignIds } },
          _count: { _all: true },
        }),
        prisma.followUp.groupBy({
          by: ['region', 'campaignId', 'status', 'needsDoctorReview'],
          where: { ...scopedRegionWhere(actor), campaignId: { in: campaignIds } },
          _count: { _all: true },
        }),
      ]);

  const patientCounts = countMap(patientRows as CountRow[]);
  const screeningCounts = countMap(screeningRows as CountRow[]);
  const surgeryCounts = surgeryCountMap(surgeryRows as SurgeryCountRow[]);
  const followUpCounts = followUpCountMap(followUpRows as FollowUpCountRow[]);

  return REGIONAL_CAMPAIGN_AREAS.map((area) => {
    const regionCampaigns = campaignsForRegion(campaigns, area.region);
    const primary = regionCampaigns.find((campaign) => campaign.status === 'Active') ?? regionCampaigns[0] ?? null;
    const primaryPlan = primary?.regions?.find((plan) => plan.region === area.region) ?? null;
    const regionCampaignIds = registeredCampaignIds(regionCampaigns);

    const completed = sumCampaignCounts(surgeryCounts, area.region, regionCampaignIds, 'Completed');
    const scheduled = sumCampaignCounts(surgeryCounts, area.region, regionCampaignIds, 'Scheduled');
    const target = campaignTargetSurgeriesForRegion(regionCampaigns, area.region);
    const pct = target ? Math.round((completed / target) * 100) : 0;
    const patients = sumCampaignCounts(patientCounts, area.region, regionCampaignIds);

    return {
      region: area.region,
      district: primaryPlan?.operationDistrict ?? area.defaultDistrict,
      manager: primaryPlan?.regionalManagerName ?? '',
      campaignName: primary?.name ?? '',
      campaignStatus: primary?.status ?? null,
      campaignStart: primary?.startDate ?? '',
      campaignEnd: primary?.endDate ?? '',
      target,
      patients,
      screened: sumCampaignCounts(screeningCounts, area.region, regionCampaignIds),
      scheduled,
      completed,
      followUpsDone: sumFollowUps(followUpCounts, area.region, regionCampaignIds, { status: 'Completed' }),
      followUpsDue:
        sumFollowUps(followUpCounts, area.region, regionCampaignIds, { status: 'Pending' }) +
        sumFollowUps(followUpCounts, area.region, regionCampaignIds, { status: 'Due' }),
      overdue: sumFollowUps(followUpCounts, area.region, regionCampaignIds, { status: 'Overdue' }),
      doctorReview: sumFollowUps(followUpCounts, area.region, regionCampaignIds, { needsDoctorReview: true }),
      pct,
      status: computeStatus(regionCampaigns.length, patients, pct),
    };
  });
}
