'use client';
import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { formatDate } from '@/lib/utils';
import type { Surgery, SurgeryStatus, SurgeryEye, LensType, Patient, Campaign, Location } from '@/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import InlineForm from '@/components/forms/InlineForm';
import { Plus, Pencil, Trash2, X, AlertTriangle, UserCheck } from 'lucide-react';
import { usePermissions } from '@/lib/auth';
import { getAllSurgeries, actionCreateSurgery, actionUpdateSurgery, actionDeleteSurgery } from '@/app/actions/surgeries';
import { getAllPatients } from '@/app/actions/patients';
import { getAllCampaigns } from '@/app/actions/campaigns';
import { getAllLocations } from '@/app/actions/locations';

const STATUSES: SurgeryStatus[] = ['Scheduled','In-Theatre','Completed','Cancelled','Postponed'];
const COL: Record<SurgeryStatus, { bg: string; border: string; badge: string }> = {
  Scheduled:    { bg:'bg-blue-50',   border:'border-blue-200',   badge:'bg-blue-100 text-blue-700' },
  'In-Theatre': { bg:'bg-amber-50',  border:'border-amber-200',  badge:'bg-amber-100 text-amber-700' },
  Completed:    { bg:'bg-green-50',  border:'border-green-200',  badge:'bg-green-100 text-green-700' },
  Cancelled:    { bg:'bg-red-50',    border:'border-red-200',    badge:'bg-red-100 text-red-700' },
  Postponed:    { bg:'bg-slate-50',  border:'border-slate-200',  badge:'bg-slate-100 text-slate-600' },
};
const BLANK: Omit<Surgery,'id'|'createdAt'> = {
  patientId:'', patientName:'', campaignId:'', locationId:'',
  surgeonId:'', surgeonName:'', eye:'Right', lensType:'Foldable Acrylic',
  scheduledAt:'', performedAt:'', status:'Scheduled',
  preOpVA:'', postOpVA:'', complications:'', intraopNotes:'',
};
function toLocal(iso: string) {
  if (!iso) return '';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(iso)) return iso.slice(0,16);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return `${iso}T00:00`;
  try { const d = new Date(iso); const p = (n:number) => String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; } catch { return ''; }
}

export default function SurgeryPage() {
  const { users } = useStore();
  const { can } = usePermissions();
  const surgeons = users.filter((u) => ['Ophthalmologist','Surgeon','Super Administrator'].includes(u.role));

  const [surgeries, setSurgeries]   = useState<Surgery[]>([]);
  const [patients, setPatients]     = useState<Patient[]>([]);
  const [campaigns, setCampaigns]   = useState<Campaign[]>([]);
  const [locations, setLocations]   = useState<Location[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [saveError, setSaveError]   = useState('');
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState<Surgery | null>(null);
  const [deleteId, setDeleteId]     = useState<string | null>(null);
  const [form, setForm]             = useState<typeof BLANK>(BLANK);
  const [assigningId, setAssigningId]         = useState<string | null>(null);
  const [assignSurgeonId, setAssignSurgeonId] = useState('');

  useEffect(() => {
    Promise.all([getAllSurgeries(), getAllPatients(), getAllCampaigns(), getAllLocations()])
      .then(([s, p, c, l]) => { setSurgeries(s); setPatients(p); setCampaigns(c); setLocations(l); setIsLoading(false); });
  }, []);

  const unassignedCount = surgeries.filter((s) => !s.surgeonId).length;

  function openAdd() { setEditing(null); setForm(BLANK); setSaveError(''); setShowForm(true); }
  function openEdit(s: Surgery) {
    setEditing(s);
    const { id, createdAt, ...r } = s;
    setForm({ ...r, scheduledAt: toLocal(r.scheduledAt), performedAt: r.performedAt ? toLocal(r.performedAt) : '', postOpVA: r.postOpVA ?? '' });
    setSaveError('');
    setShowForm(true);
  }
  function cancel() { setShowForm(false); setEditing(null); }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function set(k: keyof typeof BLANK, v: any) { if (v === null) return; setForm((f) => ({ ...f, [k]: v })); }
  function handlePatient(pid: string | null) { if (!pid) return; const p = patients.find((x) => x.id === pid); set('patientId', pid); if (p) set('patientName', p.fullName); }
  function handleSurgeon(uid2: string | null) { if (!uid2) return; const u = users.find((x) => x.id === uid2); set('surgeonId', uid2); if (u) set('surgeonName', u.name); }

  async function save() {
    setSaveError('');
    if (editing) {
      const res = await actionUpdateSurgery(editing.id, form);
      if (!res.ok) { setSaveError(res.error); return; }
      setSurgeries((prev) => prev.map((s) => s.id === editing.id ? res.data : s));
    } else {
      const res = await actionCreateSurgery(form);
      if (!res.ok) { setSaveError(res.error); return; }
      setSurgeries((prev) => [res.data, ...prev]);
    }
    cancel();
  }

  async function changeStatus(s: Surgery, status: SurgeryStatus) {
    const updated = { ...s, status, ...(status === 'Completed' ? { performedAt: new Date().toISOString() } : {}) };
    const res = await actionUpdateSurgery(s.id, updated);
    if (res.ok) setSurgeries((prev) => prev.map((x) => x.id === s.id ? res.data : x));
  }

  async function confirmAssign(s: Surgery) {
    const u = surgeons.find((x) => x.id === assignSurgeonId);
    if (!u) return;
    const res = await actionUpdateSurgery(s.id, { ...s, surgeonId: u.id, surgeonName: u.name });
    if (res.ok) { setSurgeries((prev) => prev.map((x) => x.id === s.id ? res.data : x)); setAssigningId(null); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Surgery Board</h1>
          <p className="text-sm text-slate-500">
            {isLoading ? 'Loading...' : `${surgeries.length} surgeries · ${surgeries.filter((s) => s.status === 'Completed').length} completed`}
          </p>
        </div>
        {can('surgeries','create') && !showForm && <Button onClick={openAdd} className="bg-teal-600 hover:bg-teal-700 text-white gap-2 rounded-xl"><Plus size={15} />Schedule Surgery</Button>}
        {showForm && <Button variant="outline" onClick={cancel} className="gap-2 rounded-xl text-slate-600"><X size={14} />Cancel</Button>}
      </div>

      {showForm && (
        <InlineForm title={editing ? `Edit Surgery - ${editing.patientName}` : 'Schedule Surgery'}
          onClose={cancel} onSave={save} saveLabel={editing ? 'Update' : 'Schedule'}
          saveDisabled={!form.patientId || !form.campaignId || !form.locationId}>
          {saveError && <p className="text-xs text-red-600 mb-2">{saveError}</p>}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="col-span-2">
              <Label className="text-xs mb-1 block">Patient *</Label>
              <Select value={form.patientId} onValueChange={handlePatient}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.fullName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Campaign *</Label>
              <Select value={form.campaignId} onValueChange={(v) => set('campaignId', v)}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Location *</Label>
              <Select value={form.locationId} onValueChange={(v) => set('locationId', v)}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs mb-1 block">Surgeon</Label>
              <Select value={form.surgeonId} onValueChange={handleSurgeon}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{surgeons.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Eye</Label>
              <Select value={form.eye} onValueChange={(v) => set('eye', v)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{(['Right','Left','Both'] as SurgeryEye[]).map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Lens Type</Label>
              <Select value={form.lensType} onValueChange={(v) => set('lensType', v)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{(['PMMA','Foldable Acrylic','Hydrophilic','Hydrophobic'] as LensType[]).map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Status</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs mb-1 block">Scheduled Date</Label><Input type="datetime-local" value={form.scheduledAt} onChange={(e) => set('scheduledAt', e.target.value)} className="rounded-xl" /></div>
            <div><Label className="text-xs mb-1 block">Pre-op VA</Label><Input value={form.preOpVA} onChange={(e) => set('preOpVA', e.target.value)} className="rounded-xl" placeholder="e.g. 6/60" /></div>
            <div><Label className="text-xs mb-1 block">Post-op VA</Label><Input value={form.postOpVA ?? ''} onChange={(e) => set('postOpVA', e.target.value)} className="rounded-xl" placeholder="e.g. 6/12" /></div>
            <div className="col-span-2"><Label className="text-xs mb-1 block">Complications</Label><Input value={form.complications} onChange={(e) => set('complications', e.target.value)} className="rounded-xl" placeholder="None or describe" /></div>
            <div className="col-span-2">
              <Label className="text-xs mb-1 block">Intra-op Notes</Label>
              <textarea value={form.intraopNotes} onChange={(e) => set('intraopNotes', e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 resize-none h-14" />
            </div>
          </div>
        </InlineForm>
      )}

      {unassignedCount > 0 && can('surgeries', 'edit') && (
        <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={15} className="shrink-0 text-amber-600" />
          <span><strong>{unassignedCount}</strong> {unassignedCount === 1 ? 'surgery is' : 'surgeries are'} missing a surgeon assignment.</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-slate-400 text-sm">Loading...</div>
      ) : (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 items-start">
          {(['Scheduled','In-Theatre','Completed','Cancelled'] as SurgeryStatus[]).map((status) => {
            const c = COL[status];
            const items = surgeries.filter((s) => s.status === status);
            return (
              <div key={status} className={`rounded-2xl border-2 ${c.border} ${c.bg} p-3 min-h-[160px]`}>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${c.badge}`}>{status}</span>
                  <span className="text-xs text-slate-400 font-medium">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map((s) => (
                    <div key={s.id} className={`bg-white rounded-xl p-3 shadow-sm border border-white/80 hover:shadow-md transition-shadow ${editing?.id === s.id ? 'ring-1 ring-teal-400' : ''}`}>
                      <div className="flex items-start justify-between gap-1 mb-1.5">
                        <div>
                          <p className="font-semibold text-sm text-slate-800 leading-tight">{s.patientName}</p>
                          <p className="text-xs text-slate-400">{s.eye} Eye · {s.lensType}</p>
                        </div>
                        <div className="flex gap-0.5 shrink-0">
                          {can('surgeries','edit') && <button onClick={() => openEdit(s)} className="p-1 rounded hover:bg-slate-100 text-slate-400"><Pencil size={11} /></button>}
                          {can('surgeries','delete') && <button onClick={() => setDeleteId(s.id)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 size={11} /></button>}
                        </div>
                      </div>
                      {s.surgeonId ? (
                        <p className="text-xs font-medium text-teal-700 bg-teal-50 rounded-full px-2 py-0.5 inline-flex items-center gap-1 mb-1">
                          <UserCheck size={10} />{s.surgeonName}
                        </p>
                      ) : (
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className="text-[10px] font-semibold bg-orange-100 text-orange-700 rounded-full px-2 py-0.5">Surgeon Not Assigned</span>
                          {can('surgeries','edit') && assigningId !== s.id && (
                            <button onClick={() => { setAssigningId(s.id); setAssignSurgeonId(''); }}
                              className="text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full px-2 py-0.5 transition-colors">
                              Assign
                            </button>
                          )}
                        </div>
                      )}
                      {assigningId === s.id && (
                        <div className="mt-1.5 pt-1.5 border-t border-slate-100 space-y-1.5 mb-1">
                          <Select value={assignSurgeonId} onValueChange={(v) => v && setAssignSurgeonId(v)}>
                            <SelectTrigger className="rounded-lg h-7 text-xs"><SelectValue placeholder="Select surgeon..." /></SelectTrigger>
                            <SelectContent>{surgeons.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                          </Select>
                          <div className="flex gap-1">
                            <button disabled={!assignSurgeonId} onClick={() => confirmAssign(s)}
                              className="flex-1 text-[10px] font-semibold bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white rounded-lg px-2 py-1 transition-colors">
                              Confirm
                            </button>
                            <button onClick={() => setAssigningId(null)}
                              className="text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg px-2 py-1 transition-colors">
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-slate-400 mb-1.5">{s.scheduledAt ? formatDate(s.scheduledAt) : '--'}</p>
                      {s.preOpVA  ? <p className="text-xs text-slate-500">Pre: <span className="font-mono font-medium">{s.preOpVA}</span></p>  : null}
                      {s.postOpVA ? <p className="text-xs text-green-600">Post: <span className="font-mono font-medium">{s.postOpVA}</span></p> : null}
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {status === 'Scheduled'  && <button onClick={() => changeStatus(s,'In-Theatre')} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium hover:bg-amber-200">-&gt; Theatre</button>}
                        {status === 'In-Theatre' && <button onClick={() => changeStatus(s,'Completed')}  className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium hover:bg-green-200">-&gt; Done</button>}
                        {['Scheduled','In-Theatre'].includes(status) && <button onClick={() => changeStatus(s,'Cancelled')} className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium hover:bg-red-200">Cancel</button>}
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && <p className="text-xs text-slate-400 text-center py-4">Empty</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader><AlertDialogTitle>Delete Surgery?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (deleteId) { await actionDeleteSurgery(deleteId); setSurgeries((prev) => prev.filter((s) => s.id !== deleteId)); } setDeleteId(null); }} className="bg-red-600 hover:bg-red-700 rounded-xl">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
