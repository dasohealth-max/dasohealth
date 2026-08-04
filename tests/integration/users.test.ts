import { beforeEach, describe, expect, it, vi } from 'vitest';
import { banadiPM, superAdmin } from '../mocks/actors';

const mocks = vi.hoisted(() => {
  const authAdmin = {
    getUserById: vi.fn(),
    updateUserById: vi.fn(),
  };
  const tx = {
    user: { update: vi.fn() },
  };
  const prisma = {
    user: { findUnique: vi.fn() },
    $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  return { authAdmin, tx, prisma };
});

vi.mock('@/lib/supabase', () => ({
  createServerClient: () => ({ auth: { admin: mocks.authAdmin } }),
}));

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));

vi.mock('@/lib/auth-server', () => ({
  requireActor: vi.fn(),
  auditLog: vi.fn().mockResolvedValue(undefined),
  scopedRegionWhere: vi.fn(() => ({})),
}));

import { actionDeactivateUser } from '@/app/actions/users';
import * as authServer from '@/lib/auth-server';

describe('actionDeactivateUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authServer.requireActor).mockResolvedValue(superAdmin);
    mocks.authAdmin.getUserById.mockResolvedValue({
      data: {
        user: {
          id: 'user-2',
          email: 'clerk@example.org',
          created_at: '2026-01-01T00:00:00.000Z',
          banned_until: null,
          user_metadata: { name: 'Regional Clerk' },
          app_metadata: { role: 'Data Clerk', assignedRegion: 'Galmudug' },
        },
      },
      error: null,
    });
    mocks.authAdmin.updateUserById.mockResolvedValue({ data: {}, error: null });
    mocks.prisma.user.findUnique.mockResolvedValue(null);
    mocks.tx.user.update.mockResolvedValue({});
  });

  it('disables login and preserves the local identity with an audit reason', async () => {
    const result = await actionDeactivateUser('user-2', 'Staff member has left the programme');

    expect(result).toEqual({ ok: true, data: null });
    expect(mocks.authAdmin.updateUserById).toHaveBeenCalledWith('user-2', { ban_duration: '876000h' });
    expect(mocks.tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-2' },
      data: expect.objectContaining({
        active: false,
        deactivatedById: superAdmin.id,
        deactivationReason: 'Staff member has left the programme',
      }),
    });
    expect(authServer.auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'deactivate', entity: 'User', entityId: 'user-2' }),
      mocks.tx,
    );
  });

  it('prevents a Super Administrator from deactivating their own account', async () => {
    const result = await actionDeactivateUser(superAdmin.id, 'Testing accidental self deactivation');

    expect(result).toEqual({ ok: false, error: 'You cannot deactivate your own account' });
    expect(mocks.authAdmin.updateUserById).not.toHaveBeenCalled();
  });

  it('does not allow a Project Manager to deactivate accounts', async () => {
    vi.mocked(authServer.requireActor).mockResolvedValue(banadiPM);

    const result = await actionDeactivateUser('user-2', 'Staff member has left the programme');

    expect(result).toEqual({ ok: false, error: 'Only Super Administrators can deactivate user accounts' });
    expect(mocks.authAdmin.updateUserById).not.toHaveBeenCalled();
  });
});
