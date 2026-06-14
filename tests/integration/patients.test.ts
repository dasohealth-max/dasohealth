import { describe, it, expect, vi, beforeEach } from 'vitest';
import { superAdmin, galmudugClerk, banadiPM } from '../mocks/actors';
import { galmudugPatient, patientInput } from '../mocks/data';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/auth-server', () => ({
  requireActor: vi.fn(),
  ensureRegionAccess: vi.fn(),
  auditLog: vi.fn().mockResolvedValue(undefined),
  scopedRegionWhere: vi.fn(() => ({})),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    campaign: { findUnique: vi.fn() },
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

// Imports after mocks
import { actionCreatePatient } from '@/app/actions/patients';
import * as authServer from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import * as patientApi from '@/lib/api/patients';

// ── Helpers ───────────────────────────────────────────────────────────────────

const campaignScope = { region: 'Galmudug', operationDistrict: 'Dhuusamareeb' };

const rawPatientRow = {
  id: 'patient-1',
  patientCode: 'EC-2025-0001',
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
  referralSource: 'Community',
  notes: null,
  registeredById: 'actor-clerk-1',
  registeredByName: 'Clerk Galmudug',
  screeningStatus: 'AwaitingScreening',
  createdAt: new Date('2025-02-01T08:00:00.000Z'),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('actionCreatePatient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authServer.ensureRegionAccess).mockReturnValue(null);
    vi.mocked(authServer.auditLog).mockResolvedValue(undefined);
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(campaignScope as never);
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
    vi.mocked(prisma.campaign.findUnique).mockResolvedValue(null);
    const result = await actionCreatePatient(patientInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Campaign not found/);
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

  it('generates patient code starting at EC-<year>-0001 when no patients exist', async () => {
    vi.mocked(authServer.requireActor).mockResolvedValue(superAdmin);
    vi.mocked(prisma.patient.findFirst).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    await actionCreatePatient(patientInput);
    expect(prisma.patient.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          patientCode: `EC-${new Date().getFullYear()}-0001`,
        }),
      }),
    );
  });

  it('increments patient code when patients already exist', async () => {
    vi.mocked(authServer.requireActor).mockResolvedValue(superAdmin);
    vi.mocked(prisma.patient.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
      patientCode: `EC-${new Date().getFullYear()}-0042`,
    } as never);
    await actionCreatePatient(patientInput);
    expect(prisma.patient.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          patientCode: `EC-${new Date().getFullYear()}-0043`,
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
      patientCode: 'EC-2026-0007',
      fullName: 'Amina Hassan',
    } as never);

    const result = await actionCreatePatient(patientInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Possible duplicate patient/);
    expect(prisma.patient.create).not.toHaveBeenCalled();
  });
});
