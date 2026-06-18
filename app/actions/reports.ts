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
  return {
    ...regionScope,
    ...(filterRegion !== 'all' && { region: filterRegion }),
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

// ─── Aggregation ──────────────────────────────────────────────────────────────

export async function getReportAggregation(params: {
  filterRegion: string;
  filterCampaignId: string;
}): Promise<ReportAggregation> {
  const actor = await requireActor('reports', 'view');
  if ('error' in actor) throw new Error(actor.error);

  const regionScope = scopedRegionWhere(actor);
  const entityWhere = buildEntityWhere(regionScope, params.filterRegion, params.filterCampaignId);

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

  const [patientRows, screeningRows, surgeryRows, followUpRows, medRows] = await Promise.all([
    prisma.patient.findMany({ where: entityWhere }),
    prisma.screening.findMany({ where: entityWhere }),
    prisma.surgery.findMany({ where: entityWhere }),
    prisma.followUp.findMany({ where: entityWhere }),
    prisma.followUpMedication.findMany({ where: { followUp: entityWhere } }),
  ]);

  const patients = filterRowsByRegisteredCampaign(patientRows.map(patientFromPrisma), scopedCampaignIds);
  const screenings = filterRowsByRegisteredCampaign(screeningRows.map(screeningFromPrisma), scopedCampaignIds);
  const surgeries = filterRowsByRegisteredCampaign(surgeryRows.map(surgeryFromPrisma), scopedCampaignIds);
  const followUps = filterRowsByRegisteredCampaign(followUpRows.map(followUpFromPrisma), scopedCampaignIds);
  const followUpIds = new Set(followUps.map((followUp) => followUp.id));
  const medications = medRows
    .map(medFromPrisma)
    .filter((medication) => followUpIds.has(medication.followUpId));

  const surgeryTarget = scopedCampaigns.reduce(
    (sum, campaign) => sum + campaignTargetSurgeries(campaign),
    0,
  );
  const surgeriesScheduled = surgeries.filter((s) => s.status === 'Scheduled').length;
  const surgeriesCompleted = surgeries.filter((s) => s.status === 'Completed').length;
  const surgeriesPostponed = surgeries.filter((s) => s.status === 'Postponed').length;
  const surgeriesCancelled = surgeries.filter((s) => s.status === 'Cancelled').length;
  const completedFollowUps = followUps.filter((fu) => fu.status === 'Completed').length;
  const overdueFollowUps = followUps.filter((fu) => fu.status === 'Overdue').length;
  const doctorReviewPending = followUps.filter((fu) => fu.doctorReviewStatus === 'Pending').length;
  const doctorReviewCompleted = followUps.filter((fu) => fu.doctorReviewStatus === 'Completed').length;

  const MILESTONES = ['Day 1', 'Week 1', 'Month 1', 'Month 3'] as const;
  const followUpByMilestone = MILESTONES.map((m) => {
    const mFu = followUps.filter((fu) => fu.milestone === m);
    return {
      milestone: m,
      Completed: mFu.filter((fu) => fu.status === 'Completed').length,
      Overdue: mFu.filter((fu) => fu.status === 'Overdue').length,
      'Dr. Pending': mFu.filter((fu) => fu.doctorReviewStatus === 'Pending').length,
      'Dr. Completed': mFu.filter((fu) => fu.doctorReviewStatus === 'Completed').length,
    };
  });

  const regionsForPerf = params.filterRegion === 'all' ? availableRegions : [params.filterRegion];
  const regionPerformance = regionsForPerf
    .map((r) => computeRegionPerf(r, scopedCampaigns, patients, screenings, surgeries, followUps))
    .sort(
      (a, b) =>
        (STATUS_WEIGHT[b.status as keyof typeof STATUS_WEIGHT] ?? 0) -
        (STATUS_WEIGHT[a.status as keyof typeof STATUS_WEIGHT] ?? 0) ||
        b.completionRate - a.completionRate,
    );

  const campaignStats: CampaignStatItem[] = scopedCampaigns.map((c) => {
    const cSurg = surgeries.filter((s) => s.campaignId === c.id);
    const cFu = followUps.filter((fu) => fu.campaignId === c.id);
    const done = cSurg.filter((s) => s.status === 'Completed').length;
    return {
      id: c.id,
      patients: patients.filter((p) => p.campaignId === c.id).length,
      screenings: screenings.filter((s) => s.campaignId === c.id).length,
      scheduled: cSurg.filter((s) => s.status === 'Scheduled').length,
      completed: done,
      postponed: cSurg.filter((s) => s.status === 'Postponed').length,
      cancelled: cSurg.filter((s) => s.status === 'Cancelled').length,
      followUps: cFu.length,
      completedFollowUps: cFu.filter((fu) => fu.status === 'Completed').length,
      overdueFollowUps: cFu.filter((fu) => fu.status === 'Overdue').length,
      completionRate: completionRate(done, campaignTargetSurgeries(c)),
    };
  });

  return {
    allCampaigns,
    availableRegions,
    scoped: {
      campaigns: scopedCampaigns,
      campaignCount: scopedCampaigns.length,
      patientCount: patients.length,
      screeningCount: screenings.length,
      surgeryTarget,
      surgeriesScheduled,
      surgeriesCompleted,
      surgeriesPostponed,
      surgeriesCancelled,
      surgeryCompletionRate: completionRate(surgeriesCompleted, surgeryTarget),
      followUpCount: followUps.length,
      completedFollowUps,
      overdueFollowUps,
      doctorReviewPending,
      doctorReviewCompleted,
      medications: medications.length,
      hasMedications: medications.length > 0,
    },
    funnelData: [
      { step: 'Registered', count: patients.length },
      { step: 'Screened', count: screenings.length },
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

