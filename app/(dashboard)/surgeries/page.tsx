'use client';

import { useEffect, useState } from 'react';
import type { LensType, Surgery, SurgeryStatus } from '@/types';
import { actionUpdateSurgery, actionRemoveSurgeryPatient, getPrintableHistorySurgeries, getPrintableWaitingSurgeries, getSurgeriesPaginated } from '@/app/actions/surgeries';
import { REMOVAL_REASONS } from '@/lib/surgery-constants';
import { actionCreateChangeRequest } from '@/app/actions/change_requests';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ModalForm from '@/components/forms/ModalForm';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Pagination from '@/components/ui/Pagination';
import { TableSkeletonRows } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { REGIONAL_CAMPAIGN_AREAS } from '@/lib/regions';
import { formatDateTime } from '@/lib/utils';
import { usePermissions } from '@/lib/auth';
import { patientDisplayName } from '@/lib/patient-code';
import { AlertTriangle, ChevronDown, ChevronRight, Eye, Pencil, Phone, Printer, RefreshCw, Search, Trash2, UserMinus, X } from 'lucide-react';
import ChangeRequestDialog, { type ChangeRequestTarget } from '@/components/forms/ChangeRequestDialog';

const PAGE_SIZE = 50;

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUSES: SurgeryStatus[] = ['Scheduled', 'Completed', 'Cancelled', 'Postponed'];
const LENSES: LensType[]        = ['PMMA', 'Foldable Acrylic', 'Hydrophilic', 'Hydrophobic'];

const STATUS_STYLE: Record<SurgeryStatus, string> = {
  Scheduled: 'bg-[#EBF7EE] text-[#4B5666]',
  Completed: 'bg-[#EBF7EE] text-[#2C9942]',
  Cancelled: 'bg-[#FDECEB] text-[#E53935]',
  Postponed: 'bg-[#FFF5E6] text-[#F59E0B]',
};

const F = {
  label: 'block text-[11px] font-semibold uppercase tracking-wide text-[#647184] mb-1.5',
  input: 'w-full rounded-md border border-[#DDE3EA] bg-white px-3 py-2 text-sm text-[#141920] placeholder:text-[#647184] outline-none transition focus:border-[#2C9942] focus:ring-2 focus:ring-[#2C9942]/10 disabled:bg-[#EAEEF3] disabled:text-[#647184]',
  sel:   'w-full rounded-md',
  dateInput: 'h-8 rounded-md border border-[#DDE3EA] bg-white px-2 text-xs text-[#141920] outline-none focus:border-[#2C9942] focus:ring-1 focus:ring-[#2C9942]/10',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

type SurgeryForm = Omit<Surgery, 'id' | 'createdAt'>;

const BLANK: SurgeryForm = {
  patientId: '', patientCode: '', patientName: '', campaignId: '', region: '', operationDistrict: '',
  createdFromScreeningId: '', surgeonName: '', eye: 'Right', lensType: 'Foldable Acrylic',
  scheduledAt: '', performedAt: '', status: 'Scheduled',
  preOpVA: '', postOpVA: '', complications: '', intraopNotes: '',
  completedById: '', completedByName: '',
};

function toLocal(iso?: string): string {
  if (!iso) return '';
  const d   = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function nowLocal(): string {
  return toLocal(new Date().toISOString());
}

function screeningFindingLabel(screening: NonNullable<Surgery['screeningResult']>) {
  if (screening.cataractSuspected) return 'Cataract Suspected';
  if (screening.glaucomaSuspected) return 'Glaucoma Suspected';
  if (screening.diabeticRetinopathy) return 'Diabetic Retinopathy';
  return 'No major finding selected';
}

function surgeryFindingLabel(surgery: Surgery) {
  return surgery.screeningResult ? screeningFindingLabel(surgery.screeningResult) : '-';
}

function surgeryPreOpVA(surgery: Surgery) {
  if (surgery.screeningResult) {
    return `${surgery.screeningResult.vaRightUnaided} / ${surgery.screeningResult.vaLeftUnaided}`;
  }
  return surgery.preOpVA || '-';
}

function printAfterRender() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => window.print());
  });
}

function historySummary(surgeries: Surgery[]) {
  const completed = surgeries.filter((s) => s.status === 'Completed').length;
  const postponed = surgeries.filter((s) => s.status === 'Postponed').length;
  const cancelled = surgeries.filter((s) => s.status === 'Cancelled').length;
  return `${completed} completed, ${postponed} postponed, ${cancelled} cancelled`;
}

function formatDateShort(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SurgeriesPage() {
  const { can, role } = usePermissions();
  const isSuperAdmin  = role === 'Super Administrator';

  // ── Shared ─────────────────────────────────────────────────────────────────
  const [search,          setSearch]          = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [refreshKey,      setRefreshKey]      = useState(0);
  const [form,            setForm]            = useState<SurgeryForm>(BLANK);
  const [editing,         setEditing]         = useState<Surgery | null>(null);
  const [showForm,        setShowForm]        = useState(false);
  const [saveError,       setSaveError]       = useState('');
  const [deleteTarget,    setDeleteTarget]    = useState<Surgery | null>(null);
  const [changeRequestTarget, setChangeRequestTarget] = useState<ChangeRequestTarget | null>(null);
const [removeTarget,    setRemoveTarget]    = useState<Surgery | null>(null);
  const [removeReason,    setRemoveReason]    = useState('');
  const [removeNotes,     setRemoveNotes]     = useState('');
  const [isRemoving,      setIsRemoving]      = useState(false);
  const [pmRemoveTarget,  setPmRemoveTarget]  = useState<Surgery | null>(null);
  const [pmRemoveReason,  setPmRemoveReason]  = useState('');
  const [pmRemoveNotes,   setPmRemoveNotes]   = useState('');
  const [isPmRequesting,  setIsPmRequesting]  = useState(false);
  const [viewing,         setViewing]         = useState<Surgery | null>(null);

  // ── Waiting section ────────────────────────────────────────────────────────
  const [waitingRegion,     setWaitingRegion]     = useState('');
  const [waitingFrom,       setWaitingFrom]       = useState('');
  const [waitingTo,         setWaitingTo]         = useState('');
  const [waitingSurgeries,  setWaitingSurgeries]  = useState<Surgery[]>([]);
  const [waitingTotal,      setWaitingTotal]      = useState(0);
  const [waitingPage,       setWaitingPage]       = useState(1);
  const [waitingLoading,    setWaitingLoading]    = useState(true);
  const [waitingError,      setWaitingError]      = useState('');
  const [waitingPrintRows,  setWaitingPrintRows]  = useState<Surgery[] | null>(null);
  const [waitingPrintTotal, setWaitingPrintTotal] = useState(0);
  const [waitingPrintTrunc, setWaitingPrintTrunc] = useState(false);
  const [waitingPrintLimit, setWaitingPrintLimit] = useState(0);
  const [waitingPrintId,    setWaitingPrintId]    = useState(0);
  const [isPrintingWaiting, setIsPrintingWaiting] = useState(false);

  // ── History section ────────────────────────────────────────────────────────
  const [historyOpen,       setHistoryOpen]       = useState(false);
  const [historyRegion,     setHistoryRegion]     = useState('');
  const [historyFrom,       setHistoryFrom]       = useState('');
  const [historyTo,         setHistoryTo]         = useState('');
  const [historySurgeries,  setHistorySurgeries]  = useState<Surgery[]>([]);
  const [historyTotal,      setHistoryTotal]      = useState(0);
  const [historyPage,       setHistoryPage]       = useState(1);
  const [historyLoading,    setHistoryLoading]    = useState(true);
  const [historyPrintRows,  setHistoryPrintRows]  = useState<Surgery[] | null>(null);
  const [historyPrintTotal, setHistoryPrintTotal] = useState(0);
  const [historyPrintTrunc, setHistoryPrintTrunc] = useState(false);
  const [historyPrintLimit, setHistoryPrintLimit] = useState(0);
  const [historyPrintId,    setHistoryPrintId]    = useState(0);
  const [isPrintingHistory, setIsPrintingHistory] = useState(false);

  // ── Search debounce ────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setWaitingPage(1);
      setHistoryPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  // ── Fetch waiting ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setWaitingLoading(true);
    getSurgeriesPaginated({
      search: debouncedSearch,
      region: waitingRegion,
      status: 'Scheduled',
      scheduledFrom: waitingFrom,
      scheduledTo: waitingTo,
      page: waitingPage,
      pageSize: PAGE_SIZE,
      sortAsc: true,
    })
      .then(({ data, total }) => {
        if (!cancelled) {
          setWaitingSurgeries(data);
          setWaitingTotal(total);
          setWaitingError('');
          setWaitingLoading(false);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setWaitingSurgeries([]);
          setWaitingTotal(0);
          setWaitingError(error instanceof Error ? error.message : 'Could not load surgeries');
          setWaitingLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [debouncedSearch, waitingRegion, waitingFrom, waitingTo, waitingPage, refreshKey]);

  // ── Fetch history ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);
    getSurgeriesPaginated({
      search: debouncedSearch,
      region: historyRegion,
      statuses: ['Completed', 'Cancelled', 'Postponed'],
      performedFrom: historyFrom,
      performedTo: historyTo,
      page: historyPage,
      pageSize: PAGE_SIZE,
      sortAsc: false,
    })
      .then(({ data, total }) => {
        if (!cancelled) {
          setHistorySurgeries(data);
          setHistoryTotal(total);
          setHistoryLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHistorySurgeries([]);
          setHistoryTotal(0);
          setHistoryLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [debouncedSearch, historyRegion, historyFrom, historyTo, historyPage, refreshKey]);

  // ── Print triggers ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (waitingPrintId === 0) return;
    printAfterRender();
  }, [waitingPrintId]);

  useEffect(() => {
    if (historyPrintId === 0) return;
    printAfterRender();
  }, [historyPrintId]);

  // ── Form helpers ───────────────────────────────────────────────────────────
  function set<K extends keyof SurgeryForm>(key: K, value: SurgeryForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openEdit(surgery: Surgery) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, createdAt: _ca, ...editable } = surgery;
    setEditing(surgery);
    setForm({
      ...editable,
      scheduledAt: toLocal(editable.scheduledAt),
      performedAt: toLocal(editable.performedAt),
      postOpVA:    editable.postOpVA ?? '',
    });
    setSaveError('');
    setShowForm(true);
  }

  async function save() {
    if (!editing) return;
    setSaveError('');
    const result = await actionUpdateSurgery(editing.id, form);
    if (!result.ok) {
      setSaveError(result.error);
      toast({ title: 'Surgery update failed', description: result.error, variant: 'error' });
      return;
    }
    toast({ title: 'Surgery updated', description: patientDisplayName(result.data.patientName, result.data.patientCode) });
    setShowForm(false);
    setEditing(null);
    setRefreshKey((k) => k + 1);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteTarget(null);
    setChangeRequestTarget({
      entity: 'Surgery',
      entityId: deleteTarget.id,
      entityLabel: patientDisplayName(deleteTarget.patientName, deleteTarget.patientCode),
      region: deleteTarget.region,
      campaignId: deleteTarget.campaignId,
    });
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    setIsRemoving(true);
    const result = await actionRemoveSurgeryPatient(removeTarget.id, removeReason, removeNotes);
    setIsRemoving(false);
    if (result.ok) {
      toast({ title: 'Patient removed from surgery queue', description: patientDisplayName(removeTarget.patientName, removeTarget.patientCode) });
      setWaitingSurgeries((rows) => rows.filter((r) => r.id !== removeTarget.id));
      setWaitingTotal((n) => Math.max(0, n - 1));
      setRemoveTarget(null);
    } else {
      toast({ title: 'Could not remove patient', description: result.error, variant: 'error' });
    }
  }

  async function submitPmRemoval() {
    if (!pmRemoveTarget) return;
    setIsPmRequesting(true);
    const reasonText = pmRemoveNotes.trim()
      ? `${pmRemoveReason} — ${pmRemoveNotes.trim()}`
      : pmRemoveReason;
    const result = await actionCreateChangeRequest({
      entity: 'Surgery',
      entityId: pmRemoveTarget.id,
      entityLabel: patientDisplayName(pmRemoveTarget.patientName, pmRemoveTarget.patientCode),
      requestType: 'archive',
      reason: reasonText,
      region: pmRemoveTarget.region,
      campaignId: pmRemoveTarget.campaignId,
    });
    setIsPmRequesting(false);
    if (result.ok) {
      toast({ title: 'Removal request submitted', description: 'Your Super Administrator will review and action this request.' });
      setPmRemoveTarget(null);
    } else {
      toast({ title: 'Could not submit request', description: result.error, variant: 'error' });
    }
  }

  // ── Print actions ──────────────────────────────────────────────────────────
  async function printWaiting() {
    setIsPrintingWaiting(true);
    setHistoryPrintRows(null);
    try {
      const result = await getPrintableWaitingSurgeries({
        search: debouncedSearch,
        region: waitingRegion,
        scheduledFrom: waitingFrom,
        scheduledTo: waitingTo,
      });
      setWaitingPrintRows(result.data);
      setWaitingPrintTotal(result.total);
      setWaitingPrintTrunc(result.truncated);
      setWaitingPrintLimit(result.limit);
      if (result.truncated) {
        toast({
          title: 'Print list limited',
          description: `Showing the first ${result.limit} records. Narrow the filters to print the full list.`,
          variant: 'info',
        });
      }
      setWaitingPrintId((id) => id + 1);
    } catch (error) {
      toast({ title: 'Could not prepare print list', description: error instanceof Error ? error.message : 'Please try again.', variant: 'error' });
    } finally {
      setIsPrintingWaiting(false);
    }
  }

  async function printHistory() {
    setIsPrintingHistory(true);
    setWaitingPrintRows(null);
    try {
      const result = await getPrintableHistorySurgeries({
        search: debouncedSearch,
        region: historyRegion,
        performedFrom: historyFrom,
        performedTo: historyTo,
      });
      setHistoryPrintRows(result.data);
      setHistoryPrintTotal(result.total);
      setHistoryPrintTrunc(result.truncated);
      setHistoryPrintLimit(result.limit);
      if (result.truncated) {
        toast({
          title: 'Print list limited',
          description: `Showing the first ${result.limit} records. Narrow the filters to print the full list.`,
          variant: 'info',
        });
      }
      setHistoryPrintId((id) => id + 1);
    } catch (error) {
      toast({ title: 'Could not prepare print list', description: error instanceof Error ? error.message : 'Please try again.', variant: 'error' });
    } finally {
      setIsPrintingHistory(false);
    }
  }

  const formInvalid = !form.patientId || !form.campaignId || !form.scheduledAt ||
    (form.status === 'Completed' && !form.performedAt);

  const waitingHasFilters = !!waitingRegion || !!waitingFrom || !!waitingTo;
  const historyHasFilters = !!historyRegion || !!historyFrom || !!historyTo;

  const printedAt = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-5">
      {/* ── Dialogs ──────────────────────────────────────────────────────────── */}
<ConfirmDialog
        open={!!deleteTarget}
        title="Surgery Record Protected"
        description={deleteTarget
          ? `Surgery records cannot be permanently deleted to prevent data loss. To request a change for ${patientDisplayName(deleteTarget.patientName, deleteTarget.patientCode)}, submit a change request for your Super Administrator to review.`
          : ''}
        confirmLabel="Submit Change Request"
        danger={false}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {changeRequestTarget && (
        <ChangeRequestDialog
          target={changeRequestTarget}
          onClose={() => setChangeRequestTarget(null)}
        />
      )}

      {removeTarget && (
        <RemoveSurgeryDialog
          surgery={removeTarget}
          reason={removeReason}
          notes={removeNotes}
          isSaving={isRemoving}
          onReasonChange={setRemoveReason}
          onNotesChange={setRemoveNotes}
          onConfirm={confirmRemove}
          onClose={() => setRemoveTarget(null)}
          mode="direct"
        />
      )}

      {pmRemoveTarget && (
        <RemoveSurgeryDialog
          surgery={pmRemoveTarget}
          reason={pmRemoveReason}
          notes={pmRemoveNotes}
          isSaving={isPmRequesting}
          onReasonChange={setPmRemoveReason}
          onNotesChange={setPmRemoveNotes}
          onConfirm={submitPmRemoval}
          onClose={() => setPmRemoveTarget(null)}
          mode="request"
        />
      )}

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setViewing(null)} />
          <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#141920]">{patientDisplayName(viewing.patientName, viewing.patientCode)}</h2>
                <p className="text-sm text-[#647184]">{viewing.region} · {viewing.operationDistrict}</p>
              </div>
              <button
                onClick={() => setViewing(null)}
                className="rounded-md p-1.5 text-[#647184] transition hover:bg-[#EAEEF3] hover:text-[#141920]"
                aria-label="Close surgery details"
              >
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <DetailValue label="Phone" value={viewing.patientPhone || '—'} />
              <DetailValue label="Emergency Phone" value={viewing.patientEmergencyPhone || '—'} />
              <DetailValue label="Status" value={viewing.status} />
              <DetailValue label="Scheduled" value={formatDateTime(viewing.scheduledAt)} />
              <DetailValue label="Performed" value={viewing.performedAt ? formatDateTime(viewing.performedAt) : '—'} />
              <DetailValue label="Surgeon" value={viewing.surgeonName || '—'} />
              <DetailValue label="Eye" value={viewing.eye} />
              <DetailValue label="Lens" value={viewing.lensType} />
              <DetailValue label="Pre-op VA" value={viewing.preOpVA || '—'} />
              <DetailValue label="Post-op VA" value={viewing.postOpVA || '—'} />
              <DetailValue label="Complications" value={viewing.complications || '—'} wide />
              <DetailValue label="Surgery Notes" value={viewing.intraopNotes || '—'} wide />
            </div>
            {viewing.screeningResult && (
              <div className="mt-4 rounded-lg border border-[#EAEEF3] bg-[#F8FAFC] p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#647184]">Screening Snapshot</p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <DetailValue label="Finding" value={screeningFindingLabel(viewing.screeningResult)} />
                  <DetailValue label="Recommendation" value={viewing.screeningResult.recommendation} />
                  <DetailValue label="Screened By" value={viewing.screeningResult.screenedByName || '—'} />
                  <DetailValue label="VA Right / Left" value={`${viewing.screeningResult.vaRightUnaided} / ${viewing.screeningResult.vaLeftUnaided}`} />
                  <DetailValue label="Screening Eye" value={viewing.screeningResult.eye} />
                  <DetailValue label="Medical History" value={viewing.screeningResult.medicalHistory || '—'} wide />
                  <DetailValue label="Current Medications" value={viewing.screeningResult.currentMedications || '—'} wide />
                  <DetailValue label="Screening Notes" value={viewing.screeningResult.notes || '—'} wide />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showForm && editing && (
        <ModalForm
          title={`Edit Surgery - ${patientDisplayName(editing.patientName, editing.patientCode)}`}
          subtitle={`${editing.region} · ${editing.operationDistrict}`}
          onClose={() => setShowForm(false)}
          onSave={save}
          saveLabel="Save Changes"
          saveDisabled={formInvalid}
          wide
        >
          {saveError && (
            <div className="mb-5 rounded-md border border-[#FACDCB] bg-[#FDECEB] px-3 py-2 text-sm text-[#E53935]">
              {saveError}
            </div>
          )}
          <SurgeryFormBody form={form} set={set} />
        </ModalForm>
      )}

      {/* ── Print views (hidden on-screen, revealed when printing) ───────────── */}
      {waitingPrintRows !== null && (
        <WaitingPrintView
          rows={waitingPrintRows}
          total={waitingPrintTotal}
          truncated={waitingPrintTrunc}
          limit={waitingPrintLimit}
          filters={{ region: waitingRegion, scheduledFrom: waitingFrom, scheduledTo: waitingTo }}
          printedAt={printedAt}
        />
      )}
      {historyPrintRows !== null && (
        <HistoryPrintView
          rows={historyPrintRows}
          total={historyPrintTotal}
          truncated={historyPrintTrunc}
          limit={historyPrintLimit}
          filters={{ region: historyRegion, performedFrom: historyFrom, performedTo: historyTo }}
          printedAt={printedAt}
        />
      )}

      {/* ── Main UI ──────────────────────────────────────────────────────────── */}
      <div className="space-y-5" data-print-hide="">

        {/* Page header + global search */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-auto">
            <h1 className="text-xl font-bold text-[#141920]">Surgeries</h1>
          </div>
          <div className="relative min-w-56 flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#647184]" size={13} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patient, doctor, or region..."
              className={`${F.input} pl-9`}
            />
          </div>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="flex items-center gap-1.5 rounded-md border border-[#DDE3EA] px-3 py-2 text-xs font-medium text-[#4B5666] transition hover:bg-[#F5F7FA]"
            >
              <X size={12} /> Clear search
            </button>
          )}
        </div>

        {/* ── Scheduled Surgery Queue ───────────────────────────────────────── */}
        <Card className="overflow-hidden border-0 shadow-sm">
          {/* Section header */}
          <div className="border-b border-[#EAEEF3] bg-white px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-[#141920]">Scheduled Surgery Queue</h2>
                <p className="mt-0.5 text-xs text-[#647184]">
                  {waitingLoading
                    ? 'Loading...'
                    : `${waitingTotal} patient${waitingTotal === 1 ? '' : 's'} waiting for surgery`}
                </p>
              </div>
              <button
                type="button"
                onClick={printWaiting}
                disabled={isPrintingWaiting}
                className="inline-flex items-center gap-2 rounded-md border border-[#DDE3EA] bg-white px-3 py-1.5 text-xs font-semibold text-[#4B5666] shadow-sm transition hover:bg-[#F5F7FA] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Printer size={13} /> {isPrintingWaiting ? 'Preparing...' : 'Print'}
              </button>
            </div>

            {/* Waiting filters */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {isSuperAdmin && (
                <Select
                  value={waitingRegion}
                  onValueChange={(v) => { setWaitingRegion(v ?? ''); setWaitingPage(1); }}
                >
                  <SelectTrigger className="h-8 w-44 text-xs rounded-md">
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
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[#647184]">Scheduled</span>
                <input
                  type="date"
                  value={waitingFrom}
                  onChange={(e) => { setWaitingFrom(e.target.value); setWaitingPage(1); }}
                  className={F.dateInput}
                />
                <span className="text-xs text-[#647184]">–</span>
                <input
                  type="date"
                  value={waitingTo}
                  onChange={(e) => { setWaitingTo(e.target.value); setWaitingPage(1); }}
                  className={F.dateInput}
                />
              </div>
              {waitingHasFilters && (
                <button
                  onClick={() => { setWaitingRegion(''); setWaitingFrom(''); setWaitingTo(''); setWaitingPage(1); }}
                  className="flex items-center gap-1 rounded-md border border-[#DDE3EA] px-2 py-1 text-xs font-medium text-[#4B5666] transition hover:bg-[#F5F7FA]"
                >
                  <X size={11} /> Clear
                </button>
              )}
            </div>
          </div>

          {waitingError && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#FACDCB] bg-[#FDECEB] px-4 py-3 text-sm text-[#8A1F1D]">
              <span className="flex min-w-0 items-center gap-2">
                <AlertTriangle size={15} className="shrink-0" />
                <span className="min-w-0">{waitingError}</span>
              </span>
              <button
                type="button"
                onClick={() => { setWaitingLoading(true); setWaitingError(''); setRefreshKey((k) => k + 1); }}
                className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-[#8A1F1D] shadow-sm transition hover:bg-[#FFF5F5]"
              >
                <RefreshCw size={12} /> Retry
              </button>
            </div>
          )}

          <CardContent className="p-0">
            <SurgeryTableBody
              rows={waitingSurgeries}
              isLoading={waitingLoading}
              emptyMessage={waitingHasFilters || !!debouncedSearch
                ? 'No scheduled surgeries match the current filters.'
                : 'No scheduled surgeries waiting.'}
              page={waitingPage}
              canEdit={can('surgeries', 'edit')}
              canDelete={can('surgeries', 'delete')}
              onView={setViewing}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
              onRemove={isSuperAdmin ? (s) => { setRemoveTarget(s); setRemoveReason(''); setRemoveNotes(''); } : undefined}
              onRequestRemoval={role === 'Project Manager' ? (s) => { setPmRemoveTarget(s); setPmRemoveReason(''); setPmRemoveNotes(''); } : undefined}
              compactScheduled
            />
          </CardContent>
        </Card>

        <Pagination page={waitingPage} pageSize={PAGE_SIZE} total={waitingTotal} onPageChange={setWaitingPage} />

        {/* ── Surgery History ───────────────────────────────────────────────── */}
        <Card className="overflow-hidden border-0 shadow-sm">
          {/* Collapsible header with print button */}
          <div className="border-b border-[#EAEEF3] bg-white">
            <div className="flex w-full items-center justify-between gap-3 px-4 py-3">
              <button
                type="button"
                onClick={() => setHistoryOpen((o) => !o)}
                className="flex flex-1 items-center gap-3 text-left"
              >
                <span>
                  <span className="block text-sm font-bold text-[#141920]">Surgery History</span>
                  <span className="mt-0.5 block text-xs text-[#647184]">
                    {historyLoading ? 'Loading...' : historySummary(historySurgeries)}
                  </span>
                </span>
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
                <span className="text-xs font-semibold text-[#4B5666]">
                  {historyTotal} record{historyTotal === 1 ? '' : 's'}
                </span>
                <button
                  type="button"
                  onClick={() => setHistoryOpen((o) => !o)}
                  className="rounded-md p-1 text-[#647184] transition hover:bg-[#EAEEF3]"
                >
                  {historyOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                </button>
              </div>
            </div>

            {/* History filters (visible when expanded) */}
            {historyOpen && (
              <div className="border-t border-[#EAEEF3] px-4 py-2.5 flex flex-wrap items-center gap-2">
                {isSuperAdmin && (
                  <Select
                    value={historyRegion}
                    onValueChange={(v) => { setHistoryRegion(v ?? ''); setHistoryPage(1); }}
                  >
                    <SelectTrigger className="h-8 w-44 text-xs rounded-md">
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
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-[#647184]">Performed</span>
                  <input
                    type="date"
                    value={historyFrom}
                    onChange={(e) => { setHistoryFrom(e.target.value); setHistoryPage(1); }}
                    className={F.dateInput}
                  />
                  <span className="text-xs text-[#647184]">–</span>
                  <input
                    type="date"
                    value={historyTo}
                    onChange={(e) => { setHistoryTo(e.target.value); setHistoryPage(1); }}
                    className={F.dateInput}
                  />
                </div>
                {historyHasFilters && (
                  <button
                    onClick={() => { setHistoryRegion(''); setHistoryFrom(''); setHistoryTo(''); setHistoryPage(1); }}
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
              <SurgeryTableBody
                rows={historySurgeries}
                isLoading={historyLoading}
                emptyMessage={historyHasFilters || !!debouncedSearch
                  ? 'No history surgeries match the current filters.'
                  : 'No completed, postponed, or cancelled surgeries yet.'}
                page={historyPage}
                canEdit={can('surgeries', 'edit')}
                canDelete={can('surgeries', 'delete')}
                onView={setViewing}
                onEdit={openEdit}
                onDelete={setDeleteTarget}
                compactHistory
              />
            </CardContent>
          )}
        </Card>

        {historyOpen && (
          <Pagination page={historyPage} pageSize={PAGE_SIZE} total={historyTotal} onPageChange={setHistoryPage} />
        )}
      </div>
    </div>
  );
}

// ─── Print views ───────────────────────────────────────────────────────────────

function WaitingPrintView({
  rows, total, truncated, limit, filters, printedAt,
}: {
  rows: Surgery[];
  total: number;
  truncated: boolean;
  limit: number;
  filters: { region: string; scheduledFrom: string; scheduledTo: string };
  printedAt: string;
}) {
  const regionLabel = filters.region || 'All regions';
  const dateLabel = filters.scheduledFrom || filters.scheduledTo
    ? `${filters.scheduledFrom ? formatDateShort(filters.scheduledFrom) : '…'} – ${filters.scheduledTo ? formatDateShort(filters.scheduledTo) : '…'}`
    : 'All dates';

  return (
    <section data-print-only="" className="print-report">
      <div className="print-report-header">
        <h1>Waiting Surgery List</h1>
        <p>
          Region: {regionLabel} | Scheduled: {dateLabel} | Printed: {printedAt} | {rows.length} of {total} patient{total === 1 ? '' : 's'}
          {truncated ? ` (limited to first ${limit} — narrow filters for full list)` : ''}
        </p>
      </div>
      <table>
        <thead>
          <tr>
            {['#', 'Patient Name', 'Phone', 'Region', 'Eye', 'Screening Finding', 'VA Pre-op R / L', 'Status'].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={8}>No scheduled surgeries match the selected filters.</td></tr>
          ) : rows.map((surgery, i) => (
            <tr key={surgery.id}>
              <td>{i + 1}</td>
              <td>{surgery.patientName || '-'}</td>
              <td>{surgery.patientPhone || '-'}</td>
              <td>{surgery.region}{surgery.operationDistrict ? ` / ${surgery.operationDistrict}` : ''}</td>
              <td>{surgery.eye || '-'}</td>
              <td>{surgeryFindingLabel(surgery)}</td>
              <td>{surgeryPreOpVA(surgery)}</td>
              <td>{surgery.status}</td>
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
  rows: Surgery[];
  total: number;
  truncated: boolean;
  limit: number;
  filters: { region: string; performedFrom: string; performedTo: string };
  printedAt: string;
}) {
  const regionLabel = filters.region || 'All regions';
  const dateLabel = filters.performedFrom || filters.performedTo
    ? `${filters.performedFrom ? formatDateShort(filters.performedFrom) : '…'} – ${filters.performedTo ? formatDateShort(filters.performedTo) : '…'}`
    : 'All dates';

  return (
    <section data-print-only="" className="print-report">
      <div className="print-report-header">
        <h1>Surgery History</h1>
        <p>
          Region: {regionLabel} | Performed: {dateLabel} | Printed: {printedAt} | {rows.length} of {total} record{total === 1 ? '' : 's'}
          {truncated ? ` (limited to first ${limit} — narrow filters for full list)` : ''}
        </p>
      </div>
      <table>
        <thead>
          <tr>
            {['#', 'Patient Name', 'Phone', 'Region', 'Eye', 'VA Pre-op R / L', 'VA Post-op', 'Status'].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={8}>No history surgeries match the selected filters.</td></tr>
          ) : rows.map((surgery, i) => (
            <tr key={surgery.id}>
              <td>{i + 1}</td>
              <td>{surgery.patientName || '-'}</td>
              <td>{surgery.patientPhone || '-'}</td>
              <td>{surgery.region}{surgery.operationDistrict ? ` / ${surgery.operationDistrict}` : ''}</td>
              <td>{surgery.eye || '-'}</td>
              <td>{surgeryPreOpVA(surgery)}</td>
              <td>{surgery.postOpVA || '-'}</td>
              <td>{surgery.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ─── Table body ────────────────────────────────────────────────────────────────

function SurgeryTableBody({
  rows,
  isLoading,
  emptyMessage,
  page,
  canEdit,
  canDelete,
  onView,
  onEdit,
  onDelete,
  onRemove,
  onRequestRemoval,
  compactScheduled = false,
  compactHistory = false,
}: {
  rows: Surgery[];
  isLoading: boolean;
  emptyMessage: string;
  page: number;
  canEdit: boolean;
  canDelete: boolean;
  onView: (surgery: Surgery) => void;
  onEdit: (surgery: Surgery) => void;
  onDelete: (surgery: Surgery) => void;
  onRemove?: (surgery: Surgery) => void;
  onRequestRemoval?: (surgery: Surgery) => void;
  compactScheduled?: boolean;
  compactHistory?: boolean;
}) {
  const headers = compactScheduled
    ? ['Patient', 'Phone', 'Region / City', 'Eye · Lens', 'Scheduled', 'Actions']
    : compactHistory
      ? ['Patient', 'Status', 'Region / City', 'Scheduled', 'Performed', 'Actions']
      : ['#', 'Patient', 'Phone', 'Region / City', 'Status', 'Eye · Lens', 'Scheduled', 'Performed', 'Surgeon', 'Notes', ''];

  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-sm ${compactScheduled ? 'min-w-0' : 'min-w-220'}`}>
        <thead className="border-b border-[#EAEEF3] bg-[#F5F7FA]">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#647184]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading && <TableSkeletonRows rows={8} columns={headers.length} />}
          {!isLoading && rows.length === 0 && (
            <tr><td colSpan={headers.length} className="py-12 text-center text-sm text-[#647184]">{emptyMessage}</td></tr>
          )}
          {!isLoading && rows.map((surgery, index) => (
            compactScheduled ? (
              <ScheduledSurgeryRow
                key={surgery.id}
                surgery={surgery}
                canEdit={canEdit}
                canDelete={canDelete}
                onView={onView}
                onEdit={onEdit}
                onDelete={onDelete}
                onRemove={onRemove}
                onRequestRemoval={onRequestRemoval}
              />
            ) : compactHistory ? (
              <HistorySurgeryRow
                key={surgery.id}
                surgery={surgery}
                canEdit={canEdit}
                canDelete={canDelete}
                onView={onView}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ) : (
              <SurgeryRow
                key={surgery.id}
                surgery={surgery}
                rowNumber={(page - 1) * PAGE_SIZE + index + 1}
                canEdit={canEdit}
                canDelete={canDelete}
                onView={onView}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            )
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScheduledSurgeryRow({
  surgery, canEdit, canDelete, onView, onEdit, onDelete, onRemove, onRequestRemoval,
}: {
  surgery: Surgery;
  canEdit: boolean;
  canDelete: boolean;
  onView: (surgery: Surgery) => void;
  onEdit: (surgery: Surgery) => void;
  onDelete: (surgery: Surgery) => void;
  onRemove?: (surgery: Surgery) => void;
  onRequestRemoval?: (surgery: Surgery) => void;
}) {
  return (
    <tr className="border-b border-[#EAEEF3] transition-colors hover:bg-[#F5F7FA]">
      <td className="px-4 py-3.5">
        <p className="font-medium text-[#141920]">{surgery.patientName}</p>
        <p className="font-mono text-xs text-[#647184]">{surgery.patientCode ?? 'No code'}</p>
      </td>
      <td className="px-4 py-3.5 text-[#4B5666]">
        {surgery.patientPhone ? (
          <a href={`tel:${surgery.patientPhone}`} className="inline-flex items-center gap-1 text-xs font-medium text-[#002E63] hover:text-[#2C9942]">
            <Phone size={12} /> {surgery.patientPhone}
          </a>
        ) : (
          <span className="text-xs text-[#647184]">-</span>
        )}
      </td>
      <td className="px-4 py-3.5">
        <p className="text-[#141920]">{surgery.region}</p>
        <p className="text-xs text-[#647184]">{surgery.operationDistrict}</p>
      </td>
      <td className="px-4 py-3.5 text-[#4B5666]">
        <p>{surgery.eye}</p>
        <p className="text-xs text-[#647184]">{surgery.lensType}</p>
      </td>
      <td className="px-4 py-3.5 text-xs text-[#4B5666]">{formatDateTime(surgery.scheduledAt)}</td>
      <td className="px-4 py-3.5">
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => onView(surgery)} className="rounded-md p-1.5 text-[#647184] transition hover:bg-[#EAEEF3] hover:text-[#002E63]" title="View details">
            <Eye size={13} />
          </button>
          {canEdit && (
            <button onClick={() => onEdit(surgery)} className="rounded-md p-1.5 text-[#647184] transition hover:bg-[#EBF7EE] hover:text-[#2C9942]" title="Edit surgery">
              <Pencil size={13} />
            </button>
          )}
          {canDelete && !onRemove && (
            <button onClick={() => onDelete(surgery)} className="rounded-md p-1.5 text-[#647184] transition hover:bg-[#FDECEB] hover:text-[#E53935]" title="Delete surgery">
              <Trash2 size={13} />
            </button>
          )}
          {onRemove && (
            <button onClick={() => onRemove(surgery)} className="rounded-md p-1.5 text-[#E53935] transition hover:bg-[#FDECEB]" title="Remove patient from surgery queue">
              <UserMinus size={13} />
            </button>
          )}
          {onRequestRemoval && (
            <button onClick={() => onRequestRemoval(surgery)} className="rounded-md p-1.5 text-[#647184] transition hover:bg-[#EAEEF3] hover:text-[#E53935]" title="Request removal of this patient">
              <UserMinus size={13} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function HistorySurgeryRow({
  surgery, canEdit, canDelete, onView, onEdit, onDelete,
}: {
  surgery: Surgery;
  canEdit: boolean;
  canDelete: boolean;
  onView: (surgery: Surgery) => void;
  onEdit: (surgery: Surgery) => void;
  onDelete: (surgery: Surgery) => void;
}) {
  return (
    <tr className="border-b border-[#EAEEF3] transition-colors hover:bg-[#F5F7FA]">
      <td className="px-4 py-3.5">
        <p className="font-medium text-[#141920]">{surgery.patientName}</p>
        <p className="font-mono text-xs text-[#647184]">{surgery.patientCode ?? 'No code'}</p>
      </td>
      <td className="px-4 py-3.5">
        <span className={`rounded px-2 py-1 text-xs font-medium ${STATUS_STYLE[surgery.status]}`}>
          {surgery.status}
        </span>
      </td>
      <td className="px-4 py-3.5">
        <p className="text-[#141920]">{surgery.region}</p>
        <p className="text-xs text-[#647184]">{surgery.operationDistrict}</p>
      </td>
      <td className="px-4 py-3.5 text-xs text-[#4B5666]">{formatDateTime(surgery.scheduledAt)}</td>
      <td className="px-4 py-3.5 text-xs text-[#4B5666]">{surgery.performedAt ? formatDateTime(surgery.performedAt) : '-'}</td>
      <td className="px-4 py-3.5">
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => onView(surgery)} className="rounded-md p-1.5 text-[#647184] transition hover:bg-[#EAEEF3] hover:text-[#002E63]" title="View details">
            <Eye size={13} />
          </button>
          {canEdit && (
            <button onClick={() => onEdit(surgery)} className="rounded-md p-1.5 text-[#647184] transition hover:bg-[#EBF7EE] hover:text-[#2C9942]" title="Edit surgery">
              <Pencil size={13} />
            </button>
          )}
          {canDelete && (
            <button onClick={() => onDelete(surgery)} className="rounded-md p-1.5 text-[#647184] transition hover:bg-[#FDECEB] hover:text-[#E53935]" title="Delete surgery">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function SurgeryRow({
  surgery, rowNumber, canEdit, canDelete, onView, onEdit, onDelete,
}: {
  surgery: Surgery;
  rowNumber: number;
  canEdit: boolean;
  canDelete: boolean;
  onView: (surgery: Surgery) => void;
  onEdit: (surgery: Surgery) => void;
  onDelete: (surgery: Surgery) => void;
}) {
  return (
    <tr className="border-b border-[#EAEEF3] transition-colors hover:bg-[#F5F7FA]">
      <td className="px-4 py-3.5 text-xs text-[#647184]">{rowNumber}</td>
      <td className="px-4 py-3.5">
        <p className="font-medium text-[#141920]">{surgery.patientName}</p>
        <p className="font-mono text-xs text-[#647184]">
          {surgery.patientCode ?? 'No code'}{surgery.completedByName ? ` - by ${surgery.completedByName}` : ''}
        </p>
      </td>
      <td className="px-4 py-3.5 text-[#4B5666]">
        {surgery.patientPhone ? (
          <a href={`tel:${surgery.patientPhone}`} className="inline-flex items-center gap-1 text-xs font-medium text-[#002E63] hover:text-[#2C9942]">
            <Phone size={12} /> {surgery.patientPhone}
          </a>
        ) : (
          <span className="text-xs text-[#647184]">-</span>
        )}
      </td>
      <td className="px-4 py-3.5">
        <p className="text-[#141920]">{surgery.region}</p>
        <p className="text-xs text-[#647184]">{surgery.operationDistrict}</p>
      </td>
      <td className="px-4 py-3.5">
        <span className={`rounded px-2 py-1 text-xs font-medium ${STATUS_STYLE[surgery.status]}`}>
          {surgery.status}
        </span>
      </td>
      <td className="px-4 py-3.5 text-[#4B5666]">
        <p>{surgery.eye}</p>
        <p className="text-xs text-[#647184]">{surgery.lensType}</p>
      </td>
      <td className="px-4 py-3.5 text-xs text-[#4B5666]">{formatDateTime(surgery.scheduledAt)}</td>
      <td className="px-4 py-3.5 text-xs text-[#4B5666]">{surgery.performedAt ? formatDateTime(surgery.performedAt) : '-'}</td>
      <td className="px-4 py-3.5 text-[#4B5666]">{surgery.surgeonName || '-'}</td>
      <td className="max-w-48 truncate px-4 py-3.5 text-xs text-[#4B5666]" title={surgery.intraopNotes || surgery.complications || undefined}>
        {surgery.intraopNotes || surgery.complications || '-'}
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-1">
          <button onClick={() => onView(surgery)} className="rounded-md p-1.5 text-[#647184] transition hover:bg-[#EAEEF3] hover:text-[#002E63]" title="View details">
            <Eye size={13} />
          </button>
          {canEdit && (
            <button onClick={() => onEdit(surgery)} className="rounded-md p-1.5 text-[#647184] transition hover:bg-[#EBF7EE] hover:text-[#2C9942]" title="Edit surgery">
              <Pencil size={13} />
            </button>
          )}
          {canDelete && (
            <button onClick={() => onDelete(surgery)} className="rounded-md p-1.5 text-[#647184] transition hover:bg-[#FDECEB] hover:text-[#E53935]" title="Delete surgery">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function DetailValue({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'md:col-span-3' : ''}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#647184]">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-[#141920]">{value}</p>
    </div>
  );
}

// ─── Surgery edit form ─────────────────────────────────────────────────────────

function SurgeryFormBody({
  form, set,
}: {
  form: SurgeryForm;
  set: <K extends keyof SurgeryForm>(key: K, value: SurgeryForm[K]) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4">
      <section className="rounded-lg border border-[#EAEEF3] bg-white p-3">
        <p className={`${F.label} mb-3`}>Patient</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className={F.label}>Patient Name</label>
            <input value={patientDisplayName(form.patientName, form.patientCode)} disabled className={F.input} />
          </div>
          <div>
            <label className={F.label}>Region</label>
            <input value={form.region} disabled className={F.input} />
          </div>
          <div>
            <label className={F.label}>Operation City</label>
            <input value={form.operationDistrict} disabled className={F.input} />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-[#EAEEF3] bg-white p-3">
        <p className={`${F.label} mb-3`}>Surgery Details</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className={F.label}>Surgeon / Doctor Name</label>
            <input value={form.surgeonName} disabled placeholder="Assigned doctor from sub-region" className={F.input} />
          </div>
          <div>
            <label className={F.label}>Eye</label>
            <input value={form.eye} disabled className={F.input} />
          </div>
          <div>
            <label className={F.label}>Lens Type</label>
            <Select value={form.lensType} onValueChange={(v) => { if (v) set('lensType', v as LensType); }}>
              <SelectTrigger className={F.sel}><SelectValue /></SelectTrigger>
              <SelectContent>{LENSES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-[#EAEEF3] bg-white p-3">
        <p className={`${F.label} mb-3`}>Schedule & Status</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className={F.label}>Scheduled Date & Time *</label>
            <input type="datetime-local" value={form.scheduledAt} onChange={(e) => set('scheduledAt', e.target.value)} className={F.input} />
          </div>
          <div>
            <label className={F.label}>Actual Surgery Date & Time</label>
            <input type="datetime-local" value={form.performedAt ?? ''} onChange={(e) => set('performedAt', e.target.value)} className={F.input} />
          </div>
          <div>
            <label className={F.label}>Status</label>
            <Select value={form.status} onValueChange={(v) => { if (v) set('status', v as SurgeryStatus); }}>
              <SelectTrigger className={F.sel}><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {form.screeningResult && (
        <section className="rounded-lg border border-[#EAEEF3] bg-[#F8FAFC] p-3">
          <p className={`${F.label} mb-3`}>Previous Screening Result</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ReadOnlyValue label="Screened At" value={formatDateTime(form.screeningResult.screenedAt)} />
            <ReadOnlyValue label="Screened By" value={form.screeningResult.screenedByName || '—'} />
            <ReadOnlyValue label="Finding" value={screeningFindingLabel(form.screeningResult)} />
            <ReadOnlyValue label="Eye" value={form.screeningResult.eye} />
            <ReadOnlyValue label="VA Right / Left" value={`${form.screeningResult.vaRightUnaided} / ${form.screeningResult.vaLeftUnaided}`} />
            <ReadOnlyValue label="Recommendation" value={form.screeningResult.recommendation} />
            <ReadOnlyValue label="Other Findings" value={form.screeningResult.otherFindings || '—'} wide />
            <ReadOnlyValue label="Medical History" value={form.screeningResult.medicalHistory || '—'} wide />
            <ReadOnlyValue label="Current Medications" value={form.screeningResult.currentMedications || '—'} wide />
            <ReadOnlyValue label="Screening Notes" value={form.screeningResult.notes || '—'} wide />
          </div>
        </section>
      )}

      <section className="rounded-lg border border-[#EAEEF3] bg-white p-3">
        <p className={`${F.label} mb-3`}>Clinical</p>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className={F.label}>Complications</label>
            <input value={form.complications} onChange={(e) => set('complications', e.target.value)} placeholder="e.g. Posterior capsule rupture, None" className={F.input} />
          </div>
          <div>
            <label className={F.label}>Intraoperative Notes</label>
            <input value={form.intraopNotes} onChange={(e) => set('intraopNotes', e.target.value)} placeholder="Any additional intraoperative observations..." className={F.input} />
          </div>
        </div>
      </section>
    </div>
  );
}

function ReadOnlyValue({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'md:col-span-2 xl:col-span-2' : undefined}>
      <p className={F.label}>{label}</p>
      <p className="min-h-10 break-words rounded-md border border-[#DDE3EA] bg-white px-3 py-2 text-sm text-[#4B5666]">
        {value}
      </p>
    </div>
  );
}

// ─── Remove Surgery Dialog ─────────────────────────────────────────────────────

function RemoveSurgeryDialog({
  surgery, reason, notes, isSaving, onReasonChange, onNotesChange, onConfirm, onClose, mode,
}: {
  surgery: Surgery;
  reason: string;
  notes: string;
  isSaving: boolean;
  onReasonChange: (v: string) => void;
  onNotesChange: (v: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  mode: 'direct' | 'request';
}) {
  const canSubmit = !!reason && !isSaving;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#141920]">
              {mode === 'direct' ? 'Remove Patient from Surgery Queue' : 'Request Patient Removal'}
            </h2>
            <p className="mt-0.5 text-sm text-[#647184]">
              {patientDisplayName(surgery.patientName, surgery.patientCode)}
              {' · '}Scheduled {new Date(surgery.scheduledAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-[#647184] transition hover:bg-[#EAEEF3]">
            <X size={15} />
          </button>
        </div>

        {mode === 'request' && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
            This request will be sent to your Super Administrator for review. The patient will remain in the queue until it is approved.
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#647184]">
              Reason <span className="text-[#E53935]">*</span>
            </label>
            <div className="space-y-2">
              {REMOVAL_REASONS.map((r) => (
                <label
                  key={r}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                    reason === r ? 'border-[#E53935] bg-[#FDECEB]' : 'border-[#DDE3EA] hover:bg-[#F5F7FA]'
                  }`}
                >
                  <input
                    type="radio"
                    name="removeReason"
                    value={r}
                    checked={reason === r}
                    onChange={() => onReasonChange(r)}
                    className="accent-[#E53935]"
                  />
                  <span className="text-sm text-[#141920]">{r}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#647184]">
              Additional notes <span className="text-[#94A0AE]">(optional)</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="Any additional context..."
              className="w-full rounded-md border border-[#DDE3EA] bg-white px-3 py-2 text-sm text-[#141920] placeholder:text-[#647184] outline-none transition focus:border-[#2C9942] focus:ring-2 focus:ring-[#2C9942]/10"
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-[#DDE3EA] px-4 py-2 text-sm font-medium text-[#4B5666] transition hover:bg-[#F5F7FA]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!canSubmit}
            className={`rounded-md px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
              mode === 'direct'
                ? 'bg-[#E53935] hover:bg-[#C62828]'
                : 'bg-[#1A7A46] hover:bg-[#0F4D2A]'
            }`}
          >
            {isSaving
              ? mode === 'direct' ? 'Removing...' : 'Submitting...'
              : mode === 'direct' ? 'Remove Patient' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  );
}
