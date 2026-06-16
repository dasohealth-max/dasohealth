import 'server-only';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { vaGradeToApp, vaGradeFromApp, screeningRecToApp, screeningRecFromApp } from '@/lib/prisma-enums';
import type { Screening } from '@/types';

type Row = NonNullable<Awaited<ReturnType<typeof prisma.screening.findFirst>>>;

export function fromPrisma(row: Row): Screening {
  return {
    id: row.id,
    patientId: row.patientId,
    patientName: row.patientName,
    campaignId: row.campaignId,
    campaignRegionId: row.campaignRegionId ?? undefined,
    region: row.region,
    operationDistrict: row.operationDistrict,
    screenedBy: row.screenedBy,
    screenedById: row.screenedById,
    screenedByName: row.screenedByName,
    screenedAt: (row.screenedAt as Date).toISOString(),
    vaRightUnaided: vaGradeToApp(row.vaRightUnaided) as Screening['vaRightUnaided'],
    vaLeftUnaided: vaGradeToApp(row.vaLeftUnaided) as Screening['vaLeftUnaided'],
    vaRightCorrected: row.vaRightCorrected
      ? (vaGradeToApp(row.vaRightCorrected) as Screening['vaRightCorrected'])
      : undefined,
    vaLeftCorrected: row.vaLeftCorrected
      ? (vaGradeToApp(row.vaLeftCorrected) as Screening['vaLeftCorrected'])
      : undefined,
    iopRight: row.iopRight ?? undefined,
    iopLeft: row.iopLeft ?? undefined,
    cataractSuspected: row.cataractSuspected,
    glaucomaSuspected: row.glaucomaSuspected,
    diabeticRetinopathy: row.diabeticRetinopathy,
    otherFindings: row.otherFindings,
    medicalHistory: row.medicalHistory,
    currentMedications: row.currentMedications,
    recommendation: screeningRecToApp(row.recommendation) as Screening['recommendation'],
    notes: row.notes,
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

// Cached for 30 s; invalidated by revalidateTag('screenings') on any mutation.
export const getAllScreenings = unstable_cache(
  async (where: { region?: string } = {}): Promise<Screening[]> => {
    const rows = await prisma.screening.findMany({
      where,
      orderBy: { screenedAt: 'desc' },
    });
    return rows.map(fromPrisma);
  },
  ['screenings-list'],
  { revalidate: 30, tags: ['screenings'] },
);

export async function createScreening(
  data: Omit<Screening, 'id' | 'createdAt'>,
): Promise<Screening> {
  const row = await prisma.screening.create({
    data: {
      patientId: data.patientId,
      patientName: data.patientName,
      campaignId: data.campaignId,
      campaignRegionId: data.campaignRegionId ?? null,
      region: data.region,
      operationDistrict: data.operationDistrict,
      screenedBy: data.screenedBy,
      screenedById: data.screenedById,
      screenedByName: data.screenedByName,
      screenedAt: new Date(data.screenedAt),
      vaRightUnaided: vaGradeFromApp(data.vaRightUnaided) as never,
      vaLeftUnaided: vaGradeFromApp(data.vaLeftUnaided) as never,
      vaRightCorrected: data.vaRightCorrected
        ? (vaGradeFromApp(data.vaRightCorrected) as never)
        : null,
      vaLeftCorrected: data.vaLeftCorrected
        ? (vaGradeFromApp(data.vaLeftCorrected) as never)
        : null,
      iopRight: data.iopRight ?? null,
      iopLeft: data.iopLeft ?? null,
      cataractSuspected: data.cataractSuspected,
      glaucomaSuspected: data.glaucomaSuspected,
      diabeticRetinopathy: data.diabeticRetinopathy,
      otherFindings: data.otherFindings,
      medicalHistory: data.medicalHistory,
      currentMedications: data.currentMedications,
      recommendation: screeningRecFromApp(data.recommendation) as never,
      notes: data.notes,
    },
  });
  return fromPrisma(row);
}

export async function updateScreening(
  id: string,
  data: Omit<Screening, 'id' | 'createdAt'>,
): Promise<Screening> {
  const row = await prisma.screening.update({
    where: { id },
    data: {
      patientId: data.patientId,
      patientName: data.patientName,
      campaignId: data.campaignId,
      campaignRegionId: data.campaignRegionId ?? null,
      region: data.region,
      operationDistrict: data.operationDistrict,
      screenedBy: data.screenedBy,
      screenedById: data.screenedById,
      screenedByName: data.screenedByName,
      screenedAt: new Date(data.screenedAt),
      vaRightUnaided: vaGradeFromApp(data.vaRightUnaided) as never,
      vaLeftUnaided: vaGradeFromApp(data.vaLeftUnaided) as never,
      vaRightCorrected: data.vaRightCorrected
        ? (vaGradeFromApp(data.vaRightCorrected) as never)
        : null,
      vaLeftCorrected: data.vaLeftCorrected
        ? (vaGradeFromApp(data.vaLeftCorrected) as never)
        : null,
      iopRight: data.iopRight ?? null,
      iopLeft: data.iopLeft ?? null,
      cataractSuspected: data.cataractSuspected,
      glaucomaSuspected: data.glaucomaSuspected,
      diabeticRetinopathy: data.diabeticRetinopathy,
      otherFindings: data.otherFindings,
      medicalHistory: data.medicalHistory,
      currentMedications: data.currentMedications,
      recommendation: screeningRecFromApp(data.recommendation) as never,
      notes: data.notes,
    },
  });
  return fromPrisma(row);
}

export async function deleteScreening(id: string): Promise<void> {
  await prisma.screening.delete({ where: { id } });
}
