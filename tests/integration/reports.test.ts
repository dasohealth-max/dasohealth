import { beforeEach, describe, expect, it, vi } from 'vitest';
import { banadiCampaign, galmudugCampaign } from '../mocks/data';
import { galmudugPM, superAdmin } from '../mocks/actors';

vi.mock('@/lib/auth-server', () => ({
  auditLog: vi.fn(),
  requireActor: vi.fn(),
  scopedRegionWhere: vi.fn((actor: { role: string; assignedRegion?: string }) =>
    actor.role === 'Super Administrator' ? {} : { region: actor.assignedRegion ?? '__no_region__' },
  ),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    campaign: {
      findMany: vi.fn(),
    },
    patient: {
      groupBy: vi.fn(),
    },
    screening: {
      groupBy: vi.fn(),
    },
    surgery: {
      groupBy: vi.fn(),
    },
    followUp: {
      groupBy: vi.fn(),
    },
    followUpMedication: {
      count: vi.fn(),
    },
  },
}));

vi.mock('@/lib/api/campaigns', () => ({
  fromPrisma: vi.fn((row) => row),
}));

vi.mock('@/lib/api/patients', () => ({
  fromPrisma: vi.fn((row) => row),
}));

vi.mock('@/lib/api/screenings', () => ({
  fromPrisma: vi.fn((row) => row),
}));

vi.mock('@/lib/api/surgeries', () => ({
  fromPrisma: vi.fn((row) => row),
}));

vi.mock('@/lib/api/follow_ups', () => ({
  fromPrisma: vi.fn((row) => row),
  medFromPrisma: vi.fn((row) => row),
}));

import { getReportAggregation } from '@/app/actions/reports';
import * as authServer from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';

describe('getReportAggregation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authServer.requireActor).mockResolvedValue(superAdmin);
    vi.mocked(prisma.campaign.findMany).mockResolvedValue([galmudugCampaign, banadiCampaign] as never);
    vi.mocked(prisma.patient.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.screening.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.surgery.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.followUp.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.followUpMedication.count).mockResolvedValue(0);
  });

  it('builds report totals from grouped database counts instead of full clinical rows', async () => {
    vi.mocked(prisma.patient.groupBy).mockResolvedValue([
      { region: 'Galmudug', campaignId: 'camp-galmudug-1', _count: { _all: 2 } },
      { region: 'Banadir / Mogadishu', campaignId: 'camp-banadir-1', _count: { _all: 3 } },
    ] as never);
    vi.mocked(prisma.screening.groupBy).mockResolvedValue([
      { region: 'Galmudug', campaignId: 'camp-galmudug-1', _count: { _all: 1 } },
      { region: 'Banadir / Mogadishu', campaignId: 'camp-banadir-1', _count: { _all: 2 } },
    ] as never);
    vi.mocked(prisma.surgery.groupBy).mockResolvedValue([
      { region: 'Galmudug', campaignId: 'camp-galmudug-1', status: 'Scheduled', _count: { _all: 1 } },
      { region: 'Galmudug', campaignId: 'camp-galmudug-1', status: 'Completed', _count: { _all: 1 } },
      { region: 'Banadir / Mogadishu', campaignId: 'camp-banadir-1', status: 'Completed', _count: { _all: 2 } },
    ] as never);
    vi.mocked(prisma.followUp.groupBy).mockResolvedValue([
      {
        region: 'Galmudug',
        campaignId: 'camp-galmudug-1',
        milestone: 'Day1',
        status: 'Completed',
        doctorReviewStatus: 'Completed',
        _count: { _all: 1 },
      },
      {
        region: 'Banadir / Mogadishu',
        campaignId: 'camp-banadir-1',
        milestone: 'Week1',
        status: 'Overdue',
        doctorReviewStatus: 'Pending',
        _count: { _all: 2 },
      },
    ] as never);
    vi.mocked(prisma.followUpMedication.count).mockResolvedValue(4);

    const result = await getReportAggregation({ filterRegion: 'all', filterCampaignId: 'all' });

    expect(result.scoped.patientCount).toBe(5);
    expect(result.scoped.screeningCount).toBe(3);
    expect(result.scoped.surgeriesScheduled).toBe(1);
    expect(result.scoped.surgeriesCompleted).toBe(3);
    expect(result.scoped.followUpCount).toBe(3);
    expect(result.scoped.completedFollowUps).toBe(1);
    expect(result.scoped.overdueFollowUps).toBe(2);
    expect(result.scoped.doctorReviewPending).toBe(2);
    expect(result.scoped.doctorReviewCompleted).toBe(1);
    expect(result.scoped.medications).toBe(4);
    expect(result.followUpByMilestone).toContainEqual({
      milestone: 'Day 1',
      Completed: 1,
      Overdue: 0,
      'Dr. Pending': 0,
      'Dr. Completed': 1,
    });
    expect(prisma.patient.groupBy).toHaveBeenCalledOnce();
    expect(prisma.screening.groupBy).toHaveBeenCalledOnce();
    expect(prisma.surgery.groupBy).toHaveBeenCalledOnce();
    expect(prisma.followUp.groupBy).toHaveBeenCalledOnce();
  });

  it('keeps assigned-region scope authoritative for project-manager reports', async () => {
    vi.mocked(authServer.requireActor).mockResolvedValue(galmudugPM);
    vi.mocked(prisma.campaign.findMany).mockResolvedValue([galmudugCampaign] as never);
    vi.mocked(prisma.patient.groupBy).mockResolvedValue([
      { region: 'Galmudug', campaignId: 'camp-galmudug-1', _count: { _all: 2 } },
    ] as never);

    await getReportAggregation({ filterRegion: 'all', filterCampaignId: 'all' });

    expect(prisma.patient.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        region: 'Galmudug',
        campaignId: { in: ['camp-galmudug-1'] },
      }),
    }));
  });
});
