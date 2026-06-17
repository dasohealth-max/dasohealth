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
  },
}));

vi.mock('@/lib/api/screenings', () => ({
  getAllScreenings: vi.fn(),
  createScreening: vi.fn(),
  updateScreening: vi.fn(),
  deleteScreening: vi.fn(),
  fromPrisma: vi.fn(),
}));

import { actionCreateScreening } from '@/app/actions/screenings';
import * as authServer from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import * as screeningApi from '@/lib/api/screenings';

const patientScope = {
  id: 'patient-1',
  fullName: 'Amina Hassan',
  campaignId: 'camp-galmudug-1',
  campaignRegionId: 'plan-galmudug-1',
  region: 'Galmudug',
  operationDistrict: 'Dhuusamareeb',
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
      data: { screeningStatus: 'Screened' },
    });
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
        status: 'Scheduled',
        preOpVa: '6/60',
      }),
    });
  });

  it('does not create surgery for non-surgery recommendations', async () => {
    vi.mocked(screeningApi.createScreening).mockResolvedValue({
      ...createdScreening,
      recommendation: 'No Surgery - Release',
    });

    const result = await actionCreateScreening({
      ...screeningInput,
      recommendation: 'No Surgery - Release',
    });

    expect(result.ok).toBe(true);
    expect(prisma.surgery.create).not.toHaveBeenCalled();
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
