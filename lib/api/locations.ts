import 'server-only';
import { prisma } from '@/lib/prisma';
import { facilityTypeToApp, facilityTypeFromApp } from '@/lib/prisma-enums';
import type { Location } from '@/types';

type Row = NonNullable<Awaited<ReturnType<typeof prisma.location.findFirst>>>;

export function fromPrisma(row: Row): Location {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    facilityType: facilityTypeToApp(row.facilityType) as Location['facilityType'],
    district: row.district,
    region: row.region,
    country: row.country,
    lat: row.lat,
    lng: row.lng,
    phone: row.phone ?? undefined,
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

export async function getAllLocations(): Promise<Location[]> {
  const rows = await prisma.location.findMany({ orderBy: { name: 'asc' } });
  return rows.map(fromPrisma);
}

export async function createLocation(data: Omit<Location, 'id' | 'createdAt'>): Promise<Location> {
  const row = await prisma.location.create({
    data: { ...data, facilityType: facilityTypeFromApp(data.facilityType) as never },
  });
  return fromPrisma(row);
}

export async function updateLocation(id: string, data: Omit<Location, 'id' | 'createdAt'>): Promise<Location> {
  const row = await prisma.location.update({
    where: { id },
    data: { ...data, facilityType: facilityTypeFromApp(data.facilityType) as never },
  });
  return fromPrisma(row);
}

export async function deleteLocation(id: string): Promise<void> {
  await prisma.location.delete({ where: { id } });
}
