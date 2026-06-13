import 'server-only';
import { prisma } from '@/lib/prisma';
import { followUpMilestoneToApp, followUpMilestoneFromApp } from '@/lib/prisma-enums';
import type { FollowUp } from '@/types';

type Row = NonNullable<Awaited<ReturnType<typeof prisma.followUp.findFirst>>>;

export function fromPrisma(row: Row): FollowUp {
  return {
    id: row.id,
    patientId: row.patientId,
    patientName: row.patientName,
    surgeryId: row.surgeryId,
    campaignId: row.campaignId,
    region: row.region,
    milestone: followUpMilestoneToApp(row.milestone) as FollowUp['milestone'],
    dueDate: (row.dueDate as Date).toISOString().split('T')[0],
    completedAt: row.completedAt ? (row.completedAt as Date).toISOString() : undefined,
    status: row.status as FollowUp['status'],
    vaRightPost: row.vaRightPost ?? undefined,
    vaLeftPost: row.vaLeftPost ?? undefined,
    complications: row.complications,
    notes: row.notes,
    smsReminderSent: row.smsReminderSent,
    needsDoctorReview: row.needsDoctorReview,
    completedById: row.completedById,
    completedByName: row.completedByName,
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

export async function getAllFollowUps(where: { region?: string } = {}): Promise<FollowUp[]> {
  const rows = await prisma.followUp.findMany({ where, orderBy: { dueDate: 'asc' } });
  return rows.map(fromPrisma);
}

export async function createFollowUp(data: Omit<FollowUp, 'id' | 'createdAt'>): Promise<FollowUp> {
  const row = await prisma.followUp.create({
    data: {
      patientId: data.patientId,
      patientName: data.patientName,
      surgeryId: data.surgeryId,
      campaignId: data.campaignId,
      region: data.region,
      milestone: followUpMilestoneFromApp(data.milestone) as never,
      dueDate: new Date(data.dueDate),
      completedAt: data.completedAt ? new Date(data.completedAt) : null,
      status: data.status as never,
      vaRightPost: data.vaRightPost || null,
      vaLeftPost: data.vaLeftPost || null,
      complications: data.complications,
      notes: data.notes,
      smsReminderSent: data.smsReminderSent,
      needsDoctorReview: data.needsDoctorReview,
      completedById: data.completedById,
      completedByName: data.completedByName,
    },
  });
  return fromPrisma(row);
}

export async function updateFollowUp(id: string, data: Omit<FollowUp, 'id' | 'createdAt'>): Promise<FollowUp> {
  const row = await prisma.followUp.update({
    where: { id },
    data: {
      patientId: data.patientId,
      patientName: data.patientName,
      surgeryId: data.surgeryId,
      campaignId: data.campaignId,
      region: data.region,
      milestone: followUpMilestoneFromApp(data.milestone) as never,
      dueDate: new Date(data.dueDate),
      completedAt: data.completedAt ? new Date(data.completedAt) : null,
      status: data.status as never,
      vaRightPost: data.vaRightPost || null,
      vaLeftPost: data.vaLeftPost || null,
      complications: data.complications,
      notes: data.notes,
      smsReminderSent: data.smsReminderSent,
      needsDoctorReview: data.needsDoctorReview,
      completedById: data.completedById,
      completedByName: data.completedByName,
    },
  });
  return fromPrisma(row);
}

export async function deleteFollowUp(id: string): Promise<void> {
  await prisma.followUp.delete({ where: { id } });
}

export async function checkAndMarkOverdue(where: { region?: string } = {}): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  await prisma.followUp.updateMany({
    where: { ...where, status: { in: ['Pending', 'Due'] as never[] }, dueDate: { lt: today } },
    data: { status: 'Overdue' as never },
  });
}
