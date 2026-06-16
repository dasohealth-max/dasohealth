import type { Campaign, FollowUp } from '@/types';

export type RegionStatus = 'No campaign' | 'No activity' | 'Behind' | 'Active' | 'Strong';

export const STATUS_WEIGHT: Record<RegionStatus, number> = {
  'No campaign': -1,
  'No activity': 0,
  Behind: 1,
  Active: 2,
  Strong: 3,
};

/** Returns surgery completion rate as a rounded percentage (0–100). */
export function completionRate(completed: number, target: number): number {
  return target > 0 ? Math.round((completed / target) * 100) : 0;
}

/**
 * Derives a region's activity status from campaign presence, activity volume,
 * completion rate, and screening count.
 *
 * A region with any screenings (but < 25 % rate) is still 'Active', not 'Behind',
 * because fieldwork is underway.
 */
export function regionStatus(params: {
  hasCampaigns: boolean;
  activity: number;
  rate: number;
  screenings: number;
}): RegionStatus {
  if (!params.hasCampaigns) return 'No campaign';
  if (params.activity === 0) return 'No activity';
  if (params.rate >= 75) return 'Strong';
  if (params.rate >= 25 || params.screenings > 0) return 'Active';
  return 'Behind';
}

/** Counts follow-up statuses and doctor review states. */
export function followUpCounts(followUps: Pick<FollowUp, 'status' | 'doctorReviewStatus'>[]) {
  return {
    completed: followUps.filter((fu) => fu.status === 'Completed').length,
    overdue: followUps.filter((fu) => fu.status === 'Overdue').length,
    doctorReviewPending: followUps.filter((fu) => fu.doctorReviewStatus === 'Pending').length,
    doctorReviewCompleted: followUps.filter((fu) => fu.doctorReviewStatus === 'Completed').length,
  };
}

export type CampaignLinkedRow = {
  campaignId?: string | null;
};

export function registeredCampaignIds(campaigns: Pick<Campaign, 'id'>[]): Set<string> {
  return new Set(campaigns.map((campaign) => campaign.id));
}

export function filterRowsByRegisteredCampaign<T extends CampaignLinkedRow>(
  rows: T[],
  campaignIds: Set<string>,
): T[] {
  if (campaignIds.size === 0) return [];
  return rows.filter((row) => Boolean(row.campaignId && campaignIds.has(row.campaignId)));
}

export function campaignHasRegion(campaign: Campaign, region: string): boolean {
  if (campaign.region === region) return true;
  return campaign.regions?.some((plan) => plan.region === region) ?? false;
}

export function campaignsForRegion(campaigns: Campaign[], region: string): Campaign[] {
  return campaigns.filter((campaign) => campaignHasRegion(campaign, region));
}

export function campaignTargetSurgeries(campaign: Campaign): number {
  if (campaign.regions && campaign.regions.length > 0) {
    return campaign.regions.reduce((sum, plan) => sum + plan.targetSurgeries, 0);
  }

  return campaign.targetSurgeries;
}

export function campaignTargetSurgeriesForRegion(campaigns: Campaign[], region: string): number {
  return campaigns.reduce((sum, campaign) => {
    const matchingPlans = campaign.regions?.filter((plan) => plan.region === region) ?? [];
    if (matchingPlans.length > 0) {
      return sum + matchingPlans.reduce((planSum, plan) => planSum + plan.targetSurgeries, 0);
    }

    return campaign.region === region ? sum + campaign.targetSurgeries : sum;
  }, 0);
}
