'use client';

import { useEffect, useState } from 'react';
import type { Campaign, DisabilityStatus, Patient, Sex } from '@/types';
import { getPatientsPaginated, actionCreatePatient, actionDeletePatient, actionUpdatePatient } from '@/app/actions/patients';
import { getAllCampaigns } from '@/app/actions/campaigns';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ModalForm from '@/components/forms/ModalForm';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import DateOfBirthPicker from '@/components/forms/DateOfBirthPicker';
import Pagination from '@/components/ui/Pagination';
import { REGIONAL_CAMPAIGN_AREAS } from '@/lib/regions';
import { formatDate } from '@/lib/utils';
import { usePermissions } from '@/lib/auth';
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;
const SEXES: Sex[] = ['Female', 'Male', 'Other'];
const DISABILITIES: DisabilityStatus[] = ['None', 'Visual', 'Hearing', 'Mobility', 'Cognitive', 'Multiple'];
const REFERRAL_SOURCES = ['Campaign walk-in', 'Community health worker', 'Self-referral', 'Doctor referral', 'NGO partner', 'Radio / TV campaign', 'Mosque / community leader'];
const SCREENING_STATUSES = ['Awaiting Screening', 'Screened'] as const;

const F = {
  label: 'block text-[11px] font-semibold uppercase tracking-wide text-[#7A9A87] mb-1.5',
  input: 'w-full rounded-md border border-[#E2DDD5] bg-white px-3 py-2 text-sm text-[#1C2B22] placeholder:text-[#7A9A87] outline-none transition focus:border-[#1A7A46] focus:ring-2 focus:ring-[#1A7A46]/10 disabled:bg-[#F0EDE6] disabled:text-[#7A9A87]',
  sel:   'rounded-md',
};

const STATUS_STYLE: Record<string, string> = {
  'Awaiting Screening': 'bg-[#FEF3DC] text-[#C47D11]',
  'Screened':           'bg-[#E8F5EE] text-[#1A7A46]',
};

// ─── Form shape ───────────────────────────────────────────────────────────────

const BLANK = {
  fullName:         '',
  dateOfBirth:      '',
  sex:              'Female' as Sex,
  phone:            '',
  district:         '',
  region:           '',
  operationDistrict:'',
  occupation:       '',
  education:        '',
  disabilityStatus: 'None' as DisabilityStatus,
  insuranceStatus:  'None',
  emergencyContact: '',
  emergencyPhone:   '',
  consentGiven:     true,
  consentDate:      new Date().toISOString().split('T')[0],
  campaignId:       '',
  referralSource:   'Campaign walk-in',
  notes:            '',
  registeredById:   '',
  registeredByName: '',
  screeningStatus:  'Awaiting Screening' as 'Awaiting Screening' | 'Screened',
};

type PatientForm = typeof BLANK;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PatientsPage() {
  const { can, role } = usePermissions();
  const isSuperAdmin   = role === 'Super Administrator';

  const [patients,     setPatients]     = useState<Patient[]>([]);
  const [total,        setTotal]        = useState(0);
  const [page,         setPage]         = useState(1);
  const [campaigns,    setCampaigns]    = useState<Campaign[]>([]);
  const [form,         setForm]         = useState<PatientForm>(BLANK);
  const [editing,      setEditing]      = useState<Patient | null>(null);
  const [showForm,     setShowForm]     = useState(false);
  const [saveError,    setSaveError]    = useState('');
  const [isLoading,    setIsLoading]    = useState(true);
  const [search,       setSearch]       = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Patient | null>(null);

  // Debounce search → reset to page 1 when it fires
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch page from server
  useEffect(() => {
    let cancelled = false;
    getPatientsPaginated({ search: debouncedSearch, region: regionFilter, status: statusFilter, page, pageSize: PAGE_SIZE })
      .then(({ data, total: t }) => {
        if (!cancelled) { setPatients(data); setTotal(t); setIsLoading(false); }
      })
      .catch(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [debouncedSearch, regionFilter, statusFilter, page]);

  // Load campaigns once for the form dropdown
  useEffect(() => { getAllCampaigns().then(setCampaigns); }, []);

  // ── Form helpers ───────────────────────────────────────────────────────────

  function set<K extends keyof PatientForm>(key: K, value: PatientForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function chooseCampaign(campaignId: string) {
    const campaign = campaigns.find((c) => c.id === campaignId);
    if (campaign) setForm((prev) => applyCampaignContext(prev, campaign));
  }

  const selectedCampaign = campaigns.find((c) => c.id === form.campaignId);
  const campaignLocked   = !isSuperAdmin && !!selectedCampaign;

  function openAdd() {
    setEditing(null);
    let base = BLANK;
    if (!isSuperAdmin) {
      const active = campaigns.find((c) => c.status === 'Active') ?? campaigns[0];
      if (active) base = applyCampaignContext(BLANK, active);
    }
    setForm(base);
    setSaveError('');
    setShowForm(true);
  }

  function openEdit(patient: Patient) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, patientCode: _code, createdAt: _ca, email: _email, ...editable } = patient as Patient & { email?: string };
    setEditing(patient);
    setForm({ ...BLANK, ...editable });
    setSaveError('');
    setShowForm(true);
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function save() {
    setSaveError('');
    const result = editing
      ? await actionUpdatePatient(editing.id, form)
      : await actionCreatePatient(form);
    if (!result.ok) { setSaveError(result.error); return; }
    if (editing) {
      setPatients((rows) => rows.map((r) => r.id === editing.id ? result.data : r));
    } else {
      setPage(1);
    }
    setShowForm(false);
    setEditing(null);
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function confirmDelete() {
    if (!deleteTarget) return;
    const result = await actionDeletePatient(deleteTarget.id);
    if (result.ok) {
      const remaining = patients.filter((r) => r.id !== deleteTarget.id);
      setTotal((t) => t - 1);
      if (remaining.length === 0 && page > 1) {
        setPage((p) => p - 1);
      } else {
        setPatients(remaining);
      }
    }
    setDeleteTarget(null);
  }

  const hasFilters = !!search || !!regionFilter || !!statusFilter;
  const formInvalid = !form.fullName || !form.dateOfBirth || !form.phone || !form.campaignId;

  return (
    <div className="space-y-5">
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Patient Record"
        description={deleteTarget
          ? `This will permanently delete ${deleteTarget.fullName} (${deleteTarget.patientCode}) along with all their screenings, surgeries, and follow-ups. This cannot be undone.`
          : ''}
        confirmLabel="Delete Patient"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Page header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#1C2B22]">Patients</h1>
          <p className="text-sm text-[#4A6455]">Register and manage patients in regional screening campaigns</p>
        </div>
        {can('patients', 'create') && !showForm && (
          <Button onClick={openAdd} className="gap-2 rounded-md bg-[#1A7A46] text-white hover:bg-[#0F4D2A]">
            <Plus size={15} /> Register Patient
          </Button>
        )}
        {showForm && (
          <Button variant="outline" onClick={() => setShowForm(false)} className="gap-2 rounded-md">
            <X size={14} /> Cancel
          </Button>
        )}
      </div>

      {/* Registration form */}
      {showForm && (
        <ModalForm
          title={editing ? `Edit — ${editing.fullName}` : 'Register New Patient'}
          subtitle={editing ? undefined : 'Fill in patient details — campaign and location are auto-filled from your assigned region'}
          onClose={() => setShowForm(false)}
          onSave={save}
          saveLabel={editing ? 'Save Changes' : 'Register Patient'}
          saveDisabled={formInvalid}
        >
          {saveError && (
            <div className="mb-4 rounded-md border border-[#F0C0C0] bg-[#FCE8E8] px-3 py-2 text-sm text-[#B52A2A]">
              {saveError}
            </div>
          )}
          <PatientRegistrationForm
            form={form}
            campaigns={campaigns}
            selectedCampaign={selectedCampaign}
            campaignLocked={campaignLocked}
            set={set}
            chooseCampaign={chooseCampaign}
          />
        </ModalForm>
      )}

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A9A87]" size={14} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, code, or phone..."
            className={`${F.input} pl-9`}
          />
        </div>

        {isSuperAdmin && (
          <Select value={regionFilter} onValueChange={(v) => { setRegionFilter(v ?? ''); setPage(1); }}>
            <SelectTrigger className="w-56 rounded-md">
              <SelectValue placeholder="All Regions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Regions</SelectItem>
              {REGIONAL_CAMPAIGN_AREAS.map((a) => (
                <SelectItem key={a.region} value={a.region}>{a.region}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v ?? ''); setPage(1); }}>
          <SelectTrigger className="w-48 rounded-md">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Statuses</SelectItem>
            {SCREENING_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        {hasFilters && (
          <button
            onClick={() => { setSearch(''); setRegionFilter(''); setStatusFilter(''); setPage(1); }}
            className="flex items-center gap-1.5 rounded-md border border-[#E2DDD5] px-3 py-2 text-xs font-medium text-[#4A6455] transition hover:bg-[#FAFAF8]"
          >
            <X size={12} /> Clear
          </button>
        )}

        <span className="ml-auto text-sm text-[#7A9A87]">
          {total} {total === 1 ? 'patient' : 'patients'}
        </span>
      </div>

      {/* Patients table */}
      <Card className="overflow-hidden border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-[#F0EDE6] bg-[#FAFAF8]">
                <tr>
                  {['Code', 'Patient', 'Phone', 'Region / City', 'Status', 'Registered By', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#7A9A87]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-sm text-[#7A9A87]">Loading patients...</td>
                  </tr>
                )}
                {!isLoading && patients.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-sm text-[#7A9A87]">
                      {hasFilters ? 'No patients match the current filters.' : 'No patients registered yet.'}
                    </td>
                  </tr>
                )}
                {!isLoading && patients.map((patient) => (
                  <tr key={patient.id} className="border-b border-[#F0EDE6] transition-colors hover:bg-[#FAFAF8]">
                    <td className="px-4 py-3.5 font-mono text-xs text-[#4A6455]">{patient.patientCode}</td>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-[#1C2B22]">{patient.fullName}</p>
                      <p className="text-xs text-[#7A9A87]">{formatDate(patient.dateOfBirth)} · {patient.sex}</p>
                    </td>
                    <td className="px-4 py-3.5 text-[#4A6455]">{patient.phone}</td>
                    <td className="px-4 py-3.5">
                      <p className="text-[#1C2B22]">{patient.region}</p>
                      <p className="text-xs text-[#7A9A87]">{patient.operationDistrict}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`rounded px-2 py-1 text-xs font-medium ${STATUS_STYLE[patient.screeningStatus] ?? 'bg-[#FAFAF8] text-[#4A6455]'}`}>
                        {patient.screeningStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-[#4A6455]">{patient.registeredByName || '—'}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex gap-1">
                        {can('patients', 'edit') && (
                          <button
                            onClick={() => openEdit(patient)}
                            className="rounded-md p-1.5 text-[#7A9A87] transition hover:bg-[#E8F5EE] hover:text-[#1A7A46]"
                          >
                            <Pencil size={13} />
                          </button>
                        )}
                        {can('patients', 'delete') && (
                          <button
                            onClick={() => setDeleteTarget(patient)}
                            className="rounded-md p-1.5 text-[#7A9A87] transition hover:bg-[#FCE8E8] hover:text-[#B52A2A]"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Patient registration form ────────────────────────────────────────────────

function PatientRegistrationForm({
  form, campaigns, selectedCampaign, campaignLocked, set, chooseCampaign,
}: {
  form: PatientForm;
  campaigns: Campaign[];
  selectedCampaign: Campaign | undefined;
  campaignLocked: boolean;
  set: <K extends keyof PatientForm>(key: K, value: PatientForm[K]) => void;
  chooseCampaign: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      <section>
        <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-[#7A9A87]">Campaign & Location</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <label className={F.label}>Campaign *</label>
            {campaignLocked && selectedCampaign ? (
              <div className="rounded-md border border-[#E2DDD5] bg-[#FAFAF8] px-3 py-2 text-sm text-[#4A6455]">
                {selectedCampaign.name}
                <span className="ml-2 text-[#7A9A87]">— {selectedCampaign.region}</span>
              </div>
            ) : (
              <Select value={form.campaignId} onValueChange={(v) => { if (v) chooseCampaign(v); }}>
                <SelectTrigger className={F.sel}>
                  <SelectValue placeholder="Select campaign" />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} — {c.region}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div>
            <label className={F.label}>State / Region</label>
            <input value={form.region} disabled className={F.input} placeholder="Auto-filled from campaign" />
          </div>
          <div className="sm:col-span-2">
            <label className={F.label}>Operation City / District</label>
            <input value={form.operationDistrict} disabled className={F.input} placeholder="Auto-filled from campaign" />
          </div>
        </div>
      </section>

      <section>
        <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-[#7A9A87]">Patient Identity</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className={F.label}>Full Name *</label>
            <input
              value={form.fullName}
              onChange={(e) => set('fullName', e.target.value)}
              placeholder="e.g. Ahmed Hassan Mohamed"
              className={F.input}
            />
          </div>
          <div>
            <label className={F.label}>Sex *</label>
            <Select value={form.sex} onValueChange={(v) => { if (v) set('sex', v as Sex); }}>
              <SelectTrigger className={F.sel}><SelectValue /></SelectTrigger>
              <SelectContent>{SEXES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className={F.label}>Disability Status</label>
            <Select value={form.disabilityStatus} onValueChange={(v) => { if (v) set('disabilityStatus', v as DisabilityStatus); }}>
              <SelectTrigger className={F.sel}><SelectValue /></SelectTrigger>
              <SelectContent>{DISABILITIES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-4">
            <label className={F.label}>Date of Birth * — Day / Month / Year</label>
            <DateOfBirthPicker value={form.dateOfBirth} onChange={(v) => set('dateOfBirth', v)} />
          </div>
        </div>
      </section>

      <section>
        <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-[#7A9A87]">Contact Details</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className={F.label}>Phone Number *</label>
            <input
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="e.g. +252 61 234 5678"
              className={F.input}
            />
          </div>
          <div>
            <label className={F.label}>Emergency Contact Name</label>
            <input
              value={form.emergencyContact}
              onChange={(e) => set('emergencyContact', e.target.value)}
              placeholder="e.g. Mohamed Ali (Father)"
              className={F.input}
            />
          </div>
          <div>
            <label className={F.label}>Emergency Phone</label>
            <input
              value={form.emergencyPhone}
              onChange={(e) => set('emergencyPhone', e.target.value)}
              placeholder="e.g. +252 61 234 5678"
              className={F.input}
            />
          </div>
        </div>
      </section>

      <section>
        <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-[#7A9A87]">Background</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className={F.label}>Occupation</label>
            <input
              value={form.occupation ?? ''}
              onChange={(e) => set('occupation', e.target.value)}
              placeholder="e.g. Farmer, Teacher"
              className={F.input}
            />
          </div>
          <div>
            <label className={F.label}>Referral Source</label>
            <Select value={form.referralSource} onValueChange={(v) => { if (v) set('referralSource', v); }}>
              <SelectTrigger className={F.sel}><SelectValue /></SelectTrigger>
              <SelectContent>{REFERRAL_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className={F.label}>Consent Given</label>
            <div className="flex h-9.5 items-center gap-3 rounded-md border border-[#E2DDD5] bg-white px-3">
              <input
                type="checkbox"
                checked={form.consentGiven}
                onChange={(e) => set('consentGiven', e.target.checked)}
                className="h-4 w-4 rounded border-[#D0E8DA] accent-[#1A7A46]"
              />
              <span className="text-sm text-[#4A6455]">Patient has consented to treatment</span>
            </div>
          </div>
        </div>
      </section>

      <section>
        <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-[#7A9A87]">Notes</p>
        <textarea
          value={form.notes ?? ''}
          onChange={(e) => set('notes', e.target.value)}
          rows={2}
          placeholder="Any additional clinical notes or observations about this patient..."
          className={`${F.input} resize-none`}
        />
      </section>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function applyCampaignContext(form: PatientForm, campaign: Campaign): PatientForm {
  return {
    ...form,
    campaignId:        campaign.id,
    region:            campaign.region,
    operationDistrict: campaign.operationDistrict,
    district:          campaign.operationDistrict,
  };
}
