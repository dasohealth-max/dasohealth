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
});
