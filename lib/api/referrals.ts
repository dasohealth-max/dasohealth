import 'server-only';
import { prisma } from '@/lib/prisma';
import { referralSourceToApp, referralSourceFromApp } from '@/lib/prisma-enums';
import type { Referral } from '@/types';

type Row = NonNullable<Awaited<ReturnType<typeof prisma.referral.findFirst>>>;

export function fromPrisma(row: Row): Referral {
  return {
    id: row.id,
    screeningId: row.screeningId ?? undefined,
    patientName: row.patientName,
    patientPhone: row.patientPhone,
    source: referralSourceToApp(row.source) as Referral['source'],
    referredBy: row.referredBy,
    campaignId: row.campaignId,
    locationId: row.locationId,
    status: row.status as Referral['status'],
    referredAt: (row.referredAt as Date).toISOString().split('T')[0],
    contactedAt: row.contactedAt ? (row.contactedAt as Date).toISOString().split('T')[0] : undefined,
    screenedAt: row.screenedAt ? (row.screenedAt as Date).toISOString().split('T')[0] : undefined,
    convertedAt: row.convertedAt ? (row.convertedAt as Date).toISOString().split('T')[0] : undefined,
    notes: row.notes,
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

export async function getAllReferrals(): Promise<Referral[]> {
  const rows = await prisma.referral.findMany({ orderBy: { createdAt: 'desc' } });
  return rows.map(fromPrisma);
}

export async function createReferral(data: Omit<Referral, 'id' | 'createdAt'>): Promise<Referral> {
  const row = await prisma.referral.create({
    data: {
      screeningId: data.screeningId || null,
      patientName: data.patientName,
      patientPhone: data.patientPhone,
      source: referralSourceFromApp(data.source) as never,
      referredBy: data.referredBy,
      campaignId: data.campaignId,
      locationId: data.locationId,
      status: data.status as never,
      referredAt: new Date(data.referredAt),
      notes: data.notes,
    },
  });
  return fromPrisma(row);
}

export async function updateReferral(id: string, data: Omit<Referral, 'id' | 'createdAt'>): Promise<Referral> {
  const row = await prisma.referral.update({
    where: { id },
    data: {
      patientName: data.patientName,
      patientPhone: data.patientPhone,
      source: referralSourceFromApp(data.source) as never,
      referredBy: data.referredBy,
      campaignId: data.campaignId,
      locationId: data.locationId,
      status: data.status as never,
      referredAt: new Date(data.referredAt),
      notes: data.notes,
    },
  });
  return fromPrisma(row);
}

export async function deleteReferral(id: string): Promise<void> {
  await prisma.referral.delete({ where: { id } });
}
