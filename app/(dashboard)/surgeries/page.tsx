'use client';

import { useEffect, useState } from 'react';
import type { LensType, Surgery, SurgeryStatus } from '@/types';
import { actionDeleteSurgery, actionUpdateSurgery, getSurgeriesPaginated } from '@/app/actions/surgeries';
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
import { CheckCircle, ChevronDown, ChevronRight, Eye, Pencil, Phone, Search, Trash2, X } from 'lucide-react';

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

// Shared field styles
const F = {
  label: 'block text-[11px] font-semibold uppercase tracking-wide text-[#647184] mb-1.5',
  input: 'w-full rounded-md border border-[#DDE3EA] bg-white px-3 py-2 text-sm text-[#141920] placeholder:text-[#647184] outline-none transition focus:border-[#2C9942] focus:ring-2 focus:ring-[#2C9942]/10 disabled:bg-[#EAEEF3] disabled:text-[#647184]',
  sel:   'w-full rounded-md',
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

function sortScheduledQueue(surgeries: Surgery[]) {
  return [...surgeries].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
}

function sortHistory(surgeries: Surgery[]) {
  return [...surgeries].sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
}

function historySummary(surgeries: Surgery[]) {
  const completed = surgeries.filter((surgery) => surgery.status === 'Completed').length;
  const postponed = surgeries.filter((surgery) => surgery.status === 'Postponed').length;
  const cancelled = surgeries.filter((surgery) => surgery.status === 'Cancelled').length;
  return `${completed} completed, ${postponed} postponed, ${cancelled} cancelled`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SurgeriesPage() {
  const { can, role } = usePermissions();
  const isSuperAdmin  = role === 'Super Administrator';

  const [surgeries,      setSurgeries]      = useState<Surgery[]>([]);
  const [total,          setTotal]          = useState(0);
  const [page,           setPage]           = useState(1);
  const [form,           setForm]           = useState<SurgeryForm>(BLANK);
  const [editing,        setEditing]        = useState<Surgery | null>(null);
  const [showForm,       setShowForm]       = useState(false);
  const [saveError,      setSaveError]      = useState('');
  const [search,         setSearch]         = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter,   setStatusFilter]   = useState('');
  const [regionFilter,   setRegionFilter]   = useState('');
  const [isLoading,      setIsLoading]      = useState(true);
  const [deleteTarget,   setDeleteTarget]   = useState<Surgery | null>(null);
  const [completeTarget, setCompleteTarget] = useState<Surgery | null>(null);
  const [viewing,        setViewing]        = useState<Surgery | null>(null);
  const [historyOpen,    setHistoryOpen]    = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    getSurgeriesPaginated({ search: debouncedSearch, region: regionFilter, status: statusFilter, page, pageSize: PAGE_SIZE })
      .then(({ data, total: t }) => {
        if (!cancelled) { setSurgeries(data); setTotal(t); setIsLoading(false); }
      })
      .catch(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [debouncedSearch, regionFilter, statusFilter, page]);

  const hasFilters = !!search || !!statusFilter || !!regionFilter;

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

  // ── Save edit ──────────────────────────────────────────────────────────────

  async function save() {
    if (!editing) return;
    setSaveError('');
    const result = await actionUpdateSurgery(editing.id, form);
    if (!result.ok) {
      setSaveError(result.error);
      toast({ title: 'Surgery update failed', description: result.error, variant: 'error' });
      return;
    }
    setSurgeries((rows) => rows.map((r) => r.id === editing.id ? result.data : r));
    toast({ title: 'Surgery updated', description: patientDisplayName(result.data.patientName, result.data.patientCode) });
    setShowForm(false);
    setEditing(null);
  }

  // ── Quick complete ─────────────────────────────────────────────────────────

  async function confirmComplete() {
    if (!completeTarget) return;
    const result = await actionUpdateSurgery(completeTarget.id, {
      ...completeTarget,
      status:      'Completed',
      performedAt: completeTarget.performedAt ?? nowLocal(),
    });
    if (result.ok) {
      setSurgeries((rows) => rows.map((r) => r.id === completeTarget.id ? result.data : r));
      toast({ title: 'Surgery completed', description: patientDisplayName(result.data.patientName, result.data.patientCode) });
    } else {
      toast({ title: 'Could not complete surgery', description: result.error, variant: 'error' });
    }
    setCompleteTarget(null);
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function confirmDelete() {
    if (!deleteTarget) return;
    const result = await actionDeleteSurgery(deleteTarget.id);
    if (result.ok) {
      const deletedName = patientDisplayName(deleteTarget.patientName, deleteTarget.patientCode);
      const remaining = surgeries.filter((r) => r.id !== deleteTarget.id);
      setTotal((t) => t - 1);
      if (remaining.length === 0 && page > 1) {
        setPage((p) => p - 1);
      } else {
        setSurgeries(remaining);
      }
      toast({ title: 'Surgery deleted', description: deletedName });
    } else {
      toast({ title: 'Surgery delete failed', description: result.error, variant: 'error' });
    }
    setDeleteTarget(null);
  }

  const formInvalid = !form.patientId || !form.campaignId || !form.scheduledAt ||
    (form.status === 'Completed' && !form.performedAt);
  const filteredMode = !!statusFilter;
  const scheduledSurgeries = sortScheduledQueue(surgeries.filter((surgery) => surgery.status === 'Scheduled'));
  const otherSurgeries = sortHistory(surgeries.filter((surgery) => surgery.status !== 'Scheduled'));
  const visibleSurgeries = filteredMode ? sortHistory(surgeries) : scheduledSurgeries;

  return (
    <div className="space-y-5">
      {/* Confirm: mark complete */}
      <ConfirmDialog
        open={!!completeTarget}
        title="Mark Surgery as Completed"
        description={completeTarget
          ? `Mark "${patientDisplayName(completeTarget.patientName, completeTarget.patientCode)}"'s surgery as completed? This will automatically create Day 1 and Week 1 follow-up records.`
          : ''}
        confirmLabel="Mark Completed"
        danger={false}
        onConfirm={confirmComplete}
        onCancel={() => setCompleteTarget(null)}
      />

      {/* Confirm: delete */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Surgery Record"
        description={deleteTarget
          ? `Permanently delete the surgery record for "${patientDisplayName(deleteTarget.patientName, deleteTarget.patientCode)}"? All associated follow-up records will also be deleted. This cannot be undone.`
          : ''}
        confirmLabel="Delete Surgery"
        confirmationText="DELETE"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

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
                  <DetailValue label="IOP Right / Left" value={`${viewing.screeningResult.iopRight ?? '—'} / ${viewing.screeningResult.iopLeft ?? '—'}`} />
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

      {/* Edit modal */}
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

      {/* Page header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#141920]">Surgeries</h1>
          <p className="text-sm text-[#4B5666]">
            {isLoading ? 'Loading…' : `${total} ${total === 1 ? 'surgery' : 'surgeries'}`}
          </p>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#647184]" size={13} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patient, doctor, or region..."
            className={`${F.input} pl-9`}
          />
        </div>

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v ?? ''); setPage(1); }}>
          <SelectTrigger className="w-52 rounded-md">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

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

        {hasFilters && (
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); setRegionFilter(''); setPage(1); }}
            className="flex items-center gap-1.5 rounded-md border border-[#DDE3EA] px-3 py-2 text-xs font-medium text-[#4B5666] transition hover:bg-[#F5F7FA]"
          >
            <X size={12} /> Clear
          </button>
        )}

        <span className="ml-auto shrink-0 text-sm text-[#647184]">
          {total} {total === 1 ? 'surgery' : 'surgeries'}
        </span>
      </div>

      {filteredMode ? (
        <SurgeryTable
          title={`${statusFilter} Surgeries`}
          subtitle={`${visibleSurgeries.length} matching ${statusFilter.toLowerCase()} record${visibleSurgeries.length === 1 ? '' : 's'}`}
          rows={visibleSurgeries}
          isLoading={isLoading}
          emptyMessage={hasFilters ? 'No surgeries match the current filters.' : 'No surgery records yet.'}
          page={page}
          canEdit={can('surgeries', 'edit')}
          canDelete={can('surgeries', 'delete')}
          onView={setViewing}
          onComplete={setCompleteTarget}
          onEdit={openEdit}
          onDelete={setDeleteTarget}
          compactScheduled
        />
      ) : (
        <>
          <SurgeryTable
            title="Scheduled Surgery Queue"
            subtitle="Patients waiting for surgery, sorted by nearest scheduled time"
            rows={scheduledSurgeries}
            isLoading={isLoading}
            emptyMessage={hasFilters ? 'No scheduled surgeries match the current filters.' : 'No scheduled surgeries waiting.'}
            page={page}
            canEdit={can('surgeries', 'edit')}
            canDelete={can('surgeries', 'delete')}
          onView={setViewing}
          onComplete={setCompleteTarget}
          onEdit={openEdit}
          onDelete={setDeleteTarget}
          compactScheduled
        />

          <Card className="overflow-hidden border-0 shadow-sm">
            <button
              type="button"
              onClick={() => setHistoryOpen((open) => !open)}
              className="flex w-full items-center justify-between gap-3 border-b border-[#EAEEF3] bg-white px-4 py-3 text-left transition hover:bg-[#F8FAFC]"
            >
              <span>
                <span className="block text-sm font-bold text-[#141920]">Other Surgeries</span>
                <span className="mt-0.5 block text-xs text-[#647184]">{historySummary(otherSurgeries)}</span>
              </span>
              <span className="flex items-center gap-2 text-xs font-semibold text-[#4B5666]">
                {otherSurgeries.length} record{otherSurgeries.length === 1 ? '' : 's'}
                {historyOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              </span>
            </button>
            {historyOpen && (
              <CardContent className="p-0">
                <SurgeryTableBody
                  rows={otherSurgeries}
                  isLoading={false}
                  emptyMessage="No completed, postponed, or cancelled surgeries on this page."
                  page={page}
                  canEdit={can('surgeries', 'edit')}
                  canDelete={can('surgeries', 'delete')}
                  onView={setViewing}
                  onComplete={setCompleteTarget}
                  onEdit={openEdit}
                  onDelete={setDeleteTarget}
                  compactHistory
                />
              </CardContent>
            )}
          </Card>
        </>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
    </div>
  );
}

function SurgeryTable({
  title,
  subtitle,
  rows,
  isLoading,
  emptyMessage,
  page,
  canEdit,
  canDelete,
  onView,
  onComplete,
  onEdit,
  onDelete,
  compactScheduled = false,
}: {
  title: string;
  subtitle: string;
  rows: Surgery[];
  isLoading: boolean;
  emptyMessage: string;
  page: number;
  canEdit: boolean;
  canDelete: boolean;
  onView: (surgery: Surgery) => void;
  onComplete: (surgery: Surgery) => void;
  onEdit: (surgery: Surgery) => void;
  onDelete: (surgery: Surgery) => void;
  compactScheduled?: boolean;
}) {
  return (
    <Card className="overflow-hidden border-0 shadow-sm">
      <div className="border-b border-[#EAEEF3] bg-white px-4 py-3">
        <h2 className="text-sm font-bold text-[#141920]">{title}</h2>
        <p className="mt-0.5 text-xs text-[#647184]">{subtitle}</p>
      </div>
      <CardContent className="p-0">
        <SurgeryTableBody
          rows={rows}
          isLoading={isLoading}
          emptyMessage={emptyMessage}
          page={page}
          canEdit={canEdit}
          canDelete={canDelete}
          onView={onView}
          onComplete={onComplete}
          onEdit={onEdit}
          onDelete={onDelete}
          compactScheduled={compactScheduled}
        />
      </CardContent>
    </Card>
  );
}

function SurgeryTableBody({
  rows,
  isLoading,
  emptyMessage,
  page,
  canEdit,
  canDelete,
  onView,
  onComplete,
  onEdit,
  onDelete,
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
  onComplete: (surgery: Surgery) => void;
  onEdit: (surgery: Surgery) => void;
  onDelete: (surgery: Surgery) => void;
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
                onComplete={onComplete}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ) : compactHistory ? (
              <HistorySurgeryRow
                key={surgery.id}
                surgery={surgery}
                canEdit={canEdit}
                canDelete={canDelete}
                onView={onView}
                onComplete={onComplete}
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
                onComplete={onComplete}
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
  surgery,
  canEdit,
  canDelete,
  onView,
  onComplete,
  onEdit,
  onDelete,
}: {
  surgery: Surgery;
  canEdit: boolean;
  canDelete: boolean;
  onView: (surgery: Surgery) => void;
  onComplete: (surgery: Surgery) => void;
  onEdit: (surgery: Surgery) => void;
  onDelete: (surgery: Surgery) => void;
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
          <button
            onClick={() => onView(surgery)}
            className="rounded-md p-1.5 text-[#647184] transition hover:bg-[#EAEEF3] hover:text-[#002E63]"
            title="View patient and surgery details"
          >
            <Eye size={13} />
          </button>
          {canEdit && (
            <button
              onClick={() => onComplete(surgery)}
              className="flex items-center gap-1 rounded-md bg-[#EBF7EE] px-2 py-1 text-xs font-medium text-[#2C9942] transition hover:bg-[#A6DCB5]"
            >
              <CheckCircle size={11} /> Complete
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => onEdit(surgery)}
              className="rounded-md p-1.5 text-[#647184] transition hover:bg-[#EBF7EE] hover:text-[#2C9942]"
              title="Edit surgery"
            >
              <Pencil size={13} />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(surgery)}
              className="rounded-md p-1.5 text-[#647184] transition hover:bg-[#FDECEB] hover:text-[#E53935]"
              title="Delete surgery"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function HistorySurgeryRow({
  surgery,
  canEdit,
  canDelete,
  onView,
  onComplete,
  onEdit,
  onDelete,
}: {
  surgery: Surgery;
  canEdit: boolean;
  canDelete: boolean;
  onView: (surgery: Surgery) => void;
  onComplete: (surgery: Surgery) => void;
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
          <button
            onClick={() => onView(surgery)}
            className="rounded-md p-1.5 text-[#647184] transition hover:bg-[#EAEEF3] hover:text-[#002E63]"
            title="View patient and surgery details"
          >
            <Eye size={13} />
          </button>
          {surgery.status !== 'Completed' && canEdit && (
            <button
              onClick={() => onComplete(surgery)}
              className="flex items-center gap-1 rounded-md bg-[#EBF7EE] px-2 py-1 text-xs font-medium text-[#2C9942] transition hover:bg-[#A6DCB5]"
            >
              <CheckCircle size={11} /> Complete
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => onEdit(surgery)}
              className="rounded-md p-1.5 text-[#647184] transition hover:bg-[#EBF7EE] hover:text-[#2C9942]"
              title="Edit surgery"
            >
              <Pencil size={13} />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(surgery)}
              className="rounded-md p-1.5 text-[#647184] transition hover:bg-[#FDECEB] hover:text-[#E53935]"
              title="Delete surgery"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function SurgeryRow({
  surgery,
  rowNumber,
  canEdit,
  canDelete,
  onView,
  onComplete,
  onEdit,
  onDelete,
}: {
  surgery: Surgery;
  rowNumber: number;
  canEdit: boolean;
  canDelete: boolean;
  onView: (surgery: Surgery) => void;
  onComplete: (surgery: Surgery) => void;
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
          <button
            onClick={() => onView(surgery)}
            className="rounded-md p-1.5 text-[#647184] transition hover:bg-[#EAEEF3] hover:text-[#002E63]"
            title="View patient and surgery details"
          >
            <Eye size={13} />
          </button>
          {surgery.status !== 'Completed' && canEdit && (
            <button
              onClick={() => onComplete(surgery)}
              className="flex items-center gap-1 rounded-md bg-[#EBF7EE] px-2 py-1 text-xs font-medium text-[#2C9942] transition hover:bg-[#A6DCB5]"
            >
              <CheckCircle size={11} /> Complete
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => onEdit(surgery)}
              className="rounded-md p-1.5 text-[#647184] transition hover:bg-[#EBF7EE] hover:text-[#2C9942]"
              title="Edit surgery"
            >
              <Pencil size={13} />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(surgery)}
              className="rounded-md p-1.5 text-[#647184] transition hover:bg-[#FDECEB] hover:text-[#E53935]"
              title="Delete surgery"
            >
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

// ─── Surgery edit form ────────────────────────────────────────────────────────

function SurgeryFormBody({
  form, set,
}: {
  form: SurgeryForm;
  set: <K extends keyof SurgeryForm>(key: K, value: SurgeryForm[K]) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4">
      {/* Section 1: Patient (locked) */}
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

      {/* Section 2: Surgery Details */}
      <section className="rounded-lg border border-[#EAEEF3] bg-white p-3">
        <p className={`${F.label} mb-3`}>Surgery Details</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className={F.label}>Surgeon / Doctor Name</label>
            <input
              value={form.surgeonName}
              disabled
              placeholder="Assigned doctor from sub-region"
              className={F.input}
            />
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

      {/* Section 3: Schedule & Status */}
      <section className="rounded-lg border border-[#EAEEF3] bg-white p-3">
        <p className={`${F.label} mb-3`}>Schedule & Status</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className={F.label}>Scheduled Date & Time *</label>
            <input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(e) => set('scheduledAt', e.target.value)}
              className={F.input}
            />
          </div>
          <div>
            <label className={F.label}>Actual Surgery Date & Time</label>
            <input
              type="datetime-local"
              value={form.performedAt ?? ''}
              onChange={(e) => set('performedAt', e.target.value)}
              className={F.input}
            />
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
            <ReadOnlyValue label="IOP Right / Left" value={`${form.screeningResult.iopRight ?? '—'} / ${form.screeningResult.iopLeft ?? '—'}`} />
            <ReadOnlyValue label="Recommendation" value={form.screeningResult.recommendation} />
            <ReadOnlyValue label="Other Findings" value={form.screeningResult.otherFindings || '—'} wide />
            <ReadOnlyValue label="Medical History" value={form.screeningResult.medicalHistory || '—'} wide />
            <ReadOnlyValue label="Current Medications" value={form.screeningResult.currentMedications || '—'} wide />
            <ReadOnlyValue label="Screening Notes" value={form.screeningResult.notes || '—'} wide />
          </div>
        </section>
      )}

      {/* Section 4: Clinical */}
      <section className="rounded-lg border border-[#EAEEF3] bg-white p-3">
        <p className={`${F.label} mb-3`}>Clinical</p>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className={F.label}>Complications</label>
            <input
              value={form.complications}
              onChange={(e) => set('complications', e.target.value)}
              placeholder="e.g. Posterior capsule rupture, None"
              className={F.input}
            />
          </div>
          <div>
            <label className={F.label}>Intraoperative Notes</label>
            <input
              value={form.intraopNotes}
              onChange={(e) => set('intraopNotes', e.target.value)}
              placeholder="Any additional intraoperative observations..."
              className={F.input}
            />
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
