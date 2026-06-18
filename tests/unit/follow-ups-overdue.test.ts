import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    followUp: {
      updateMany: vi.fn(),
    },
  },
}));

import { checkAndMarkOverdue } from '@/lib/api/follow_ups';
import { prisma } from '@/lib/prisma';

describe('checkAndMarkOverdue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.followUp.updateMany).mockResolvedValue({ count: 2 } as never);
  });

  it('marks pending and due follow-ups before today as overdue', async () => {
    const updated = await checkAndMarkOverdue();

    expect(updated).toBe(2);
    expect(prisma.followUp.updateMany).toHaveBeenCalledWith({
      where: {
        status: { in: ['Pending', 'Due'] },
        dueDate: { lt: expect.any(Date) },
      },
      data: { status: 'Overdue' },
    });
  });

  it('keeps region scope when provided', async () => {
    await checkAndMarkOverdue({ region: 'Galmudug' });

    expect(prisma.followUp.updateMany).toHaveBeenCalledWith({
      where: {
        region: 'Galmudug',
        status: { in: ['Pending', 'Due'] },
        dueDate: { lt: expect.any(Date) },
      },
      data: { status: 'Overdue' },
    });
  });
});
