'use client';

import { useEffect, useState } from 'react';
import type { Campaign, DisabilityStatus, Patient, Sex } from '@/types';
import {
  getPatientsPaginated,
  actionCreatePatient,
  actionDeletePatient,
  actionUpdatePatient,
  getPatientRegistrationCampaigns,
} from '@/app/actions/patients';
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
import { patientDisplayName } from '@/lib/patient-code';
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;
const SEXES: Sex[] = ['Female', 'Male', 'Other'];
const DISABILITIES: DisabilityStatus[] = ['None', 'Visual', 'Hearing', 'Mobility', 'Cognitive', 'Multiple'];
const REFERRAL_SOURCES = ['Campaign walk-in', 'Community health worker', 'Self-referral', 'Doctor referral', 'NGO partner', 'Radio / TV campaign', 'Mosque / community leader'];
const SCREENING_STATUSES = ['Awaiting Screening', 'Screened'] as const;

const F = {
  label: 'block text-[11px] font-semibold uppercase tracking-wide text-[#647184] mb-1.5',
  input: 'w-full rounded-md border border-[#DDE3EA] bg-white px-3 py-2 text-sm text-[#141920] placeholder:text-[#647184] outline-none transition focus:border-[#2C9942] focus:ring-2 focus:ring-[#2C9942]/10 disabled:bg-[#EAEEF3] disabled:text-[#647184]',
  sel:   'w-full rounded-md',
};

const STATUS_STYLE: Record<string, string> = {
  'Awaiting Screening': 'bg-[#FFF5E6] text-[#F59E0B]',
  'Screened':           'bg-[#EBF7EE] text-[#2C9942]',
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
  campaignRegionId: '',
  referralSource:   'Campaign walk-in',
  notes:            '',
  registeredById:   '',
  registeredByName: '',
  screeningStatus:  'Awaiting Screening' as 'Awaiting Screening' | 'Screened',
};

type PatientForm = typeof BLANK;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PatientsPage() {
  const { can, role, user } = usePermissions();
  const isSuperAdmin   = role === 'Super Administrator';
  const canManagePatients = can('patients', 'create') || can('patients', 'edit');

  const [patients,     setPatients]     = useState<Patient[]>([]);
  const [total,        setTotal]        = useState(0);
  const [page,         setPage]         = useState(1);
  const [campaigns,    setCampaigns]    = useState<Campaign[]>([]);
  const [form,         setForm]         = useState<PatientForm>(BLANK);
  const [editing,      setEditing]      = useState<Patient | null>(null);
  const [showForm,     setShowForm]     = useState(false);
  const [saveError,    setSaveError]    = useState('');
  const [isLoading,    setIsLoading]    = useState(true);
  const [search,       setSearch]       = useState(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('highlight') ?? '';
  });
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Patient | null>(null);
  const [highlightCode, setHighlightCode] = useState(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('highlight') ?? '';
  });

  // On mount: clear the one-time highlight state and clean up the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('highlight');
    if (!code) return;
    const timer = setTimeout(() => {
      setHighlightCode('');
      window.history.replaceState({}, '', '/patients');
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

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

  // Load region-scoped campaigns only for roles that can use the registration form.
  useEffect(() => {
    if (!canManagePatients) return;
    let cancelled = false;
    getPatientRegistrationCampaigns()
      .then((rows) => { if (!cancelled) setCampaigns(rows); })
      .catch(() => { if (!cancelled) setCampaigns([]); });
    return () => { cancelled = true; };
  }, [canManagePatients]);

  // ── Form helpers ───────────────────────────────────────────────────────────

  function set<K extends keyof PatientForm>(key: K, value: PatientForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function eligiblePlans(campaign: Campaign) {
    const plans = campaign.regions ?? [];
    return isSuperAdmin ? plans : plans.filter((plan) => plan.region === user?.assignedRegion);
  }

  function chooseCampaign(campaignId: string) {
    const campaign = campaigns.find((c) => c.id === campaignId);
    if (campaign) {
      const firstPlan = eligiblePlans(campaign)[0];
      setForm((prev) => firstPlan ? applyRegionalPlanContext(prev, campaign, firstPlan) : {
        ...prev,
        campaignId: campaign.id,
        campaignRegionId: '',
        region: '',
        operationDistrict: '',
        district: '',
      });
    }
  }

  function chooseRegionalPlan(campaignRegionId: string) {
    const campaign = campaigns.find((c) => c.id === form.campaignId);
    const plan = campaign ? eligiblePlans(campaign).find((r) => r.id === campaignRegionId) : undefined;
    if (campaign && plan) setForm((prev) => applyRegionalPlanContext(prev, campaign, plan));
  }

  const selectedCampaign = campaigns.find((c) => c.id === form.campaignId);
  const campaignLocked   = !isSuperAdmin && !!selectedCampaign;

  function openAdd() {
    setEditing(null);
    let base = BLANK;
    if (!isSuperAdmin) {
      const active = campaigns.find((c) => c.status === 'Active' && eligiblePlans(c).length > 0)
        ?? campaigns.find((c) => eligiblePlans(c).length > 0);
      const firstPlan = active ? eligiblePlans(active)[0] : undefined;
      if (active && firstPlan) base = applyRegionalPlanContext(BLANK, active, firstPlan);
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
  const formInvalid = !form.fullName || !form.dateOfBirth || !form.phone || !form.campaignId || !form.campaignRegionId;
  const registrationCampaigns = campaigns.filter((campaign) => eligiblePlans(campaign).length > 0);

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
          <h1 className="text-xl font-bold text-[#141920]">Patients</h1>
          <p className="text-sm text-[#4B5666]">Register and manage patients in regional screening campaigns</p>
        </div>
        {can('patients', 'create') && !showForm && (
          <Button onClick={openAdd} className="gap-2 rounded-md bg-[#2C9942] text-white hover:bg-[#002E63]">
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
          title={editing ? `Edit - ${patientDisplayName(editing.fullName, editing.patientCode)}` : 'Register New Patient'}
          subtitle={editing ? undefined : 'Fill in patient details — campaign and location are auto-filled from your assigned region'}
          onClose={() => setShowForm(false)}
          onSave={save}
          saveLabel={editing ? 'Save Changes' : 'Register Patient'}
          saveDisabled={formInvalid}
          wide
        >
          {saveError && (
            <div className="mb-4 rounded-md border border-[#FACDCB] bg-[#FDECEB] px-3 py-2 text-sm text-[#E53935]">
              {saveError}
            </div>
          )}
          <PatientRegistrationForm
            form={form}
            campaigns={registrationCampaigns}
            selectedCampaign={selectedCampaign}
            assignedRegion={user?.assignedRegion}
            isSuperAdmin={isSuperAdmin}
            campaignLocked={campaignLocked}
            set={set}
            chooseCampaign={chooseCampaign}
            chooseRegionalPlan={chooseRegionalPlan}
          />
        </ModalForm>
      )}

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#647184]" size={14} />
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
            className="flex items-center gap-1.5 rounded-md border border-[#DDE3EA] px-3 py-2 text-xs font-medium text-[#4B5666] transition hover:bg-[#F5F7FA]"
          >
            <X size={12} /> Clear
          </button>
        )}

        <span className="ml-auto text-sm text-[#647184]">
          {total} {total === 1 ? 'patient' : 'patients'}
        </span>
      </div>

      {/* Patients table */}
      <Card className="overflow-hidden border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-[#EAEEF3] bg-[#F5F7FA]">
                <tr>
                  {['#', 'Code', 'Patient', 'Phone', 'Region / City', 'Status', 'Registered By', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#647184]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-sm text-[#647184]">Loading patients...</td>
                  </tr>
                )}
                {!isLoading && patients.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-sm text-[#647184]">
                      {hasFilters ? 'No patients match the current filters.' : 'No patients registered yet.'}
                    </td>
                  </tr>
                )}
                {!isLoading && patients.map((patient, index) => (
                  <tr key={patient.id} className={`border-b border-[#EAEEF3] transition-colors hover:bg-[#F5F7FA] ${patient.patientCode === highlightCode ? 'animate-row-highlight' : ''}`}>
                    <td className="px-4 py-3.5 text-xs text-[#647184]">{(page - 1) * PAGE_SIZE + index + 1}</td>
                    <td className="px-4 py-3.5 font-mono text-xs text-[#4B5666]">{patient.patientCode}</td>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-[#141920]">{patient.fullName}</p>
                      <p className="font-mono text-xs text-[#647184]">{patient.patientCode} · {formatDate(patient.dateOfBirth)} · {patient.sex}</p>
                    </td>
                    <td className="px-4 py-3.5 text-[#4B5666]">{patient.phone}</td>
                    <td className="px-4 py-3.5">
                      <p className="text-[#141920]">{patient.region}</p>
                      <p className="text-xs text-[#647184]">{patient.operationDistrict}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`rounded px-2 py-1 text-xs font-medium ${STATUS_STYLE[patient.screeningStatus] ?? 'bg-[#F5F7FA] text-[#4B5666]'}`}>
                        {patient.screeningStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-[#4B5666]">{patient.registeredByName || '—'}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex gap-1">
                        {can('patients', 'edit') && (
                          <button
                            onClick={() => openEdit(patient)}
                            className="rounded-md p-1.5 text-[#647184] transition hover:bg-[#EBF7EE] hover:text-[#2C9942]"
                          >
                            <Pencil size={13} />
                          </button>
                        )}
                        {can('patients', 'delete') && (
                          <button
                            onClick={() => setDeleteTarget(patient)}
                            className="rounded-md p-1.5 text-[#647184] transition hover:bg-[#FDECEB] hover:text-[#E53935]"
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
  form, campaigns, selectedCampaign, assignedRegion, isSuperAdmin, campaignLocked, set, chooseCampaign, chooseRegionalPlan,
}: {
  form: PatientForm;
  campaigns: Campaign[];
  selectedCampaign: Campaign | undefined;
  assignedRegion?: string;
  isSuperAdmin: boolean;
  campaignLocked: boolean;
  set: <K extends keyof PatientForm>(key: K, value: PatientForm[K]) => void;
  chooseCampaign: (id: string) => void;
  chooseRegionalPlan: (id: string) => void;
}) {
  const selectedPlans = selectedCampaign
    ? (isSuperAdmin ? selectedCampaign.regions ?? [] : (selectedCampaign.regions ?? []).filter((plan) => plan.region === assignedRegion))
    : [];
  const visiblePlansForCampaign = (campaign: Campaign) =>
    isSuperAdmin ? campaign.regions ?? [] : (campaign.regions ?? []).filter((plan) => plan.region === assignedRegion);
  const selectedPlan = selectedPlans.find((plan) => plan.id === form.campaignRegionId);
  const selectedCampaignLabel = selectedCampaign
    ? `${selectedCampaign.name} - ${selectedPlans.length} sub-region${selectedPlans.length === 1 ? '' : 's'}`
    : '';
  const selectedPlanLabel = selectedPlan
    ? `${selectedPlan.region} - ${selectedPlan.operationDistrict}`
    : '';
  return (
    <div className="space-y-4">
      <section>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[#647184]">Campaign & Location</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className={F.label}>Campaign *</label>
            {campaignLocked && selectedCampaign ? (
              <div className="truncate rounded-md border border-[#DDE3EA] bg-[#F5F7FA] px-3 py-2 text-sm text-[#4B5666]">
                {selectedCampaign.name}
                <span className="ml-2 text-[#647184]">- {selectedPlan?.region ?? 'Select sub-region'}</span>
              </div>
            ) : (
              <Select value={form.campaignId} onValueChange={(v) => { if (v) chooseCampaign(v); }}>
                <SelectTrigger className={F.sel}>
                  {selectedCampaignLabel ? (
                    <span className="min-w-0 flex-1 truncate text-left">{selectedCampaignLabel}</span>
                  ) : (
                    <SelectValue placeholder="Select campaign" />
                  )}
                </SelectTrigger>
                <SelectContent align="start" className="min-w-96 max-w-[calc(100vw-2rem)]">
                  {campaigns.map((c) => {
                    const count = visiblePlansForCampaign(c).length;
                    return (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} - {count} sub-region{count === 1 ? '' : 's'}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
          </div>
          <div>
            <label className={F.label}>Sub-region *</label>
            <Select value={form.campaignRegionId} disabled={!selectedCampaign} onValueChange={(v) => { if (v) chooseRegionalPlan(v); }}>
              <SelectTrigger className={F.sel}>
                {selectedPlanLabel ? (
                  <span className="min-w-0 flex-1 truncate text-left">{selectedPlanLabel}</span>
                ) : (
                  <SelectValue placeholder={selectedCampaign ? 'Select sub-region' : 'Select campaign first'} />
                )}
              </SelectTrigger>
              <SelectContent align="start" className="min-w-80 max-w-[calc(100vw-2rem)]">
                {selectedPlans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>{plan.region} - {plan.operationDistrict}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className={F.label}>State / Region</label>
            <input value={form.region} disabled className={F.input} placeholder="Auto-filled from sub-region" />
          </div>
          <div>
            <label className={F.label}>Operation City / District</label>
            <input value={form.operationDistrict} disabled className={F.input} placeholder="Auto-filled from sub-region" />
          </div>
        </div>
      </section>

      <section>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[#647184]">Patient Identity</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="xl:col-span-2">
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
          <div className="md:col-span-2 xl:col-span-2">
            <label className={F.label}>Date of Birth * — Day / Month / Year</label>
            <DateOfBirthPicker value={form.dateOfBirth} onChange={(v) => set('dateOfBirth', v)} />
          </div>
        </div>
      </section>

      <section>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[#647184]">Contact Details</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
        <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[#647184]">Background</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
            <div className="flex min-h-10 items-center gap-3 rounded-md border border-[#DDE3EA] bg-white px-3 py-2">
              <input
                type="checkbox"
                checked={form.consentGiven}
                onChange={(e) => set('consentGiven', e.target.checked)}
                className="h-4 w-4 rounded border-[#A6DCB5] accent-[#2C9942]"
              />
              <span className="text-sm leading-tight text-[#4B5666]">Patient has consented to treatment</span>
            </div>
          </div>
        </div>
      </section>

      <section>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[#647184]">Notes</p>
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

function applyRegionalPlanContext(form: PatientForm, campaign: Campaign, plan: NonNullable<Campaign['regions']>[number]): PatientForm {
  return {
    ...form,
    campaignId:        campaign.id,
    campaignRegionId:  plan.id,
    region:            plan.region,
    operationDistrict: plan.operationDistrict,
    district:          plan.operationDistrict,
  };
}
