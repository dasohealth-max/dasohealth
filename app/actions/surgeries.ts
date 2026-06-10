'use server';

import { prisma } from '@/lib/prisma';
import { getAllSurgeries as fetchAllSurgeries, createSurgery, updateSurgery, deleteSurgery } from '@/lib/api/surgeries';
import { surgeryStatusFromApp } from '@/lib/prisma-enums';
import { guard } from '@/lib/auth-server';
import type { Surgery } from '@/types';

export async function getAllSurgeries(): Promise<Surgery[]> {
  const denied = await guard('surgeries', 'view');
  if (denied) throw new Error(denied.error);
  return fetchAllSurgeries();
}

type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

export async function actionCreateSurgery(
  data: Omit<Surgery, 'id' | 'createdAt'>,
): Promise<ActionResult<Surgery>> {
  const denied = await guard('surgeries', 'create');
  if (denied) return denied;

  try {
    if (!data.patientId || !data.campaignId || !data.locationId) {
      return { ok: false, error: 'Patient, campaign, and location are required' };
    }
    return { ok: true, data: await createSurgery(data) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionUpdateSurgery(
  id: string,
  data: Omit<Surgery, 'id' | 'createdAt'>,
): Promise<ActionResult<Surgery>> {
  const denied = await guard('surgeries', 'edit');
  if (denied) return denied;

  try {
    const old = await prisma.surgery.findUnique({ where: { id }, select: { status: true } });
    const updated = await updateSurgery(id, data);

    const newStatusKey = surgeryStatusFromApp(data.status);
    if (newStatusKey === 'Completed' && old?.status !== ('Completed' as never)) {
      const row = await prisma.surgery.findUnique({
        where: { id },
        select: { performedAt: true, patientId: true, patientName: true, campaignId: true },
      });
      if (row) {
        const base = row.performedAt ? new Date(row.performedAt) : new Date();
        const milestones: [string, number][] = [
          ['Day1', 1], ['Week1', 7], ['Month1', 30], ['Month3', 90],
        ];
        for (const [milestone, days] of milestones) {
          const dueDate = new Date(base.getTime() + days * 86400_000);
          await prisma.followUp.create({
            data: {
              patientId: row.patientId,
              patientName: row.patientName,
              surgeryId: id,
              campaignId: row.campaignId,
              milestone: milestone as never,
              dueDate,
              status: 'Pending' as never,
              smsReminderSent: false,
              complications: '',
              notes: '',
            },
          });
        }
      }
    }

    return { ok: true, data: updated };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionDeleteSurgery(id: string): Promise<ActionResult> {
  const denied = await guard('surgeries', 'delete');
  if (denied) return denied;

  try {
    await deleteSurgery(id);
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
