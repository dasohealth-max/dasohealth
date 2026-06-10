'use server';

import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { fromPrisma, getAllTransportJobs } from '@/lib/api/transport';
import { guard } from '@/lib/auth-server';
import type { TransportJob } from '@/types';
import type { TransportStatus } from '@/lib/generated/prisma/client';

export { getAllTransportJobs };

type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

const TransportSchema = z.object({
  patientId:      z.string().uuid('Valid patient required'),
  patientName:    z.string().min(1),
  vehicle:        z.string(),
  driver:         z.string(),
  pickupLocation: z.string().min(1, 'Pickup location is required'),
  dropLocation:   z.string().min(1, 'Drop-off location is required'),
  scheduledAt:    z.string().min(1, 'Scheduled date/time is required'),
  cost:           z.number().min(0),
  status:         z.enum(['Scheduled', 'In-Transit', 'Completed', 'Cancelled']),
  notes:          z.string(),
});

export async function actionCreateTransportJob(
  input: unknown
): Promise<ActionResult<TransportJob>> {
  const denied = await guard('transport', 'create');
  if (denied) return denied;

  const parsed = TransportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  try {
    const row = await prisma.transportJob.create({
      data: {
        patientId:      d.patientId,
        patientName:    d.patientName,
        vehicle:        d.vehicle,
        driver:         d.driver,
        pickupLocation: d.pickupLocation,
        dropLocation:   d.dropLocation,
        scheduledAt:    new Date(d.scheduledAt),
        cost:           d.cost,
        status:         d.status as TransportStatus,
        notes:          d.notes,
      },
    });
    return { ok: true, data: fromPrisma(row) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionUpdateTransportJob(
  id: string,
  input: unknown
): Promise<ActionResult<TransportJob>> {
  const denied = await guard('transport', 'edit');
  if (denied) return denied;

  const parsed = TransportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  try {
    const row = await prisma.transportJob.update({
      where: { id },
      data: {
        patientId:      d.patientId,
        patientName:    d.patientName,
        vehicle:        d.vehicle,
        driver:         d.driver,
        pickupLocation: d.pickupLocation,
        dropLocation:   d.dropLocation,
        scheduledAt:    new Date(d.scheduledAt),
        cost:           d.cost,
        status:         d.status as TransportStatus,
        notes:          d.notes,
      },
    });
    return { ok: true, data: fromPrisma(row) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionUpdateTransportStatus(
  id: string,
  status: TransportJob['status']
): Promise<ActionResult<TransportJob>> {
  const denied = await guard('transport', 'edit');
  if (denied) return denied;

  try {
    const row = await prisma.transportJob.update({
      where: { id },
      data: {
        status: status as TransportStatus,
        completedAt: status === 'Completed' ? new Date() : undefined,
      },
    });
    return { ok: true, data: fromPrisma(row) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionDeleteTransportJob(id: string): Promise<ActionResult> {
  const denied = await guard('transport', 'delete');
  if (denied) return denied;

  try {
    await prisma.transportJob.delete({ where: { id } });
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
