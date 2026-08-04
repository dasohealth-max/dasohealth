import { beforeEach, describe, expect, it, vi } from 'vitest';
import { galmudugClerk, galmudugPM, superAdmin } from '../mocks/actors';

vi.mock('@/lib/auth-server', () => ({
  requireActor: vi.fn(),
  auditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: (() => {
    const db = {
    patient: { findUnique: vi.fn(), update: vi.fn() },
    surgery: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    changeRequest: { count: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    };
    return {
      ...db,
      $transaction: vi.fn((callback: (tx: typeof db) => unknown) => callback(db)),
    };
  })(),
}));

import { actionCreateChangeRequest, actionResolveChangeRequest, getInboxBadgeCount, markInboxDecisionsViewed } from '@/app/actions/change_requests';
import * as authServer from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';

describe('actionCreateChangeRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authServer.requireActor).mockResolvedValue(galmudugPM);
  });

  it('derives patient label, region, and campaign from the stored patient', async () => {
    vi.mocked(prisma.patient.findUnique).mockResolvedValue({
      id: 'patient-1',
      fullName: 'Authoritative Name',
      region: 'Galmudug',
      campaignId: '11111111-1111-1111-1111-111111111111',
    } as never);
    vi.mocked(prisma.changeRequest.create).mockResolvedValue({
      id: 'request-1',
      entity: 'Patient',
      entityId: 'patient-1',
      entityLabel: 'Authoritative Name',
      requestType: 'correct',
      reason: 'Correct the patient record',
      requestedById: galmudugPM.id,
      requestedByName: galmudugPM.name,
      requestedByRole: galmudugPM.role,
      status: 'Pending',
      region: 'Galmudug',
      campaignId: '11111111-1111-1111-1111-111111111111',
      resolvedById: null,
      resolvedByName: null,
      resolutionNote: '',
      resolvedAt: null,
      createdAt: new Date('2026-08-04T00:00:00Z'),
      updatedAt: new Date('2026-08-04T00:00:00Z'),
    } as never);

    const result = await actionCreateChangeRequest({
      entity: 'Patient',
      entityId: 'patient-1',
      entityLabel: 'Forged Name',
      requestType: 'correct',
      reason: 'Correct the patient record',
      region: 'Banadir / Mogadishu',
      campaignId: '22222222-2222-2222-2222-222222222222',
    });

    expect(result).toMatchObject({
      ok: true,
      data: {
        entityLabel: 'Authoritative Name',
        region: 'Galmudug',
        campaignId: '11111111-1111-1111-1111-111111111111',
      },
    });
    expect(prisma.changeRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityLabel: 'Authoritative Name',
        region: 'Galmudug',
        campaignId: '11111111-1111-1111-1111-111111111111',
      }),
    });
  });

  it.each([
    ['Data Clerk', galmudugClerk],
    ['Super Administrator', superAdmin],
  ])('rejects request creation by %s', async (_role, actor) => {
    vi.mocked(authServer.requireActor).mockResolvedValue(actor);

    const result = await actionCreateChangeRequest({
      entity: 'Patient',
      entityId: 'patient-1',
      entityLabel: '',
      requestType: 'archive',
      reason: 'Entered in error',
    });

    expect(result).toEqual({ ok: false, error: 'Only Project Managers can submit lifecycle requests' });
    expect(prisma.patient.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a request for an entity outside the actor region', async () => {
    vi.mocked(prisma.patient.findUnique).mockResolvedValue({
      id: 'patient-1',
      fullName: 'Outside Region',
      region: 'Banadir / Mogadishu',
      campaignId: null,
    } as never);

    const result = await actionCreateChangeRequest({
      entity: 'Patient',
      entityId: 'patient-1',
      entityLabel: '',
      requestType: 'archive',
      reason: 'Archive duplicate patient',
    });

    expect(result).toEqual({ ok: false, error: 'Forbidden: region access denied' });
    expect(prisma.changeRequest.create).not.toHaveBeenCalled();
  });

  it('rejects a duplicate pending archive request for the same patient', async () => {
    vi.mocked(prisma.patient.findUnique).mockResolvedValue({
      id: 'patient-1',
      fullName: 'Authoritative Name',
      region: 'Galmudug',
      campaignId: null,
      archivedAt: null,
    } as never);
    vi.mocked(prisma.changeRequest.count).mockResolvedValue(1);

    const result = await actionCreateChangeRequest({
      entity: 'Patient',
      entityId: 'patient-1',
      entityLabel: '',
      requestType: 'archive',
      reason: 'Duplicate registration entered in error',
    });

    expect(result).toEqual({ ok: false, error: 'An archive request for this patient is already pending' });
    expect(prisma.changeRequest.create).not.toHaveBeenCalled();
  });

  it('rejects a surgery cancellation request that targets a patient record', async () => {
    vi.mocked(prisma.patient.findUnique).mockResolvedValue({
      id: 'patient-1',
      fullName: 'Amina Hassan',
      region: 'Galmudug',
      campaignId: null,
      archivedAt: null,
    } as never);

    const result = await actionCreateChangeRequest({
      entity: 'Patient',
      entityId: 'patient-1',
      entityLabel: '',
      requestType: 'cancel_surgery',
      reason: 'Did not show up',
    });

    expect(result).toEqual({ ok: false, error: 'Surgery cancellation requests must target a surgery record' });
    expect(prisma.changeRequest.create).not.toHaveBeenCalled();
  });

  it('rejects cancellation requests for completed surgery records', async () => {
    vi.mocked(prisma.surgery.findUnique).mockResolvedValue({
      id: 'surgery-1',
      patientName: 'Amina Hassan',
      region: 'Galmudug',
      campaignId: null,
      archivedAt: null,
      status: 'Completed',
    } as never);

    const result = await actionCreateChangeRequest({
      entity: 'Surgery',
      entityId: 'surgery-1',
      entityLabel: '',
      requestType: 'cancel_surgery',
      reason: 'Did not show up',
    });

    expect(result).toEqual({ ok: false, error: 'Only scheduled or postponed surgery placements can be cancelled' });
    expect(prisma.changeRequest.create).not.toHaveBeenCalled();
  });
});

describe('inbox notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.changeRequest.count).mockResolvedValue(2);
    vi.mocked(prisma.changeRequest.updateMany).mockResolvedValue({ count: 2 });
  });

  it('counts pending approvals for the Super Administrator', async () => {
    vi.mocked(authServer.requireActor).mockResolvedValue(superAdmin);

    await expect(getInboxBadgeCount()).resolves.toBe(2);
    expect(prisma.changeRequest.count).toHaveBeenCalledWith({ where: { status: 'Pending' } });
  });

  it('counts only unread decisions for the requesting Project Manager', async () => {
    vi.mocked(authServer.requireActor).mockResolvedValue(galmudugPM);

    await expect(getInboxBadgeCount()).resolves.toBe(2);
    expect(prisma.changeRequest.count).toHaveBeenCalledWith({
      where: {
        requestedById: galmudugPM.id,
        status: { in: ['Approved', 'Rejected'] },
        requesterViewedAt: null,
      },
    });

    await markInboxDecisionsViewed();
    expect(prisma.changeRequest.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ requestedById: galmudugPM.id, requesterViewedAt: null }),
      data: { requesterViewedAt: expect.any(Date) },
    });
  });

  it('does not expose inbox counts to clerks', async () => {
    vi.mocked(authServer.requireActor).mockResolvedValue({ error: 'Forbidden' });

    await expect(getInboxBadgeCount()).resolves.toBe(0);
    expect(prisma.changeRequest.count).not.toHaveBeenCalled();
  });
});

describe('actionResolveChangeRequest', () => {
  const request = {
    id: 'request-1',
    entity: 'Patient',
    entityId: 'patient-1',
    entityLabel: 'Amina Hassan',
    requestType: 'archive',
    reason: 'Duplicate registration entered in error',
    requestedById: galmudugPM.id,
    requestedByName: galmudugPM.name,
    requestedByRole: galmudugPM.role,
    status: 'Pending',
    region: 'Galmudug',
    campaignId: null,
    resolvedById: null,
    resolvedByName: null,
    resolutionNote: '',
    resolvedAt: null,
    createdAt: new Date('2026-08-04T00:00:00Z'),
    updatedAt: new Date('2026-08-04T00:00:00Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authServer.requireActor).mockResolvedValue(superAdmin);
    vi.mocked(prisma.changeRequest.findUnique).mockResolvedValue(request as never);
    vi.mocked(prisma.changeRequest.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.changeRequest.update).mockResolvedValue({
      ...request,
      status: 'Approved',
      resolvedById: superAdmin.id,
      resolvedByName: superAdmin.name,
      resolutionNote: 'Confirmed duplicate record',
      resolvedAt: new Date('2026-08-04T01:00:00Z'),
    } as never);
    vi.mocked(prisma.patient.findUnique).mockResolvedValue({
      id: 'patient-1',
      fullName: 'Amina Hassan',
      archivedAt: null,
    } as never);
    vi.mocked(prisma.patient.update).mockResolvedValue({} as never);
    vi.mocked(prisma.surgery.updateMany).mockResolvedValue({ count: 1 });
  });

  it('approves and archives a patient plus active queue placements atomically', async () => {
    const result = await actionResolveChangeRequest('request-1', {
      resolution: 'Approved',
      resolutionNote: 'Confirmed duplicate record',
    });

    expect(result.ok).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.patient.update).toHaveBeenCalledWith({
      where: { id: 'patient-1' },
      data: expect.objectContaining({
        archivedById: superAdmin.id,
        archivedReason: expect.stringContaining('Duplicate registration entered in error'),
      }),
    });
    expect(prisma.surgery.updateMany).toHaveBeenCalledWith({
      where: {
        patientId: 'patient-1',
        archivedAt: null,
        status: { in: ['Scheduled', 'Postponed'] },
      },
      data: expect.objectContaining({ archivedById: superAdmin.id }),
    });
    expect(authServer.auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'archive', entity: 'Patient', entityId: 'patient-1' }),
      expect.anything(),
    );
  });

  it('does not archive when another administrator has already resolved the request', async () => {
    vi.mocked(prisma.changeRequest.updateMany).mockResolvedValue({ count: 0 });

    const result = await actionResolveChangeRequest('request-1', {
      resolution: 'Approved',
      resolutionNote: 'Confirmed duplicate record',
    });

    expect(result).toEqual({ ok: false, error: 'This request has already been resolved' });
    expect(prisma.patient.update).not.toHaveBeenCalled();
  });

  it('approves a surgery cancellation without archiving the patient', async () => {
    const cancellationRequest = {
      ...request,
      entity: 'Surgery',
      entityId: 'surgery-1',
      requestType: 'cancel_surgery',
      reason: 'Did not show up',
    };
    vi.mocked(prisma.changeRequest.findUnique).mockResolvedValue(cancellationRequest as never);
    vi.mocked(prisma.surgery.findUnique).mockResolvedValue({
      id: 'surgery-1',
      patientId: 'patient-1',
      patientName: 'Amina Hassan',
      status: 'Scheduled',
      archivedAt: null,
    } as never);
    vi.mocked(prisma.surgery.update).mockResolvedValue({} as never);

    const result = await actionResolveChangeRequest('request-1', {
      resolution: 'Approved',
      resolutionNote: 'Cancellation confirmed',
    });

    expect(result.ok).toBe(true);
    expect(prisma.surgery.update).toHaveBeenCalledWith({
      where: { id: 'surgery-1' },
      data: expect.objectContaining({
        status: 'Cancelled',
        cancellationReason: 'Did not show up',
        cancelledById: superAdmin.id,
      }),
    });
    expect(prisma.patient.update).not.toHaveBeenCalled();
    expect(authServer.auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'cancel', entity: 'Surgery', entityId: 'surgery-1' }),
      expect.anything(),
    );
  });
});
