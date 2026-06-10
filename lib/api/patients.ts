import 'server-only';
import { prisma } from '@/lib/prisma';
import type { Patient as PrismaPatient } from '@/lib/generated/prisma/client';
import type { Patient } from '@/types';

export function fromPrisma(row: PrismaPatient): Patient {
  return {
    id: row.id,
    patientCode: row.patientCode,
    fullName: row.fullName,
    dateOfBirth: (row.dateOfBirth as Date).toISOString().split('T')[0],
    sex: row.sex as Patient['sex'],
    phone: row.phone,
    email: row.email ?? undefined,
    district: row.district,
    region: row.region,
    occupation: row.occupation ?? undefined,
    education: row.education ?? undefined,
    disabilityStatus: row.disabilityStatus as Patient['disabilityStatus'],
    insuranceStatus: row.insuranceStatus,
    emergencyContact: row.emergencyContact,
    emergencyPhone: row.emergencyPhone,
    consentGiven: row.consentGiven,
    consentDate: row.consentDate
      ? (row.consentDate as Date).toISOString().split('T')[0]
      : '',
    campaignId: row.campaignId ?? undefined,
    locationId: row.locationId ?? undefined,
    referralSource: row.referralSource,
    notes: row.notes ?? undefined,
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    createdAt: (row.createdAt as Date).toISOString(),
  };
}

export async function getAllPatients(): Promise<Patient[]> {
  const rows = await prisma.patient.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(fromPrisma);
}

export async function getPatientById(id: string): Promise<Patient | null> {
  const row = await prisma.patient.findUnique({ where: { id } });
  return row ? fromPrisma(row) : null;
}
