import { describe, it, expect, vi, beforeEach } from 'vitest';
import { galmudugScreener, banadiPM, superAdmin } from '../mocks/actors';
import { galmudugFollowUp } from '../mocks/data';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/auth-server', () => ({
  requireActor: vi.fn(),
  ensureRegionAccess: vi.fn(),
  auditLog: vi.fn().mockResolvedValue(undefined),
  scopedRegionWhere: vi.fn(() => ({})),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: (() => {
    const db = {
    $queryRaw: vi.fn(),
    surgery: { findUnique: vi.fn() },
    screening: { findMany: vi.fn() },
    followUp: { findUnique: vi.fn(), groupBy: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn() },
    followUpMedication: { findUnique: vi.fn(), update: vi.fn() },
    };
    return { ...db, $transaction: vi.fn((callback: (tx: typeof db) => unknown) => callback(db)) };
  })(),
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
import { actionCreateFollowUp, actionMarkMedicationEnteredInError, actionVoidFollowUp, actionUpdateFollowUp, actionCreateMedication, getFollowUpsPaginated, getPrintableFollowUps } from '@/app/actions/follow_ups';
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

const linkedScreeningRow = {
  id: 'screening-1',
  screenedAt: new Date('2025-02-28T08:00:00.000Z'),
  screenedByName: 'Nurse Ayaan',
  vaRightUnaided: 'V6_60',
  vaLeftUnaided: 'V6_18',
  cataractSuspected: true,
  glaucomaSuspected: false,
  diabeticRetinopathy: false,
  eye: 'Right',
  recommendation: 'ReferForSurgery',
  otherFindings: 'Dense cataract',
  medicalHistory: 'Diabetes controlled',
  currentMedications: 'Metformin',
  notes: 'Ready for surgery',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getFollowUpsPaginated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authServer.scopedRegionWhere).mockReturnValue({});
    vi.mocked(authServer.requireActor).mockResolvedValue(galmudugScreener);
    vi.mocked(authServer.scopedRegionWhere).mockReturnValue({ region: 'Galmudug' });
    vi.mocked(prisma.followUp.groupBy).mockResolvedValue([{ patientId: 'patient-1' }] as never);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ total: 1 }] as never);
    vi.mocked(prisma.followUp.findMany).mockResolvedValue([{}] as never);
    vi.mocked(prisma.screening.findMany).mockResolvedValue([] as never);
    vi.mocked(followUpApi.fromPrisma).mockReturnValue(galmudugFollowUp);
  });

  it('uses a distinct patient count instead of materializing all groups for totals', async () => {
    const result = await getFollowUpsPaginated({ tab: 'due', search: '', page: 1, pageSize: 50 });

    expect(result.total).toBe(1);
    expect(prisma.followUp.groupBy).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.followUp.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          region: 'Galmudug',
          patientId: { in: ['patient-1'] },
        }),
      }),
    );
  });

  it('attaches the linked previous screening result for follow-up context', async () => {
    vi.mocked(prisma.followUp.findMany).mockResolvedValue([
      {
        surgeryId: 'surgery-1',
        surgery: { createdFromScreeningId: 'screening-1' },
      },
    ] as never);
    vi.mocked(prisma.screening.findMany).mockResolvedValue([linkedScreeningRow] as never);

    const result = await getFollowUpsPaginated({ tab: 'due', search: '', page: 1, pageSize: 50 });

    expect(prisma.screening.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['screening-1'] } },
    });
    expect(result.data[0]?.followUps[0]?.screeningResult).toMatchObject({
      eye: 'Right',
      vaRightUnaided: '6/60',
      vaLeftUnaided: '6/18',
      recommendation: 'Refer for Surgery',
      cataractSuspected: true,
      otherFindings: 'Dense cataract',
    });
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

describe('actionMarkMedicationEnteredInError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authServer.requireActor).mockResolvedValue(superAdmin);
    vi.mocked(authServer.ensureRegionAccess).mockReturnValue(null);
    vi.mocked(prisma.followUpMedication.findUnique).mockResolvedValue({
      id: 'med-1',
      drugName: 'Prednisolone',
      enteredInErrorAt: null,
      followUp: { region: 'Galmudug', campaignId: 'campaign-1' },
    } as never);
    vi.mocked(prisma.followUpMedication.update).mockResolvedValue({} as never);
  });

  it('preserves the medication and audits the entered-in-error reason', async () => {
    const result = await actionMarkMedicationEnteredInError('med-1', 'Medication added to the wrong follow-up');

    expect(result).toEqual({ ok: true, data: null });
    expect(prisma.followUpMedication.update).toHaveBeenCalledWith({
      where: { id: 'med-1' },
      data: expect.objectContaining({
        enteredInErrorById: superAdmin.id,
        enteredInErrorReason: 'Medication added to the wrong follow-up',
      }),
    });
    expect(authServer.auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'void', entity: 'FollowUpMedication', entityId: 'med-1' }),
      expect.anything(),
    );
  });

  it('does not allow a Screening Officer to void medication history', async () => {
    vi.mocked(authServer.requireActor).mockResolvedValue(galmudugScreener);

    const result = await actionMarkMedicationEnteredInError('med-1', 'Medication added to the wrong follow-up');

    expect(result).toEqual({ ok: false, error: 'Only Super Administrators can mark medications as entered in error' });
    expect(prisma.followUpMedication.update).not.toHaveBeenCalled();
  });
});

describe('actionVoidFollowUp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authServer.requireActor).mockResolvedValue(superAdmin);
    vi.mocked(authServer.ensureRegionAccess).mockReturnValue(null);
    vi.mocked(prisma.followUp.findUnique).mockResolvedValue({
      id: 'followup-1', patientName: 'Amina Hassan', region: 'Galmudug',
      campaignId: 'campaign-1', voidedAt: null,
    } as never);
    vi.mocked(prisma.followUp.update).mockResolvedValue({} as never);
  });

  it('preserves and audits a voided follow-up', async () => {
    const result = await actionVoidFollowUp('followup-1', 'Follow-up was recorded for the wrong patient');

    expect(result).toEqual({ ok: true, data: null });
    expect(prisma.followUp.update).toHaveBeenCalledWith({
      where: { id: 'followup-1' },
      data: expect.objectContaining({
        voidedById: superAdmin.id,
        voidedReason: 'Follow-up was recorded for the wrong patient',
      }),
    });
    expect(authServer.auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'void', entity: 'FollowUp', entityId: 'followup-1' }),
      expect.anything(),
    );
  });

  it('rejects follow-up voiding by non-super-admin users', async () => {
    vi.mocked(authServer.requireActor).mockResolvedValue(banadiPM);

    const result = await actionVoidFollowUp('followup-1', 'Follow-up was recorded for the wrong patient');

    expect(result).toEqual({ ok: false, error: 'Only Super Administrators can void follow-ups' });
    expect(prisma.followUp.update).not.toHaveBeenCalled();
  });
});
