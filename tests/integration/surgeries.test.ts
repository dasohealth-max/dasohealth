import { describe, it, expect, vi, beforeEach } from 'vitest';
import { superAdmin, banadiPM } from '../mocks/actors';
import { galmudugSurgery } from '../mocks/data';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/auth-server', () => ({
  requireActor: vi.fn(),
  ensureRegionAccess: vi.fn(),
  auditLog: vi.fn().mockResolvedValue(undefined),
  scopedRegionWhere: vi.fn(() => ({})),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    patient: { findUnique: vi.fn() },
    surgery: { findUnique: vi.fn() },
    followUp: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  },
}));

vi.mock('@/lib/api/surgeries', () => ({
  getAllSurgeries: vi.fn(),
  createSurgery: vi.fn(),
  updateSurgery: vi.fn(),
  deleteSurgery: vi.fn(),
  fromPrisma: vi.fn(),
}));

vi.mock('@/lib/prisma-enums', () => ({
  surgeryStatusFromApp: vi.fn((s: string) => s),
}));

// Imports after mocks
import { actionCreateSurgery, actionUpdateSurgery } from '@/app/actions/surgeries';
import * as authServer from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import * as surgeryApi from '@/lib/api/surgeries';
import { Prisma } from '@/lib/generated/prisma/client';

// ── Helpers ───────────────────────────────────────────────────────────────────

const patientScope = {
  id: 'patient-1',
  fullName: 'Amina Hassan',
  campaignId: 'camp-galmudug-1',
  region: 'Galmudug',
  operationDistrict: 'Dhuusamareeb',
};

const rawSurgeryRow = {
  id: 'surgery-1',
  region: 'Galmudug',
  status: 'Scheduled',
  performedAt: null,
};

const surgeryData = {
  patientId: 'patient-1',
  patientName: 'Amina Hassan',
  campaignId: 'camp-galmudug-1',
  region: 'Galmudug',
  operationDistrict: 'Dhuusamareeb',
  surgeonName: 'Dr. Ahmed',
  eye: 'Right' as const,
  lensType: 'Foldable Acrylic' as const,
  scheduledAt: '2025-03-01T08:00:00.000Z',
  status: 'Scheduled' as const,
  preOpVA: '6/60',
  postOpVA: undefined,
  complications: '',
  intraopNotes: '',
  completedById: '',
  completedByName: '',
  createdFromScreeningId: undefined,
  performedAt: undefined,
};

const allFollowUpMilestoneRows = [
  { milestone: 'Day1' },
  { milestone: 'Week1' },
  { milestone: 'Month1' },
  { milestone: 'Month3' },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('actionCreateSurgery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authServer.requireActor).mockResolvedValue(superAdmin);
    vi.mocked(authServer.ensureRegionAccess).mockReturnValue(null);
    vi.mocked(authServer.auditLog).mockResolvedValue(undefined);
    vi.mocked(prisma.patient.findUnique).mockResolvedValue(patientScope as never);
    vi.mocked(surgeryApi.createSurgery).mockResolvedValue(galmudugSurgery);
    vi.mocked(prisma.followUp.findMany).mockResolvedValue(allFollowUpMilestoneRows as never);
  });

  it('creates a scheduled surgery successfully', async () => {
    const result = await actionCreateSurgery(surgeryData);
    expect(result.ok).toBe(true);
    expect(surgeryApi.createSurgery).toHaveBeenCalledOnce();
  });

  it('scope is derived from patient record, not client input', async () => {
    await actionCreateSurgery({ ...surgeryData, region: 'Banadir / Mogadishu' });
    expect(surgeryApi.createSurgery).toHaveBeenCalledWith(
      expect.objectContaining({
        region: 'Galmudug',
        campaignId: 'camp-galmudug-1',
      }),
    );
  });

  it('rejects Completed status without a performedAt date', async () => {
    const result = await actionCreateSurgery({ ...surgeryData, status: 'Completed', performedAt: undefined });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/completion date/i);
  });

  it('creates follow-ups when surgery is completed with performedAt', async () => {
    const completedSurgery = {
      ...galmudugSurgery,
      status: 'Completed' as const,
      performedAt: '2025-03-01T10:00:00.000Z',
    };
    vi.mocked(surgeryApi.createSurgery).mockResolvedValue(completedSurgery);
    vi.mocked(prisma.followUp.findFirst).mockResolvedValue(null); // no duplicates
    vi.mocked(prisma.followUp.create).mockResolvedValue({} as never);

    const result = await actionCreateSurgery({
      ...surgeryData,
      status: 'Completed',
      performedAt: '2025-03-01T10:00:00.000Z',
    });
    expect(result.ok).toBe(true);
    expect(prisma.followUp.create).toHaveBeenCalledTimes(4);
    expect(prisma.followUp.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ milestone: 'Day1' }),
    });
    expect(prisma.followUp.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ milestone: 'Week1' }),
    });
    expect(prisma.followUp.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ milestone: 'Month1' }),
    });
    expect(prisma.followUp.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ milestone: 'Month3' }),
    });
  });

  it('does not create duplicate follow-ups if they already exist', async () => {
    const completedSurgery = {
      ...galmudugSurgery,
      status: 'Completed' as const,
      performedAt: '2025-03-01T10:00:00.000Z',
    };
    vi.mocked(surgeryApi.createSurgery).mockResolvedValue(completedSurgery);
    // All follow-ups already exist
    vi.mocked(prisma.followUp.findFirst).mockResolvedValue({ id: 'existing-fu' } as never);

    await actionCreateSurgery({
      ...surgeryData,
      status: 'Completed',
      performedAt: '2025-03-01T10:00:00.000Z',
    });
    expect(prisma.followUp.create).not.toHaveBeenCalled();
  });

  it('rejects when patient not found', async () => {
    vi.mocked(prisma.patient.findUnique).mockResolvedValue(null);
    const result = await actionCreateSurgery(surgeryData);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/campaign not found/i);
  });

  it('rejects cross-region access for a PM', async () => {
    vi.mocked(authServer.requireActor).mockResolvedValue(banadiPM);
    vi.mocked(authServer.ensureRegionAccess).mockReturnValue({
      ok: false,
      error: 'Forbidden: region access denied',
    });
    const result = await actionCreateSurgery(surgeryData);
    expect(result.ok).toBe(false);
  });
});

describe('actionUpdateSurgery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authServer.requireActor).mockResolvedValue(superAdmin);
    vi.mocked(authServer.ensureRegionAccess).mockReturnValue(null);
    vi.mocked(authServer.auditLog).mockResolvedValue(undefined);
    vi.mocked(prisma.surgery.findUnique).mockResolvedValue(rawSurgeryRow as never);
    vi.mocked(prisma.patient.findUnique).mockResolvedValue(patientScope as never);
    vi.mocked(surgeryApi.updateSurgery).mockResolvedValue(galmudugSurgery);
    vi.mocked(surgeryApi.fromPrisma).mockReturnValue(galmudugSurgery);
    vi.mocked(prisma.followUp.findMany).mockResolvedValue(allFollowUpMilestoneRows as never);
  });

  it('rejects Completed update without performedAt', async () => {
    const result = await actionUpdateSurgery('surgery-1', {
      ...surgeryData,
      status: 'Completed',
      performedAt: undefined,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/completion date/i);
  });

  it('creates follow-ups when transitioning to Completed for the first time', async () => {
    vi.mocked(surgeryApi.updateSurgery).mockResolvedValue({
      ...galmudugSurgery,
      status: 'Completed',
      performedAt: '2025-03-01T10:00:00.000Z',
    });
    vi.mocked(prisma.followUp.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.followUp.create).mockResolvedValue({} as never);

    const result = await actionUpdateSurgery('surgery-1', {
      ...surgeryData,
      status: 'Completed',
      performedAt: '2025-03-01T10:00:00.000Z',
    });
    expect(result.ok).toBe(true);
    expect(prisma.followUp.create).toHaveBeenCalledTimes(4);
  });

  it('fills missing follow-ups idempotently when already Completed', async () => {
    vi.mocked(prisma.surgery.findUnique).mockResolvedValue({
      ...rawSurgeryRow,
      status: 'Completed',
    } as never);
    vi.mocked(surgeryApi.updateSurgery).mockResolvedValue({
      ...galmudugSurgery,
      status: 'Completed',
      performedAt: '2025-03-01T10:00:00.000Z',
    });
    vi.mocked(prisma.followUp.findFirst).mockImplementation(async ({ where }) => {
      return where.milestone === 'Month3' ? null : ({ id: `existing-${where.milestone}` } as never);
    });
    vi.mocked(prisma.followUp.create).mockResolvedValue({} as never);

    await actionUpdateSurgery('surgery-1', {
      ...surgeryData,
      status: 'Completed',
      performedAt: '2025-03-01T10:00:00.000Z',
    });
    expect(prisma.followUp.create).toHaveBeenCalledTimes(1);
    expect(prisma.followUp.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ milestone: 'Month3' }),
    });
  });

  it('does not duplicate follow-ups when already Completed and all milestones exist', async () => {
    vi.mocked(prisma.surgery.findUnique).mockResolvedValue({
      ...rawSurgeryRow,
      status: 'Completed',
    } as never);
    vi.mocked(surgeryApi.updateSurgery).mockResolvedValue({
      ...galmudugSurgery,
      status: 'Completed',
      performedAt: '2025-03-01T10:00:00.000Z',
    });
    vi.mocked(prisma.followUp.findFirst).mockResolvedValue({ id: 'existing-fu' } as never);

    await actionUpdateSurgery('surgery-1', {
      ...surgeryData,
      status: 'Completed',
      performedAt: '2025-03-01T10:00:00.000Z',
    });
    expect(prisma.followUp.create).not.toHaveBeenCalled();
  });

  it('treats unique milestone conflicts as idempotent under concurrent completion', async () => {
    vi.mocked(surgeryApi.updateSurgery).mockResolvedValue({
      ...galmudugSurgery,
      status: 'Completed',
      performedAt: '2025-03-01T10:00:00.000Z',
    });
    vi.mocked(prisma.followUp.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.followUp.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    vi.mocked(prisma.followUp.findMany).mockResolvedValue(allFollowUpMilestoneRows as never);

    const result = await actionUpdateSurgery('surgery-1', {
      ...surgeryData,
      status: 'Completed',
      performedAt: '2025-03-01T10:00:00.000Z',
    });

    expect(result.ok).toBe(true);
    expect(prisma.followUp.create).toHaveBeenCalledTimes(4);
    expect(prisma.followUp.findMany).toHaveBeenCalledWith({
      where: { surgeryId: 'surgery-1' },
      select: { milestone: true },
    });
  });

  it('fails completion if the four required follow-up milestones cannot be verified', async () => {
    vi.mocked(surgeryApi.updateSurgery).mockResolvedValue({
      ...galmudugSurgery,
      status: 'Completed',
      performedAt: '2025-03-01T10:00:00.000Z',
    });
    vi.mocked(prisma.followUp.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.followUp.create).mockResolvedValue({} as never);
    vi.mocked(prisma.followUp.findMany).mockResolvedValue([
      { milestone: 'Day1' },
      { milestone: 'Week1' },
      { milestone: 'Month1' },
    ] as never);

    const result = await actionUpdateSurgery('surgery-1', {
      ...surgeryData,
      status: 'Completed',
      performedAt: '2025-03-01T10:00:00.000Z',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Month3/);
  });
});
