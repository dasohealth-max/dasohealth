'use client';

import { useEffect, useState } from 'react';
import type { Patient, Screening, SurgeryEye, VAGrade } from '@/types';
import {
  actionCreateScreening, actionDeleteScreening, actionUpdateScreening,
  getScreeningHistoryPaginated, getScreeningQueuePaginated,
  getPrintableScreeningQueue, getPrintableScreeningHistory,
} from '@/app/actions/screenings';
import { getPatientById } from '@/app/actions/patients';
import Pagination from '@/components/ui/Pagination';
import { TableSkeletonRows } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ModalForm from '@/components/forms/ModalForm';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/toast';
import { formatDateTime } from '@/lib/utils';
import { usePermissions } from '@/lib/auth';
import { patientDisplayName } from '@/lib/patient-code';
import { defaultRecommendationForSurgeryConsent } from '@/lib/screening-defaults';
import { REGIONAL_CAMPAIGN_AREAS } from '@/lib/regions';
import { AlertTriangle, ChevronDown, ChevronRight, Clock, MapPin, Pencil, Printer, RefreshCw, Search, Stethoscope, Trash2, X } from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

const VA_GRADES: VAGrade[] = ['6/6', '6/9', '6/12', '6/18', '6/24', '6/36', '6/60', '<6/60', 'CF 1M', 'CF 2M', 'CF 3M', 'HM', 'PL', 'NPL'];
const EYES: SurgeryEye[] = ['Right', 'Left', 'Both'];
const FINDING_KEYS = ['cataractSuspected', 'glaucomaSuspected', 'diabeticRetinopathy'] as const;

const ACTIVE_RECOMMENDATIONS: Screening['recommendation'][] = [
  'Refer for Surgery',
  'Discharge',
];

const REC_STYLE: Record<string, string> = {
  'Refer for Surgery':   'bg-[#FDECEB] text-[#E53935]',
  'Discharge':           'bg-[#EAEEF3] text-[#4B5666]',
  'Positive':            'bg-[#EBF7EE] text-[#2C9942]',
};

const F = {
  label: 'block text-[11px] font-semibold uppercase tracking-wide text-[#647184] mb-1.5',
  input: 'w-full rounded-md border border-[#DDE3EA] bg-white px-3 py-2 text-sm text-[#141920] placeholder:text-[#647184] outline-none transition focus:border-[#2C9942] focus:ring-2 focus:ring-[#2C9942]/10 disabled:bg-[#EAEEF3] disabled:text-[#647184]',
  sel:   'rounded-md',
  dateInput: 'h-8 rounded-md border border-[#DDE3EA] bg-white px-2 text-xs text-[#141920] outline-none focus:border-[#2C9942] focus:ring-1 focus:ring-[#2C9942]/10',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type ScreeningForm = Omit<Screening, 'id' | 'createdAt'> & {
  surgeryConsentGiven: boolean;
  surgeryConsentDate: string;
};

function todayDate(): string {
  return new Date().toISOString().split('T')[0];
}

function blankForm(): ScreeningForm {
  return {
    patientId: '', patientCode: '', patientName: '', campaignId: '', region: '', operationDistrict: '',
    screenedBy: '', screenedById: '', screenedByName: '',
    screenedAt: nowLocal(),
    vaRightUnaided: '6/6', vaLeftUnaided: '6/6',
    cataractSuspected: false, glaucomaSuspected: false, diabeticRetinopathy: false,
    eye: 'Both',
    otherFindings: '', medicalHistory: '', currentMedications: '',
    recommendation: defaultRecommendationForSurgeryConsent(false),
    notes: '',
    surgeryConsentGiven: false,
    surgeryConsentDate: '',
  };
}

function screeningFindingLabel(s: Pick<Screening, 'cataractSuspected' | 'glaucomaSuspected' | 'diabeticRetinopathy'>): string {
  if (s.cataractSuspected) return 'Cataract Suspected';
  if (s.glaucomaSuspected) return 'Glaucoma Suspected';
  if (s.diabeticRetinopathy) return 'Diabetic Retinopathy';
  return 'No finding';
}

function printAfterRender() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => window.print());
  });
}

function formatDateShort(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateOnly(isoStr: string): string {
  if (!isoStr) return '-';
  return new Date(isoStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ScreeningPage() {
  const { can, role, user } = usePermissions();
  const isSuperAdmin = role === 'Super Administrator';

  // ── Shared ─────────────────────────────────────────────────────────────────
  const [form,        setForm]        = useState(blankForm);
  const [editing,     setEditing]     = useState<Screening | null>(null);
  const [showForm,    setShowForm]    = useState(false);
  const [saveError,   setSaveError]   = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Screening | null>(null);

  // ── Waiting Queue ──────────────────────────────────────────────────────────
  const [patients,          setPatients]          = useState<Patient[]>([]);
  const [queueTotal,        setQueueTotal]        = useState(0);
  const [queuePage,         setQueuePage]         = useState(1);
  const [isLoading,         setIsLoading]         = useState(true);
  const [queueError,        setQueueError]        = useState('');
  const [queueRefreshKey,   setQueueRefreshKey]   = useState(0);
  const [queueSearch,       setQueueSearch]       = useState('');
  const [debouncedQueueSearch, setDebouncedQueueSearch] = useState('');
  const [queueRegion,       setQueueRegion]       = useState('');
  const [queueFrom,         setQueueFrom]         = useState('');
  const [queueTo,           setQueueTo]           = useState('');
  const [queuePrintRows,    setQueuePrintRows]    = useState<Patient[] | null>(null);
  const [queuePrintTotal,   setQueuePrintTotal]   = useState(0);
  const [queuePrintTrunc,   setQueuePrintTrunc]   = useState(false);
  const [queuePrintLimit,   setQueuePrintLimit]   = useState(0);
  const [queuePrintId,      setQueuePrintId]      = useState(0);
  const [isPrintingQueue,   setIsPrintingQueue]   = useState(false);

  // ── Completed Screenings ───────────────────────────────────────────────────
  const [screenings,          setScreenings]          = useState<Screening[]>([]);
  const [screeningsTotal,     setScreeningsTotal]     = useState(0);
  const [screenedPatientTotal, setScreenedPatientTotal] = useState(0);
  const [screeningsPage,      setScreeningsPage]      = useState(1);
  const [histLoading,         setHistLoading]         = useState(true);
  const [historyError,        setHistoryError]        = useState('');
  const [historyRefreshKey,   setHistoryRefreshKey]   = useState(0);
  const [historyOpen,         setHistoryOpen]         = useState(false);
  const [historySearch,       setHistorySearch]       = useState('');
  const [debouncedHistSearch, setDebouncedHistSearch] = useState('');
  const [historyRegion,       setHistoryRegion]       = useState('');
  const [historyFrom,         setHistoryFrom]         = useState('');
  const [historyTo,           setHistoryTo]           = useState('');
  const [historyPrintRows,    setHistoryPrintRows]    = useState<Array<Screening & { patientPhone: string }> | null>(null);
  const [historyPrintTotal,   setHistoryPrintTotal]   = useState(0);
  const [historyPrintTrunc,   setHistoryPrintTrunc]   = useState(false);
  const [historyPrintLimit,   setHistoryPrintLimit]   = useState(0);
  const [historyPrintId,      setHistoryPrintId]      = useState(0);
  const [isPrintingHistory,   setIsPrintingHistory]   = useState(false);

  // ── Debounce queue search ──────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQueueSearch(queueSearch); setQueuePage(1); }, 400);
    return () => clearTimeout(t);
  }, [queueSearch]);

  // ── Debounce history search ────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedHistSearch(historySearch); setScreeningsPage(1); }, 400);
    return () => clearTimeout(t);
  }, [historySearch]);

  // ── Fetch waiting queue ────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getScreeningQueuePaginated({
      search: debouncedQueueSearch,
      region: queueRegion,
      registeredFrom: queueFrom,
      registeredTo: queueTo,
      page: queuePage,
      pageSize: PAGE_SIZE,
    })
      .then(({ data, total }) => {
        if (!cancelled) { setPatients(data); setQueueTotal(total); setQueueError(''); setIsLoading(false); }
      })
      .catch((error) => {
        if (!cancelled) { setPatients([]); setQueueTotal(0); setQueueError(error instanceof Error ? error.message : 'Could not load screening queue'); setIsLoading(false); }
      });
    return () => { cancelled = true; };
  }, [debouncedQueueSearch, queueRegion, queueFrom, queueTo, queuePage, queueRefreshKey]);

  // ── Fetch history ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setHistLoading(true);
    getScreeningHistoryPaginated({
      search: debouncedHistSearch,
      region: historyRegion,
      screenedFrom: historyFrom,
      screenedTo: historyTo,
      page: screeningsPage,
      pageSize: PAGE_SIZE,
    })
      .then(({ data, total, patientTotal }) => {
        if (!cancelled) { setScreenings(data); setScreeningsTotal(total); setScreenedPatientTotal(patientTotal); setHistoryError(''); setHistLoading(false); }
      })
      .catch((error) => {
        if (!cancelled) { setScreenings([]); setScreeningsTotal(0); setScreenedPatientTotal(0); setHistoryError(error instanceof Error ? error.message : 'Could not load screening history'); setHistLoading(false); }
      });
    return () => { cancelled = true; };
  }, [debouncedHistSearch, historyRegion, historyFrom, historyTo, screeningsPage, historyRefreshKey]);

  // ── Print triggers ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (queuePrintId === 0) return;
    printAfterRender();
  }, [queuePrintId]);

  useEffect(() => {
    if (historyPrintId === 0) return;
    printAfterRender();
  }, [historyPrintId]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const scopeLabel = isSuperAdmin
    ? null
    : `Scope: Assigned region — ${user?.assignedRegion ?? 'Not assigned'}`;

  const queueHasFilters  = !!queueRegion || !!queueFrom || !!queueTo;
  const historyHasFilters = !!historyRegion || !!historyFrom || !!historyTo;
  const printedAt = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  // ── Form helpers ───────────────────────────────────────────────────────────
  function set<K extends keyof ScreeningForm>(key: K, value: ScreeningForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setSurgeryConsent(consentGiven: boolean) {
    setForm((prev) => ({
      ...prev,
      surgeryConsentGiven: consentGiven,
      surgeryConsentDate: consentGiven ? (prev.surgeryConsentDate || todayDate()) : '',
      recommendation: defaultRecommendationForSurgeryConsent(consentGiven),
    }));
  }

  function chooseFinding(key: (typeof FINDING_KEYS)[number], checked: boolean) {
    setForm((prev) => ({
      ...prev,
      cataractSuspected: key === 'cataractSuspected' ? checked : false,
      glaucomaSuspected: key === 'glaucomaSuspected' ? checked : false,
      diabeticRetinopathy: key === 'diabeticRetinopathy' ? checked : false,
    }));
  }

  function choosePatient(patientId: string) {
    const patient = patients.find((p) => p.id === patientId);
    setForm((prev) => ({
      ...prev,
      patientId,
      patientCode:       patient?.patientCode ?? '',
      patientName:       patient?.fullName ?? '',
      campaignId:        patient?.campaignId ?? '',
      region:            patient?.region ?? '',
      operationDistrict: patient?.operationDistrict ?? '',
      surgeryConsentGiven: patient?.consentGiven ?? false,
      surgeryConsentDate: patient?.consentDate ?? '',
      recommendation: defaultRecommendationForSurgeryConsent(patient?.consentGiven ?? false),
    }));
  }

  function openAdd(patient?: Patient) {
    setEditing(null);
    const base = blankForm();
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
        surgeryConsentGiven: patient.consentGiven,
        surgeryConsentDate: patient.consentDate,
        recommendation: defaultRecommendationForSurgeryConsent(patient.consentGiven),
      });
    }
  }

  async function openEdit(screening: Screening) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, createdAt: _ca, ...editable } = screening;
    let patient = patients.find((row) => row.id === screening.patientId);
    if (!patient) {
      try {
        patient = await getPatientById(screening.patientId) ?? undefined;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load patient details';
        toast({ title: 'Patient details unavailable', description: message, variant: 'error' });
        return;
      }
    }
    if (!patient) {
      toast({ title: 'Patient details unavailable', description: 'The selected patient could not be found.', variant: 'error' });
      return;
    }
    setEditing(screening);
    setForm({
      ...editable,
      surgeryConsentGiven: patient.consentGiven,
      surgeryConsentDate: patient.consentDate ?? '',
      recommendation: patient.consentGiven === false && editable.recommendation === 'Refer for Surgery'
        ? 'Discharge'
        : editable.recommendation,
    });
    setSaveError('');
    setShowForm(true);
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function save() {
    setSaveError('');
    const result = editing
      ? await actionUpdateScreening(editing.id, form)
      : await actionCreateScreening(form);
    if (!result.ok) {
      setSaveError(result.error);
      toast({ title: editing ? 'Screening update failed' : 'Screening save failed', description: result.error, variant: 'error' });
      return;
    }
    if (editing) {
      setScreenings((rows) => rows.map((r) => r.id === editing.id ? result.data : r));
      toast({ title: 'Screening updated', description: patientDisplayName(result.data.patientName, result.data.patientCode) });
    } else {
      setScreeningsTotal((n) => n + 1);
      setScreenings((rows) => screeningsPage === 1 ? [result.data, ...rows].slice(0, PAGE_SIZE) : rows);
      setScreeningsPage(1);
      setQueueTotal((n) => Math.max(0, n - 1));
      setPatients((rows) => rows.filter((p) => p.id !== result.data.patientId));
      setQueueRefreshKey((key) => key + 1);
      toast({ title: 'Screening recorded', description: patientDisplayName(result.data.patientName, result.data.patientCode) });
    }
    setShowForm(false);
    setEditing(null);
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function confirmDelete() {
    if (!deleteTarget) return;
    const result = await actionDeleteScreening(deleteTarget.id);
    if (result.ok) {
      const deletedName = patientDisplayName(deleteTarget.patientName, deleteTarget.patientCode);
      setScreenings((rows) => rows.filter((r) => r.id !== deleteTarget.id));
      setScreeningsTotal((n) => Math.max(0, n - 1));
      if (result.data) { setQueueRefreshKey((key) => key + 1); }
      if (screenings.length === 1 && screeningsPage > 1) setScreeningsPage((p) => p - 1);
      toast({ title: 'Screening deleted', description: deletedName });
    } else {
      toast({ title: 'Screening delete failed', description: result.error, variant: 'error' });
    }
    setDeleteTarget(null);
  }

  // ── Print actions ──────────────────────────────────────────────────────────
  async function printQueue() {
    setIsPrintingQueue(true);
    setHistoryPrintRows(null);
    try {
      const result = await getPrintableScreeningQueue({
        search: debouncedQueueSearch,
        region: queueRegion,
        registeredFrom: queueFrom,
        registeredTo: queueTo,
      });
      setQueuePrintRows(result.data);
      setQueuePrintTotal(result.total);
      setQueuePrintTrunc(result.truncated);
      setQueuePrintLimit(result.limit);
      if (result.truncated) {
        toast({ title: 'Print list limited', description: `Showing the first ${result.limit} records. Narrow filters to print the full list.`, variant: 'info' });
      }
      setQueuePrintId((id) => id + 1);
    } catch (error) {
      toast({ title: 'Could not prepare print list', description: error instanceof Error ? error.message : 'Please try again.', variant: 'error' });
    } finally {
      setIsPrintingQueue(false);
    }
  }

  async function printHistory() {
    setIsPrintingHistory(true);
    setQueuePrintRows(null);
    try {
      const result = await getPrintableScreeningHistory({
        search: debouncedHistSearch,
        region: historyRegion,
        screenedFrom: historyFrom,
        screenedTo: historyTo,
      });
      setHistoryPrintRows(result.data);
      setHistoryPrintTotal(result.total);
      setHistoryPrintTrunc(result.truncated);
      setHistoryPrintLimit(result.limit);
      if (result.truncated) {
        toast({ title: 'Print list limited', description: `Showing the first ${result.limit} records. Narrow filters to print the full list.`, variant: 'info' });
      }
      setHistoryPrintId((id) => id + 1);
    } catch (error) {
      toast({ title: 'Could not prepare print list', description: error instanceof Error ? error.message : 'Please try again.', variant: 'error' });
    } finally {
      setIsPrintingHistory(false);
    }
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
        confirmationText="DELETE"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

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
            queuedPatients={patients}
            isEditing={!!editing}
            set={set}
            chooseFinding={chooseFinding}
            choosePatient={choosePatient}
            setSurgeryConsent={setSurgeryConsent}
          />
        </ModalForm>
      )}

      {/* ── Print views ──────────────────────────────────────────────────────── */}
      {queuePrintRows !== null && (
        <QueuePrintView
          rows={queuePrintRows}
          total={queuePrintTotal}
          truncated={queuePrintTrunc}
          limit={queuePrintLimit}
          filters={{ region: queueRegion, registeredFrom: queueFrom, registeredTo: queueTo }}
          printedAt={printedAt}
        />
      )}
      {historyPrintRows !== null && (
        <HistoryPrintView
          rows={historyPrintRows}
          total={historyPrintTotal}
          truncated={historyPrintTrunc}
          limit={historyPrintLimit}
          filters={{ region: historyRegion, screenedFrom: historyFrom, screenedTo: historyTo }}
          printedAt={printedAt}
        />
      )}

      {/* ── Main UI ──────────────────────────────────────────────────────────── */}
      <div className="space-y-5" data-print-hide="">

        {/* Page header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[#141920]">Screening</h1>
            {scopeLabel && (
              <div className="mt-1 inline-flex items-center gap-2 rounded-md border border-[#DDE3EA] bg-white px-3 py-1.5 text-sm font-semibold text-[#4B5666]">
                <MapPin size={14} className="shrink-0 text-[#647184]" />
                <span>{scopeLabel}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Waiting Queue ─────────────────────────────────────────────────── */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="border-b border-[#EAEEF3] bg-white px-4 py-3">
            {/* Section header */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[#141920]">Waiting Queue</p>
                <p className="text-xs text-[#4B5666]">
                  {isLoading ? 'Loading...' : `${queueTotal} patient${queueTotal === 1 ? '' : 's'} awaiting screening`}
                </p>
              </div>
              <button
                type="button"
                onClick={printQueue}
                disabled={isPrintingQueue}
                className="inline-flex items-center gap-2 rounded-md border border-[#DDE3EA] bg-white px-3 py-1.5 text-xs font-semibold text-[#4B5666] shadow-sm transition hover:bg-[#F5F7FA] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Printer size={13} /> {isPrintingQueue ? 'Preparing...' : 'Print'}
              </button>
            </div>

            {/* Queue filters */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {isSuperAdmin && (
                <Select value={queueRegion} onValueChange={(v) => { setQueueRegion(v ?? ''); setQueuePage(1); }}>
                  <SelectTrigger className="h-8 w-44 text-xs rounded-md">
                    <SelectValue placeholder="All Regions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Regions</SelectItem>
                    {REGIONAL_CAMPAIGN_AREAS.map((area) => (
                      <SelectItem key={area.region} value={area.region}>{area.region}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[#647184]">Registered</span>
                <input
                  type="date"
                  value={queueFrom}
                  onChange={(e) => { setQueueFrom(e.target.value); setQueuePage(1); }}
                  className={F.dateInput}
                />
                <span className="text-xs text-[#647184]">–</span>
                <input
                  type="date"
                  value={queueTo}
                  onChange={(e) => { setQueueTo(e.target.value); setQueuePage(1); }}
                  className={F.dateInput}
                />
              </div>
              {queueHasFilters && (
                <button
                  onClick={() => { setQueueRegion(''); setQueueFrom(''); setQueueTo(''); setQueuePage(1); }}
                  className="flex items-center gap-1 rounded-md border border-[#DDE3EA] px-2 py-1 text-xs font-medium text-[#4B5666] transition hover:bg-[#F5F7FA]"
                >
                  <X size={11} /> Clear
                </button>
              )}
            </div>

            {/* Queue search */}
            <div className="mt-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#647184]" size={13} />
              <input
                value={queueSearch}
                onChange={(e) => setQueueSearch(e.target.value)}
                placeholder="Search name, code, phone..."
                className={`${F.input} pl-9`}
              />
            </div>
          </div>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-170 text-sm">
                <thead className="border-b border-[#EAEEF3] bg-[#F5F7FA]">
                  <tr>
                    {['#', 'Code', 'Patient', 'Phone', 'Region / City', 'Surgery Consent', 'Registered By', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#647184]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading && <TableSkeletonRows rows={6} columns={8} />}
                  {!isLoading && queueError && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8">
                        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3 rounded-md border border-[#FACDCB] bg-[#FDECEB] px-4 py-3 text-sm text-[#8A1F1D]">
                          <span className="flex min-w-0 items-center gap-2">
                            <AlertTriangle size={15} className="shrink-0" />
                            <span className="min-w-0">{queueError}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => { setIsLoading(true); setQueueError(''); setQueueRefreshKey((k) => k + 1); }}
                            className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-[#8A1F1D] shadow-sm transition hover:bg-[#FFF5F5]"
                          >
                            <RefreshCw size={12} /> Retry
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {!isLoading && !queueError && patients.length === 0 && (
                    <tr><td colSpan={8} className="py-10 text-center text-sm text-[#647184]">
                      {queueSearch || queueHasFilters ? 'No patients match the current filters.' : 'No patients waiting — the queue is clear.'}
                    </td></tr>
                  )}
                  {!isLoading && !queueError && patients.map((patient, index) => (
                    <tr key={patient.id} className="border-b border-[#EAEEF3] transition-colors hover:bg-[#F5F7FA]">
                      <td className="px-4 py-3.5 text-xs text-[#647184]">{(queuePage - 1) * PAGE_SIZE + index + 1}</td>
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
                      <td className="px-4 py-3.5">
                        <ConsentBadge patient={patient} />
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
            <Pagination page={queuePage} pageSize={PAGE_SIZE} total={queueTotal} onPageChange={setQueuePage} />
          </CardContent>
        </Card>

        {/* ── Completed Screenings ──────────────────────────────────────────── */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="bg-white">
            {/* Collapsible header with print button */}
            <div className="flex w-full items-center justify-between gap-3 px-4 py-3">
              <button
                type="button"
                onClick={() => setHistoryOpen((v) => !v)}
                className="flex flex-1 items-center gap-3 text-left"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#EAEEF3]">
                  <Stethoscope size={14} className="text-[#4B5666]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#141920]">Completed Screenings</p>
                  <p className="text-xs text-[#4B5666]">
                    {histLoading ? 'Loading...' : `${screenedPatientTotal} patient${screenedPatientTotal === 1 ? '' : 's'} screened`}
                  </p>
                </div>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={printHistory}
                  disabled={isPrintingHistory}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#DDE3EA] bg-white px-3 py-1.5 text-xs font-semibold text-[#4B5666] shadow-sm transition hover:bg-[#F5F7FA] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Printer size={13} /> {isPrintingHistory ? 'Preparing...' : 'Print'}
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryOpen((v) => !v)}
                  className="rounded-md p-1 text-[#647184] transition hover:bg-[#EAEEF3]"
                >
                  {historyOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
              </div>
            </div>

            {/* History filters (visible when expanded) */}
            {historyOpen && (
              <div className="border-t border-[#EAEEF3] px-4 py-2.5 flex flex-wrap items-center gap-2">
                {isSuperAdmin && (
                  <Select value={historyRegion} onValueChange={(v) => { setHistoryRegion(v ?? ''); setScreeningsPage(1); }}>
                    <SelectTrigger className="h-8 w-44 text-xs rounded-md">
                      <SelectValue placeholder="All Regions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Regions</SelectItem>
                      {REGIONAL_CAMPAIGN_AREAS.map((area) => (
                        <SelectItem key={area.region} value={area.region}>{area.region}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-[#647184]">Screened</span>
                  <input
                    type="date"
                    value={historyFrom}
                    onChange={(e) => { setHistoryFrom(e.target.value); setScreeningsPage(1); }}
                    className={F.dateInput}
                  />
                  <span className="text-xs text-[#647184]">–</span>
                  <input
                    type="date"
                    value={historyTo}
                    onChange={(e) => { setHistoryTo(e.target.value); setScreeningsPage(1); }}
                    className={F.dateInput}
                  />
                </div>
                {historyHasFilters && (
                  <button
                    onClick={() => { setHistoryRegion(''); setHistoryFrom(''); setHistoryTo(''); setScreeningsPage(1); }}
                    className="flex items-center gap-1 rounded-md border border-[#DDE3EA] px-2 py-1 text-xs font-medium text-[#4B5666] transition hover:bg-[#F5F7FA]"
                  >
                    <X size={11} /> Clear
                  </button>
                )}
              </div>
            )}
          </div>

          {historyOpen && (
            <CardContent className="p-0">
              <div className="border-t border-[#EAEEF3]">
                {/* History search */}
                <div className="flex items-center justify-between gap-3 px-4 py-3">
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
                    {screenedPatientTotal} patient{screenedPatientTotal === 1 ? '' : 's'}
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
                      {histLoading && <TableSkeletonRows rows={5} columns={9} />}
                      {!histLoading && historyError && (
                        <tr>
                          <td colSpan={9} className="px-4 py-8">
                            <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3 rounded-md border border-[#FACDCB] bg-[#FDECEB] px-4 py-3 text-sm text-[#8A1F1D]">
                              <span className="flex min-w-0 items-center gap-2">
                                <AlertTriangle size={15} className="shrink-0" />
                                <span className="min-w-0">{historyError}</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => { setHistLoading(true); setHistoryError(''); setHistoryRefreshKey((k) => k + 1); }}
                                className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-[#8A1F1D] shadow-sm transition hover:bg-[#FFF5F5]"
                              >
                                <RefreshCw size={12} /> Retry
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                      {!histLoading && !historyError && screenings.length === 0 && (
                        <tr><td colSpan={9} className="py-8 text-center text-sm text-[#647184]">
                          {historySearch || historyHasFilters ? 'No screenings match the current filters.' : 'No screenings found.'}
                        </td></tr>
                      )}
                      {!histLoading && !historyError && screenings.map((screening, index) => (
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
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}

// ─── Print views ───────────────────────────────────────────────────────────────

function QueuePrintView({
  rows, total, truncated, limit, filters, printedAt,
}: {
  rows: Patient[];
  total: number;
  truncated: boolean;
  limit: number;
  filters: { region: string; registeredFrom: string; registeredTo: string };
  printedAt: string;
}) {
  const regionLabel = filters.region || 'All regions';
  const dateLabel = filters.registeredFrom || filters.registeredTo
    ? `${filters.registeredFrom ? formatDateShort(filters.registeredFrom) : '…'} – ${filters.registeredTo ? formatDateShort(filters.registeredTo) : '…'}`
    : 'All dates';

  return (
    <section data-print-only="" className="print-report">
      <div className="print-report-header">
        <h1>Screening Waiting Queue</h1>
        <p>
          Region: {regionLabel} | Registered: {dateLabel} | Printed: {printedAt} | {rows.length} of {total} patient{total === 1 ? '' : 's'}
          {truncated ? ` (limited to first ${limit} — narrow filters for full list)` : ''}
        </p>
      </div>
      <table>
        <thead>
          <tr>
            {['#', 'Patient Name', 'Phone', 'Region', 'Surgery Consent', 'Registration Date'].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={6}>No patients match the selected filters.</td></tr>
          ) : rows.map((patient, i) => (
            <tr key={patient.id}>
              <td>{i + 1}</td>
              <td>{patient.fullName || '-'}</td>
              <td>{patient.phone || '-'}</td>
              <td>{patient.region}{patient.operationDistrict ? ` / ${patient.operationDistrict}` : ''}</td>
              <td>{patient.consentGiven ? 'Yes' : 'No'}</td>
              <td>{formatDateOnly(patient.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function HistoryPrintView({
  rows, total, truncated, limit, filters, printedAt,
}: {
  rows: Array<Screening & { patientPhone: string }>;
  total: number;
  truncated: boolean;
  limit: number;
  filters: { region: string; screenedFrom: string; screenedTo: string };
  printedAt: string;
}) {
  const regionLabel = filters.region || 'All regions';
  const dateLabel = filters.screenedFrom || filters.screenedTo
    ? `${filters.screenedFrom ? formatDateShort(filters.screenedFrom) : '…'} – ${filters.screenedTo ? formatDateShort(filters.screenedTo) : '…'}`
    : 'All dates';

  return (
    <section data-print-only="" className="print-report">
      <div className="print-report-header">
        <h1>Completed Screenings</h1>
        <p>
          Region: {regionLabel} | Screened: {dateLabel} | Printed: {printedAt} | {rows.length} of {total} record{total === 1 ? '' : 's'}
          {truncated ? ` (limited to first ${limit} — narrow filters for full list)` : ''}
        </p>
      </div>
      <table>
        <thead>
          <tr>
            {['#', 'Patient Name', 'Phone', 'Region', 'VA R / L', 'Finding', 'Recommendation', 'Screened Date'].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={8}>No screenings match the selected filters.</td></tr>
          ) : rows.map((s, i) => (
            <tr key={s.id}>
              <td>{i + 1}</td>
              <td>{s.patientName || '-'}</td>
              <td>{s.patientPhone || '-'}</td>
              <td>{s.region}{s.operationDistrict ? ` / ${s.operationDistrict}` : ''}</td>
              <td>{s.vaRightUnaided} / {s.vaLeftUnaided}</td>
              <td>{screeningFindingLabel(s)}</td>
              <td>{s.recommendation}</td>
              <td>{formatDateOnly(s.screenedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ─── Screening form body ────────────────────────────────────────────────────────

function ScreeningFormBody({
  form, patients, queuedPatients, isEditing, set, chooseFinding, choosePatient, setSurgeryConsent,
}: {
  form: ScreeningForm;
  patients: Patient[];
  queuedPatients: Patient[];
  isEditing: boolean;
  set: <K extends keyof ScreeningForm>(key: K, value: ScreeningForm[K]) => void;
  chooseFinding: (key: (typeof FINDING_KEYS)[number], checked: boolean) => void;
  choosePatient: (id: string) => void;
  setSurgeryConsent: (consentGiven: boolean) => void;
}) {
  const patientList = isEditing ? patients : queuedPatients;
  const selectedPatient = patients.find((patient) => patient.id === form.patientId);
  const selectedPatientLabel = selectedPatient
    ? `${selectedPatient.patientCode} - ${selectedPatient.fullName}`
    : patientDisplayName(form.patientName, form.patientCode);
  const selectedFinding = FINDING_KEYS.find((key) => form[key]);
  const recommendations = form.surgeryConsentGiven
    ? ACTIVE_RECOMMENDATIONS
    : ACTIVE_RECOMMENDATIONS.filter((item) => item !== 'Refer for Surgery');

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {/* Section 1: Patient & Timestamp */}
      <section className="rounded-lg border border-[#EAEEF3] bg-white p-3">
        <p className={`${F.label} mb-2`}>Patient & Session</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
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
          <div className="md:col-span-4">
            <label className={F.label}>Screening Time</label>
            <div className="flex items-center gap-2.5 rounded-md border border-[#DDE3EA] bg-[#F5F7FA] px-3 py-2">
              <Clock size={13} className="shrink-0 text-[#647184]" />
              <span className="min-w-0 text-sm text-[#4B5666]">{form.screenedAt.replace('T', ' ')}</span>
              <span className="ml-auto shrink-0 rounded bg-[#EBF7EE] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#2C9942]">
                {isEditing ? 'Original time' : 'Auto'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Surgery Consent */}
      <section className="rounded-lg border border-[#EAEEF3] bg-white p-3">
        <p className={`${F.label} mb-2`}>Surgery Consent</p>
        <label className="flex min-h-10 items-center gap-3 rounded-md border border-[#DDE3EA] bg-white px-3 py-2">
          <input
            type="checkbox"
            checked={form.surgeryConsentGiven}
            onChange={(e) => setSurgeryConsent(e.target.checked)}
            className="h-4 w-4 rounded border-[#A6DCB5] accent-[#2C9942]"
          />
          <span className="text-sm leading-tight text-[#4B5666]">
            {form.surgeryConsentGiven
              ? `Patient agrees to surgery if referred${form.surgeryConsentDate ? ` - recorded ${form.surgeryConsentDate}` : ''}`
              : 'Patient is not ready for surgery referral'}
          </span>
        </label>
        {!form.surgeryConsentGiven && (
          <p className="mt-2 text-xs font-medium text-[#E53935]">Refer for Surgery is disabled until consent is recorded.</p>
        )}
      </section>

      {/* Section 3: Visual Acuity */}
      <section className="rounded-lg border border-[#EAEEF3] bg-white p-3">
        <p className={`${F.label} mb-2`}>Visual Acuity (Unaided)</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        </div>
      </section>

      {/* Section 4: Findings */}
      <section className="rounded-lg border border-[#EAEEF3] bg-white p-3">
        <p className={`${F.label} mb-2`}>Clinical Findings</p>
        <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-3">
          {[
            { key: 'cataractSuspected' as const,   label: 'Cataract Suspected' },
            { key: 'glaucomaSuspected' as const,   label: 'Glaucoma Suspected' },
            { key: 'diabeticRetinopathy' as const, label: 'Diabetic Retinopathy' },
          ].map(({ key, label }) => (
            <label
              key={key}
              className={`flex min-h-10 items-center gap-2.5 rounded-md border px-3 py-2 transition ${
                selectedFinding && selectedFinding !== key
                  ? 'cursor-not-allowed border-[#EAEEF3] bg-[#F5F7FA] text-[#94A0AE]'
                  : 'cursor-pointer border-[#DDE3EA] hover:bg-[#F5F7FA]'
              }`}
            >
              <input
                type="checkbox"
                checked={form[key]}
                disabled={!!selectedFinding && selectedFinding !== key}
                onChange={(e) => chooseFinding(key, e.target.checked)}
                className="h-4 w-4 rounded border-[#A6DCB5] accent-[#2C9942]"
              />
              <span className="text-sm leading-tight text-[#141920]">{label}</span>
            </label>
          ))}
        </div>
        <div className="mb-3 max-w-xs">
          <label className={F.label}>Eye *</label>
          <Select value={form.eye} onValueChange={(v) => { if (v) set('eye', v as SurgeryEye); }}>
            <SelectTrigger className={F.sel}><SelectValue /></SelectTrigger>
            <SelectContent>{EYES.map((eye) => <SelectItem key={eye} value={eye}>{eye}</SelectItem>)}</SelectContent>
          </Select>
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

      {/* Section 5: Patient History */}
      <section className="rounded-lg border border-[#EAEEF3] bg-white p-3">
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

      {/* Section 6: Outcome */}
      <section className="rounded-lg border border-[#EAEEF3] bg-white p-3 xl:col-span-2">
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
                {recommendations.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!form.surgeryConsentGiven && (
              <p className="mt-1 text-xs text-[#E53935]">Surgery referral requires patient consent.</p>
            )}
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

function ConsentBadge({ patient }: { patient: Patient }) {
  if (patient.consentGiven) {
    return (
      <span className="inline-flex items-center rounded bg-[#EBF7EE] px-2 py-1 text-xs font-medium text-[#2C9942]">
        Allowed{patient.consentDate ? ` - ${patient.consentDate}` : ''}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded bg-[#FFF5E6] px-2 py-1 text-xs font-medium text-[#F59E0B]">
      Not ready
    </span>
  );
}
