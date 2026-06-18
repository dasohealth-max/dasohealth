'use client';

import { useEffect, useState } from 'react';
import type { LensType, Surgery, SurgeryEye, SurgeryStatus } from '@/types';
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
import { CheckCircle, Pencil, Search, Trash2, X } from 'lucide-react';

const PAGE_SIZE = 50;

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUSES: SurgeryStatus[] = ['Scheduled', 'Completed', 'Cancelled', 'Postponed'];
const EYES: SurgeryEye[]        = ['Right', 'Left', 'Both'];
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
  sel:   'rounded-md',
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

  return (
    <div className="space-y-5">
      {/* Confirm: mark complete */}
      <ConfirmDialog
        open={!!completeTarget}
        title="Mark Surgery as Completed"
        description={completeTarget
          ? `Mark "${patientDisplayName(completeTarget.patientName, completeTarget.patientCode)}"'s surgery as completed? This will automatically create Day 1, Week 1, and Month 1 follow-up records.`
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

      {/* Edit modal */}
      {showForm && editing && (
        <ModalForm
          title={`Edit Surgery - ${patientDisplayName(editing.patientName, editing.patientCode)}`}
          subtitle={`${editing.region} · ${editing.operationDistrict}`}
          onClose={() => setShowForm(false)}
          onSave={save}
          saveLabel="Save Changes"
          saveDisabled={formInvalid}
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

      {/* Table */}
      <Card className="overflow-hidden border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-200 text-sm">
              <thead className="border-b border-[#EAEEF3] bg-[#F5F7FA]">
                <tr>
                  {['#', 'Patient', 'Region / City', 'Status', 'Eye · Lens', 'Scheduled', 'Performed', 'Surgeon', 'Notes', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#647184]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <TableSkeletonRows rows={8} columns={10} />
                )}
                {!isLoading && surgeries.length === 0 && (
                  <tr><td colSpan={10} className="py-12 text-center text-sm text-[#647184]">
                    {hasFilters ? 'No surgeries match the current filters.' : 'No surgery records yet.'}
                  </td></tr>
                )}
                {!isLoading && surgeries.map((surgery, index) => (
                  <tr key={surgery.id} className="border-b border-[#EAEEF3] transition-colors hover:bg-[#F5F7FA]">
                    <td className="px-4 py-3.5 text-xs text-[#647184]">{(page - 1) * PAGE_SIZE + index + 1}</td>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-[#141920]">{surgery.patientName}</p>
                      <p className="font-mono text-xs text-[#647184]">
                        {surgery.patientCode ?? 'No code'}{surgery.completedByName ? ` - by ${surgery.completedByName}` : ''}
                      </p>
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
                    <td className="px-4 py-3.5 text-xs text-[#4B5666]">{surgery.performedAt ? formatDateTime(surgery.performedAt) : '—'}</td>
                    <td className="px-4 py-3.5 text-[#4B5666]">{surgery.surgeonName || '—'}</td>
                    <td className="max-w-48 truncate px-4 py-3.5 text-xs text-[#4B5666]" title={surgery.intraopNotes || surgery.complications || undefined}>
                      {surgery.intraopNotes || surgery.complications || '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1">
                        {surgery.status !== 'Completed' && can('surgeries', 'edit') && (
                          <button
                            onClick={() => setCompleteTarget(surgery)}
                            className="flex items-center gap-1 rounded-md bg-[#EBF7EE] px-2 py-1 text-xs font-medium text-[#2C9942] transition hover:bg-[#A6DCB5]"
                          >
                            <CheckCircle size={11} /> Complete
                          </button>
                        )}
                        {can('surgeries', 'edit') && (
                          <button
                            onClick={() => openEdit(surgery)}
                            className="rounded-md p-1.5 text-[#647184] transition hover:bg-[#EBF7EE] hover:text-[#2C9942]"
                          >
                            <Pencil size={13} />
                          </button>
                        )}
                        {can('surgeries', 'delete') && (
                          <button
                            onClick={() => setDeleteTarget(surgery)}
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

// ─── Surgery edit form ────────────────────────────────────────────────────────

function SurgeryFormBody({
  form, set,
}: {
  form: SurgeryForm;
  set: <K extends keyof SurgeryForm>(key: K, value: SurgeryForm[K]) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Section 1: Patient (locked) */}
      <section>
        <p className={`${F.label} mb-3`}>Patient</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-1">
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
      <section>
        <p className={`${F.label} mb-3`}>Surgery Details</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="col-span-2">
            <label className={F.label}>Surgeon / Doctor Name</label>
            <input
              value={form.surgeonName}
              onChange={(e) => set('surgeonName', e.target.value)}
              placeholder="e.g. Dr. Ali Hassan"
              className={F.input}
            />
          </div>
          <div>
            <label className={F.label}>Eye</label>
            <Select value={form.eye} onValueChange={(v) => { if (v) set('eye', v as SurgeryEye); }}>
              <SelectTrigger className={F.sel}><SelectValue /></SelectTrigger>
              <SelectContent>{EYES.map((e) => <SelectItem key={e} value={e}>{e} Eye</SelectItem>)}</SelectContent>
            </Select>
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
      <section>
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

      {/* Section 4: Clinical */}
      <section>
        <p className={`${F.label} mb-3`}>Clinical</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={F.label}>Pre-op Visual Acuity</label>
            <input
              value={form.preOpVA}
              onChange={(e) => set('preOpVA', e.target.value)}
              placeholder="e.g. 6/60"
              className={F.input}
            />
          </div>
          <div>
            <label className={F.label}>Post-op Visual Acuity</label>
            <input
              value={form.postOpVA ?? ''}
              onChange={(e) => set('postOpVA', e.target.value)}
              placeholder="e.g. 6/9"
              className={F.input}
            />
          </div>
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
