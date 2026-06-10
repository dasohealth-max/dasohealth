import 'server-only';
import { prisma } from '@/lib/prisma';
import type { TransportJob as PrismaJob } from '@/lib/generated/prisma/client';
import type { TransportJob } from '@/types';

export function fromPrisma(row: PrismaJob): TransportJob {
  return {
    id:             row.id,
    patientId:      row.patientId,
    patientName:    row.patientName,
    vehicle:        row.vehicle,
    driver:         row.driver,
    pickupLocation: row.pickupLocation,
    dropLocation:   row.dropLocation,
    scheduledAt:    (row.scheduledAt as Date).toISOString(),
    completedAt:    row.completedAt ? (row.completedAt as Date).toISOString() : undefined,
    cost:           Number(row.cost),
    status:         row.status as TransportJob['status'],
    notes:          row.notes,
    createdAt:      (row.createdAt as Date).toISOString(),
  };
}

export async function getAllTransportJobs(): Promise<TransportJob[]> {
  const rows = await prisma.transportJob.findMany({ orderBy: { scheduledAt: 'desc' } });
  return rows.map(fromPrisma);
}
