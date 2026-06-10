import 'server-only';
import { prisma } from '@/lib/prisma';
import type { OutreachActivity as PrismaActivity } from '@/lib/generated/prisma/client';
import type { OutreachActivity } from '@/types';

export function fromPrisma(row: PrismaActivity): OutreachActivity {
  return {
    id:           row.id,
    type:         row.type as OutreachActivity['type'],
    title:        row.title,
    date:         (row.date as Date).toISOString().split('T')[0],
    locationId:   row.locationId,
    locationName: row.locationName,
    campaignId:   row.campaignId,
    reach:        row.reach,
    conversions:  row.conversions,
    conductedBy:  row.conductedBy,
    notes:        row.notes,
    createdAt:    (row.createdAt as Date).toISOString(),
  };
}

export async function getAllOutreachActivities(): Promise<OutreachActivity[]> {
  const rows = await prisma.outreachActivity.findMany({ orderBy: { date: 'desc' } });
  return rows.map(fromPrisma);
}
