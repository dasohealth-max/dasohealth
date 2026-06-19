import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    followUp: {
      updateMany: vi.fn(),
    },
  },
}));

import { checkAndMarkOverdue } from '@/lib/api/follow_ups';
import { prisma } from '@/lib/prisma';
import { statusForFollowUpDate } from '@/lib/follow-up-schedule';

describe('statusForFollowUpDate', () => {
  const today = new Date('2026-06-19T09:00:00.000Z');

  it('keeps Day 1 due for days 1-3, overdue for days 4-7, and missed after day 7', () => {
    expect(statusForFollowUpDate('Day1', new Date('2026-06-20'), today)).toBe('Pending');
    expect(statusForFollowUpDate('Day1', new Date('2026-06-19'), today)).toBe('Due');
    expect(statusForFollowUpDate('Day1', new Date('2026-06-17'), today)).toBe('Due');
    expect(statusForFollowUpDate('Day1', new Date('2026-06-16'), today)).toBe('Overdue');
    expect(statusForFollowUpDate('Day1', new Date('2026-06-13'), today)).toBe('Overdue');
    expect(statusForFollowUpDate('Day1', new Date('2026-06-12'), today)).toBe('Missed');
  });

  it('keeps Week 1 due for days 7-9, overdue for days 10-12, and missed after day 12', () => {
    expect(statusForFollowUpDate('Week1', new Date('2026-06-20'), today)).toBe('Pending');
    expect(statusForFollowUpDate('Week1', new Date('2026-06-19'), today)).toBe('Due');
    expect(statusForFollowUpDate('Week1', new Date('2026-06-17'), today)).toBe('Due');
    expect(statusForFollowUpDate('Week1', new Date('2026-06-16'), today)).toBe('Overdue');
    expect(statusForFollowUpDate('Week1', new Date('2026-06-14'), today)).toBe('Overdue');
    expect(statusForFollowUpDate('Week1', new Date('2026-06-13'), today)).toBe('Missed');
  });
});

describe('checkAndMarkOverdue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-19T09:00:00.000Z'));
    vi.mocked(prisma.followUp.updateMany).mockResolvedValue({ count: 1 } as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('refreshes active Day 1 and Week 1 follow-ups through pending, due, overdue, and missed windows', async () => {
    const updated = await checkAndMarkOverdue();

    expect(updated).toBe(8);
    expect(prisma.followUp.updateMany).toHaveBeenCalledTimes(8);
    expect(prisma.followUp.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        milestone: 'Day1',
        status: { in: ['Pending', 'Due', 'Overdue'] },
        dueDate: { lte: expect.any(Date), gte: expect.any(Date) },
      }),
      data: { status: 'Due' },
    }));
    expect(prisma.followUp.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        milestone: 'Day1',
        dueDate: { lt: expect.any(Date), gte: expect.any(Date) },
      }),
      data: { status: 'Overdue' },
    }));
    expect(prisma.followUp.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        milestone: 'Day1',
        dueDate: { lt: expect.any(Date) },
      }),
      data: { status: 'Missed' },
    }));
  });

  it('keeps region scope when provided', async () => {
    await checkAndMarkOverdue({ region: 'Galmudug' });

    expect(prisma.followUp.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        region: 'Galmudug',
        milestone: 'Day1',
      }),
    }));
  });
});
