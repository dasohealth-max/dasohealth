import { beforeEach, describe, expect, it, vi } from 'vitest';
import { superAdmin } from '../mocks/actors';

vi.mock('@/lib/auth-server', () => ({
  requireActor: vi.fn(),
  isSuperAdmin: vi.fn((actor: { role: string }) => actor.role === 'Super Administrator'),
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
  },
}));

import { getDashboardRegionStats } from '@/app/actions/dashboard';
import * as authServer from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';

describe('getDashboardRegionStats', () => {
  const campaignRow = {
    id: 'campaign-banadir',
    name: 'Banadir Patient Target',
    type: 'CataractSurgeryOutreach',
    status: 'Active',
    region: 'Banadir / Mogadishu',
    operationDistrict: 'Mogadishu',
    projectManagerId: 'pm-1',
    projectManagerName: 'PM Banadir',
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    endDate: new Date('2026-12-31T00:00:00.000Z'),
    budget: 0,
    donors: '',
    targetScreenings: 100,
    targetSurgeries: 400,
    targetFollowUps: 100,
    description: '',
    notes: '',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    regions: [{
      id: 'plan-banadir',
      campaignId: 'campaign-banadir',
      type: 'CataractSurgeryOutreach',
      region: 'Banadir / Mogadishu',
      operationDistrict: 'Mogadishu',
      regionalManagerId: 'pm-1',
      regionalManagerName: 'PM Banadir',
      doctorName: 'Dr. Banadir',
      doctorNameKey: 'dr-banadir',
      targetPatients: 400,
      targetScreenings: 100,
      targetSurgeries: 400,
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-12-31T00:00:00.000Z'),
      status: 'OnTrack',
      notes: '',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authServer.requireActor).mockResolvedValue(superAdmin);
    vi.mocked(prisma.campaign.findMany).mockResolvedValue([]);
    vi.mocked(prisma.patient.groupBy).mockResolvedValue([]);
    vi.mocked(prisma.screening.groupBy).mockResolvedValue([]);
    vi.mocked(prisma.surgery.groupBy).mockResolvedValue([]);
    vi.mocked(prisma.followUp.groupBy).mockResolvedValue([]);
  });

  it('returns regional stats without loading full clinical tables', async () => {
    const stats = await getDashboardRegionStats();

    expect(stats).toHaveLength(9);
    expect(stats[0]).toMatchObject({
      region: 'Banadir / Mogadishu',
      patients: 0,
      screened: 0,
      completed: 0,
      status: 'No Campaign',
    });
    expect(prisma.campaign.findMany).toHaveBeenCalledOnce();
    expect(prisma.patient.groupBy).not.toHaveBeenCalled();
    expect(prisma.screening.groupBy).not.toHaveBeenCalled();
    expect(prisma.surgery.groupBy).not.toHaveBeenCalled();
    expect(prisma.followUp.groupBy).not.toHaveBeenCalled();
  });

  it('uses unique patients for dashboard workflow and target progress', async () => {
    vi.mocked(prisma.campaign.findMany).mockResolvedValue([campaignRow] as never);
    vi.mocked(prisma.patient.groupBy).mockResolvedValue([
      { region: 'Banadir / Mogadishu', campaignId: 'campaign-banadir', _count: { _all: 3 } },
    ] as never);
    vi.mocked(prisma.screening.groupBy).mockResolvedValue([
      { region: 'Banadir / Mogadishu', campaignId: 'campaign-banadir', patientId: 'patient-1', _count: { _all: 2 } },
      { region: 'Banadir / Mogadishu', campaignId: 'campaign-banadir', patientId: 'patient-2', _count: { _all: 1 } },
    ] as never);
    vi.mocked(prisma.surgery.groupBy).mockResolvedValue([
      { region: 'Banadir / Mogadishu', campaignId: 'campaign-banadir', status: 'Completed', patientId: 'patient-1', _count: { _all: 2 } },
      { region: 'Banadir / Mogadishu', campaignId: 'campaign-banadir', status: 'Completed', patientId: 'patient-2', _count: { _all: 1 } },
      { region: 'Banadir / Mogadishu', campaignId: 'campaign-banadir', status: 'Scheduled', patientId: 'patient-3', _count: { _all: 2 } },
    ] as never);
    vi.mocked(prisma.followUp.groupBy)
      .mockResolvedValueOnce([
        { region: 'Banadir / Mogadishu', campaignId: 'campaign-banadir', status: 'Pending', patientId: 'patient-1', _count: { _all: 2 } },
        { region: 'Banadir / Mogadishu', campaignId: 'campaign-banadir', status: 'Overdue', patientId: 'patient-1', _count: { _all: 1 } },
        { region: 'Banadir / Mogadishu', campaignId: 'campaign-banadir', status: 'Due', patientId: 'patient-2', _count: { _all: 1 } },
        { region: 'Banadir / Mogadishu', campaignId: 'campaign-banadir', status: 'Completed', patientId: 'patient-2', _count: { _all: 3 } },
      ] as never)
      .mockResolvedValueOnce([
        { region: 'Banadir / Mogadishu', campaignId: 'campaign-banadir', status: 'Overdue', needsDoctorReview: false, _count: { _all: 1 } },
        { region: 'Banadir / Mogadishu', campaignId: 'campaign-banadir', status: 'Pending', needsDoctorReview: true, _count: { _all: 2 } },
      ] as never);

    const stats = await getDashboardRegionStats();
    const banadir = stats.find((row) => row.region === 'Banadir / Mogadishu');

    expect(banadir).toMatchObject({
      patients: 3,
      screened: 2,
      scheduled: 1,
      completed: 2,
      followUpsDue: 2,
      followUpsDone: 1,
      overdue: 1,
      doctorReview: 2,
      target: 400,
      pct: 1,
    });
  });
});
