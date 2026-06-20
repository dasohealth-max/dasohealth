import { describe, it, expect, vi, beforeEach } from 'vitest';
import { banadiPM, galmudugScreener } from '../mocks/actors';
import type { Screening } from '@/types';

vi.mock('@/lib/auth-server', () => ({
  requireActor: vi.fn(),
  ensureRegionAccess: vi.fn(),
  auditLog: vi.fn().mockResolvedValue(undefined),
  scopedRegionWhere: vi.fn(() => ({})),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    patient: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    surgery: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    campaignRegion: {
      findUnique: vi.fn(),
    },
    screening: {
      findUnique: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('@/lib/api/screenings', () => ({
  getAllScreenings: vi.fn(),
  createScreening: vi.fn(),
  updateScreening: vi.fn(),
  deleteScreening: vi.fn(),
  fromPrisma: vi.fn(),
}));

import { actionCreateScreening, actionDeleteScreening, actionUpdateScreening } from '@/app/actions/screenings';
import * as authServer from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import * as screeningApi from '@/lib/api/screenings';

const patientScope = {
  id: 'patient-1',
  patientCode: 'CS-GM-0001',
  fullName: 'Amina Hassan',
  campaignId: 'camp-galmudug-1',
  campaignRegionId: 'plan-galmudug-1',
  region: 'Galmudug',
  operationDistrict: 'Dhuusamareeb',
  consentGiven: true,
  consentDate: new Date('2025-02-15'),
};

const screeningInput = {
  patientId: 'patient-1',
  patientName: 'Client Supplied Name',
  campaignId: 'client-campaign',
  campaignRegionId: 'client-plan',
  region: 'Banadir / Mogadishu',
  operationDistrict: 'Mogadishu',
  screenedBy: '',
  screenedById: '',
  screenedByName: '',
  screenedAt: '2025-02-15T09:00:00.000Z',
  vaRightUnaided: '6/60' as const,
  vaLeftUnaided: '6/18' as const,
  vaRightCorrected: '6/36' as const,
  vaLeftCorrected: '6/12' as const,
  iopRight: 16,
  iopLeft: 17,
  cataractSuspected: true,
  glaucomaSuspected: false,
  diabeticRetinopathy: false,
  eye: 'Right' as const,
  otherFindings: '',
  medicalHistory: '',
  currentMedications: '',
  recommendation: 'Refer for Surgery' as const,
  notes: 'Needs surgery',
};

const createdScreening: Screening = {
  id: 'screening-1',
  ...screeningInput,
  patientName: 'Amina Hassan',
  campaignId: 'camp-galmudug-1',
  campaignRegionId: 'plan-galmudug-1',
  region: 'Galmudug',
  operationDistrict: 'Dhuusamareeb',
  screenedBy: 'Screener Galmudug',
  screenedById: 'actor-screener-1',
  screenedByName: 'Screener Galmudug',
  createdAt: '2025-02-15T09:01:00.000Z',
};

describe('actionCreateScreening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authServer.requireActor).mockResolvedValue(galmudugScreener);
    vi.mocked(authServer.ensureRegionAccess).mockReturnValue(null);
    vi.mocked(authServer.auditLog).mockResolvedValue(undefined);
    vi.mocked(prisma.patient.findUnique).mockResolvedValue(patientScope as never);
    vi.mocked(prisma.patient.update).mockResolvedValue({} as never);
    vi.mocked(prisma.surgery.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.surgery.create).mockResolvedValue({} as never);
    vi.mocked(prisma.campaignRegion.findUnique).mockResolvedValue({ doctorName: 'Dr. Galmudug' } as never);
    vi.mocked(screeningApi.createScreening).mockResolvedValue(createdScreening);
  });

  it('records screening using patient campaign and sub-region data', async () => {
    const result = await actionCreateScreening(screeningInput);

    expect(result.ok).toBe(true);
    expect(screeningApi.createScreening).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'patient-1',
        patientName: 'Amina Hassan',
        campaignId: 'camp-galmudug-1',
        campaignRegionId: 'plan-galmudug-1',
        region: 'Galmudug',
        operationDistrict: 'Dhuusamareeb',
        screenedById: 'actor-screener-1',
        screenedByName: 'Screener Galmudug',
      }),
    );
  });

  it('marks the registered patient as screened', async () => {
    await actionCreateScreening(screeningInput);

    expect(prisma.patient.update).toHaveBeenCalledWith({
      where: { id: 'patient-1' },
      data: expect.objectContaining({ screeningStatus: 'Screened' }),
    });
  });

  it('rejects surgery referral when patient consent is not recorded', async () => {
    vi.mocked(prisma.patient.findUnique).mockResolvedValue({
      ...patientScope,
      consentGiven: false,
      consentDate: null,
    } as never);

    const result = await actionCreateScreening({
      ...screeningInput,
      surgeryConsentGiven: false,
      surgeryConsentDate: '',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/consent is required/i);
    expect(screeningApi.createScreening).not.toHaveBeenCalled();
    expect(prisma.surgery.create).not.toHaveBeenCalled();
  });

  it('records surgery consent during screening and allows referral', async () => {
    vi.mocked(prisma.patient.findUnique).mockResolvedValue({
      ...patientScope,
      consentGiven: false,
      consentDate: null,
    } as never);

    const result = await actionCreateScreening({
      ...screeningInput,
      surgeryConsentGiven: true,
      surgeryConsentDate: '2025-02-15',
    });

    expect(result.ok).toBe(true);
    expect(prisma.patient.update).toHaveBeenCalledWith({
      where: { id: 'patient-1' },
      data: expect.objectContaining({
        screeningStatus: 'Screened',
        consentGiven: true,
        consentDate: new Date('2025-02-15'),
      }),
    });
    expect(prisma.surgery.create).toHaveBeenCalled();
  });

  it('routes surgery recommendations into a scheduled surgery record', async () => {
    await actionCreateScreening(screeningInput);

    expect(prisma.surgery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        patientId: 'patient-1',
        patientName: 'Amina Hassan',
        campaignId: 'camp-galmudug-1',
        campaignRegionId: 'plan-galmudug-1',
        region: 'Galmudug',
        operationDistrict: 'Dhuusamareeb',
        createdFromScreeningId: 'screening-1',
        surgeonName: 'Dr. Galmudug',
        eye: 'Right',
        status: 'Scheduled',
        preOpVa: '6/60',
      }),
    });
  });

  it('does not create surgery for non-surgery recommendations', async () => {
    vi.mocked(screeningApi.createScreening).mockResolvedValue({
      ...createdScreening,
      recommendation: 'Discharge',
    });

    const result = await actionCreateScreening({
      ...screeningInput,
      recommendation: 'Discharge',
    });

    expect(result.ok).toBe(true);
    expect(prisma.surgery.create).not.toHaveBeenCalled();
  });

  it('accepts Discharge as the canonical no-surgery recommendation', async () => {
    vi.mocked(screeningApi.createScreening).mockResolvedValue({
      ...createdScreening,
      recommendation: 'Discharge',
    });

    const result = await actionCreateScreening({
      ...screeningInput,
      recommendation: 'Discharge',
    });

    expect(result.ok).toBe(true);
    expect(screeningApi.createScreening).toHaveBeenCalledWith(
      expect.objectContaining({ recommendation: 'Discharge' }),
    );
    expect(prisma.surgery.create).not.toHaveBeenCalled();
  });

  it('rejects multiple clinical findings in one screening', async () => {
    const result = await actionCreateScreening({
      ...screeningInput,
      glaucomaSuspected: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/only one clinical finding/i);
    expect(screeningApi.createScreening).not.toHaveBeenCalled();
  });

  it('blocks cross-region screening from a different regional user', async () => {
    vi.mocked(authServer.requireActor).mockResolvedValue(banadiPM);
    vi.mocked(authServer.ensureRegionAccess).mockReturnValue({
      ok: false,
      error: 'Forbidden: region access denied',
    });

    const result = await actionCreateScreening(screeningInput);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/region access denied/);
    expect(screeningApi.createScreening).not.toHaveBeenCalled();
  });
});

describe('actionUpdateScreening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authServer.requireActor).mockResolvedValue(galmudugScreener);
    vi.mocked(authServer.ensureRegionAccess).mockReturnValue(null);
    vi.mocked(authServer.auditLog).mockResolvedValue(undefined);
    vi.mocked(prisma.patient.findUnique).mockResolvedValue(patientScope as never);
    vi.mocked(prisma.screening.findUnique).mockResolvedValue({
      id: 'screening-1',
      region: 'Galmudug',
    } as never);
    vi.mocked(prisma.surgery.findFirst).mockResolvedValue({
      id: 'surgery-1',
      status: 'Scheduled',
    } as never);
    vi.mocked(prisma.surgery.update).mockResolvedValue({} as never);
    vi.mocked(prisma.campaignRegion.findUnique).mockResolvedValue({ doctorName: 'Dr. Galmudug' } as never);
    vi.mocked(screeningApi.updateScreening).mockResolvedValue({
      ...createdScreening,
      eye: 'Both',
    });
  });

  it('syncs linked non-completed surgery eye when a screening edit changes the eye', async () => {
    const result = await actionUpdateScreening('screening-1', {
      ...screeningInput,
      eye: 'Both',
    });

    expect(result.ok).toBe(true);
    expect(prisma.surgery.update).toHaveBeenCalledWith({
      where: { id: 'surgery-1' },
      data: expect.objectContaining({
        createdFromScreeningId: 'screening-1',
        eye: 'Both',
        preOpVa: 'Right: 6/60 / Left: 6/18',
      }),
    });
  });

  it('does not rewrite linked surgery eye after the surgery is completed', async () => {
    vi.mocked(prisma.surgery.findFirst).mockResolvedValue({
      id: 'surgery-1',
      status: 'Completed',
    } as never);

    const result = await actionUpdateScreening('screening-1', {
      ...screeningInput,
      eye: 'Both',
    });

    expect(result.ok).toBe(true);
    expect(prisma.surgery.update).not.toHaveBeenCalled();
  });
});

describe('actionDeleteScreening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authServer.requireActor).mockResolvedValue(galmudugScreener);
    vi.mocked(authServer.ensureRegionAccess).mockReturnValue(null);
    vi.mocked(authServer.auditLog).mockResolvedValue(undefined);
    vi.mocked(prisma.screening.findUnique).mockResolvedValue({
      id: 'screening-1',
      patientId: 'patient-1',
      campaignId: 'camp-galmudug-1',
      region: 'Galmudug',
    } as never);
    vi.mocked(prisma.patient.update).mockResolvedValue({} as never);
    vi.mocked(screeningApi.deleteScreening).mockResolvedValue(undefined);
  });

  it('returns patient to awaiting screening when deleting their last screening', async () => {
    vi.mocked(prisma.screening.count).mockResolvedValue(0);

    const result = await actionDeleteScreening('screening-1');

    expect(result.ok).toBe(true);
    expect(prisma.patient.update).toHaveBeenCalledWith({
      where: { id: 'patient-1' },
      data: { screeningStatus: 'Awaiting Screening' },
    });
    if (result.ok) {
      expect(result.data).toEqual({
        patientId: 'patient-1',
        screeningStatus: 'Awaiting Screening',
      });
    }
  });

  it('keeps patient screened when other screenings remain', async () => {
    vi.mocked(prisma.screening.count).mockResolvedValue(1);

    const result = await actionDeleteScreening('screening-1');

    expect(result.ok).toBe(true);
    expect(prisma.patient.update).toHaveBeenCalledWith({
      where: { id: 'patient-1' },
      data: { screeningStatus: 'Screened' },
    });
  });
});
