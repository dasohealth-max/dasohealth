'use server';

import { z } from 'zod';
import { updateTag } from 'next/cache';
import { after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fromPrisma, getAllPatients as fetchAllPatients, getPatientById as fetchPatientById } from '@/lib/api/patients';
import { getAllCampaigns as fetchAllCampaigns } from '@/lib/api/campaigns';
import { auditLog, ensureRegionAccess, isSuperAdmin, requireActor, scopedRegionWhere } from '@/lib/auth-server';
import type { Campaign, Patient } from '@/types';
import { Prisma, type Sex, type DisabilityStatus, type BirthDateSource } from '@/lib/generated/prisma/client';
import { formatPatientCode, patientCodePrefix } from '@/lib/patient-code';

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
  dateOfBirth: z.string().optional().default(''),
  birthDateSource: z.enum(['Exact', 'AgeEstimate']).optional().default('Exact'),
  ageYearsAtRegistration: z.preprocess((value) => {
    if (value === '' || value === null || value === undefined) return undefined;
    return typeof value === 'number' ? value : Number(value);
  }, z.number().int('Age must be a whole number').min(0, 'Age must be between 0 and 120').max(120, 'Age must be between 0 and 120').optional()),
  sex: z.enum(['Male', 'Female']),
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

function normalizeSomaliaPhone(value: string): string {
  return normalizePhone(value).replace(/^\+/, '');
}

function normalizeOptionalSomaliaPhone(value: string): string {
  const normalized = normalizeSomaliaPhone(value);
  return normalized === '252' ? '' : normalized;
}

function isValidSomaliaPhone(value: string): boolean {
  const normalized = normalizeSomaliaPhone(value);
  return /^252\d{6,12}$/.test(normalized);
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

function todayIsoDate(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${padDatePart(now.getUTCMonth() + 1)}-${padDatePart(now.getUTCDate())}`;
}

function dateFromIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function approximateBirthDateFromAge(ageYears: number): Date {
  const today = todayIsoDate();
  const [year, month, day] = today.split('-').map(Number);
  const estimatedYear = year - ageYears;
  const maxDay = new Date(Date.UTC(estimatedYear, month, 0)).getUTCDate();
  return new Date(Date.UTC(estimatedYear, month - 1, Math.min(day, maxDay)));
}

function resolveBirthDate(data: {
  dateOfBirth: string;
  birthDateSource: 'Exact' | 'AgeEstimate';
  ageYearsAtRegistration?: number;
}): { dateOfBirth: Date; birthDateSource: BirthDateSource; ageYearsAtRegistration: number | null } | { error: string } {
  if (data.birthDateSource === 'AgeEstimate') {
    if (data.ageYearsAtRegistration === undefined) return { error: 'Age is required' };
    return {
      dateOfBirth: approximateBirthDateFromAge(data.ageYearsAtRegistration),
      birthDateSource: 'AgeEstimate' as BirthDateSource,
      ageYearsAtRegistration: data.ageYearsAtRegistration,
    };
  }

  if (!data.dateOfBirth) return { error: 'Date of birth is required' };
  const dateOfBirth = dateFromIsoDate(data.dateOfBirth);
  if (!dateOfBirth) return { error: 'Date of birth must be a valid date' };
  if (data.dateOfBirth > todayIsoDate()) return { error: 'Date of birth cannot be in the future' };

  return {
    dateOfBirth,
    birthDateSource: 'Exact' as BirthDateSource,
    ageYearsAtRegistration: null,
  };
}

async function getCampaignScope(campaignId: string, campaignRegionId: string) {
  return prisma.campaignRegion.findFirst({
    where: { id: campaignRegionId, campaignId },
    select: { id: true, region: true, operationDistrict: true },
  });
}

async function createPatientWithCode(data: Omit<Parameters<typeof prisma.patient.create>[0]['data'], 'patientCode'>): Promise<Patient> {
  const prefix = patientCodePrefix((data as { region?: string }).region ?? '');
  const startPos = Prisma.raw(String(prefix.length + 1));
  const MAX_RETRIES = 5;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await prisma.$queryRaw<[{ max: bigint | number }]>`
        SELECT COALESCE(MAX(CAST(SUBSTRING(patient_code, ${startPos}) AS INTEGER)), 0) AS max
        FROM patients
        WHERE patient_code ~ ${`^${prefix}[0-9]+$`}
      `;
      const lastNum = Number(result[0]?.max ?? 0);
      const patientCode = formatPatientCode(prefix, lastNum + 1);
      const row = await prisma.patient.create({ data: { ...(data as Parameters<typeof prisma.patient.create>[0]['data']), patientCode } });
      return fromPrisma(row);
    } catch (e: unknown) {
      const isUniqueViolation = e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
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
  const phone = normalizeSomaliaPhone(d.phone);
  const emergencyPhone = normalizeOptionalSomaliaPhone(d.emergencyPhone);
  if (!isValidSomaliaPhone(phone)) return { ok: false, error: 'Phone must start with 252 and contain 9-15 digits total' };
  if (emergencyPhone && !isValidSomaliaPhone(emergencyPhone)) return { ok: false, error: 'Emergency phone must start with 252 and contain 9-15 digits total' };
  const birthDate = resolveBirthDate(d);
  if ('error' in birthDate) return { ok: false, error: birthDate.error };

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
      dateOfBirth: birthDate.dateOfBirth,
      birthDateSource: birthDate.birthDateSource,
      ageYearsAtRegistration: birthDate.ageYearsAtRegistration,
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
      emergencyPhone,
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
  const phone = normalizeSomaliaPhone(d.phone);
  const emergencyPhone = normalizeOptionalSomaliaPhone(d.emergencyPhone);
  if (!isValidSomaliaPhone(phone)) return { ok: false, error: 'Phone must start with 252 and contain 9-15 digits total' };
  if (emergencyPhone && !isValidSomaliaPhone(emergencyPhone)) return { ok: false, error: 'Emergency phone must start with 252 and contain 9-15 digits total' };
  const birthDate = resolveBirthDate(d);
  if ('error' in birthDate) return { ok: false, error: birthDate.error };

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
        dateOfBirth: birthDate.dateOfBirth,
        birthDateSource: birthDate.birthDateSource,
        ageYearsAtRegistration: birthDate.ageYearsAtRegistration,
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
        emergencyPhone,
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
