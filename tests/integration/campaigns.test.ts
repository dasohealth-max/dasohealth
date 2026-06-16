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
  createCampaignRegion: vi.fn(),
  updateCampaignRegion: vi.fn(),
  deleteCampaignRegion: vi.fn(),
}));

import { actionCreateCampaign, actionCreateCampaignRegion, actionUpdateCampaign } from '@/app/actions/campaigns';
import * as authServer from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import * as campaignApi from '@/lib/api/campaigns';
import type { CampaignRegion } from '@/types';

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

describe('actionCreateCampaign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('Super Admin can create a parent campaign without regional plans', async () => {
    mockRequireActor(superAdmin);
    const result = await actionCreateCampaign(campaignInput);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.id).toBe('camp-galmudug-1');
    expect(campaignApi.createCampaign).toHaveBeenCalledOnce();
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

  it('rejects unregistered project managers', async () => {
    mockRequireActor(superAdmin);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const result = await actionCreateCampaign(campaignInput);
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

  it('rejects campaign date range that excludes an existing regional plan', async () => {
    mockRequireActor(superAdmin);
    const result = await actionUpdateCampaign('camp-galmudug-1', { ...campaignInput, startDate: '2025-02-01' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/regional plan dates/);
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

  it('adds one regional plan to a campaign', async () => {
    mockRequireActor(superAdmin);
    const result = await actionCreateCampaignRegion(regionInput);
    expect(result.ok).toBe(true);
    expect(campaignApi.createCampaignRegion).toHaveBeenCalledOnce();
  });

  it('blocks duplicate sub-contract type for the same region inside the same campaign', async () => {
    mockRequireActor(superAdmin);
    vi.mocked(prisma.campaignRegion.findFirst).mockResolvedValue({ id: 'existing' } as never);
    const result = await actionCreateCampaignRegion(regionInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/already exists/);
  });

  it('blocks regional plan dates outside parent campaign range', async () => {
    mockRequireActor(superAdmin);
    const result = await actionCreateCampaignRegion({ ...regionInput, endDate: '2026-01-01' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/within the parent campaign/);
  });

  it('blocks a regional manager assigned to another region', async () => {
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
