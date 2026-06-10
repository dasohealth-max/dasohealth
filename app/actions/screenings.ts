'use server';

import { prisma } from '@/lib/prisma';
import { getAllScreenings, createScreening, updateScreening, deleteScreening } from '@/lib/api/screenings';
import { guard } from '@/lib/auth-server';
import type { Screening } from '@/types';

export { getAllScreenings };

type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

const CLINICAL_RECS = ['Further Investigation', 'Glasses', 'Follow-up'] as const;

async function handleAutoRouting(
  screeningId: string,
  form: Omit<Screening, 'id' | 'createdAt'>,
  patientPhone: string,
  isEdit: boolean,
) {
  if (!form.campaignId || !form.locationId) return;

  if (form.recommendation === 'Refer for Surgery') {
    if (isEdit) {
      await prisma.referral.updateMany({
        where: { screeningId },
        data: { status: 'Converted' as never },
      });
    }
    await prisma.surgery.create({
      data: {
        patientId: form.patientId,
        patientName: form.patientName,
        campaignId: form.campaignId,
        locationId: form.locationId,
        eye: 'Left' as never,
        lensType: 'FoldableAcrylic' as never,
        scheduledAt: new Date(Date.now() + 7 * 86400_000),
        status: 'Scheduled' as never,
        preOpVa: form.vaRightUnaided,
        complications: '',
        intraopNotes: `Referred from screening by ${form.screenedBy}. ${form.notes}`.trim(),
      },
    });
  } else if (CLINICAL_RECS.includes(form.recommendation as typeof CLINICAL_RECS[number])) {
    const existing = isEdit
      ? await prisma.referral.findFirst({ where: { screeningId } })
      : null;
    if (existing) {
      await prisma.referral.update({
        where: { id: existing.id },
        data: {
          patientName: form.patientName,
          patientPhone,
          referredBy: form.screenedBy,
          campaignId: form.campaignId,
          locationId: form.locationId,
          notes: form.recommendation,
        },
      });
    } else {
      await prisma.referral.create({
        data: {
          screeningId,
          patientName: form.patientName,
          patientPhone,
          source: 'Facility' as never,
          referredBy: form.screenedBy,
          campaignId: form.campaignId,
          locationId: form.locationId,
          status: 'Pending' as never,
          referredAt: new Date(),
          notes: form.recommendation,
        },
      });
    }
  } else if (form.recommendation === 'Discharge' && isEdit) {
    await prisma.referral.updateMany({
      where: { screeningId },
      data: { status: 'Converted' as never },
    });
  }
}

export async function actionCreateScreening(
  data: Omit<Screening, 'id' | 'createdAt'>,
): Promise<ActionResult<Screening>> {
  const denied = await guard('screening', 'create');
  if (denied) return denied;

  try {
    if (!data.patientId || !data.campaignId || !data.locationId) {
      return { ok: false, error: 'Patient, campaign, and location are required' };
    }
    const screening = await createScreening(data);
    const patient = await prisma.patient.findUnique({
      where: { id: data.patientId },
      select: { phone: true },
    });
    await handleAutoRouting(screening.id, data, patient?.phone ?? '', false);
    return { ok: true, data: screening };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionUpdateScreening(
  id: string,
  data: Omit<Screening, 'id' | 'createdAt'>,
): Promise<ActionResult<Screening>> {
  const denied = await guard('screening', 'edit');
  if (denied) return denied;

  try {
    if (!data.patientId || !data.campaignId || !data.locationId) {
      return { ok: false, error: 'Patient, campaign, and location are required' };
    }
    const screening = await updateScreening(id, data);
    const patient = await prisma.patient.findUnique({
      where: { id: data.patientId },
      select: { phone: true },
    });
    await handleAutoRouting(id, data, patient?.phone ?? '', true);
    return { ok: true, data: screening };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionDeleteScreening(id: string): Promise<ActionResult> {
  const denied = await guard('screening', 'delete');
  if (denied) return denied;

  try {
    await deleteScreening(id);
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
