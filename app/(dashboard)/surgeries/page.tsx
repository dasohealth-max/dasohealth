'use client';

import { useEffect, useMemo, useState } from 'react';
import type { LensType, Surgery, SurgeryEye, SurgeryStatus } from '@/types';
import { actionDeleteSurgery, actionUpdateSurgery, getAllSurgeries } from '@/app/actions/surgeries';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import InlineForm from '@/components/forms/InlineForm';
import { formatDateTime } from '@/lib/utils';
import { usePermissions } from '@/lib/auth';
import { CheckCircle, Pencil, Search, Trash2, X } from 'lucide-react';

const STATUSES: SurgeryStatus[] = ['Scheduled', 'In-Theatre', 'Completed', 'Cancelled', 'Postponed'];
const EYES: SurgeryEye[] = ['Right', 'Left', 'Both'];
const LENSES: LensType[] = ['PMMA', 'Foldable Acrylic', 'Hydrophilic', 'Hydrophobic'];

const BLANK: Omit<Surgery, 'id' | 'createdAt'> = {
  patientId: '',
  patientName: '',
  campaignId: '',
  locationId: '',
  region: '',
  operationDistrict: '',
  createdFromScreeningId: '',
  surgeonId: '',
  surgeonName: '',
  eye: 'Right',
  lensType: 'Foldable Acrylic',
  scheduledAt: '',
  performedAt: '',
  status: 'Scheduled',
  preOpVA: '',
  postOpVA: '',
  complications: '',
  intraopNotes: '',
  completedById: '',
  completedByName: '',
};

function toLocal(iso?: string) {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function SurgeriesPage() {
  const { can } = usePermissions();
  const [surgeries, setSurgeries] = useState<Surgery[]>([]);
  const [form, setForm] = useState(BLANK);
  const [editing, setEditing] = useState<Surgery | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SurgeryStatus>('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getAllSurgeries().then((rows) => {
      setSurgeries(rows);
      setIsLoading(false);
    });
  }, []);

  const regions = useMemo(() => Array.from(new Set(surgeries.map((surgery) => surgery.region))).sort(), [surgeries]);
  const filteredSurgeries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return surgeries.filter((surgery) => {
      const matchesSearch = !q ||
        surgery.patientName.toLowerCase().includes(q) ||
        surgery.region.toLowerCase().includes(q) ||
        surgery.operationDistrict.toLowerCase().includes(q) ||
        surgery.surgeonName.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || surgery.status === statusFilter;
      const matchesRegion = regionFilter === 'all' || surgery.region === regionFilter;
      return matchesSearch && matchesStatus && matchesRegion;
    });
  }, [regionFilter, search, statusFilter, surgeries]);

  function set<K extends keyof typeof BLANK>(key: K, value: (typeof BLANK)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openEdit(surgery: Surgery) {
    const editable = Object.fromEntries(
      Object.entries(surgery).filter(([key]) => key !== 'id' && key !== 'createdAt')
    ) as typeof BLANK;
    setEditing(surgery);
    setForm({
      ...editable,
      scheduledAt: toLocal(editable.scheduledAt),
      performedAt: toLocal(editable.performedAt),
      postOpVA: editable.postOpVA ?? '',
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
      return;
    }
    setSurgeries((rows) => rows.map((row) => row.id === editing.id ? result.data : row));
    setShowForm(false);
    setEditing(null);
  }

  async function setStatus(surgery: Surgery, status: SurgeryStatus) {
    const performedAt = status === 'Completed' ? (surgery.performedAt ?? new Date().toISOString()) : surgery.performedAt;
    const result = await actionUpdateSurgery(surgery.id, { ...surgery, status, performedAt });
    if (result.ok) setSurgeries((rows) => rows.map((row) => row.id === surgery.id ? result.data : row));
  }

  async function remove(surgery: Surgery) {
    const result = await actionDeleteSurgery(surgery.id);
    if (result.ok) setSurgeries((rows) => rows.filter((row) => row.id !== surgery.id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Surgeries</h1>
          <p className="text-sm text-slate-500">{surgeries.filter((surgery) => surgery.status === 'Completed').length} completed of {surgeries.length} surgery records</p>
        </div>
        {showForm && <Button variant="outline" onClick={() => setShowForm(false)} className="gap-2 rounded-xl"><X size={14} />Cancel</Button>}
      </div>

      {showForm && (
        <InlineForm
          title={editing ? `Edit ${editing.patientName}` : 'Update Surgery'}
          onClose={() => setShowForm(false)}
          onSave={save}
          saveLabel="Update Surgery"
          saveDisabled={!form.patientId || !form.campaignId || !form.scheduledAt || (form.status === 'Completed' && !form.performedAt)}
        >
          {saveError && <p className="mb-2 text-xs text-red-600">{saveError}</p>}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="md:col-span-2"><Label className="mb-1 block text-xs">Patient</Label><Input value={form.patientName} disabled className="rounded-xl bg-slate-50" /></div>
            <div><Label className="mb-1 block text-xs">Region</Label><Input value={form.region} disabled className="rounded-xl bg-slate-50" /></div>
            <div><Label className="mb-1 block text-xs">Operation District</Label><Input value={form.operationDistrict} disabled className="rounded-xl bg-slate-50" /></div>
            <div><Label className="mb-1 block text-xs">Doctor / Surgeon</Label><Input value={form.surgeonName} onChange={(e) => set('surgeonName', e.target.value)} className="rounded-xl" /></div>
            <div><Label className="mb-1 block text-xs">Eye</Label><Select value={form.eye} onValueChange={(value) => { if (value) set('eye', value as SurgeryEye); }}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{EYES.map((eye) => <SelectItem key={eye} value={eye}>{eye}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="mb-1 block text-xs">Lens</Label><Select value={form.lensType} onValueChange={(value) => { if (value) set('lensType', value as LensType); }}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{LENSES.map((lens) => <SelectItem key={lens} value={lens}>{lens}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="mb-1 block text-xs">Status</Label><Select value={form.status} onValueChange={(value) => { if (value) set('status', value as SurgeryStatus); }}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="mb-1 block text-xs">Scheduled Date</Label><Input type="datetime-local" value={form.scheduledAt} onChange={(e) => set('scheduledAt', e.target.value)} className="rounded-xl" /></div>
            <div><Label className="mb-1 block text-xs">Actual Surgery Date</Label><Input type="datetime-local" value={form.performedAt ?? ''} onChange={(e) => set('performedAt', e.target.value)} className="rounded-xl" /></div>
            <div><Label className="mb-1 block text-xs">Pre-op VA</Label><Input value={form.preOpVA} onChange={(e) => set('preOpVA', e.target.value)} className="rounded-xl" /></div>
            <div><Label className="mb-1 block text-xs">Post-op VA</Label><Input value={form.postOpVA ?? ''} onChange={(e) => set('postOpVA', e.target.value)} className="rounded-xl" /></div>
            <div className="md:col-span-2"><Label className="mb-1 block text-xs">Complications</Label><Input value={form.complications} onChange={(e) => set('complications', e.target.value)} className="rounded-xl" /></div>
            <div className="md:col-span-4"><Label className="mb-1 block text-xs">Notes</Label><textarea value={form.intraopNotes} onChange={(e) => set('intraopNotes', e.target.value)} className="h-16 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500" /></div>
          </div>
        </InlineForm>
      )}

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_180px_220px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search patient, doctor, region, district..." className="rounded-xl pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={(value) => { if (value) setStatusFilter(value as 'all' | SurgeryStatus); }}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={regionFilter} onValueChange={(value) => { if (value) setRegionFilter(value); }}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Region" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All regions</SelectItem>
                {regions.map((region) => <SelectItem key={region} value={region}>{region}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>{['Patient', 'Region', 'Status', 'Eye / Lens', 'Scheduled', 'Actual Date', 'Doctor', 'Completed By', 'Notes', ''].map((heading) => <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{heading}</th>)}</tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={10} className="py-12 text-center text-sm text-slate-400">Loading surgeries...</td></tr>}
                {!isLoading && filteredSurgeries.map((surgery) => (
                  <tr key={surgery.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{surgery.patientName}</td>
                    <td className="px-4 py-3 text-slate-600">{surgery.region}<p className="text-xs text-slate-400">{surgery.operationDistrict}</p></td>
                    <td className="px-4 py-3"><StatusBadge status={surgery.status} /></td>
                    <td className="px-4 py-3 text-slate-600">{surgery.eye} / {surgery.lensType}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(surgery.scheduledAt)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{surgery.performedAt ? formatDateTime(surgery.performedAt) : '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{surgery.surgeonName || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{surgery.completedByName || '-'}</td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-xs text-slate-500" title={surgery.intraopNotes || surgery.complications}>{surgery.intraopNotes || surgery.complications || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {surgery.status !== 'Completed' && can('surgeries', 'edit') && <button onClick={() => setStatus(surgery, 'Completed')} className="rounded-lg bg-green-50 px-2 py-1 text-xs font-medium text-green-700"><CheckCircle size={12} className="mr-1 inline" />Complete</button>}
                        {can('surgeries', 'edit') && <button onClick={() => openEdit(surgery)} className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"><Pencil size={14} /></button>}
                        {can('surgeries', 'delete') && <button onClick={() => remove(surgery)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {!isLoading && filteredSurgeries.length === 0 && <tr><td colSpan={10} className="py-12 text-center text-sm text-slate-400">No surgeries found.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: SurgeryStatus }) {
  const classes: Record<SurgeryStatus, string> = {
    Scheduled: 'bg-blue-50 text-blue-700',
    'In-Theatre': 'bg-indigo-50 text-indigo-700',
    Completed: 'bg-emerald-50 text-emerald-700',
    Cancelled: 'bg-red-50 text-red-700',
    Postponed: 'bg-amber-50 text-amber-700',
  };
  return <span className={`rounded-full px-2 py-1 text-xs font-medium ${classes[status]}`}>{status}</span>;
}
