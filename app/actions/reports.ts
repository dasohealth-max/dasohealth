'use server';

import { prisma } from '@/lib/prisma';
import { auditLog, requireActor, scopedRegionWhere } from '@/lib/auth-server';
import { fromPrisma as campaignFromPrisma } from '@/lib/api/campaigns';
import { fromPrisma as patientFromPrisma } from '@/lib/api/patients';
import { fromPrisma as screeningFromPrisma } from '@/lib/api/screenings';
import { fromPrisma as surgeryFromPrisma } from '@/lib/api/surgeries';
import { fromPrisma as followUpFromPrisma, medFromPrisma } from '@/lib/api/follow_ups';
import { REGIONAL_CAMPAIGN_AREAS } from '@/lib/regions';
import {
  campaignHasRegion,
  campaignRegionNames,
  campaignTargetSurgeries,
  campaignTargetSurgeriesForRegion,
  completionRate,
  filterRowsByRegisteredCampaign,
  regionStatus,
  registeredCampaignIds,
  STATUS_WEIGHT,
} from '@/lib/reporting';
import type { Campaign, Patient, Screening, Surgery, FollowUp, FollowUpMedication } from '@/types';
import type { Prisma } from '@/lib/generated/prisma/client';
import { doctorReviewStatusToApp, followUpMilestoneToApp } from '@/lib/prisma-enums';
import { ACTIVE_FOLLOW_UP_MILESTONES, ACTIVE_FOLLOW_UP_PRISMA_MILESTONES } from '@/lib/follow-up-schedule';

type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function actionAuditReportExport(input: {
  region: string;
  campaign: string;
  format: 'xlsx' | 'pdf';
}): Promise<ActionResult> {
  const actor = await requireActor('reports', 'export');
  if ('error' in actor) return { ok: false, error: actor.error };

  const region = input.region === 'all' ? undefined : input.region;
  await auditLog({
    actor,
    action: 'export',
    entity: 'Report',
    entityId: `report-${Date.now()}`,
    region,
    details: `Exported ${input.format.toUpperCase()} report for ${region ?? 'all regions'} / ${input.campaign}`,
    after: {
      region: input.region,
      campaign: input.campaign,
      format: input.format,
    },
  });

  return { ok: true, data: null };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type RegionPerformanceItem = {
  region: string;
  campaigns: number;
  targetSurgeries: number;
  patients: number;
  screenings: number;
  scheduled: number;
  completed: number;
  postponed: number;
  cancelled: number;
  followUps: number;
  completedFollowUps: number;
  overdueFollowUps: number;
  doctorReviewPending: number;
  doctorReviewCompleted: number;
  completionRate: number;
  status: string;
};

export type CampaignStatItem = {
  id: string;
  targetSurgeries: number;
  patients: number;
  screenings: number;
  scheduled: number;
  completed: number;
  postponed: number;
  cancelled: number;
  followUps: number;
  completedFollowUps: number;
  overdueFollowUps: number;
  completionRate: number;
};

export type ReportAggregation = {
  allCampaigns: Campaign[];
  availableRegions: string[];
  scoped: {
    campaigns: Campaign[];
    campaignCount: number;
    patientCount: number;
    screeningCount: number;
    surgeryTarget: number;
    surgeriesScheduled: number;
    surgeriesCompleted: number;
    surgeriesPostponed: number;
    surgeriesCancelled: number;
    surgeryCompletionRate: number;
    followUpCount: number;
    completedFollowUps: number;
    overdueFollowUps: number;
    doctorReviewPending: number;
    doctorReviewCompleted: number;
    medications: number;
    hasMedications: boolean;
  };
  funnelData: { step: string; count: number }[];
  surgeryStatusData: { name: string; value: number; fill: string }[];
  followUpByMilestone: { milestone: string; Completed: number; Overdue: number; 'Dr. Pending': number; 'Dr. Completed': number }[];
  regionPerformance: RegionPerformanceItem[];
  campaignStats: CampaignStatItem[];
  inactiveRegions: number;
};

export type ReportRawData = {
  campaigns: Campaign[];
  patients: Patient[];
  screenings: Screening[];
  surgeries: Surgery[];
  followUps: FollowUp[];
  medications: FollowUpMedication[];
  regionPerformance: RegionPerformanceItem[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildEntityWhere(
  regionScope: { region?: string },
  filterRegion: string,
  filterCampaignId: string,
) {
  const region = regionScope.region ?? (filterRegion !== 'all' ? filterRegion : undefined);
  return {
    ...(region && { region }),
    ...(filterCampaignId !== 'all' && { campaignId: filterCampaignId }),
  };
}

function buildCampaignWhere(regionScope: { region?: string }): Prisma.CampaignWhereInput {
  if (!regionScope.region) return {};
  return {
    OR: [
      { region: regionScope.region },
      { regions: { some: { region: regionScope.region } } },
    ],
  };
}

function scopeCampaignRegions(campaign: Campaign, regionScope: { region?: string }): Campaign {
  if (!regionScope.region) return campaign;
  return {
    ...campaign,
    regions: (campaign.regions ?? []).filter((plan) => plan.region === regionScope.region),
  };
}

function computeRegionPerf(
  regionName: string,
  scopedCampaigns: Campaign[],
  patients: Patient[],
  screenings: Screening[],
  surgeries: Surgery[],
  followUps: FollowUp[],
): RegionPerformanceItem {
  const rc = scopedCampaigns.filter((c) => campaignHasRegion(c, regionName));
  const rp = patients.filter((p) => p.region === regionName);
  const rs = screenings.filter((s) => s.region === regionName);
  const rsu = surgeries.filter((s) => s.region === regionName);
  const rfu = followUps.filter((fu) => fu.region === regionName);
  const target = campaignTargetSurgeriesForRegion(rc, regionName);
  const done = rsu.filter((s) => s.status === 'Completed').length;
  const rate = completionRate(done, target);
  const status = regionStatus({
    hasCampaigns: rc.length > 0,
    activity: rp.length + rs.length + rsu.length,
    rate,
    screenings: rs.length,
  });
  return {
    region: regionName,
    campaigns: rc.length,
    targetSurgeries: target,
    patients: rp.length,
    screenings: rs.length,
    scheduled: rsu.filter((s) => s.status === 'Scheduled').length,
    completed: done,
    postponed: rsu.filter((s) => s.status === 'Postponed').length,
    cancelled: rsu.filter((s) => s.status === 'Cancelled').length,
    followUps: rfu.length,
    completedFollowUps: rfu.filter((fu) => fu.status === 'Completed').length,
    overdueFollowUps: rfu.filter((fu) => fu.status === 'Overdue').length,
    doctorReviewPending: rfu.filter((fu) => fu.doctorReviewStatus === 'Pending').length,
    doctorReviewCompleted: rfu.filter((fu) => fu.doctorReviewStatus === 'Completed').length,
    completionRate: rate,
    status,
  };
}

type RegionCampaignCountRow = {
  region: string;
  campaignId: string | null;
  _count: { _all: number };
};

type SurgeryStatusCountRow = RegionCampaignCountRow & {
  status: string;
};

type FollowUpAggregateCountRow = RegionCampaignCountRow & {
  milestone: string;
  status: string;
  doctorReviewStatus: string;
};

function campaignTargetForFilter(campaign: Campaign, filterRegion: string): number {
  return filterRegion === 'all'
    ? campaignTargetSurgeries(campaign)
    : campaignTargetSurgeriesForRegion([campaign], filterRegion);
}

function matchesRegionCampaign(
  row: RegionCampaignCountRow,
  region: string | undefined,
  campaignIds: Set<string>,
): boolean {
  return (!region || row.region === region) && Boolean(row.campaignId && campaignIds.has(row.campaignId));
}

function sumRegionCampaignCounts(
  rows: RegionCampaignCountRow[],
  campaignIds: Set<string>,
  region?: string,
): number {
  return rows.reduce(
    (sum, row) => sum + (matchesRegionCampaign(row, region, campaignIds) ? row._count._all : 0),
    0,
  );
}

function sumSurgeryCounts(
  rows: SurgeryStatusCountRow[],
  campaignIds: Set<string>,
  status: string,
  region?: string,
): number {
  return rows.reduce(
    (sum, row) => sum + (row.status === status && matchesRegionCampaign(row, region, campaignIds) ? row._count._all : 0),
    0,
  );
}

function sumFollowUpCounts(
  rows: FollowUpAggregateCountRow[],
  campaignIds: Set<string>,
  filters: {
    region?: string;
    milestone?: string;
    status?: string;
    doctorReviewStatus?: string;
  } = {},
): number {
  return rows.reduce((sum, row) => {
    if (!matchesRegionCampaign(row, filters.region, campaignIds)) return sum;
    if (filters.milestone && followUpMilestoneToApp(row.milestone) !== filters.milestone) return sum;
    if (filters.status && row.status !== filters.status) return sum;
    if (filters.doctorReviewStatus && doctorReviewStatusToApp(row.doctorReviewStatus) !== filters.doctorReviewStatus) return sum;
    return sum + row._count._all;
  }, 0);
}

function computeRegionPerfFromCounts(params: {
  regionName: string;
  scopedCampaigns: Campaign[];
  patientRows: RegionCampaignCountRow[];
  screeningRows: RegionCampaignCountRow[];
  surgeryRows: SurgeryStatusCountRow[];
  followUpRows: FollowUpAggregateCountRow[];
}): RegionPerformanceItem {
  const rc = params.scopedCampaigns.filter((campaign) => campaignHasRegion(campaign, params.regionName));
  const campaignIds = registeredCampaignIds(rc);
  const patients = sumRegionCampaignCounts(params.patientRows, campaignIds, params.regionName);
  const screenings = sumRegionCampaignCounts(params.screeningRows, campaignIds, params.regionName);
  const scheduled = sumSurgeryCounts(params.surgeryRows, campaignIds, 'Scheduled', params.regionName);
  const completed = sumSurgeryCounts(params.surgeryRows, campaignIds, 'Completed', params.regionName);
  const postponed = sumSurgeryCounts(params.surgeryRows, campaignIds, 'Postponed', params.regionName);
  const cancelled = sumSurgeryCounts(params.surgeryRows, campaignIds, 'Cancelled', params.regionName);
  const followUps = sumFollowUpCounts(params.followUpRows, campaignIds, { region: params.regionName });
  const completedFollowUps = sumFollowUpCounts(params.followUpRows, campaignIds, { region: params.regionName, status: 'Completed' });
  const overdueFollowUps = sumFollowUpCounts(params.followUpRows, campaignIds, { region: params.regionName, status: 'Overdue' });
  const doctorReviewPending = sumFollowUpCounts(params.followUpRows, campaignIds, { region: params.regionName, doctorReviewStatus: 'Pending' });
  const doctorReviewCompleted = sumFollowUpCounts(params.followUpRows, campaignIds, { region: params.regionName, doctorReviewStatus: 'Completed' });
  const target = campaignTargetSurgeriesForRegion(rc, params.regionName);
  const rate = completionRate(completed, target);
  const status = regionStatus({
    hasCampaigns: rc.length > 0,
    activity: patients + screenings + scheduled + completed + postponed + cancelled,
    rate,
    screenings,
  });

  return {
    region: params.regionName,
    campaigns: rc.length,
    targetSurgeries: target,
    patients,
    screenings,
    scheduled,
    completed,
    postponed,
    cancelled,
    followUps,
    completedFollowUps,
    overdueFollowUps,
    doctorReviewPending,
    doctorReviewCompleted,
    completionRate: rate,
    status,
  };
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

export async function getReportAggregation(params: {
  filterRegion: string;
  filterCampaignId: string;
}): Promise<ReportAggregation> {
  const actor = await requireActor('reports', 'view');
  if ('error' in actor) throw new Error(actor.error);

  const regionScope = scopedRegionWhere(actor);

  const allCampaignRows = await prisma.campaign.findMany({
    where: buildCampaignWhere(regionScope),
    include: { regions: { orderBy: { createdAt: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });
  const allCampaigns = allCampaignRows.map(campaignFromPrisma).map((campaign) => scopeCampaignRegions(campaign, regionScope));

  const regionSet = new Set(allCampaigns.flatMap(campaignRegionNames));
  const availableRegions = REGIONAL_CAMPAIGN_AREAS.map((a) => a.region).filter((r) => regionSet.has(r));

  const scopedCampaigns = allCampaigns.filter(
    (c) =>
      (params.filterRegion === 'all' || campaignHasRegion(c, params.filterRegion)) &&
      (params.filterCampaignId === 'all' || c.id === params.filterCampaignId),
  );
  const scopedCampaignIds = registeredCampaignIds(scopedCampaigns);
  const scopedCampaignIdList = [...scopedCampaignIds];

  const baseEntityWhere = {
    ...buildEntityWhere(regionScope, params.filterRegion, 'all'),
    campaignId: { in: scopedCampaignIdList },
  };
  const followUpWhere = {
    ...baseEntityWhere,
    milestone: { in: ACTIVE_FOLLOW_UP_PRISMA_MILESTONES as never[] },
  };

  const [
    patientCountRows,
    screeningCountRows,
    surgeryCountRows,
    followUpCountRows,
    medicationCount,
  ] = scopedCampaignIdList.length === 0
    ? [[], [], [], [], 0]
    : await Promise.all([
        prisma.patient.groupBy({
          by: ['region', 'campaignId'],
          where: baseEntityWhere,
          _count: { _all: true },
        }),
        prisma.screening.groupBy({
          by: ['region', 'campaignId'],
          where: baseEntityWhere,
          _count: { _all: true },
        }),
        prisma.surgery.groupBy({
          by: ['region', 'campaignId', 'status'],
          where: baseEntityWhere,
          _count: { _all: true },
        }),
        prisma.followUp.groupBy({
          by: ['region', 'campaignId', 'milestone', 'status', 'doctorReviewStatus'],
          where: followUpWhere,
          _count: { _all: true },
        }),
        prisma.followUpMedication.count({
          where: { followUp: followUpWhere },
        }),
      ]);

  const patientRows = patientCountRows as RegionCampaignCountRow[];
  const screeningRows = screeningCountRows as RegionCampaignCountRow[];
  const surgeryRows = surgeryCountRows as SurgeryStatusCountRow[];
  const followUpRows = followUpCountRows as FollowUpAggregateCountRow[];

  const surgeryTarget = scopedCampaigns.reduce(
    (sum, campaign) => sum + campaignTargetForFilter(campaign, params.filterRegion),
    0,
  );
  const patientCount = sumRegionCampaignCounts(patientRows, scopedCampaignIds);
  const screeningCount = sumRegionCampaignCounts(screeningRows, scopedCampaignIds);
  const surgeriesScheduled = sumSurgeryCounts(surgeryRows, scopedCampaignIds, 'Scheduled');
  const surgeriesCompleted = sumSurgeryCounts(surgeryRows, scopedCampaignIds, 'Completed');
  const surgeriesPostponed = sumSurgeryCounts(surgeryRows, scopedCampaignIds, 'Postponed');
  const surgeriesCancelled = sumSurgeryCounts(surgeryRows, scopedCampaignIds, 'Cancelled');
  const followUpCount = sumFollowUpCounts(followUpRows, scopedCampaignIds);
  const completedFollowUps = sumFollowUpCounts(followUpRows, scopedCampaignIds, { status: 'Completed' });
  const overdueFollowUps = sumFollowUpCounts(followUpRows, scopedCampaignIds, { status: 'Overdue' });
  const doctorReviewPending = sumFollowUpCounts(followUpRows, scopedCampaignIds, { doctorReviewStatus: 'Pending' });
  const doctorReviewCompleted = sumFollowUpCounts(followUpRows, scopedCampaignIds, { doctorReviewStatus: 'Completed' });

  const followUpByMilestone = ACTIVE_FOLLOW_UP_MILESTONES.map((m) => {
    return {
      milestone: m,
      Completed: sumFollowUpCounts(followUpRows, scopedCampaignIds, { milestone: m, status: 'Completed' }),
      Overdue: sumFollowUpCounts(followUpRows, scopedCampaignIds, { milestone: m, status: 'Overdue' }),
      'Dr. Pending': sumFollowUpCounts(followUpRows, scopedCampaignIds, { milestone: m, doctorReviewStatus: 'Pending' }),
      'Dr. Completed': sumFollowUpCounts(followUpRows, scopedCampaignIds, { milestone: m, doctorReviewStatus: 'Completed' }),
    };
  });

  const regionsForPerf = params.filterRegion === 'all' ? availableRegions : [params.filterRegion];
  const regionPerformance = regionsForPerf
    .map((r) => computeRegionPerfFromCounts({
      regionName: r,
      scopedCampaigns,
      patientRows,
      screeningRows,
      surgeryRows,
      followUpRows,
    }))
    .sort(
      (a, b) =>
        (STATUS_WEIGHT[b.status as keyof typeof STATUS_WEIGHT] ?? 0) -
        (STATUS_WEIGHT[a.status as keyof typeof STATUS_WEIGHT] ?? 0) ||
        b.completionRate - a.completionRate,
    );

  const campaignStats: CampaignStatItem[] = scopedCampaigns.map((c) => {
    const campaignIds = new Set([c.id]);
    const done = sumSurgeryCounts(surgeryRows, campaignIds, 'Completed');
    const targetSurgeries = campaignTargetForFilter(c, params.filterRegion);
    return {
      id: c.id,
      targetSurgeries,
      patients: sumRegionCampaignCounts(patientRows, campaignIds),
      screenings: sumRegionCampaignCounts(screeningRows, campaignIds),
      scheduled: sumSurgeryCounts(surgeryRows, campaignIds, 'Scheduled'),
      completed: done,
      postponed: sumSurgeryCounts(surgeryRows, campaignIds, 'Postponed'),
      cancelled: sumSurgeryCounts(surgeryRows, campaignIds, 'Cancelled'),
      followUps: sumFollowUpCounts(followUpRows, campaignIds),
      completedFollowUps: sumFollowUpCounts(followUpRows, campaignIds, { status: 'Completed' }),
      overdueFollowUps: sumFollowUpCounts(followUpRows, campaignIds, { status: 'Overdue' }),
      completionRate: completionRate(done, targetSurgeries),
    };
  });

  return {
    allCampaigns,
    availableRegions,
    scoped: {
      campaigns: scopedCampaigns,
      campaignCount: scopedCampaigns.length,
      patientCount,
      screeningCount,
      surgeryTarget,
      surgeriesScheduled,
      surgeriesCompleted,
      surgeriesPostponed,
      surgeriesCancelled,
      surgeryCompletionRate: completionRate(surgeriesCompleted, surgeryTarget),
      followUpCount,
      completedFollowUps,
      overdueFollowUps,
      doctorReviewPending,
      doctorReviewCompleted,
      medications: medicationCount,
      hasMedications: medicationCount > 0,
    },
    funnelData: [
      { step: 'Registered', count: patientCount },
      { step: 'Screened', count: screeningCount },
      { step: 'Surgery Booked', count: surgeriesScheduled + surgeriesCompleted },
      { step: 'Surg. Completed', count: surgeriesCompleted },
      { step: 'Follow-up Done', count: completedFollowUps },
    ],
    surgeryStatusData: [
      { name: 'Scheduled', value: surgeriesScheduled, fill: '#4B5666' },
      { name: 'Completed', value: surgeriesCompleted, fill: '#2C9942' },
      { name: 'Postponed', value: surgeriesPostponed, fill: '#F59E0B' },
      { name: 'Cancelled', value: surgeriesCancelled, fill: '#E53935' },
    ].filter((d) => d.value > 0),
    followUpByMilestone,
    regionPerformance,
    campaignStats,
    inactiveRegions: regionPerformance.filter((r) => r.status === 'No activity' || r.status === 'Behind').length,
  };
}

// ─── Raw data for Excel export ────────────────────────────────────────────────

export async function getReportRawData(params: {
  filterRegion: string;
  filterCampaignId: string;
}): Promise<ReportRawData> {
  const actor = await requireActor('reports', 'export');
  if ('error' in actor) throw new Error(actor.error);

  const regionScope = scopedRegionWhere(actor);
  const entityWhere = buildEntityWhere(regionScope, params.filterRegion, params.filterCampaignId);

  const allCampaignRows = await prisma.campaign.findMany({
    where: buildCampaignWhere(regionScope),
    include: { regions: { orderBy: { createdAt: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });
  const allCampaigns = allCampaignRows.map(campaignFromPrisma).map((campaign) => scopeCampaignRegions(campaign, regionScope));

  const [patientRows, screeningRows, surgeryRows, followUpRows, medRows] = await Promise.all([
    prisma.patient.findMany({ where: entityWhere }),
    prisma.screening.findMany({ where: entityWhere }),
    prisma.surgery.findMany({ where: entityWhere }),
    prisma.followUp.findMany({ where: entityWhere }),
    prisma.followUpMedication.findMany({ where: { followUp: entityWhere } }),
  ]);

  const campaigns = allCampaigns.filter(
    (c) =>
      (params.filterRegion === 'all' || campaignHasRegion(c, params.filterRegion)) &&
      (params.filterCampaignId === 'all' || c.id === params.filterCampaignId),
  );
  const campaignIds = registeredCampaignIds(campaigns);
  const patients = filterRowsByRegisteredCampaign(patientRows.map(patientFromPrisma), campaignIds);
  const screenings = filterRowsByRegisteredCampaign(screeningRows.map(screeningFromPrisma), campaignIds);
  const surgeries = filterRowsByRegisteredCampaign(surgeryRows.map(surgeryFromPrisma), campaignIds);
  const followUps = filterRowsByRegisteredCampaign(followUpRows.map(followUpFromPrisma), campaignIds);
  const followUpIds = new Set(followUps.map((followUp) => followUp.id));
  const medications = medRows
    .map(medFromPrisma)
    .filter((medication) => followUpIds.has(medication.followUpId));

  const regionSet = new Set(allCampaigns.flatMap(campaignRegionNames));
  const availableRegions = REGIONAL_CAMPAIGN_AREAS.map((a) => a.region).filter((r) => regionSet.has(r));
  const regionsForPerf = params.filterRegion === 'all' ? availableRegions : [params.filterRegion];
  const regionPerformance = regionsForPerf
    .map((r) => computeRegionPerf(r, campaigns, patients, screenings, surgeries, followUps))
    .sort(
      (a, b) =>
        (STATUS_WEIGHT[b.status as keyof typeof STATUS_WEIGHT] ?? 0) -
        (STATUS_WEIGHT[a.status as keyof typeof STATUS_WEIGHT] ?? 0) ||
        b.completionRate - a.completionRate,
    );

  return { campaigns, patients, screenings, surgeries, followUps, medications, regionPerformance };
}
