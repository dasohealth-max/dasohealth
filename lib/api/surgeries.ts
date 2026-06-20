import 'server-only';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { surgeryStatusToApp, surgeryStatusFromApp, lensTypeToApp, lensTypeFromApp, screeningRecToApp, vaGradeToApp } from '@/lib/prisma-enums';
import type { Surgery } from '@/types';
import type { Prisma } from '@/lib/generated/prisma/client';

type Row = NonNullable<Awaited<ReturnType<typeof prisma.surgery.findFirst>>> & {
  patient?: { patientCode: string; phone: string; emergencyPhone: string } | null;
};
type ScreeningSnapshotRow = NonNullable<Awaited<ReturnType<typeof prisma.screening.findFirst>>>;
type SurgeryScreeningResult = NonNullable<Surgery['screeningResult']>;

export function fromPrisma(row: Row): Surgery {
  return {
    id: row.id,
    patientId: row.patientId,
    patientCode: row.patient?.patientCode,
    patientPhone: row.patient?.phone,
    patientEmergencyPhone: row.patient?.emergencyPhone,
    patientName: row.patientName,
    campaignId: row.campaignId,
    campaignRegionId: row.campaignRegionId ?? undefined,
    region: row.region,
    operationDistrict: row.operationDistrict,
    createdFromScreeningId: row.createdFromScreeningId ?? undefined,
    surgeonName: row.surgeonName ?? '',
    eye: row.eye as Surgery['eye'],
    lensType: lensTypeToApp(row.lensType) as Surgery['lensType'],
    scheduledAt: (row.scheduledAt as Date).toISOString(),
    performedAt: row.performedAt ? (row.performedAt as Date).toISOString() : undefined,
    status: surgeryStatusToApp(row.status) as Surgery['status'],
    preOpVA: row.preOpVa,
    postOpVA: row.postOpVa ?? undefined,
    complications: row.complications,
    intraopNotes: row.intraopNotes,
    completedById: row.completedById,
    completedByName: row.completedByName,
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

// Cached for 30 s; invalidated immediately by revalidateTag('surgeries') after any mutation.
export const getAllSurgeries = unstable_cache(
  async (where: { region?: string } = {}): Promise<Surgery[]> => {
    const rows = await prisma.surgery.findMany({
      where,
      include: { patient: { select: { patientCode: true, phone: true, emergencyPhone: true } } },
      orderBy: { scheduledAt: 'desc' },
    });
    return rows.map(fromPrisma);
  },
  ['surgeries-list'],
  { revalidate: 30, tags: ['surgeries'] },
);

export async function attachScreeningResults(rows: Row[]): Promise<Surgery[]> {
  const surgeries = rows.map(fromPrisma);
  const screeningIds = [...new Set(surgeries.map((surgery) => surgery.createdFromScreeningId).filter(Boolean))] as string[];
  if (screeningIds.length === 0) return surgeries;

  const screenings = await prisma.screening.findMany({
    where: { id: { in: screeningIds } },
  });
  const byId = new Map<string, ScreeningSnapshotRow>(screenings.map((screening) => [screening.id, screening]));

  return surgeries.map((surgery) => {
    const screening = surgery.createdFromScreeningId ? byId.get(surgery.createdFromScreeningId) : undefined;
    if (!screening) return surgery;
    const screeningEye = screening.eye as Surgery['eye'];
    const syncedPreOpVA = preOpVaForScreeningEye(screening);
    const shouldSyncDisplay = surgery.status !== 'Completed';
    return {
      ...surgery,
      eye: shouldSyncDisplay ? screeningEye : surgery.eye,
      preOpVA: shouldSyncDisplay ? syncedPreOpVA : surgery.preOpVA,
      screeningResult: {
        screenedAt: (screening.screenedAt as Date).toISOString(),
        screenedByName: screening.screenedByName,
        vaRightUnaided: vaGradeToApp(screening.vaRightUnaided) as SurgeryScreeningResult['vaRightUnaided'],
        vaLeftUnaided: vaGradeToApp(screening.vaLeftUnaided) as SurgeryScreeningResult['vaLeftUnaided'],
        cataractSuspected: screening.cataractSuspected,
        glaucomaSuspected: screening.glaucomaSuspected,
        diabeticRetinopathy: screening.diabeticRetinopathy,
        eye: screeningEye,
        recommendation: screeningRecToApp(screening.recommendation) as SurgeryScreeningResult['recommendation'],
        otherFindings: screening.otherFindings,
        medicalHistory: screening.medicalHistory,
        currentMedications: screening.currentMedications,
        notes: screening.notes,
      },
    };
  });
}

function preOpVaForScreeningEye(screening: ScreeningSnapshotRow): string {
  const right = vaGradeToApp(screening.vaRightUnaided) as string;
  const left = vaGradeToApp(screening.vaLeftUnaided) as string;
  if (screening.eye === 'Right') return right;
  if (screening.eye === 'Left') return left;
  return `Right: ${right} / Left: ${left}`;
}

export async function getSurgeriesWithScreeningResults(where: Prisma.SurgeryWhereInput = {}): Promise<Surgery[]> {
  const rows = await prisma.surgery.findMany({
    where,
    include: { patient: { select: { patientCode: true, phone: true, emergencyPhone: true } } },
    orderBy: { scheduledAt: 'desc' },
  });
  return attachScreeningResults(rows);
}

export async function createSurgery(data: Omit<Surgery, 'id' | 'createdAt'>): Promise<Surgery> {
  const assignedDoctor = data.campaignRegionId
    ? await prisma.campaignRegion.findUnique({
        where: { id: data.campaignRegionId },
        select: { doctorName: true },
      })
    : null;
  const row = await prisma.surgery.create({
    data: {
      patientId: data.patientId,
      patientName: data.patientName,
      campaignId: data.campaignId,
      campaignRegionId: data.campaignRegionId ?? null,
      region: data.region,
      operationDistrict: data.operationDistrict,
      createdFromScreeningId: data.createdFromScreeningId || null,
      surgeonName: data.surgeonName || assignedDoctor?.doctorName || null,
      eye: data.eye as never,
      lensType: lensTypeFromApp(data.lensType) as never,
      scheduledAt: new Date(data.scheduledAt),
      performedAt: data.performedAt ? new Date(data.performedAt) : null,
      status: surgeryStatusFromApp(data.status) as never,
      preOpVa: data.preOpVA,
      postOpVa: data.postOpVA || null,
      complications: data.complications,
      intraopNotes: data.intraopNotes,
      completedById: data.completedById,
      completedByName: data.completedByName,
    },
    include: { patient: { select: { patientCode: true, phone: true, emergencyPhone: true } } },
  });
  return fromPrisma(row);
}

export async function updateSurgery(id: string, data: Omit<Surgery, 'id' | 'createdAt'>): Promise<Surgery> {
  const row = await prisma.surgery.update({
    where: { id },
    data: {
      patientId: data.patientId,
      patientName: data.patientName,
      campaignId: data.campaignId,
      campaignRegionId: data.campaignRegionId ?? null,
      region: data.region,
      operationDistrict: data.operationDistrict,
      createdFromScreeningId: data.createdFromScreeningId || null,
      surgeonName: data.surgeonName || null,
      eye: data.eye as never,
      lensType: lensTypeFromApp(data.lensType) as never,
      scheduledAt: new Date(data.scheduledAt),
      performedAt: data.performedAt ? new Date(data.performedAt) : null,
      status: surgeryStatusFromApp(data.status) as never,
      preOpVa: data.preOpVA,
      postOpVa: data.postOpVA || null,
      complications: data.complications,
      intraopNotes: data.intraopNotes,
      completedById: data.completedById,
      completedByName: data.completedByName,
    },
    include: { patient: { select: { patientCode: true, phone: true, emergencyPhone: true } } },
  });
  return fromPrisma(row);
}

export async function deleteSurgery(id: string): Promise<void> {
  await prisma.surgery.delete({ where: { id } });
}
