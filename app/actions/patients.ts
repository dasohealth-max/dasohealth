'use server';

import { z } from 'zod';
import { updateTag } from 'next/cache';
import { after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fromPrisma, getAllPatients as fetchAllPatients, getPatientById as fetchPatientById } from '@/lib/api/patients';
import { getAllCampaigns as fetchAllCampaigns } from '@/lib/api/campaigns';
import { auditLog, ensureRegionAccess, isSuperAdmin, requireActor, scopedRegionWhere } from '@/lib/auth-server';
import type { Campaign, Patient } from '@/types';
import type { Sex, DisabilityStatus, Prisma } from '@/lib/generated/prisma/client';

export async function getAllPatients(): Promise<Patient[]> {
  const actor = await requireActor('patients', 'view');
  if ('error' in actor) throw new Error(actor.error);
  return fetchAllPatients(scopedRegionWhere(actor));
}

export async function getPatientRegistrationCampaigns(): Promise<Campaign[]> {
  const actor = await requireActor('patients', 'view');
  if ('error' in actor) throw new Error(actor.error);

  const where: Prisma.CampaignWhereInput = isSuperAdmin(actor)
    ? {}
    : { regions: { some: { region: actor.assignedRegion ?? '__no_region__' } } };

  const campaigns = await fetchAllCampaigns(where);
  if (isSuperAdmin(actor)) {
    return campaigns.filter((campaign) => (campaign.regions ?? []).length > 0);
  }

  const assignedRegion = actor.assignedRegion ?? '__no_region__';
  return campaigns
    .map((campaign) => ({
      ...campaign,
      regions: (campaign.regions ?? []).filter((plan) => plan.region === assignedRegion),
    }))
    .filter((campaign) => (campaign.regions ?? []).length > 0);
}

export async function getPatientsPaginated(params: {
  search?: string;
  region?: string;
  status?: string;
  page: number;
  pageSize: number;
}): Promise<{ data: Patient[]; total: number }> {
  const actor = await requireActor('patients', 'view');
  if ('error' in actor) throw new Error(actor.error);

  const where: Prisma.PatientWhereInput = {
    ...scopedRegionWhere(actor),
    ...(params.region && { region: params.region }),
    ...(params.status && { screeningStatus: params.status }),
    ...(params.search && {
      OR: [
        { fullName: { contains: params.search, mode: 'insensitive' } },
        { patientCode: { contains: params.search, mode: 'insensitive' } },
        { phone: { contains: params.search } },
      ],
    }),
  };

  const pageSize = Math.min(Math.max(1, params.pageSize), 200);
  const page = Math.max(1, params.page);
  const skip = (page - 1) * pageSize;
  const [rows, total] = await Promise.all([
    prisma.patient.findMany({ where, skip, take: pageSize, orderBy: { createdAt: 'desc' } }),
    prisma.patient.count({ where }),
  ]);

  return { data: rows.map(fromPrisma), total };
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
  campaignRegionId: z.string().min(1, 'Sub-region is required'),
  referralSource: z.string(),
  notes: z.string().optional(),
});

type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function normalizePhone(value: string): string {
  return value.trim().replace(/[^\d+]/g, '');
}

function isValidPhone(value: string): boolean {
  const normalized = normalizePhone(value);
  return /^\+?\d{7,15}$/.test(normalized);
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

async function getCampaignScope(campaignId: string, campaignRegionId: string) {
  return prisma.campaignRegion.findFirst({
    where: { id: campaignRegionId, campaignId },
    select: { id: true, region: true, operationDistrict: true },
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
  const fullName = normalizeName(d.fullName);
  const phone = normalizePhone(d.phone);
  if (!isValidPhone(phone)) return { ok: false, error: 'Phone must be 7-15 digits and may start with +' };

  try {
    const campaign = await getCampaignScope(d.campaignId, d.campaignRegionId);
    if (!campaign) return { ok: false, error: 'Sub-region not found for selected campaign' };
    const denied = ensureRegionAccess(actor, campaign.region);
    if (denied) return denied;

    const duplicate = await prisma.patient.findFirst({
      where: {
        campaignId: d.campaignId,
        campaignRegionId: d.campaignRegionId,
        phone,
        fullName: { equals: fullName, mode: 'insensitive' },
      },
      select: { patientCode: true, fullName: true },
    });
    if (duplicate) {
      return { ok: false, error: `Possible duplicate patient: ${duplicate.fullName} (${duplicate.patientCode}) is already registered in this campaign` };
    }

    const patient = await createPatientWithCode({
      fullName,
      dateOfBirth: new Date(d.dateOfBirth),
      sex: d.sex as Sex,
      phone,
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
      campaignRegionId: d.campaignRegionId,
      referralSource: d.referralSource,
      notes: d.notes || null,
      registeredById: actor.id,
      registeredByName: actor.name,
      screeningStatus: 'Awaiting Screening',
    });
    updateTag('patients');
    after(() => auditLog({
      actor,
      action: 'create',
      entity: 'Patient',
      entityId: patient.id,
      region: patient.region,
      campaignId: patient.campaignId,
      details: `Registered patient ${patient.fullName}`,
      after: patient,
    }));
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
  const fullName = normalizeName(d.fullName);
  const phone = normalizePhone(d.phone);
  if (!isValidPhone(phone)) return { ok: false, error: 'Phone must be 7-15 digits and may start with +' };

  try {
    const before = await fetchPatientById(id);
    if (!before) return { ok: false, error: 'Patient not found' };
    const beforeDenied = ensureRegionAccess(actor, before.region);
    if (beforeDenied) return beforeDenied;

    const campaign = await getCampaignScope(d.campaignId, d.campaignRegionId);
    if (!campaign) return { ok: false, error: 'Sub-region not found for selected campaign' };
    const denied = ensureRegionAccess(actor, campaign.region);
    if (denied) return denied;

    const duplicate = await prisma.patient.findFirst({
      where: {
        id: { not: id },
        campaignId: d.campaignId,
        campaignRegionId: d.campaignRegionId,
        phone,
        fullName: { equals: fullName, mode: 'insensitive' },
      },
      select: { patientCode: true, fullName: true },
    });
    if (duplicate) {
      return { ok: false, error: `Possible duplicate patient: ${duplicate.fullName} (${duplicate.patientCode}) is already registered in this campaign` };
    }

    const row = await prisma.patient.update({
      where: { id },
      data: {
        fullName,
        dateOfBirth: new Date(d.dateOfBirth),
        sex: d.sex as Sex,
        phone,
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
        campaignRegionId: d.campaignRegionId,
        referralSource: d.referralSource,
        notes: d.notes || null,
      },
    });
    const patient = fromPrisma(row);
    updateTag('patients');
    after(() => auditLog({
      actor,
      action: 'update',
      entity: 'Patient',
      entityId: patient.id,
      region: patient.region,
      campaignId: patient.campaignId,
      details: `Updated patient ${patient.fullName}`,
      before,
      after: patient,
    }));
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
    updateTag('patients');
    after(() => auditLog({
      actor,
      action: 'delete',
      entity: 'Patient',
      entityId: id,
      region: before?.region,
      campaignId: before?.campaignId,
      details: before ? `Deleted patient ${before.fullName}` : 'Deleted patient',
      before,
    }));
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
