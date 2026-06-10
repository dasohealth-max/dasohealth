'use client';
import { useState, useEffect, useTransition } from 'react';
import { formatDateTime } from '@/lib/utils';
import { getAllPatients } from '@/app/actions/patients';
import {
  getAllTransportJobs,
  actionCreateTransportJob,
  actionUpdateTransportJob,
  actionUpdateTransportStatus,
  actionDeleteTransportJob,
} from '@/app/actions/transport';
import type { TransportJob, TransportStatus, Patient } from '@/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import InlineForm from '@/components/forms/InlineForm';
import { Plus, Pencil, Trash2, X, AlertTriangle } from 'lucide-react';
import { usePermissions } from '@/lib/auth';

const STATUSES: TransportStatus[] = ['Scheduled','In-Transit','Completed','Cancelled'];
const STATUS_STYLE: Record<TransportStatus,string> = {
  Scheduled:'bg-blue-100 text-blue-700','In-Transit':'bg-amber-100 text-amber-700',
  Completed:'bg-green-100 text-green-700', Cancelled:'bg-red-100 text-red-700',
};
const BLANK: Omit<TransportJob,'id'|'createdAt'> = {
  patientId:'', patientName:'', vehicle:'', driver:'',
  pickupLocation:'', dropLocation:'', scheduledAt:'', cost:0, status:'Scheduled', notes:'',
};

export default function TransportPage() {
  const { can } = usePermissions();
  const [jobs, setJobs]         = useState<TransportJob[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<TransportJob | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm]         = useState<typeof BLANK>(BLANK);
  const [saveError, setSaveError] = useState('');
  const [isPending, startTransition] = useTransition();

  async function load() {
    const [t, p] = await Promise.all([getAllTransportJobs(), getAllPatients()]);
    setJobs(t); setPatients(p); setIsLoading(false);
  }
  useEffect(() => { load(); }, []);

  const totalCost = jobs.filter((t) => t.status === 'Completed').reduce((a, t) => a + t.cost, 0);

  function openAdd() { setEditing(null); setForm(BLANK); setSaveError(''); setShowForm(true); }
  function openEdit(t: TransportJob) { setEditing(t); const { id, createdAt, ...r } = t; setForm(r); setSaveError(''); setShowForm(true); }
  function cancel() { setShowForm(false); setEditing(null); setSaveError(''); }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function set(k: keyof typeof BLANK, v: any) { if (v === null) return; setForm((f) => ({ ...f, [k]: v })); }
  function handlePatient(pid: string | null) { if (!pid) return; const p = patients.find((x) => x.id === pid); set('patientId', pid); if (p) set('patientName', p.fullName); }

  async function save() {
    setSaveError('');
    startTransition(async () => {
      const result = editing
        ? await actionUpdateTransportJob(editing.id, form)
        : await actionCreateTransportJob(form);
      if (!result.ok) { setSaveError(result.error); return; }
      await load();
      cancel();
    });
  }

  function changeStatus(job: TransportJob, status: TransportStatus) {
    startTransition(async () => {
      await actionUpdateTransportStatus(job.id, status);
      await load();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Transport & Logistics</h1>
          <p className="text-sm text-slate-500">{jobs.length} jobs · ${totalCost} total cost</p>
        </div>
        {can('transport','create') && !showForm && <Button onClick={openAdd} className="bg-teal-600 hover:bg-teal-700 text-white gap-2 rounded-xl"><Plus size={15} />Add Transport</Button>}
        {showForm && <Button variant="outline" onClick={cancel} className="gap-2 rounded-xl text-slate-600"><X size={14} />Cancel</Button>}
      </div>

      {saveError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-700 font-medium">
          <AlertTriangle size={14} /> {saveError}
        </div>
      )}

      {showForm && (
        <InlineForm title={editing ? `Edit — ${editing.patientName}` : 'Add Transport Job'}
          onClose={cancel} onSave={save} saveLabel={editing ? 'Update' : 'Add Job'} saveDisabled={!form.patientId || isPending}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="col-span-2"><Label className="text-xs mb-1 block">Patient *</Label>
              <Select value={form.patientId} onValueChange={handlePatient}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select patient" /></SelectTrigger>
                <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.fullName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs mb-1 block">Vehicle</Label><Input value={form.vehicle} onChange={(e) => set('vehicle', e.target.value)} className="rounded-xl" /></div>
            <div><Label className="text-xs mb-1 block">Driver</Label><Input value={form.driver} onChange={(e) => set('driver', e.target.value)} className="rounded-xl" /></div>
            <div className="col-span-2"><Label className="text-xs mb-1 block">Pickup Location</Label><Input value={form.pickupLocation} onChange={(e) => set('pickupLocation', e.target.value)} className="rounded-xl" /></div>
            <div className="col-span-2"><Label className="text-xs mb-1 block">Drop-off Location</Label><Input value={form.dropLocation} onChange={(e) => set('dropLocation', e.target.value)} className="rounded-xl" /></div>
            <div className="col-span-2"><Label className="text-xs mb-1 block">Scheduled Date/Time</Label><Input type="datetime-local" value={typeof form.scheduledAt === 'string' ? form.scheduledAt.slice(0,16) : ''} onChange={(e) => set('scheduledAt', e.target.value)} className="rounded-xl" /></div>
            <div><Label className="text-xs mb-1 block">Cost ($)</Label><Input type="number" value={form.cost} onChange={(e) => set('cost', +e.target.value)} className="rounded-xl" /></div>
            <div><Label className="text-xs mb-1 block">Status</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2 md:col-span-4"><Label className="text-xs mb-1 block">Notes</Label>
              <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 resize-none h-14" />
            </div>
          </div>
        </InlineForm>
      )}

      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>{['Patient','Vehicle','Driver','Pickup','Drop-off','Scheduled','Cost','Status',''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={9} className="text-center py-12 text-slate-400">Loading…</td></tr>}
                {!isLoading && jobs.length === 0 && <tr><td colSpan={9} className="text-center py-12 text-slate-400">No transport jobs.</td></tr>}
                {jobs.map((t) => (
                  <tr key={t.id} className={`border-b border-slate-50 hover:bg-slate-50/70 transition-colors ${editing?.id === t.id ? 'bg-teal-50/30' : ''}`}>
                    <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{t.patientName}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{t.vehicle}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{t.driver}</td>
                    <td className="px-4 py-3 text-slate-500 max-w-[120px] truncate">{t.pickupLocation}</td>
                    <td className="px-4 py-3 text-slate-500 max-w-[120px] truncate">{t.dropLocation}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{formatDateTime(t.scheduledAt)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700">${t.cost}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[t.status]}`}>{t.status}</span></td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {t.status === 'Scheduled'  && can('transport','edit') && <button disabled={isPending} onClick={() => changeStatus(t,'In-Transit')} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium hover:bg-amber-200 whitespace-nowrap disabled:opacity-40">→ Transit</button>}
                        {t.status === 'In-Transit' && can('transport','edit') && <button disabled={isPending} onClick={() => changeStatus(t,'Completed')} className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium hover:bg-green-200 disabled:opacity-40">Done</button>}
                        {can('transport','edit') && <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600"><Pencil size={13} /></button>}
                        {can('transport','delete') && <button onClick={() => setDeleteId(t.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 size={13} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader><AlertDialogTitle>Delete Transport Job?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deleteId) { await actionDeleteTransportJob(deleteId); await load(); }
                setDeleteId(null);
              }}
              className="bg-red-600 hover:bg-red-700 rounded-xl"
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
