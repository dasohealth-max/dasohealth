'use server';

import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { fromPrisma, getAllPatients as fetchAllPatients, getPatientById as fetchPatientById } from '@/lib/api/patients';
import { guard } from '@/lib/auth-server';
import { nextPatientCode } from '@/lib/utils';
import type { Patient } from '@/types';
import type { Sex, DisabilityStatus } from '@/lib/generated/prisma/client';

// ─── Protected read operations ────────────────────────────────────────────
export async function getAllPatients(): Promise<Patient[]> {
  const denied = await guard('patients', 'view');
  if (denied) throw new Error(denied.error);
  return fetchAllPatients();
}

export async function getPatientById(id: string): Promise<Patient | null> {
  const denied = await guard('patients', 'view');
  if (denied) throw new Error(denied.error);
  return fetchPatientById(id);
}

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const PatientSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  sex: z.enum(['Male', 'Female', 'Other']),
  phone: z.string().min(1, 'Phone is required'),
  email: z.string().optional(),
  district: z.string().min(1, 'District is required'),
  region: z.string().min(1, 'Region is required'),
  occupation: z.string().optional(),
  education: z.string().optional(),
  disabilityStatus: z.enum(['None', 'Visual', 'Hearing', 'Mobility', 'Cognitive', 'Multiple']),
  insuranceStatus: z.string(),
  emergencyContact: z.string(),
  emergencyPhone: z.string(),
  consentGiven: z.boolean(),
  consentDate: z.string().optional(),
  campaignId: z.string().optional(),
  locationId: z.string().optional(),
  referralSource: z.string(),
  notes: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function actionCreatePatient(
  input: unknown
): Promise<ActionResult<Patient>> {
  const denied = await guard('patients', 'create');
  if (denied) return denied;

  const parsed = PatientSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const d = parsed.data;

  try {
    const existing = await prisma.patient.findMany({ select: { patientCode: true } });
    const codes = existing.map((r) => r.patientCode);
    const patientCode = nextPatientCode(codes);

    const row = await prisma.patient.create({
      data: {
        patientCode,
        fullName: d.fullName,
        dateOfBirth: new Date(d.dateOfBirth),
        sex: d.sex as Sex,
        phone: d.phone,
        email: d.email || null,
        district: d.district,
        region: d.region,
        occupation: d.occupation || null,
        education: d.education || null,
        disabilityStatus: d.disabilityStatus as DisabilityStatus,
        insuranceStatus: d.insuranceStatus,
        emergencyContact: d.emergencyContact,
        emergencyPhone: d.emergencyPhone,
        consentGiven: d.consentGiven,
        consentDate: d.consentDate ? new Date(d.consentDate) : null,
        campaignId: d.campaignId || null,
        locationId: d.locationId || null,
        referralSource: d.referralSource,
        notes: d.notes || null,
        lat: d.lat ?? null,
        lng: d.lng ?? null,
      },
    });
    return { ok: true, data: fromPrisma(row) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionUpdatePatient(
  id: string,
  input: unknown
): Promise<ActionResult<Patient>> {
  const denied = await guard('patients', 'edit');
  if (denied) return denied;

  const parsed = PatientSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const d = parsed.data;

  try {
    const row = await prisma.patient.update({
      where: { id },
      data: {
        fullName: d.fullName,
        dateOfBirth: new Date(d.dateOfBirth),
        sex: d.sex as Sex,
        phone: d.phone,
        email: d.email || null,
        district: d.district,
        region: d.region,
        occupation: d.occupation || null,
        education: d.education || null,
        disabilityStatus: d.disabilityStatus as DisabilityStatus,
        insuranceStatus: d.insuranceStatus,
        emergencyContact: d.emergencyContact,
        emergencyPhone: d.emergencyPhone,
        consentGiven: d.consentGiven,
        consentDate: d.consentDate ? new Date(d.consentDate) : null,
        campaignId: d.campaignId || null,
        locationId: d.locationId || null,
        referralSource: d.referralSource,
        notes: d.notes || null,
        lat: d.lat ?? null,
        lng: d.lng ?? null,
      },
    });
    return { ok: true, data: fromPrisma(row) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionDeletePatient(
  id: string
): Promise<ActionResult<null>> {
  const denied = await guard('patients', 'delete');
  if (denied) return denied;

  try {
    await prisma.patient.delete({ where: { id } });
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
