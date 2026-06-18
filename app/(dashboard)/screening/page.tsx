'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Patient, Screening, VAGrade } from '@/types';
import { actionCreateScreening, actionDeleteScreening, actionUpdateScreening, getScreeningHistoryPaginated } from '@/app/actions/screenings';
import { getAllPatients } from '@/app/actions/patients';
import Pagination from '@/components/ui/Pagination';

const PAGE_SIZE = 50;
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ModalForm from '@/components/forms/ModalForm';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { formatDateTime } from '@/lib/utils';
import { usePermissions } from '@/lib/auth';
import { patientDisplayName } from '@/lib/patient-code';
import { AlertTriangle, ChevronDown, ChevronRight, Clock, Pencil, Search, Stethoscope, Trash2 } from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const VA_GRADES: VAGrade[] = ['6/6', '6/9', '6/12', '6/18', '6/24', '6/36', '6/60', '<6/60', 'CF', 'HM', 'PL', 'NPL'];

// Only active recommendations shown in new/edit screening forms; legacy values stay displayable for existing records.
const ACTIVE_RECOMMENDATIONS: Screening['recommendation'][] = [
  'Refer for Surgery',
  'Discharge',
];

// Recommendation badge styles
const REC_STYLE: Record<string, string> = {
  'Refer for Surgery':   'bg-[#FDECEB] text-[#E53935]',
  'Discharge':           'bg-[#EAEEF3] text-[#4B5666]',
  'Positive':            'bg-[#EBF7EE] text-[#2C9942]',
};

// Shared field styles
const F = {
  label: 'block text-[11px] font-semibold uppercase tracking-wide text-[#647184] mb-1.5',
  input: 'w-full rounded-md border border-[#DDE3EA] bg-white px-3 py-2 text-sm text-[#141920] placeholder:text-[#647184] outline-none transition focus:border-[#2C9942] focus:ring-2 focus:ring-[#2C9942]/10 disabled:bg-[#EAEEF3] disabled:text-[#647184]',
  sel:   'rounded-md',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Blank form ───────────────────────────────────────────────────────────────

function blankForm(): Omit<Screening, 'id' | 'createdAt'> {
  return {
    patientId: '', patientCode: '', patientName: '', campaignId: '', region: '', operationDistrict: '',
    screenedBy: '', screenedById: '', screenedByName: '',
    screenedAt: nowLocal(),
    vaRightUnaided: '6/6', vaLeftUnaided: '6/6',
    cataractSuspected: false, glaucomaSuspected: false, diabeticRetinopathy: false,
    otherFindings: '', medicalHistory: '', currentMedications: '',
    recommendation: 'Refer for Surgery',
    notes: '',
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ScreeningPage() {
  const { can } = usePermissions();

  const [screenings,          setScreenings]          = useState<Screening[]>([]);
  const [screeningsTotal,     setScreeningsTotal]     = useState(0);
  const [screeningsPage,      setScreeningsPage]      = useState(1);
  const [debouncedHistSearch, setDebouncedHistSearch] = useState('');
  const [patients,            setPatients]            = useState<Patient[]>([]);
  const [form,                setForm]                = useState(blankForm);
  const [editing,             setEditing]             = useState<Screening | null>(null);
  const [showForm,            setShowForm]            = useState(false);
  const [saveError,           setSaveError]           = useState('');
  const [isLoading,           setIsLoading]           = useState(true);
  const [histLoading,         setHistLoading]         = useState(false);
  const [queueSearch,         setQueueSearch]         = useState('');
  const [historySearch,       setHistorySearch]       = useState('');
  const [historyOpen,         setHistoryOpen]         = useState(false);
  const [deleteTarget,        setDeleteTarget]        = useState<Screening | null>(null);

  // Load region-scoped patients for queue and form
  useEffect(() => {
    getAllPatients().then((patientRows) => {
      setPatients(patientRows);
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, []);

  // Debounce history search, reset page
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedHistSearch(historySearch); setScreeningsPage(1); }, 400);
    return () => clearTimeout(t);
  }, [historySearch]);

  // Load paginated screening history
  useEffect(() => {
    let cancelled = false;
    getScreeningHistoryPaginated({ search: debouncedHistSearch, page: screeningsPage, pageSize: PAGE_SIZE })
      .then(({ data, total }) => {
        if (!cancelled) { setScreenings(data); setScreeningsTotal(total); setHistLoading(false); }
      })
      .catch(() => { if (!cancelled) setHistLoading(false); });
    return () => { cancelled = true; };
  }, [debouncedHistSearch, screeningsPage]);

  // ── Derived lists ──────────────────────────────────────────────────────────

  const queuedPatients = useMemo(
    () => patients.filter((p) => p.screeningStatus === 'Awaiting Screening'),
    [patients],
  );

  const filteredQueue = useMemo(() => {
    const q = queueSearch.trim().toLowerCase();
    if (!q) return queuedPatients;
    return queuedPatients.filter(
      (p) =>
        p.patientCode.toLowerCase().includes(q) ||
        p.fullName.toLowerCase().includes(q) ||
        p.phone.includes(q),
    );
  }, [queuedPatients, queueSearch]);

  // ── Form helpers ───────────────────────────────────────────────────────────

  function set<K extends keyof ReturnType<typeof blankForm>>(key: K, value: ReturnType<typeof blankForm>[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function choosePatient(patientId: string) {
    const patient  = patients.find((p) => p.id === patientId);
    setForm((prev) => ({
      ...prev,
      patientId,
      patientCode:       patient?.patientCode ?? '',
      patientName:       patient?.fullName ?? '',
      campaignId:        patient?.campaignId ?? '',
      region:            patient?.region ?? '',
      operationDistrict: patient?.operationDistrict ?? '',
    }));
  }

  function openAdd(patient?: Patient) {
    setEditing(null);
    const base = blankForm(); // fresh timestamp every time modal opens
    setForm(base);
    setSaveError('');
    setShowForm(true);
    if (patient) {
      setForm({
        ...base,
        patientId:         patient.id,
        patientCode:       patient.patientCode,
        patientName:       patient.fullName,
        campaignId:        patient.campaignId ?? '',
        region:            patient.region ?? '',
        operationDistrict: patient.operationDistrict ?? '',
      });
    }
  }

  function openEdit(screening: Screening) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, createdAt: _ca, ...editable } = screening;
    setEditing(screening);
    setForm(editable);
    setSaveError('');
    setShowForm(true);
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function save() {
    setSaveError('');
    const result = editing
      ? await actionUpdateScreening(editing.id, form)
      : await actionCreateScreening(form);
    if (!result.ok) { setSaveError(result.error); return; }
    if (editing) {
      setScreenings((rows) => rows.map((r) => r.id === editing.id ? result.data : r));
    } else {
      // New screening — go to page 1 to see it (ordered by date desc)
      setScreeningsPage(1);
      setScreeningsTotal((n) => n + 1);
    }
    setPatients((rows) =>
      rows.map((p) => p.id === result.data.patientId ? { ...p, screeningStatus: 'Screened' } : p),
    );
    setShowForm(false);
    setEditing(null);
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function confirmDelete() {
    if (!deleteTarget) return;
    const result = await actionDeleteScreening(deleteTarget.id);
    if (result.ok) {
      setScreenings((rows) => rows.filter((r) => r.id !== deleteTarget.id));
      setScreeningsTotal((n) => Math.max(0, n - 1));
      if (result.data) {
        setPatients((rows) =>
          rows.map((patient) =>
            patient.id === result.data?.patientId
              ? { ...patient, screeningStatus: result.data.screeningStatus }
              : patient,
          ),
        );
      }
      if (screenings.length === 1 && screeningsPage > 1) setScreeningsPage((p) => p - 1);
    }
    setDeleteTarget(null);
  }

  const formInvalid = !form.patientId || !form.campaignId;

  return (
    <div className="space-y-5">
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Screening Record"
        description={deleteTarget
          ? `Remove the screening record for "${patientDisplayName(deleteTarget.patientName, deleteTarget.patientCode)}"? This cannot be undone.`
          : ''}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Screening form modal */}
      {showForm && (
        <ModalForm
          title={editing ? `Edit Screening - ${patientDisplayName(editing.patientName, editing.patientCode)}` : 'Record Screening'}
          subtitle={editing ? undefined : 'Select a patient from the waiting queue and complete the screening assessment'}
          onClose={() => setShowForm(false)}
          onSave={save}
          saveLabel={editing ? 'Save Changes' : 'Save Screening'}
          saveDisabled={formInvalid}
          wide
        >
          {saveError && (
            <div className="mb-5 rounded-md border border-[#FACDCB] bg-[#FDECEB] px-3 py-2 text-sm text-[#E53935]">
              {saveError}
            </div>
          )}
          <ScreeningFormBody
            form={form}
            patients={patients}
            queuedPatients={queuedPatients}
            isEditing={!!editing}
            set={set}
            choosePatient={choosePatient}
          />
        </ModalForm>
      )}

      {/* Page header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#141920]">Screening</h1>
          <p className="text-sm text-[#4B5666]">
            {isLoading ? 'Loading…' : `${queuedPatients.length} patient${queuedPatients.length === 1 ? '' : 's'} waiting for screening`}
          </p>
        </div>
      </div>

      {/* ── Waiting Queue ── */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[#141920]">Waiting Queue</p>
              <p className="text-xs text-[#4B5666]">
                {filteredQueue.length !== queuedPatients.length
                  ? `${filteredQueue.length} of ${queuedPatients.length}`
                  : queuedPatients.length} patient{queuedPatients.length === 1 ? '' : 's'} awaiting screening
              </p>
            </div>
            <div className="relative min-w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#647184]" size={13} />
              <input
                value={queueSearch}
                onChange={(e) => setQueueSearch(e.target.value)}
                placeholder="Search name, code, phone..."
                className={`${F.input} pl-9`}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-170 text-sm">
              <thead className="border-b border-[#EAEEF3] bg-[#F5F7FA]">
                <tr>
                  {['#', 'Code', 'Patient', 'Phone', 'Region / City', 'Registered By', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#647184]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={7} className="py-10 text-center text-sm text-[#647184]">Loading...</td></tr>
                )}
                {!isLoading && filteredQueue.length === 0 && (
                  <tr><td colSpan={7} className="py-10 text-center text-sm text-[#647184]">
                    {queueSearch ? 'No patients match the search.' : 'No patients waiting — the queue is clear.'}
                  </td></tr>
                )}
                {!isLoading && filteredQueue.map((patient, index) => (
                  <tr key={patient.id} className="border-b border-[#EAEEF3] transition-colors hover:bg-[#F5F7FA]">
                    <td className="px-4 py-3.5 text-xs text-[#647184]">{index + 1}</td>
                    <td className="px-4 py-3.5 font-mono text-xs text-[#4B5666]">{patient.patientCode}</td>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-[#141920]">{patient.fullName}</p>
                      <p className="font-mono text-xs text-[#647184]">{patient.patientCode} - {patient.sex}</p>
                    </td>
                    <td className="px-4 py-3.5 text-[#4B5666]">{patient.phone}</td>
                    <td className="px-4 py-3.5">
                      <p className="text-[#141920]">{patient.region}</p>
                      <p className="text-xs text-[#647184]">{patient.operationDistrict}</p>
                    </td>
                    <td className="px-4 py-3.5 text-[#4B5666]">{patient.registeredByName || '—'}</td>
                    <td className="px-4 py-3.5 text-right">
                      {can('screening', 'create') && (
                        <button
                          onClick={() => openAdd(patient)}
                          className="flex items-center gap-1.5 rounded-md bg-[#2C9942] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#002E63]"
                        >
                          <Stethoscope size={12} /> Screen
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Completed Screenings (collapsible) ── */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {/* Toggle header */}
          <button
            onClick={() => setHistoryOpen((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-4 transition hover:bg-[#F5F7FA]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#EAEEF3]">
                <Stethoscope size={14} className="text-[#4B5666]" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-[#141920]">Completed Screenings</p>
                <p className="text-xs text-[#4B5666]">{screeningsTotal} screening{screeningsTotal === 1 ? '' : 's'} recorded — click to {historyOpen ? 'collapse' : 'expand'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {historyOpen ? <ChevronDown size={16} className="text-[#647184]" /> : <ChevronRight size={16} className="text-[#647184]" />}
            </div>
          </button>

          {/* Expanded content */}
          {historyOpen && (
            <div className="border-t border-[#EAEEF3]">
              <div className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="relative min-w-56 flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#647184]" size={13} />
                  <input
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Search name, region, recommendation..."
                    className={`${F.input} pl-9`}
                  />
                </div>
                <span className="shrink-0 text-xs text-[#647184]">
                  {screeningsTotal} records
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-[#EAEEF3] bg-[#F5F7FA]">
                    <tr>
                      {['#', 'Patient', 'Region', 'VA R / L', 'Finding', 'Recommendation', 'Screened By', 'Date', ''].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#647184]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {histLoading && (
                      <tr><td colSpan={9} className="py-8 text-center text-sm text-[#647184]">Loading…</td></tr>
                    )}
                    {!histLoading && screenings.length === 0 && (
                      <tr><td colSpan={9} className="py-8 text-center text-sm text-[#647184]">No screenings found.</td></tr>
                    )}
                    {!histLoading && screenings.map((screening, index) => (
                      <tr key={screening.id} className="border-b border-[#EAEEF3] transition-colors hover:bg-[#F5F7FA]">
                        <td className="px-4 py-3.5 text-xs text-[#647184]">{(screeningsPage - 1) * PAGE_SIZE + index + 1}</td>
                        <td className="px-4 py-3.5">
                          <p className="font-medium text-[#141920]">{screening.patientName}</p>
                          {screening.patientCode && <p className="font-mono text-xs text-[#647184]">{screening.patientCode}</p>}
                        </td>
                        <td className="px-4 py-3.5 text-[#4B5666]">{screening.region}</td>
                        <td className="px-4 py-3.5 font-mono text-xs">{screening.vaRightUnaided} / {screening.vaLeftUnaided}</td>
                        <td className="px-4 py-3.5">
                          {screening.cataractSuspected
                            ? <span className="flex items-center gap-1 text-xs font-medium text-[#E53935]"><AlertTriangle size={11} />Cataract</span>
                            : <span className="text-xs text-[#647184]">Clear</span>}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`rounded px-2 py-1 text-xs font-medium ${REC_STYLE[screening.recommendation] ?? 'bg-[#EAEEF3] text-[#4B5666]'}`}>
                            {screening.recommendation}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-[#4B5666]">{screening.screenedByName || screening.screenedBy}</td>
                        <td className="px-4 py-3.5 text-xs text-[#4B5666]">{formatDateTime(screening.screenedAt)}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex gap-1">
                            {can('screening', 'edit') && (
                              <button
                                onClick={() => openEdit(screening)}
                                className="rounded-md p-1.5 text-[#647184] transition hover:bg-[#EBF7EE] hover:text-[#2C9942]"
                              >
                                <Pencil size={13} />
                              </button>
                            )}
                            {can('screening', 'delete') && (
                              <button
                                onClick={() => setDeleteTarget(screening)}
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
              <Pagination page={screeningsPage} pageSize={PAGE_SIZE} total={screeningsTotal} onPageChange={setScreeningsPage} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Screening form body (inside modal) ──────────────────────────────────────

function ScreeningFormBody({
  form, patients, queuedPatients, isEditing, set, choosePatient,
}: {
  form: ReturnType<typeof blankForm>;
  patients: Patient[];
  queuedPatients: Patient[];
  isEditing: boolean;
  set: <K extends keyof ReturnType<typeof blankForm>>(key: K, value: ReturnType<typeof blankForm>[K]) => void;
  choosePatient: (id: string) => void;
}) {
  const patientList = isEditing ? patients : queuedPatients;
  const selectedPatient = patients.find((patient) => patient.id === form.patientId);
  const selectedPatientLabel = selectedPatient
    ? `${selectedPatient.patientCode} - ${selectedPatient.fullName}`
    : patientDisplayName(form.patientName, form.patientCode);

  return (
    <div className="space-y-4">
      {/* Section 1: Patient & Timestamp */}
      <section>
        <p className={`${F.label} mb-2`}>Patient & Session</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className={F.label}>Patient *</label>
            <Select value={form.patientId} onValueChange={(v) => { if (v) choosePatient(v); }}>
              <SelectTrigger className={F.sel}>
                {selectedPatientLabel ? (
                  <span className="flex flex-1 truncate text-left">{selectedPatientLabel}</span>
                ) : (
                  <SelectValue placeholder={patientList.length ? 'Select patient from queue' : 'No patients in queue'} />
                )}
              </SelectTrigger>
              <SelectContent>
                {patientList.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.patientCode} - {p.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className={F.label}>Region</label>
            <input value={form.region} disabled className={F.input} placeholder="Auto-filled from patient" />
          </div>
          <div className="md:col-span-3 xl:col-span-1">
            <label className={F.label}>Screening Time</label>
            <div className="flex items-center gap-2.5 rounded-md border border-[#DDE3EA] bg-[#F5F7FA] px-3 py-2">
              <Clock size={13} className="shrink-0 text-[#647184]" />
              <span className="min-w-0 truncate text-sm text-[#4B5666]">{form.screenedAt.replace('T', ' ')}</span>
              <span className="ml-auto shrink-0 rounded bg-[#EBF7EE] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#2C9942]">
                {isEditing ? 'Original time' : 'Auto'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Visual Acuity */}
      <section>
        <p className={`${F.label} mb-2`}>Visual Acuity (Unaided)</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div>
            <label className={F.label}>VA — Right Eye</label>
            <Select value={form.vaRightUnaided} onValueChange={(v) => { if (v) set('vaRightUnaided', v as VAGrade); }}>
              <SelectTrigger className={F.sel}><SelectValue /></SelectTrigger>
              <SelectContent>{VA_GRADES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className={F.label}>VA — Left Eye</label>
            <Select value={form.vaLeftUnaided} onValueChange={(v) => { if (v) set('vaLeftUnaided', v as VAGrade); }}>
              <SelectTrigger className={F.sel}><SelectValue /></SelectTrigger>
              <SelectContent>{VA_GRADES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className={F.label}>IOP — Right (mmHg)</label>
            <input
              type="number"
              value={form.iopRight ?? ''}
              onChange={(e) => set('iopRight', e.target.value ? Number(e.target.value) : undefined)}
              placeholder="e.g. 16"
              className={F.input}
            />
          </div>
          <div>
            <label className={F.label}>IOP — Left (mmHg)</label>
            <input
              type="number"
              value={form.iopLeft ?? ''}
              onChange={(e) => set('iopLeft', e.target.value ? Number(e.target.value) : undefined)}
              placeholder="e.g. 16"
              className={F.input}
            />
          </div>
        </div>
      </section>

      {/* Section 3: Findings */}
      <section>
        <p className={`${F.label} mb-2`}>Clinical Findings</p>
        <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-3">
          {[
            { key: 'cataractSuspected' as const,    label: 'Cataract Suspected' },
            { key: 'glaucomaSuspected' as const,    label: 'Glaucoma Suspected' },
            { key: 'diabeticRetinopathy' as const,  label: 'Diabetic Retinopathy' },
          ].map(({ key, label }) => (
            <label key={key} className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-md border border-[#DDE3EA] px-3 py-2 transition hover:bg-[#F5F7FA]">
              <input
                type="checkbox"
                checked={form[key]}
                onChange={(e) => set(key, e.target.checked)}
                className="h-4 w-4 rounded border-[#A6DCB5] accent-[#2C9942]"
              />
              <span className="text-sm leading-tight text-[#141920]">{label}</span>
            </label>
          ))}
        </div>
        <div>
          <label className={F.label}>Other Findings</label>
          <input
            value={form.otherFindings}
            onChange={(e) => set('otherFindings', e.target.value)}
            placeholder="e.g. Pterygium right eye, corneal opacity, dry eye"
            className={F.input}
          />
        </div>
      </section>

      {/* Section 4: Patient History */}
      <section>
        <p className={`${F.label} mb-2`}>Patient History</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className={F.label}>Medical History</label>
            <input
              value={form.medicalHistory}
              onChange={(e) => set('medicalHistory', e.target.value)}
              placeholder="e.g. Hypertension, Type 2 Diabetes"
              className={F.input}
            />
          </div>
          <div>
            <label className={F.label}>Current Medications</label>
            <input
              value={form.currentMedications}
              onChange={(e) => set('currentMedications', e.target.value)}
              placeholder="e.g. Timolol eye drops, Metformin 500mg"
              className={F.input}
            />
          </div>
        </div>
      </section>

      {/* Section 5: Outcome */}
      <section>
        <p className={`${F.label} mb-2`}>Outcome</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(220px,0.7fr)_minmax(0,1.3fr)]">
          <div>
            <label className={F.label}>Recommendation *</label>
            <Select
              value={form.recommendation}
              onValueChange={(v) => { if (v) set('recommendation', v as Screening['recommendation']); }}
            >
              <SelectTrigger className={F.sel}><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACTIVE_RECOMMENDATIONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className={F.label}>Notes</label>
            <input
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Any additional notes or follow-up instructions..."
              className={F.input}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
