import 'server-only';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { surgeryStatusToApp, surgeryStatusFromApp, lensTypeToApp, lensTypeFromApp } from '@/lib/prisma-enums';
import type { Surgery } from '@/types';

type Row = NonNullable<Awaited<ReturnType<typeof prisma.surgery.findFirst>>>;

export function fromPrisma(row: Row): Surgery {
  return {
    id: row.id,
    patientId: row.patientId,
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
    const rows = await prisma.surgery.findMany({ where, orderBy: { scheduledAt: 'desc' } });
    return rows.map(fromPrisma);
  },
  ['surgeries-list'],
  { revalidate: 30, tags: ['surgeries'] },
);

export async function createSurgery(data: Omit<Surgery, 'id' | 'createdAt'>): Promise<Surgery> {
  const row = await prisma.surgery.create({
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
  });
  return fromPrisma(row);
}

export async function deleteSurgery(id: string): Promise<void> {
  await prisma.surgery.delete({ where: { id } });
}
