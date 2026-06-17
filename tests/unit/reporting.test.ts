import { describe, it, expect } from 'vitest';
import {
  campaignTargetSurgeries,
  campaignTargetSurgeriesForRegion,
  campaignHasRegion,
  campaignRegionsLabel,
  completionRate,
  filterRowsByRegisteredCampaign,
  followUpCounts,
  registeredCampaignIds,
  regionStatus,
  STATUS_WEIGHT,
} from '@/lib/reporting';
import type { Campaign, FollowUp } from '@/types';

describe('completionRate', () => {
  it('returns 0 when target is 0', () => {
    expect(completionRate(0, 0)).toBe(0);
    expect(completionRate(50, 0)).toBe(0);
  });

  it('calculates rounded percentage correctly', () => {
    expect(completionRate(400, 400)).toBe(100);
    expect(completionRate(300, 400)).toBe(75);
    expect(completionRate(100, 400)).toBe(25);
    expect(completionRate(0, 400)).toBe(0);
    expect(completionRate(1, 3)).toBe(33); // rounds 33.33 → 33
    expect(completionRate(2, 3)).toBe(67); // rounds 66.67 → 67
  });

  it('can exceed 100% when completed > target', () => {
    expect(completionRate(500, 400)).toBe(125);
  });
});

describe('regionStatus', () => {
  it("returns 'No campaign' when no campaigns exist", () => {
    expect(regionStatus({ hasCampaigns: false, activity: 0, rate: 0, screenings: 0 })).toBe('No campaign');
    expect(regionStatus({ hasCampaigns: false, activity: 100, rate: 80, screenings: 50 })).toBe('No campaign');
  });

  it("returns 'No activity' when campaign exists but nothing has happened", () => {
    expect(regionStatus({ hasCampaigns: true, activity: 0, rate: 0, screenings: 0 })).toBe('No activity');
  });

  it("returns 'Strong' at or above 75% completion rate", () => {
    expect(regionStatus({ hasCampaigns: true, activity: 300, rate: 75, screenings: 100 })).toBe('Strong');
    expect(regionStatus({ hasCampaigns: true, activity: 400, rate: 100, screenings: 200 })).toBe('Strong');
  });

  it("returns 'Active' between 25–74% completion", () => {
    expect(regionStatus({ hasCampaigns: true, activity: 200, rate: 25, screenings: 0 })).toBe('Active');
    expect(regionStatus({ hasCampaigns: true, activity: 200, rate: 50, screenings: 0 })).toBe('Active');
    expect(regionStatus({ hasCampaigns: true, activity: 200, rate: 74, screenings: 0 })).toBe('Active');
  });

  it("returns 'Active' even below 25% when screenings exist", () => {
    expect(regionStatus({ hasCampaigns: true, activity: 50, rate: 0, screenings: 30 })).toBe('Active');
    expect(regionStatus({ hasCampaigns: true, activity: 50, rate: 10, screenings: 1 })).toBe('Active');
  });

  it("returns 'Behind' below 25% with no screenings", () => {
    expect(regionStatus({ hasCampaigns: true, activity: 20, rate: 0, screenings: 0 })).toBe('Behind');
    expect(regionStatus({ hasCampaigns: true, activity: 20, rate: 24, screenings: 0 })).toBe('Behind');
  });
});

describe('STATUS_WEIGHT ordering', () => {
  it('ranks statuses correctly for sorting (No campaign < No activity < Behind < Active < Strong)', () => {
    expect(STATUS_WEIGHT['No campaign']).toBeLessThan(STATUS_WEIGHT['No activity']);
    expect(STATUS_WEIGHT['No activity']).toBeLessThan(STATUS_WEIGHT['Behind']);
    expect(STATUS_WEIGHT['Behind']).toBeLessThan(STATUS_WEIGHT['Active']);
    expect(STATUS_WEIGHT['Active']).toBeLessThan(STATUS_WEIGHT['Strong']);
  });
});

describe('followUpCounts', () => {
  const makeFollowUp = (status: FollowUp['status'], doctorReviewStatus: FollowUp['doctorReviewStatus']) =>
    ({ status, doctorReviewStatus }) as Pick<FollowUp, 'status' | 'doctorReviewStatus'>;

  it('returns all zeros for an empty array', () => {
    expect(followUpCounts([])).toEqual({
      completed: 0,
      overdue: 0,
      doctorReviewPending: 0,
      doctorReviewCompleted: 0,
    });
  });

  it('counts completed follow-ups', () => {
    const fus = [
      makeFollowUp('Completed', 'Not Needed'),
      makeFollowUp('Completed', 'Not Needed'),
      makeFollowUp('Pending', 'Not Needed'),
    ];
    expect(followUpCounts(fus).completed).toBe(2);
  });

  it('counts overdue follow-ups', () => {
    const fus = [
      makeFollowUp('Overdue', 'Not Needed'),
      makeFollowUp('Pending', 'Not Needed'),
    ];
    expect(followUpCounts(fus).overdue).toBe(1);
  });

  it('counts doctor review pending and completed', () => {
    const fus = [
      makeFollowUp('Completed', 'Pending'),
      makeFollowUp('Completed', 'Completed'),
      makeFollowUp('Completed', 'Completed'),
      makeFollowUp('Overdue', 'Not Needed'),
    ];
    const counts = followUpCounts(fus);
    expect(counts.doctorReviewPending).toBe(1);
    expect(counts.doctorReviewCompleted).toBe(2);
  });
});

describe('campaign data consistency helpers', () => {
  const makeCampaign = (overrides: Partial<Campaign>): Campaign => ({
    id: 'campaign-1',
    name: 'Galmudug Cataract Campaign',
    type: 'Cataract Surgery Outreach',
    status: 'Active',
    region: 'Galmudug',
    operationDistrict: 'Dhuusamareeb',
    projectManagerId: 'pm-1',
    projectManagerName: 'Asha',
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    budget: 0,
    donors: '',
    targetScreenings: 100,
    targetSurgeries: 50,
    targetFollowUps: 0,
    description: '',
    notes: '',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  });

  it('keeps only rows linked to registered campaign ids', () => {
    const campaigns = [makeCampaign({ id: 'campaign-1' })];
    const campaignIds = registeredCampaignIds(campaigns);
    const rows = [
      { id: 'patient-1', campaignId: 'campaign-1' },
      { id: 'patient-2', campaignId: 'missing-campaign' },
      { id: 'patient-3', campaignId: null },
      { id: 'patient-4' },
    ];

    expect(filterRowsByRegisteredCampaign(rows, campaignIds)).toEqual([
      { id: 'patient-1', campaignId: 'campaign-1' },
    ]);
  });

  it('returns no rows when there are no scoped registered campaigns', () => {
    const rows = [{ id: 'patient-1', campaignId: 'campaign-1' }];
    expect(filterRowsByRegisteredCampaign(rows, new Set())).toEqual([]);
  });

  it('uses sub-region surgery targets when a campaign has sub-regions', () => {
    const campaign = makeCampaign({
      targetSurgeries: 999,
      regions: [
        {
          id: 'plan-1',
          campaignId: 'campaign-1',
          type: 'Cataract Surgery Outreach',
          region: 'Galmudug',
          operationDistrict: 'Dhuusamareeb',
          regionalManagerId: 'rm-1',
          regionalManagerName: 'Asha',
          targetPatients: 100,
          targetScreenings: 90,
          targetSurgeries: 40,
          startDate: '2026-06-01',
          endDate: '2026-06-30',
          status: 'On Track',
          notes: '',
          createdAt: '2026-06-01T00:00:00.000Z',
          updatedAt: '2026-06-01T00:00:00.000Z',
        },
        {
          id: 'plan-2',
          campaignId: 'campaign-1',
          type: 'Eye Vision Outreach',
          region: 'Galmudug',
          operationDistrict: 'Dhuusamareeb',
          regionalManagerId: 'rm-1',
          regionalManagerName: 'Asha',
          targetPatients: 80,
          targetScreenings: 70,
          targetSurgeries: 15,
          startDate: '2026-06-01',
          endDate: '2026-06-30',
          status: 'On Track',
          notes: '',
          createdAt: '2026-06-01T00:00:00.000Z',
          updatedAt: '2026-06-01T00:00:00.000Z',
        },
      ],
    });

    expect(campaignTargetSurgeries(campaign)).toBe(55);
    expect(campaignTargetSurgeriesForRegion([campaign], 'Galmudug')).toBe(55);
  });

  it('matches regions from sub-regions even when the parent campaign has no region', () => {
    const campaign = makeCampaign({
      region: '',
      operationDistrict: '',
      projectManagerId: '',
      projectManagerName: '',
      regions: [
        {
          id: 'plan-1',
          campaignId: 'campaign-1',
          type: 'Cataract Surgery Outreach',
          region: 'Galmudug',
          operationDistrict: 'Dhuusamareeb',
          regionalManagerId: 'rm-1',
          regionalManagerName: 'Asha',
          targetPatients: 0,
          targetScreenings: 0,
          targetSurgeries: 40,
          startDate: '2026-06-01',
          endDate: '2026-06-30',
          status: 'On Track',
          notes: '',
          createdAt: '2026-06-01T00:00:00.000Z',
          updatedAt: '2026-06-01T00:00:00.000Z',
        },
      ],
    });

    expect(campaignHasRegion(campaign, 'Galmudug')).toBe(true);
    expect(campaignHasRegion(campaign, 'Puntland')).toBe(false);
    expect(campaignRegionsLabel(campaign)).toBe('Galmudug');
  });

  it('uses campaign-level surgery targets for legacy campaigns without plans', () => {
    const campaign = makeCampaign({ targetSurgeries: 50, regions: [] });

    expect(campaignTargetSurgeries(campaign)).toBe(50);
    expect(campaignTargetSurgeriesForRegion([campaign], 'Galmudug')).toBe(50);
    expect(campaignTargetSurgeriesForRegion([campaign], 'Puntland')).toBe(0);
  });
});
