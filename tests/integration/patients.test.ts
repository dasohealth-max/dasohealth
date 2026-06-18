import { describe, it, expect, vi, beforeEach } from 'vitest';
import { superAdmin, galmudugClerk, banadiPM } from '../mocks/actors';
import { galmudugPatient, patientInput } from '../mocks/data';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/auth-server', () => ({
  requireActor: vi.fn(),
  ensureRegionAccess: vi.fn(),
  isSuperAdmin: vi.fn((actor: { role: string }) => actor.role === 'Super Administrator'),
  auditLog: vi.fn().mockResolvedValue(undefined),
  scopedRegionWhere: vi.fn(() => ({})),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    campaignRegion: { findFirst: vi.fn() },
    patient: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('@/lib/api/patients', () => ({
  fromPrisma: vi.fn(),
  getAllPatients: vi.fn(),
  getPatientById: vi.fn(),
}));

vi.mock('@/lib/api/campaigns', () => ({
  getAllCampaigns: vi.fn(),
}));

// Imports after mocks
import { actionCreatePatient, getPatientRegistrationCampaigns } from '@/app/actions/patients';
import * as authServer from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import * as patientApi from '@/lib/api/patients';
import * as campaignApi from '@/lib/api/campaigns';
import { galmudugCampaign } from '../mocks/data';

// ── Helpers ───────────────────────────────────────────────────────────────────

const campaignScope = { id: 'plan-galmudug-1', region: 'Galmudug', operationDistrict: 'Dhuusamareeb' };

const rawPatientRow = {
  id: 'patient-1',
  patientCode: 'CS-GM-0001',
  fullName: 'Amina Hassan',
  dateOfBirth: new Date('1965-03-12'),
  sex: 'Female',
  phone: '+252612345678',
  email: null,
  district: 'Dhuusamareeb',
  region: 'Galmudug',
  operationDistrict: 'Dhuusamareeb',
  occupation: null,
  education: null,
  disabilityStatus: 'Visual',
  insuranceStatus: 'None',
  emergencyContact: 'Hassan Ali',
  emergencyPhone: '+252612345679',
  consentGiven: true,
  consentDate: new Date('2025-02-01'),
  campaignId: 'camp-galmudug-1',
  campaignRegionId: 'plan-galmudug-1',
  referralSource: 'Community',
  notes: null,
  registeredById: 'actor-clerk-1',
  registeredByName: 'Clerk Galmudug',
  screeningStatus: 'AwaitingScreening',
  createdAt: new Date('2025-02-01T08:00:00.000Z'),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getPatientRegistrationCampaigns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Data Clerk receives only assigned-region campaign sub-regions for patient registration', async () => {
    vi.mocked(authServer.requireActor).mockResolvedValue(galmudugClerk);
    vi.mocked(campaignApi.getAllCampaigns).mockResolvedValue([
      {
        ...galmudugCampaign,
        region: '',
        operationDistrict: '',
        regions: [
          ...(galmudugCampaign.regions ?? []),
          {
            ...(galmudugCampaign.regions ?? [])[0],
            id: 'plan-banadir-1',
            region: 'Banadir / Mogadishu',
            operationDistrict: 'Mogadishu',
            regionalManagerId: 'actor-pm-2',
            regionalManagerName: 'PM Banadir',
          },
        ],
      },
    ]);

    const rows = await getPatientRegistrationCampaigns();

    expect(campaignApi.getAllCampaigns).toHaveBeenCalledWith({
      regions: { some: { region: 'Galmudug' } },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].regions?.map((plan) => plan.region)).toEqual(['Galmudug']);
  });
});

describe('actionCreatePatient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.patient.findFirst).mockReset();
    vi.mocked(prisma.patient.create).mockReset();
    vi.mocked(prisma.$queryRaw).mockReset();
    vi.mocked(authServer.ensureRegionAccess).mockReturnValue(null);
    vi.mocked(authServer.auditLog).mockResolvedValue(undefined);
    vi.mocked(prisma.campaignRegion.findFirst).mockResolvedValue(campaignScope as never);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ max: 0 }] as never);
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.patient.create).mockResolvedValue(rawPatientRow as never);
    vi.mocked(patientApi.fromPrisma).mockReturnValue(galmudugPatient);
  });

  it('Clerk can register a patient', async () => {
    vi.mocked(authServer.requireActor).mockResolvedValue(galmudugClerk);
    vi.mocked(prisma.patient.findFirst).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    const result = await actionCreatePatient(patientInput);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.region).toBe('Galmudug');
      expect(result.data.campaignId).toBe('camp-galmudug-1');
    }
  });

  it('patient region and district are derived from campaign, not client input', async () => {
    vi.mocked(authServer.requireActor).mockResolvedValue(galmudugClerk);
    vi.mocked(prisma.patient.findFirst).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    await actionCreatePatient(patientInput);
    // The create call must use campaign-derived region, not an arbitrary client value
    expect(prisma.patient.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          region: 'Galmudug',
          operationDistrict: 'Dhuusamareeb',
        }),
      }),
    );
  });

  it('rejects when campaign is not found', async () => {
    vi.mocked(authServer.requireActor).mockResolvedValue(galmudugClerk);
    vi.mocked(prisma.campaignRegion.findFirst).mockResolvedValue(null);
    const result = await actionCreatePatient(patientInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Sub-region not found/);
  });

  it('Banadir PM cannot register patient into Galmudug campaign', async () => {
    vi.mocked(authServer.requireActor).mockResolvedValue(banadiPM);
    vi.mocked(authServer.ensureRegionAccess).mockReturnValue({
      ok: false,
      error: 'Forbidden: region access denied',
    });
    const result = await actionCreatePatient(patientInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/region access denied/);
    expect(prisma.patient.create).not.toHaveBeenCalled();
  });

  it('rejects missing required fields', async () => {
    vi.mocked(authServer.requireActor).mockResolvedValue(galmudugClerk);
    const result = await actionCreatePatient({ fullName: '' });
    expect(result.ok).toBe(false);
  });

  it('rejects when actor lacks create permission', async () => {
    vi.mocked(authServer.requireActor).mockResolvedValue({ error: 'Forbidden: insufficient permissions' });
    const result = await actionCreatePatient(patientInput);
    expect(result.ok).toBe(false);
  });

  it('generates patient code starting at CS-region-0001 when no matching regional codes exist', async () => {
    vi.mocked(authServer.requireActor).mockResolvedValue(superAdmin);
    vi.mocked(prisma.patient.findFirst).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    await actionCreatePatient(patientInput);
    expect(prisma.patient.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          patientCode: 'CS-GM-0001',
        }),
      }),
    );
  });

  it('increments patient code when patients already exist', async () => {
    vi.mocked(authServer.requireActor).mockResolvedValue(superAdmin);
    vi.mocked(prisma.patient.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
      patientCode: 'CS-GM-0042',
    } as never);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ max: 42 }] as never);
    await actionCreatePatient(patientInput);
    expect(prisma.patient.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          patientCode: 'CS-GM-0043',
        }),
      }),
    );
  });

  it('rejects invalid phone numbers before creating a patient', async () => {
    vi.mocked(authServer.requireActor).mockResolvedValue(galmudugClerk);
    const result = await actionCreatePatient({ ...patientInput, phone: 'abc' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Phone must be/);
    expect(prisma.patient.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate patient name and phone inside the same campaign', async () => {
    vi.mocked(authServer.requireActor).mockResolvedValue(galmudugClerk);
    vi.mocked(prisma.patient.findFirst).mockResolvedValueOnce({
      patientCode: 'CS-GM-0007',
      fullName: 'Amina Hassan',
    } as never);

    const result = await actionCreatePatient(patientInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Possible duplicate patient/);
    expect(prisma.patient.create).not.toHaveBeenCalled();
  });
});
