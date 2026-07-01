import { describe, it, expect, vi, beforeEach } from 'vitest';
import { galmudugScreener, banadiPM } from '../mocks/actors';
import { galmudugFollowUp } from '../mocks/data';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/auth-server', () => ({
  requireActor: vi.fn(),
  ensureRegionAccess: vi.fn(),
  auditLog: vi.fn().mockResolvedValue(undefined),
  scopedRegionWhere: vi.fn(() => ({})),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    surgery: { findUnique: vi.fn() },
    followUp: { findUnique: vi.fn(), groupBy: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    followUpMedication: { findUnique: vi.fn() },
  },
}));

vi.mock('@/lib/api/follow_ups', () => ({
  getAllFollowUps: vi.fn(),
  getAllMedications: vi.fn(),
  createFollowUp: vi.fn(),
  updateFollowUp: vi.fn(),
  deleteFollowUp: vi.fn(),
  checkAndMarkOverdue: vi.fn(),
  getMedicationsForFollowUp: vi.fn(),
  createMedication: vi.fn(),
  updateMedication: vi.fn(),
  deleteMedication: vi.fn(),
  fromPrisma: vi.fn(),
}));

// Imports after mocks
import { actionCreateFollowUp, actionUpdateFollowUp, actionCreateMedication, getFollowUpsPaginated, getPrintableFollowUps } from '@/app/actions/follow_ups';
import * as authServer from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import * as followUpApi from '@/lib/api/follow_ups';

// ── Helpers ───────────────────────────────────────────────────────────────────

const surgeryScope = {
  region: 'Galmudug',
  campaignId: 'camp-galmudug-1',
  campaignRegionId: 'plan-galmudug-1',
  patientId: 'patient-1',
  patientName: 'Amina Hassan',
};

const followUpData = {
  patientId: 'patient-1',
  patientName: 'Amina Hassan',
  surgeryId: 'surgery-1',
  campaignId: 'camp-galmudug-1',
  campaignRegionId: 'plan-galmudug-1',
  region: 'Galmudug',
  milestone: 'Day 1' as const,
  dueDate: '2025-03-02',
  status: 'Pending' as const,
  complications: '',
  notes: '',
  needsDoctorReview: false,
  doctorReviewStatus: 'Not Needed' as const,
  doctorName: '',
  doctorDiagnosis: '',
  doctorTreatmentPlan: '',
  doctorNotes: '',
  completedById: '',
  completedByName: '',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getFollowUpsPaginated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authServer.scopedRegionWhere).mockReturnValue({});
    vi.mocked(authServer.requireActor).mockResolvedValue(galmudugScreener);
    vi.mocked(authServer.scopedRegionWhere).mockReturnValue({ region: 'Galmudug' });
    vi.mocked(prisma.followUp.groupBy).mockResolvedValue([{ surgeryId: 'surgery-1' }] as never);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ total: 1 }] as never);
    vi.mocked(prisma.followUp.findMany).mockResolvedValue([{}] as never);
    vi.mocked(followUpApi.fromPrisma).mockReturnValue(galmudugFollowUp);
  });

  it('uses a distinct surgery count instead of materializing all groups for totals', async () => {
    const result = await getFollowUpsPaginated({ tab: 'due', search: '', page: 1, pageSize: 50 });

    expect(result.total).toBe(1);
    expect(prisma.followUp.groupBy).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.followUp.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          region: 'Galmudug',
          surgeryId: { in: ['surgery-1'] },
        }),
      }),
    );
  });
});

describe('getPrintableFollowUps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authServer.requireActor).mockResolvedValue(galmudugScreener);
    vi.mocked(authServer.scopedRegionWhere).mockReturnValue({ region: 'Galmudug' });
    vi.mocked(prisma.followUp.groupBy).mockResolvedValue([{ patientId: 'patient-1' }] as never);
    vi.mocked(prisma.followUp.findMany).mockResolvedValue([{}] as never);
    vi.mocked(followUpApi.fromPrisma).mockReturnValue(galmudugFollowUp);
  });

  it('keeps assigned-region scope and caps printable patients', async () => {
    const result = await getPrintableFollowUps({ tab: 'due', search: 'Amina' });

    expect(result.total).toBe(1);
    expect(result.truncated).toBe(false);
    expect(prisma.followUp.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['patientId'],
        where: expect.objectContaining({
          region: 'Galmudug',
          status: 'Due',
        }),
        take: 1000,
      }),
    );
    expect(prisma.followUp.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          region: 'Galmudug',
          status: 'Due',
          patientId: { in: ['patient-1'] },
        }),
      }),
    );
  });
});

describe('actionCreateFollowUp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authServer.scopedRegionWhere).mockReturnValue({});
    vi.mocked(authServer.requireActor).mockResolvedValue(galmudugScreener);
    vi.mocked(authServer.ensureRegionAccess).mockReturnValue(null);
    vi.mocked(authServer.auditLog).mockResolvedValue(undefined);
    vi.mocked(prisma.surgery.findUnique).mockResolvedValue(surgeryScope as never);
    vi.mocked(followUpApi.createFollowUp).mockResolvedValue(galmudugFollowUp);
  });

  it('screener can create a follow-up', async () => {
    const result = await actionCreateFollowUp(followUpData);
    expect(result.ok).toBe(true);
    expect(followUpApi.createFollowUp).toHaveBeenCalledOnce();
  });

  it('follow-up region is derived from surgery, not client input', async () => {
    await actionCreateFollowUp({ ...followUpData, region: 'Banadir / Mogadishu' });
    expect(followUpApi.createFollowUp).toHaveBeenCalledWith(
      expect.objectContaining({ region: 'Galmudug' }),
    );
  });

  it('follow-up sub-region is derived from surgery, not client input', async () => {
    await actionCreateFollowUp({ ...followUpData, campaignRegionId: 'client-plan' });
    expect(followUpApi.createFollowUp).toHaveBeenCalledWith(
      expect.objectContaining({ campaignRegionId: 'plan-galmudug-1' }),
    );
  });

  it('rejects when surgery is not found', async () => {
    vi.mocked(prisma.surgery.findUnique).mockResolvedValue(null);
    const result = await actionCreateFollowUp(followUpData);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Surgery not found/);
  });

  it('rejects cross-region follow-up creation', async () => {
    vi.mocked(authServer.requireActor).mockResolvedValue(banadiPM);
    vi.mocked(authServer.ensureRegionAccess).mockReturnValue({
      ok: false,
      error: 'Forbidden: region access denied',
    });
    const result = await actionCreateFollowUp(followUpData);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/region access denied/);
  });

  it('rejects when required fields are missing', async () => {
    const result = await actionCreateFollowUp({ ...followUpData, surgeryId: '' });
    expect(result.ok).toBe(false);
  });
});

describe('actionUpdateFollowUp – doctor review', () => {
  const rawFollowUp = {
    id: 'followup-1',
    region: 'Galmudug',
    campaignId: 'camp-galmudug-1',
    status: 'Pending',
    doctorReviewStatus: 'Not Needed',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authServer.scopedRegionWhere).mockReturnValue({});
    vi.mocked(authServer.requireActor).mockResolvedValue(galmudugScreener);
    vi.mocked(authServer.ensureRegionAccess).mockReturnValue(null);
    vi.mocked(authServer.auditLog).mockResolvedValue(undefined);
    vi.mocked(prisma.followUp.findUnique).mockResolvedValue(rawFollowUp as never);
    vi.mocked(prisma.surgery.findUnique).mockResolvedValue(surgeryScope as never);
    vi.mocked(followUpApi.updateFollowUp).mockResolvedValue(galmudugFollowUp);
  });

  it('can mark follow-up as needing doctor review', async () => {
    const updated = { ...galmudugFollowUp, needsDoctorReview: true, doctorReviewStatus: 'Pending' as const };
    vi.mocked(followUpApi.updateFollowUp).mockResolvedValue(updated);

    const result = await actionUpdateFollowUp('followup-1', {
      ...followUpData,
      needsDoctorReview: true,
      doctorReviewStatus: 'Pending',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.needsDoctorReview).toBe(true);
  });

  it('saves doctor review Completed state correctly', async () => {
    const reviewed = {
      ...galmudugFollowUp,
      doctorReviewStatus: 'Completed' as const,
      doctorName: 'Dr. Hassan',
    };
    vi.mocked(followUpApi.updateFollowUp).mockResolvedValue(reviewed);

    const result = await actionUpdateFollowUp('followup-1', {
      ...followUpData,
      doctorReviewStatus: 'Completed',
      doctorName: 'Dr. Hassan',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.doctorReviewStatus).toBe('Completed');
  });

  it('updates follow-up sub-region from surgery scope', async () => {
    await actionUpdateFollowUp('followup-1', { ...followUpData, campaignRegionId: 'client-plan' });
    expect(followUpApi.updateFollowUp).toHaveBeenCalledWith(
      'followup-1',
      expect.objectContaining({ campaignRegionId: 'plan-galmudug-1' }),
    );
  });

  it('rejects update when follow-up is not found', async () => {
    vi.mocked(prisma.followUp.findUnique).mockResolvedValue(null);
    const result = await actionUpdateFollowUp('nonexistent', followUpData);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not found/i);
  });

  it('cross-region update is blocked', async () => {
    vi.mocked(authServer.requireActor).mockResolvedValue(banadiPM);
    vi.mocked(authServer.ensureRegionAccess).mockReturnValue({
      ok: false,
      error: 'Forbidden: region access denied',
    });
    const result = await actionUpdateFollowUp('followup-1', followUpData);
    expect(result.ok).toBe(false);
  });
});

describe('actionCreateMedication', () => {
  const followUpRow = { region: 'Galmudug' };
  const medicationData = {
    followUpId: 'followup-1',
    drugName: 'Prednisolone',
    dosage: '1%',
    frequency: 'QID',
    duration: '2 weeks',
    instructions: 'Apply to eye',
    status: 'Prescribed' as const,
    notes: '',
  };
  const medication = { id: 'med-1', ...medicationData, createdAt: '2025-03-02T00:00:00.000Z' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authServer.scopedRegionWhere).mockReturnValue({});
    vi.mocked(authServer.requireActor).mockResolvedValue(galmudugScreener);
    vi.mocked(authServer.ensureRegionAccess).mockReturnValue(null);
    vi.mocked(prisma.followUp.findUnique).mockResolvedValue(followUpRow as never);
    vi.mocked(followUpApi.createMedication).mockResolvedValue(medication);
  });

  it('screener can add a medication to a follow-up', async () => {
    const result = await actionCreateMedication(medicationData);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.drugName).toBe('Prednisolone');
  });

  it('rejects when follow-up not found', async () => {
    vi.mocked(prisma.followUp.findUnique).mockResolvedValue(null);
    const result = await actionCreateMedication(medicationData);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not found/i);
  });

  it('cross-region medication creation is blocked', async () => {
    vi.mocked(authServer.requireActor).mockResolvedValue(banadiPM);
    vi.mocked(authServer.ensureRegionAccess).mockReturnValue({
      ok: false,
      error: 'Forbidden: region access denied',
    });
    const result = await actionCreateMedication(medicationData);
    expect(result.ok).toBe(false);
  });
});
