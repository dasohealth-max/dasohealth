import { describe, it, expect, vi, beforeEach } from 'vitest';
import { superAdmin, galmudugPM, banadiPM } from '../mocks/actors';
import { galmudugCampaign, campaignInput } from '../mocks/data';

// ── Module mocks (hoisted before imports) ─────────────────────────────────────

vi.mock('@/lib/auth-server', () => ({
  requireActor: vi.fn(),
  ensureRegionAccess: vi.fn(),
  auditLog: vi.fn().mockResolvedValue(undefined),
  scopedRegionWhere: vi.fn(() => ({})),
  isSuperAdmin: vi.fn((actor: { role: string }) => actor.role === 'Super Administrator'),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    campaign: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/lib/api/campaigns', () => ({
  getAllCampaigns: vi.fn(),
  createCampaign: vi.fn(),
  updateCampaign: vi.fn(),
  deleteCampaign: vi.fn(),
  getCampaignById: vi.fn(),
}));

// Import after mocks are registered
import { actionCreateCampaign, actionUpdateCampaign } from '@/app/actions/campaigns';
import * as authServer from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import * as campaignApi from '@/lib/api/campaigns';

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockRequireActor(actor: typeof superAdmin | typeof galmudugPM) {
  vi.mocked(authServer.requireActor).mockResolvedValue(actor);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('actionCreateCampaign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authServer.ensureRegionAccess).mockReturnValue(null);
    vi.mocked(authServer.auditLog).mockResolvedValue(undefined);
    vi.mocked(prisma.campaign.findFirst).mockResolvedValue(null);
    vi.mocked(campaignApi.createCampaign).mockResolvedValue(galmudugCampaign);
  });

  it('Super Admin can create a campaign', async () => {
    mockRequireActor(superAdmin);
    const result = await actionCreateCampaign(campaignInput);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.region).toBe('Galmudug');
    expect(campaignApi.createCampaign).toHaveBeenCalledOnce();
  });

  it('rejects when actor lacks create permission', async () => {
    vi.mocked(authServer.requireActor).mockResolvedValue({ error: 'Forbidden: insufficient permissions' });
    const result = await actionCreateCampaign(campaignInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Forbidden/);
    expect(campaignApi.createCampaign).not.toHaveBeenCalled();
  });

  it('rejects duplicate Active campaign in the same region', async () => {
    mockRequireActor(superAdmin);
    vi.mocked(prisma.campaign.findFirst).mockResolvedValue({
      name: 'Existing Galmudug Campaign',
    } as never);
    const result = await actionCreateCampaign(campaignInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/already has an active campaign/);
    expect(campaignApi.createCampaign).not.toHaveBeenCalled();
  });

  it('PM is blocked when ensureRegionAccess denies', async () => {
    mockRequireActor(galmudugPM);
    vi.mocked(authServer.ensureRegionAccess).mockReturnValue({
      ok: false,
      error: 'Forbidden: region access denied',
    });
    const result = await actionCreateCampaign({ ...campaignInput, region: 'Banadir / Mogadishu' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/region access denied/);
  });

  it('rejects invalid region string', async () => {
    mockRequireActor(superAdmin);
    const result = await actionCreateCampaign({ ...campaignInput, region: 'InvalidRegion' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeTruthy();
  });

  it('rejects missing required fields', async () => {
    mockRequireActor(superAdmin);
    const result = await actionCreateCampaign({ name: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeTruthy();
  });

  it('PM can create a campaign in their own region', async () => {
    mockRequireActor(galmudugPM);
    vi.mocked(authServer.ensureRegionAccess).mockReturnValue(null);
    vi.mocked(campaignApi.createCampaign).mockResolvedValue(galmudugCampaign);
    const result = await actionCreateCampaign(campaignInput);
    expect(result.ok).toBe(true);
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
    vi.mocked(prisma.campaign.findFirst).mockResolvedValue(null);
    vi.mocked(campaignApi.getCampaignById).mockResolvedValue(galmudugCampaign);
    vi.mocked(campaignApi.updateCampaign).mockResolvedValue(galmudugCampaign);
  });

  it('Super Admin can update a campaign', async () => {
    mockRequireActor(superAdmin);
    const result = await actionUpdateCampaign('camp-galmudug-1', campaignInput);
    expect(result.ok).toBe(true);
  });

  it('rejects Active status update when another Active campaign exists in same region', async () => {
    mockRequireActor(superAdmin);
    vi.mocked(prisma.campaign.findFirst).mockResolvedValue({
      name: 'Conflicting Active Campaign',
    } as never);
    const result = await actionUpdateCampaign('camp-galmudug-1', campaignInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/already has an active campaign/);
  });

  it('banadir PM cannot edit galmudug campaign', async () => {
    mockRequireActor(banadiPM);
    vi.mocked(authServer.ensureRegionAccess).mockReturnValue({
      ok: false,
      error: 'Forbidden: region access denied',
    });
    const result = await actionUpdateCampaign('camp-galmudug-1', campaignInput);
    expect(result.ok).toBe(false);
  });
});
