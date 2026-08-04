import { beforeEach, describe, expect, it, vi } from 'vitest';
import { superAdmin } from '../mocks/actors';

vi.mock('@/lib/auth-server', () => ({
  requireActor: vi.fn(),
  ensureRegionAccess: vi.fn(),
  isSuperAdmin: vi.fn(() => true),
  scopedRegionWhere: vi.fn(() => ({})),
  auditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/api/patients', () => ({
  fromPrisma: vi.fn(),
  getAllPatients: vi.fn(),
  getPatientById: vi.fn(),
}));

vi.mock('@/lib/api/campaigns', () => ({ getAllCampaigns: vi.fn() }));

vi.mock('@/lib/prisma', () => ({
  prisma: (() => {
    const db = {
      patient: { delete: vi.fn(), update: vi.fn() },
      surgery: { updateMany: vi.fn() },
    };
    return {
      ...db,
      $transaction: vi.fn((callback: (tx: typeof db) => unknown) => callback(db)),
    };
  })(),
}));

import { actionDeletePatient, actionRestorePatient } from '@/app/actions/patients';
import * as authServer from '@/lib/auth-server';
import * as patientApi from '@/lib/api/patients';
import { prisma } from '@/lib/prisma';

describe('patient archive-only lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authServer.requireActor).mockResolvedValue(superAdmin);
  });

  it('permanently blocks patient deletion without touching the database', async () => {
    const result = await actionDeletePatient('patient-1');

    expect(result).toEqual({
      ok: false,
      error: 'Patient records cannot be permanently deleted. Archive the patient record instead.',
    });
    expect(prisma.patient.delete).not.toHaveBeenCalled();
  });

  it('restores the patient record without rescheduling archived surgery placements', async () => {
    vi.mocked(patientApi.getPatientById).mockResolvedValue({
      id: 'patient-1',
      patientCode: 'CS-GM-0001',
      fullName: 'Amina Hassan',
      region: 'Galmudug',
      campaignId: 'campaign-1',
      archivedAt: '2026-08-04T00:00:00.000Z',
    } as never);
    vi.mocked(authServer.ensureRegionAccess).mockReturnValue(null);
    vi.mocked(prisma.patient.update).mockResolvedValue({} as never);

    const result = await actionRestorePatient('patient-1', 'Archive request was approved for the wrong duplicate');

    expect(result).toEqual({ ok: true, data: null });
    expect(prisma.patient.update).toHaveBeenCalledWith({
      where: { id: 'patient-1' },
      data: {
        archivedAt: null,
        archivedById: null,
        archivedByName: null,
        archivedReason: null,
      },
    });
    expect(prisma.surgery.updateMany).not.toHaveBeenCalled();
    expect(authServer.auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'restore',
        entity: 'Patient',
        details: expect.stringContaining('Archive request was approved for the wrong duplicate'),
      }),
      expect.anything(),
    );
  });
});
