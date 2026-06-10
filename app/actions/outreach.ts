'use server';

import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { fromPrisma, getAllOutreachActivities as fetchAllOutreachActivities } from '@/lib/api/outreach';
import { guard } from '@/lib/auth-server';
import type { OutreachActivity } from '@/types';
import type { OutreachType } from '@/lib/generated/prisma/client';

export async function getAllOutreachActivities(): Promise<OutreachActivity[]> {
  const denied = await guard('outreach', 'view');
  if (denied) throw new Error(denied.error);
  return fetchAllOutreachActivities();
}

type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

const OutreachSchema = z.object({
  type: z.enum(['Awareness Campaign', 'Community Meeting', 'Radio Broadcast', 'School Visit', 'Health Fair', 'CHW Training']),
  title: z.string().min(1, 'Title is required'),
  date: z.string().min(1, 'Date is required'),
  locationId: z.string().uuid('Valid location required'),
  locationName: z.string().min(1),
  campaignId: z.string().uuid('Valid campaign required'),
  reach: z.number().int().min(0),
  conversions: z.number().int().min(0),
  conductedBy: z.string().min(1, 'Conducted by is required'),
  notes: z.string(),
});

export async function actionCreateOutreachActivity(
  input: unknown
): Promise<ActionResult<OutreachActivity>> {
  const denied = await guard('outreach', 'create');
  if (denied) return denied;

  const parsed = OutreachSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  try {
    const row = await prisma.outreachActivity.create({
      data: {
        type: d.type as OutreachType,
        title: d.title,
        date: new Date(d.date),
        locationId: d.locationId,
        locationName: d.locationName,
        campaignId: d.campaignId,
        reach: d.reach,
        conversions: d.conversions,
        conductedBy: d.conductedBy,
        notes: d.notes,
      },
    });
    return { ok: true, data: fromPrisma(row) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionUpdateOutreachActivity(
  id: string,
  input: unknown
): Promise<ActionResult<OutreachActivity>> {
  const denied = await guard('outreach', 'edit');
  if (denied) return denied;

  const parsed = OutreachSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  try {
    const row = await prisma.outreachActivity.update({
      where: { id },
      data: {
        type: d.type as OutreachType,
        title: d.title,
        date: new Date(d.date),
        locationId: d.locationId,
        locationName: d.locationName,
        campaignId: d.campaignId,
        reach: d.reach,
        conversions: d.conversions,
        conductedBy: d.conductedBy,
        notes: d.notes,
      },
    });
    return { ok: true, data: fromPrisma(row) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionDeleteOutreachActivity(id: string): Promise<ActionResult> {
  const denied = await guard('outreach', 'delete');
  if (denied) return denied;

  try {
    await prisma.outreachActivity.delete({ where: { id } });
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
