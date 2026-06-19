import type { FollowUpStatus } from '@/types';

export type ActiveFollowUpMilestone = 'Day 1' | 'Week 1';
export type ActiveFollowUpMilestoneKey = 'Day1' | 'Week1';

export type FollowUpScheduleRule = {
  milestone: ActiveFollowUpMilestone;
  prismaMilestone: ActiveFollowUpMilestoneKey;
  dueOffsetDays: number;
  dueWindowDays: number;
  missedAfterDueDays: number;
  timing: string;
  focus: string;
  windowLabel: string;
};

export const ACTIVE_FOLLOW_UP_SCHEDULE: FollowUpScheduleRule[] = [
  {
    milestone: 'Day 1',
    prismaMilestone: 'Day1',
    dueOffsetDays: 1,
    dueWindowDays: 3,
    missedAfterDueDays: 7,
    timing: '24h-day 3',
    focus: 'Early recovery check',
    windowLabel: 'Due 24h-day 3, overdue day 4-7',
  },
  {
    milestone: 'Week 1',
    prismaMilestone: 'Week1',
    dueOffsetDays: 7,
    dueWindowDays: 3,
    missedAfterDueDays: 6,
    timing: 'day 7-9',
    focus: 'Healing and medicines',
    windowLabel: 'Due day 7-9, overdue day 10-12',
  },
];

export const ACTIVE_FOLLOW_UP_MILESTONES = ACTIVE_FOLLOW_UP_SCHEDULE.map((rule) => rule.milestone);
export const ACTIVE_FOLLOW_UP_PRISMA_MILESTONES = ACTIVE_FOLLOW_UP_SCHEDULE.map((rule) => rule.prismaMilestone);

export function startOfDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function addDays(value: Date, days: number): Date {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

export function statusForFollowUpDate(
  milestone: string,
  dueDate: Date,
  today = new Date(),
): FollowUpStatus | null {
  const rule = ACTIVE_FOLLOW_UP_SCHEDULE.find((item) => item.prismaMilestone === milestone || item.milestone === milestone);
  if (!rule) return null;

  const todayStart = startOfDay(today).getTime();
  const dueStart = startOfDay(dueDate).getTime();
  const daysSinceDue = Math.floor((todayStart - dueStart) / 86_400_000);

  if (daysSinceDue < 0) return 'Pending';
  if (daysSinceDue < rule.dueWindowDays) return 'Due';
  if (daysSinceDue < rule.missedAfterDueDays) return 'Overdue';
  return 'Missed';
}
