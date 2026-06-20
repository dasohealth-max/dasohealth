import { describe, it, expect, vi, beforeEach } from 'vitest';
import { superAdmin, galmudugPM, banadiPM } from '../mocks/actors';
import { galmudugCampaign, campaignInput } from '../mocks/data';

vi.mock('@/lib/auth-server', () => ({
  requireActor: vi.fn(),
  ensureRegionAccess: vi.fn(),
  auditLog: vi.fn().mockResolvedValue(undefined),
  scopedRegionWhere: vi.fn(() => ({})),
  isSuperAdmin: vi.fn((actor: { role: string }) => actor.role === 'Super Administrator'),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    campaignRegion: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    patient: {
      count: vi.fn(),
    },
    screening: {
      count: vi.fn(),
    },
    surgery: {
      count: vi.fn(),
    },
    followUp: {
      count: vi.fn(),
    },
    auditLog: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/api/campaigns', () => ({
  getAllCampaigns: vi.fn(),
  createCampaign: vi.fn(),
  updateCampaign: vi.fn(),
  deleteCampaign: vi.fn(),
  getCampaignById: vi.fn(),
  normalizeDoctorName: vi.fn((value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase() || null),
  createCampaignRegion: vi.fn(),
  updateCampaignRegion: vi.fn(),
  deleteCampaignRegion: vi.fn(),
}));

import {
  actionCreateCampaign,
  actionCreateCampaignRegion,
  actionDeleteCampaign,
  actionDeleteCampaignRegion,
  actionUpdateCampaign,
  getAllCampaigns,
} from '@/app/actions/campaigns';
import * as authServer from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import * as campaignApi from '@/lib/api/campaigns';
import type { Campaign, CampaignRegion } from '@/types';

function mockRequireActor(actor: typeof superAdmin | typeof galmudugPM | typeof banadiPM) {
  vi.mocked(authServer.requireActor).mockResolvedValue(actor);
}

const regionInput = {
  campaignId: 'camp-galmudug-1',
  type: 'Cataract Surgery Outreach' as const,
  region: 'Galmudug',
  operationDistrict: 'Dhuusamareeb',
  regionalManagerId: 'actor-pm-1',
  regionalManagerName: 'PM Galmudug',
  doctorName: 'Dr. Galmudug',
  targetPatients: 600,
  targetScreenings: 500,
  targetSurgeries: 400,
  startDate: '2025-01-01',
  endDate: '2025-12-31',
  status: 'On Track' as const,
  notes: '',
};

const galmudugPlan: CampaignRegion = {
  id: 'plan-galmudug-1',
  ...regionInput,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

describe('getAllCampaigns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.patient.count).mockResolvedValue(0);
    vi.mocked(prisma.screening.count).mockResolvedValue(0);
    vi.mocked(prisma.surgery.count).mockResolvedValue(0);
    vi.mocked(prisma.followUp.count).mockResolvedValue(0);
  });

  it('scopes returned campaign sub-regions to the Project Manager assignment', async () => {
    mockRequireActor(galmudugPM);
    const sharedCampaign: Campaign = {
      ...galmudugCampaign,
      region: '',
      operationDistrict: '',
      projectManagerId: '',
      projectManagerName: '',
      regions: [
        galmudugPlan,
        {
          ...galmudugPlan,
          id: 'plan-banadir-1',
          region: 'Banadir / Mogadishu',
          operationDistrict: 'Mogadishu',
          regionalManagerId: 'actor-pm-2',
          regionalManagerName: 'PM Banadir',
          doctorName: 'Dr. Banadir',
          doctorNameKey: 'dr. banadir',
        },
      ],
    };
    vi.mocked(campaignApi.getAllCampaigns).mockResolvedValue([sharedCampaign]);

    const rows = await getAllCampaigns();

    expect(campaignApi.getAllCampaigns).toHaveBeenCalledWith({
      OR: [
        { projectManagerId: 'actor-pm-1' },
        { regions: { some: { regionalManagerId: 'actor-pm-1' } } },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].regions?.map((plan) => plan.region)).toEqual(['Galmudug']);
  });

  it('hides same-region sub-regions that are not assigned to the Project Manager', async () => {
    mockRequireActor(galmudugPM);
    const sharedCampaign: Campaign = {
      ...galmudugCampaign,
      projectManagerId: '',
      projectManagerName: '',
      regions: [
        galmudugPlan,
        {
          ...galmudugPlan,
          id: 'plan-galmudug-other',
          regionalManagerId: 'actor-pm-other',
          regionalManagerName: 'Other PM',
          doctorName: 'Dr. Other',
          doctorNameKey: 'dr. other',
        },
      ],
    };
    vi.mocked(campaignApi.getAllCampaigns).mockResolvedValue([sharedCampaign]);

    const rows = await getAllCampaigns();

    expect(rows).toHaveLength(1);
    expect(rows[0].regions?.map((plan) => plan.id)).toEqual(['plan-galmudug-1']);
  });
});

describe('actionCreateCampaign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.patient.count).mockResolvedValue(0);
    vi.mocked(prisma.screening.count).mockResolvedValue(0);
    vi.mocked(prisma.surgery.count).mockResolvedValue(0);
    vi.mocked(prisma.followUp.count).mockResolvedValue(0);
    vi.mocked(authServer.ensureRegionAccess).mockReturnValue(null);
    vi.mocked(authServer.auditLog).mockResolvedValue(undefined);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'actor-pm-1',
      name: 'PM Galmudug',
      role: 'ProjectManager',
      assignedRegion: 'Galmudug',
      active: true,
    } as never);
    vi.mocked(campaignApi.createCampaign).mockResolvedValue(galmudugCampaign);
  });

  it('Super Admin can create a parent campaign without sub-regions', async () => {
    mockRequireActor(superAdmin);
    const result = await actionCreateCampaign(campaignInput);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.id).toBe('camp-galmudug-1');
    expect(campaignApi.createCampaign).toHaveBeenCalledOnce();
    expect(campaignApi.createCampaign).toHaveBeenCalledWith(expect.objectContaining({
      region: '',
      operationDistrict: '',
      projectManagerId: '',
      projectManagerName: '',
    }));
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects when actor lacks create permission', async () => {
    vi.mocked(authServer.requireActor).mockResolvedValue({ error: 'Forbidden: insufficient permissions' });
    const result = await actionCreateCampaign(campaignInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Forbidden/);
    expect(campaignApi.createCampaign).not.toHaveBeenCalled();
  });

  it('rejects missing required fields', async () => {
    mockRequireActor(superAdmin);
    const result = await actionCreateCampaign({ name: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeTruthy();
  });

  it('rejects invalid date ranges', async () => {
    mockRequireActor(superAdmin);
    const result = await actionCreateCampaign({ ...campaignInput, startDate: '2025-12-31', endDate: '2025-01-01' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/End date/);
  });

  it('rejects unregistered project managers when a campaign-level manager is supplied', async () => {
    mockRequireActor(superAdmin);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const result = await actionCreateCampaign({
      ...campaignInput,
      region: 'Galmudug',
      operationDistrict: 'Dhuusamareeb',
      projectManagerId: 'actor-pm-1',
      projectManagerName: 'PM Galmudug',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/registered user/);
  });

  it('auditLog is called on success', async () => {
    mockRequireActor(superAdmin);
    await actionCreateCampaign(campaignInput);
    expect(authServer.auditLog).toHaveBeenCalledOnce();
  });
});

describe('actionUpdateCampaign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.patient.count).mockResolvedValue(0);
    vi.mocked(prisma.screening.count).mockResolvedValue(0);
    vi.mocked(prisma.surgery.count).mockResolvedValue(0);
    vi.mocked(prisma.followUp.count).mockResolvedValue(0);
    vi.mocked(authServer.ensureRegionAccess).mockReturnValue(null);
    vi.mocked(authServer.auditLog).mockResolvedValue(undefined);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'actor-pm-1',
      name: 'PM Galmudug',
      role: 'ProjectManager',
      assignedRegion: 'Galmudug',
      active: true,
    } as never);
    vi.mocked(campaignApi.getCampaignById).mockResolvedValue(galmudugCampaign);
    vi.mocked(campaignApi.updateCampaign).mockResolvedValue(galmudugCampaign);
  });

  it('Super Admin can update a campaign', async () => {
    mockRequireActor(superAdmin);
    const result = await actionUpdateCampaign('camp-galmudug-1', campaignInput);
    expect(result.ok).toBe(true);
  });

  it('rejects campaign date range that excludes an existing sub-region', async () => {
    mockRequireActor(superAdmin);
    const result = await actionUpdateCampaign('camp-galmudug-1', { ...campaignInput, startDate: '2025-02-01' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/sub-region dates/);
  });

  it('banadir PM cannot edit galmudug campaign', async () => {
    mockRequireActor(banadiPM);
    const result = await actionUpdateCampaign('camp-galmudug-1', campaignInput);
    expect(result.ok).toBe(false);
  });
});

describe('actionCreateCampaignRegion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.patient.count).mockResolvedValue(0);
    vi.mocked(prisma.screening.count).mockResolvedValue(0);
    vi.mocked(prisma.surgery.count).mockResolvedValue(0);
    vi.mocked(prisma.followUp.count).mockResolvedValue(0);
    vi.mocked(authServer.ensureRegionAccess).mockReturnValue(null);
    vi.mocked(authServer.auditLog).mockResolvedValue(undefined);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'actor-pm-1',
      name: 'PM Galmudug',
      role: 'ProjectManager',
      assignedRegion: 'Galmudug',
      active: true,
    } as never);
    vi.mocked(campaignApi.getCampaignById).mockResolvedValue(galmudugCampaign);
    vi.mocked(campaignApi.createCampaignRegion).mockResolvedValue(galmudugPlan);
    vi.mocked(prisma.campaignRegion.findFirst).mockResolvedValue(null);
  });

  it('adds one sub-region to a campaign', async () => {
    mockRequireActor(superAdmin);
    const result = await actionCreateCampaignRegion(regionInput);
    expect(result.ok).toBe(true);
    expect(campaignApi.createCampaignRegion).toHaveBeenCalledOnce();
  });

  it('blocks duplicate contract type for the same sub-region inside the same campaign', async () => {
    mockRequireActor(superAdmin);
    vi.mocked(prisma.campaignRegion.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'existing' } as never);
    const result = await actionCreateCampaignRegion(regionInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/already exists/);
  });

  it('blocks sub-region dates outside parent campaign range', async () => {
    mockRequireActor(superAdmin);
    const result = await actionCreateCampaignRegion({ ...regionInput, endDate: '2026-01-01' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/within the parent campaign/);
  });

  it('blocks a project manager assigned to another sub-region', async () => {
    mockRequireActor(superAdmin);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'actor-pm-2',
      name: 'PM Banadir',
      role: 'ProjectManager',
      assignedRegion: 'Banadir / Mogadishu',
      active: true,
    } as never);
    const result = await actionCreateCampaignRegion({
      ...regionInput,
      regionalManagerId: 'actor-pm-2',
      regionalManagerName: 'PM Banadir',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not Galmudug/);
  });
});

describe('campaign deletion safeguards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authServer.ensureRegionAccess).mockReturnValue(null);
    vi.mocked(authServer.auditLog).mockResolvedValue(undefined);
    vi.mocked(campaignApi.getCampaignById).mockResolvedValue(galmudugCampaign);
    vi.mocked(campaignApi.deleteCampaign).mockResolvedValue(undefined);
    vi.mocked(campaignApi.deleteCampaignRegion).mockResolvedValue(undefined);
    vi.mocked(prisma.campaignRegion.findUnique).mockResolvedValue({
      id: 'plan-galmudug-1',
      campaignId: 'camp-galmudug-1',
      region: 'Galmudug',
      operationDistrict: 'Dhuusamareeb',
      type: 'CataractSurgeryOutreach',
      regionalManagerId: 'actor-pm-1',
      regionalManagerName: 'PM Galmudug',
      doctorName: 'Dr. Galmudug',
      doctorNameKey: 'dr. galmudug',
      targetPatients: 600,
      targetScreenings: 500,
      targetSurgeries: 400,
      startDate: new Date('2025-01-01T00:00:00.000Z'),
      endDate: new Date('2025-12-31T00:00:00.000Z'),
      status: 'OnTrack',
      notes: '',
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    } as never);
    vi.mocked(prisma.patient.count).mockResolvedValue(0);
    vi.mocked(prisma.screening.count).mockResolvedValue(0);
    vi.mocked(prisma.surgery.count).mockResolvedValue(0);
    vi.mocked(prisma.followUp.count).mockResolvedValue(0);
  });

  it('blocks campaign deletion when clinical records are linked', async () => {
    mockRequireActor(superAdmin);
    vi.mocked(prisma.screening.count).mockResolvedValue(2);

    const result = await actionDeleteCampaign('camp-galmudug-1');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Cannot delete this campaign.*2 screenings.*Suspended\/Completed/);
    expect(campaignApi.deleteCampaign).not.toHaveBeenCalled();
  });

  it('deletes campaign when no clinical records are linked', async () => {
    mockRequireActor(superAdmin);

    const result = await actionDeleteCampaign('camp-galmudug-1');

    expect(result.ok).toBe(true);
    expect(campaignApi.deleteCampaign).toHaveBeenCalledWith('camp-galmudug-1');
  });

  it('blocks sub-region removal when clinical records are linked', async () => {
    mockRequireActor(superAdmin);
    vi.mocked(prisma.patient.count).mockResolvedValue(1);
    vi.mocked(prisma.surgery.count).mockResolvedValue(1);

    const result = await actionDeleteCampaignRegion('plan-galmudug-1');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Cannot delete this sub-region.*1 patient.*1 surgery/);
    expect(campaignApi.deleteCampaignRegion).not.toHaveBeenCalled();
  });
});
