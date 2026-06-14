import type { FollowUp } from '@/types';

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
