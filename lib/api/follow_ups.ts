import 'server-only';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { followUpMilestoneToApp, followUpMilestoneFromApp, doctorReviewStatusToApp, doctorReviewStatusFromApp, medicationStatusToApp, medicationStatusFromApp } from '@/lib/prisma-enums';
import type { FollowUp, FollowUpMedication } from '@/types';
import { ACTIVE_FOLLOW_UP_SCHEDULE, addDays, startOfDay } from '@/lib/follow-up-schedule';

type Row = NonNullable<Awaited<ReturnType<typeof prisma.followUp.findFirst>>> & {
  patient?: { patientCode: string; phone?: string; emergencyPhone?: string } | null;
  surgery?: {
    operationDistrict?: string;
    performedAt?: Date | string | null;
    scheduledAt?: Date | string;
    eye?: string;
  } | null;
};
type MedRow = NonNullable<Awaited<ReturnType<typeof prisma.followUpMedication.findFirst>>>;

const FOLLOW_UP_INCLUDE = {
  patient: { select: { patientCode: true, phone: true, emergencyPhone: true } },
  surgery: { select: { operationDistrict: true, performedAt: true, scheduledAt: true, eye: true } },
} as const;

export function fromPrisma(row: Row): FollowUp {
  return {
    id: row.id,
    patientId: row.patientId,
    patientCode: row.patient?.patientCode,
    patientPhone: row.patient?.phone,
    patientEmergencyPhone: row.patient?.emergencyPhone,
    patientName: row.patientName,
    surgeryId: row.surgeryId,
    campaignId: row.campaignId,
    campaignRegionId: row.campaignRegionId ?? undefined,
    region: row.region,
    operationDistrict: row.surgery?.operationDistrict,
    surgeryPerformedAt: row.surgery?.performedAt ? new Date(row.surgery.performedAt).toISOString() : undefined,
    surgeryScheduledAt: row.surgery?.scheduledAt ? new Date(row.surgery.scheduledAt).toISOString() : undefined,
    surgeryEye: row.surgery?.eye as FollowUp['surgeryEye'],
    milestone: followUpMilestoneToApp(row.milestone) as FollowUp['milestone'],
    dueDate: (row.dueDate as Date).toISOString().split('T')[0],
    completedAt: row.completedAt ? (row.completedAt as Date).toISOString() : undefined,
    status: row.status as FollowUp['status'],
    vaRightPost: row.vaRightPost ?? undefined,
    vaLeftPost: row.vaLeftPost ?? undefined,
    complications: row.complications,
    notes: row.notes,
    needsDoctorReview: row.needsDoctorReview,
    doctorReviewStatus: doctorReviewStatusToApp(row.doctorReviewStatus) as FollowUp['doctorReviewStatus'],
    doctorReviewedAt: row.doctorReviewedAt ? (row.doctorReviewedAt as Date).toISOString() : undefined,
    doctorName: row.doctorName,
    doctorDiagnosis: row.doctorDiagnosis,
    doctorTreatmentPlan: row.doctorTreatmentPlan,
    doctorNotes: row.doctorNotes,
    nextAppointmentDate: row.nextAppointmentDate ? (row.nextAppointmentDate as Date).toISOString().split('T')[0] : undefined,
    completedById: row.completedById,
    completedByName: row.completedByName,
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

export function medFromPrisma(row: MedRow): FollowUpMedication {
  return {
    id: row.id,
    followUpId: row.followUpId,
    drugName: row.drugName,
    dosage: row.dosage,
    frequency: row.frequency,
    duration: row.duration,
    instructions: row.instructions,
    status: medicationStatusToApp(row.status) as FollowUpMedication['status'],
    notes: row.notes,
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

// Cached for 30 s; invalidated immediately by revalidateTag('follow-ups') after any mutation.
export const getAllFollowUps = unstable_cache(
  async (where: { region?: string } = {}): Promise<FollowUp[]> => {
    const rows = await prisma.followUp.findMany({
      where,
      include: FOLLOW_UP_INCLUDE,
      orderBy: { dueDate: 'asc' },
    });
    return rows.map(fromPrisma);
  },
  ['follow-ups-list'],
  { revalidate: 30, tags: ['follow-ups'] },
);

export async function getFollowUpWithMedications(id: string): Promise<(FollowUp & { medications: FollowUpMedication[] }) | null> {
  const row = await prisma.followUp.findUnique({
    where: { id },
    include: { medications: { orderBy: { createdAt: 'asc' } } },
  });
  if (!row) return null;
  return { ...fromPrisma(row), medications: row.medications.map(medFromPrisma) };
}

export async function getMedicationsForFollowUp(followUpId: string): Promise<FollowUpMedication[]> {
  const rows = await prisma.followUpMedication.findMany({
    where: { followUpId },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map(medFromPrisma);
}

export const getAllMedications = unstable_cache(
  async (followUpWhere: { region?: string } = {}): Promise<FollowUpMedication[]> => {
    const rows = await prisma.followUpMedication.findMany({
      where: followUpWhere.region ? { followUp: { region: followUpWhere.region } } : {},
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(medFromPrisma);
  },
  ['follow-ups-medications'],
  { revalidate: 30, tags: ['follow-ups'] },
);

function resolveDoctorReviewStatus(data: Pick<FollowUp, 'needsDoctorReview' | 'doctorReviewStatus'>) {
  if (data.needsDoctorReview && data.doctorReviewStatus === 'Not Needed') return 'Pending';
  if (!data.needsDoctorReview && data.doctorReviewStatus === 'Pending') return 'Not Needed';
  return data.doctorReviewStatus;
}

export async function createFollowUp(data: Omit<FollowUp, 'id' | 'createdAt'>): Promise<FollowUp> {
  const resolvedStatus = resolveDoctorReviewStatus(data);
  const assignedDoctor = data.doctorName
    ? data.doctorName
    : await resolveAssignedDoctor(data.surgeryId, data.campaignRegionId);
  const row = await prisma.followUp.create({
    data: {
      patientId: data.patientId,
      patientName: data.patientName,
      surgeryId: data.surgeryId,
      campaignId: data.campaignId,
      campaignRegionId: data.campaignRegionId ?? null,
      region: data.region,
      milestone: followUpMilestoneFromApp(data.milestone) as never,
      dueDate: new Date(data.dueDate),
      completedAt: data.completedAt ? new Date(data.completedAt) : null,
      status: data.status as never,
      vaRightPost: data.vaRightPost || null,
      vaLeftPost: data.vaLeftPost || null,
      complications: data.complications,
      notes: data.notes,
      needsDoctorReview: data.needsDoctorReview,
      doctorReviewStatus: doctorReviewStatusFromApp(resolvedStatus) as never,
      doctorReviewedAt: data.doctorReviewedAt ? new Date(data.doctorReviewedAt) : null,
      doctorName: assignedDoctor,
      doctorDiagnosis: data.doctorDiagnosis,
      doctorTreatmentPlan: data.doctorTreatmentPlan,
      doctorNotes: data.doctorNotes,
      nextAppointmentDate: data.nextAppointmentDate ? new Date(data.nextAppointmentDate) : null,
      completedById: data.completedById,
      completedByName: data.completedByName,
    },
  });
  return fromPrisma(row);
}

async function resolveAssignedDoctor(surgeryId: string, campaignRegionId?: string): Promise<string> {
  const surgery = await prisma.surgery.findUnique({
    where: { id: surgeryId },
    select: { surgeonName: true },
  });
  if (surgery?.surgeonName) return surgery.surgeonName;
  if (!campaignRegionId) return '';
  const region = await prisma.campaignRegion.findUnique({
    where: { id: campaignRegionId },
    select: { doctorName: true },
  });
  return region?.doctorName ?? '';
}

export async function updateFollowUp(id: string, data: Omit<FollowUp, 'id' | 'createdAt'>): Promise<FollowUp> {
  const resolvedStatus = resolveDoctorReviewStatus(data);
  const row = await prisma.followUp.update({
    where: { id },
    data: {
      patientId: data.patientId,
      patientName: data.patientName,
      surgeryId: data.surgeryId,
      campaignId: data.campaignId,
      campaignRegionId: data.campaignRegionId ?? null,
      region: data.region,
      milestone: followUpMilestoneFromApp(data.milestone) as never,
      dueDate: new Date(data.dueDate),
      completedAt: data.completedAt ? new Date(data.completedAt) : null,
      status: data.status as never,
      vaRightPost: data.vaRightPost || null,
      vaLeftPost: data.vaLeftPost || null,
      complications: data.complications,
      notes: data.notes,
      needsDoctorReview: data.needsDoctorReview,
      doctorReviewStatus: doctorReviewStatusFromApp(resolvedStatus) as never,
      doctorReviewedAt: data.doctorReviewedAt ? new Date(data.doctorReviewedAt) : null,
      doctorName: data.doctorName,
      doctorDiagnosis: data.doctorDiagnosis,
      doctorTreatmentPlan: data.doctorTreatmentPlan,
      doctorNotes: data.doctorNotes,
      nextAppointmentDate: data.nextAppointmentDate ? new Date(data.nextAppointmentDate) : null,
      completedById: data.completedById,
      completedByName: data.completedByName,
    },
  });
  return fromPrisma(row);
}

export async function deleteFollowUp(id: string): Promise<void> {
  await prisma.followUp.delete({ where: { id } });
}

export async function checkAndMarkOverdue(where: { region?: string } = {}): Promise<number> {
  const today = startOfDay(new Date());
  const mutableStatuses = ['Pending', 'Due', 'Overdue'] as never[];
  let updated = 0;

  for (const rule of ACTIVE_FOLLOW_UP_SCHEDULE) {
    const dueStart = addDays(today, -(rule.dueWindowDays - 1));
    const overdueStart = addDays(today, -(rule.missedAfterDueDays - 1));

    const [pending, due, overdue, missed] = await Promise.all([
      prisma.followUp.updateMany({
        where: {
          ...where,
          milestone: rule.prismaMilestone as never,
          status: { in: mutableStatuses },
          dueDate: { gt: today },
        },
        data: { status: 'Pending' as never },
      }),
      prisma.followUp.updateMany({
        where: {
          ...where,
          milestone: rule.prismaMilestone as never,
          status: { in: mutableStatuses },
          dueDate: { lte: today, gte: dueStart },
        },
        data: { status: 'Due' as never },
      }),
      prisma.followUp.updateMany({
        where: {
          ...where,
          milestone: rule.prismaMilestone as never,
          status: { in: mutableStatuses },
          dueDate: { lt: dueStart, gte: overdueStart },
        },
        data: { status: 'Overdue' as never },
      }),
      prisma.followUp.updateMany({
        where: {
          ...where,
          milestone: rule.prismaMilestone as never,
          status: { in: mutableStatuses },
          dueDate: { lt: overdueStart },
        },
        data: { status: 'Missed' as never },
      }),
    ]);

    updated += pending.count + due.count + overdue.count + missed.count;
  }

  return updated;
}

export async function createMedication(
  data: Omit<FollowUpMedication, 'id' | 'createdAt'>,
): Promise<FollowUpMedication> {
  const row = await prisma.followUpMedication.create({
    data: {
      followUpId: data.followUpId,
      drugName: data.drugName,
      dosage: data.dosage,
      frequency: data.frequency,
      duration: data.duration,
      instructions: data.instructions,
      status: medicationStatusFromApp(data.status) as never,
      notes: data.notes,
    },
  });
  return medFromPrisma(row);
}

export async function updateMedication(
  id: string,
  data: Omit<FollowUpMedication, 'id' | 'createdAt'>,
): Promise<FollowUpMedication> {
  const row = await prisma.followUpMedication.update({
    where: { id },
    data: {
      drugName: data.drugName,
      dosage: data.dosage,
      frequency: data.frequency,
      duration: data.duration,
      instructions: data.instructions,
      status: medicationStatusFromApp(data.status) as never,
      notes: data.notes,
    },
  });
  return medFromPrisma(row);
}

export async function deleteMedication(id: string): Promise<void> {
  await prisma.followUpMedication.delete({ where: { id } });
}
