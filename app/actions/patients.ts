'use server';

import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { fromPrisma, getAllPatients as fetchAllPatients, getPatientById as fetchPatientById } from '@/lib/api/patients';
import { auditLog, ensureRegionAccess, requireActor, scopedRegionWhere } from '@/lib/auth-server';
import type { Patient } from '@/types';
import type { Sex, DisabilityStatus } from '@/lib/generated/prisma/client';

export async function getAllPatients(): Promise<Patient[]> {
  const actor = await requireActor('patients', 'view');
  if ('error' in actor) throw new Error(actor.error);
  return fetchAllPatients(scopedRegionWhere(actor));
}

export async function getPatientById(id: string): Promise<Patient | null> {
  const actor = await requireActor('patients', 'view');
  if ('error' in actor) throw new Error(actor.error);
  const patient = await fetchPatientById(id);
  if (!patient) return null;
  const denied = ensureRegionAccess(actor, patient.region);
  if (denied) throw new Error(denied.error);
  return patient;
}

const PatientSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  sex: z.enum(['Male', 'Female', 'Other']),
  phone: z.string().min(1, 'Phone is required'),
  email: z.string().optional(),
  district: z.string().optional(),
  region: z.string().optional(),
  operationDistrict: z.string().optional(),
  occupation: z.string().optional(),
  education: z.string().optional(),
  disabilityStatus: z.enum(['None', 'Visual', 'Hearing', 'Mobility', 'Cognitive', 'Multiple']),
  insuranceStatus: z.string(),
  emergencyContact: z.string(),
  emergencyPhone: z.string(),
  consentGiven: z.boolean(),
  consentDate: z.string().optional(),
  campaignId: z.string().min(1, 'Campaign is required'),
  referralSource: z.string(),
  notes: z.string().optional(),
});

type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function getCampaignScope(campaignId: string) {
  return prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { region: true, operationDistrict: true },
  });
}

async function createPatientWithCode(data: Omit<Parameters<typeof prisma.patient.create>[0]['data'], 'patientCode'>): Promise<Patient> {
  const MAX_RETRIES = 5;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const last = await prisma.patient.findFirst({
        select: { patientCode: true },
        orderBy: { patientCode: 'desc' },
      });
      const year = new Date().getFullYear();
      const lastNum = last ? parseInt(last.patientCode.split('-')[2] || '0', 10) : 0;
      const patientCode = `EC-${year}-${String(lastNum + 1).padStart(4, '0')}`;
      const row = await prisma.patient.create({ data: { ...(data as Parameters<typeof prisma.patient.create>[0]['data']), patientCode } });
      return fromPrisma(row);
    } catch (e: unknown) {
      const isUniqueViolation = e instanceof Error && 'code' in e && (e as { code: string }).code === 'P2002';
      if (isUniqueViolation && attempt < MAX_RETRIES - 1) continue;
      throw e;
    }
  }
  throw new Error('Could not generate a unique patient code. Please try again.');
}

export async function actionCreatePatient(input: unknown): Promise<ActionResult<Patient>> {
  const actor = await requireActor('patients', 'create');
  if ('error' in actor) return { ok: false, error: actor.error };

  const parsed = PatientSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  try {
    const campaign = await getCampaignScope(d.campaignId);
    if (!campaign) return { ok: false, error: 'Campaign not found' };
    const denied = ensureRegionAccess(actor, campaign.region);
    if (denied) return denied;

    const patient = await createPatientWithCode({
      fullName: d.fullName,
      dateOfBirth: new Date(d.dateOfBirth),
      sex: d.sex as Sex,
      phone: d.phone,
      email: d.email || null,
      district: d.district || campaign.operationDistrict,
      region: campaign.region,
      operationDistrict: campaign.operationDistrict,
      occupation: d.occupation || null,
      education: d.education || null,
      disabilityStatus: d.disabilityStatus as DisabilityStatus,
      insuranceStatus: d.insuranceStatus,
      emergencyContact: d.emergencyContact,
      emergencyPhone: d.emergencyPhone,
      consentGiven: d.consentGiven,
      consentDate: d.consentDate ? new Date(d.consentDate) : null,
      campaignId: d.campaignId,
      referralSource: d.referralSource,
      notes: d.notes || null,
      registeredById: actor.id,
      registeredByName: actor.name,
      screeningStatus: 'Awaiting Screening',
    });
    await auditLog({
      actor,
      action: 'create',
      entity: 'Patient',
      entityId: patient.id,
      region: patient.region,
      campaignId: patient.campaignId,
      details: `Registered patient ${patient.fullName}`,
      after: patient,
    });
    return { ok: true, data: patient };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionUpdatePatient(id: string, input: unknown): Promise<ActionResult<Patient>> {
  const actor = await requireActor('patients', 'edit');
  if ('error' in actor) return { ok: false, error: actor.error };

  const parsed = PatientSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  try {
    const before = await fetchPatientById(id);
    if (!before) return { ok: false, error: 'Patient not found' };
    const beforeDenied = ensureRegionAccess(actor, before.region);
    if (beforeDenied) return beforeDenied;

    const campaign = await getCampaignScope(d.campaignId);
    if (!campaign) return { ok: false, error: 'Campaign not found' };
    const denied = ensureRegionAccess(actor, campaign.region);
    if (denied) return denied;

    const row = await prisma.patient.update({
      where: { id },
      data: {
        fullName: d.fullName,
        dateOfBirth: new Date(d.dateOfBirth),
        sex: d.sex as Sex,
        phone: d.phone,
        email: d.email || null,
        district: d.district || campaign.operationDistrict,
        region: campaign.region,
        operationDistrict: campaign.operationDistrict,
        occupation: d.occupation || null,
        education: d.education || null,
        disabilityStatus: d.disabilityStatus as DisabilityStatus,
        insuranceStatus: d.insuranceStatus,
        emergencyContact: d.emergencyContact,
        emergencyPhone: d.emergencyPhone,
        consentGiven: d.consentGiven,
        consentDate: d.consentDate ? new Date(d.consentDate) : null,
        campaignId: d.campaignId,
        referralSource: d.referralSource,
        notes: d.notes || null,
      },
    });
    const patient = fromPrisma(row);
    await auditLog({
      actor,
      action: 'update',
      entity: 'Patient',
      entityId: patient.id,
      region: patient.region,
      campaignId: patient.campaignId,
      details: `Updated patient ${patient.fullName}`,
      before,
      after: patient,
    });
    return { ok: true, data: patient };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionDeletePatient(id: string): Promise<ActionResult<null>> {
  const actor = await requireActor('patients', 'delete');
  if ('error' in actor) return { ok: false, error: actor.error };

  try {
    const before = await fetchPatientById(id);
    if (before) {
      const denied = ensureRegionAccess(actor, before.region);
      if (denied) return denied;
    }
    await prisma.patient.delete({ where: { id } });
    await auditLog({
      actor,
      action: 'delete',
      entity: 'Patient',
      entityId: id,
      region: before?.region,
      campaignId: before?.campaignId,
      details: before ? `Deleted patient ${before.fullName}` : 'Deleted patient',
      before,
    });
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
