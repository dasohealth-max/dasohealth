'use client';
import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { uid, formatDate, daysUntil } from '@/lib/utils';
import type { FollowUp, FollowUpStatus, FollowUpMilestone } from '@/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import InlineForm from '@/components/forms/InlineForm';
import { Plus, Pencil, Trash2, Bell, CheckCircle, X } from 'lucide-react';
import { usePermissions } from '@/lib/auth';

const MILESTONES: FollowUpMilestone[] = ['Day 1','Week 1','Month 1','Month 3'];
const STATUSES: FollowUpStatus[]      = ['Pending','Due','Overdue','Completed','Missed'];
const STATUS_STYLE: Record<FollowUpStatus,string> = {
  Pending:'bg-slate-100 text-slate-600', Due:'bg-blue-100 text-blue-700',
  Overdue:'bg-red-100 text-red-700', Completed:'bg-green-100 text-green-700', Missed:'bg-orange-100 text-orange-700',
};
const MS_STYLE: Record<FollowUpMilestone,string> = {
  'Day 1':'bg-purple-100 text-purple-700', 'Week 1':'bg-indigo-100 text-indigo-700',
  'Month 1':'bg-teal-100 text-teal-700', 'Month 3':'bg-emerald-100 text-emerald-700',
};
const BLANK: Omit<FollowUp,'id'|'createdAt'> = {
  patientId:'', patientName:'', surgeryId:'', campaignId:'',
  milestone:'Day 1', dueDate:'', status:'Pending',
  vaRightPost:'', vaLeftPost:'', complications:'', notes:'', smsReminderSent:false,
};

export default function FollowUpsPage() {
  const { followUps, patients, addFollowUp, updateFollowUp, deleteFollowUp, checkOverdueFollowUps } = useStore();
  const { can } = usePermissions();
  const [filter, setFilter]     = useState<FollowUpStatus|'All'>('All');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<FollowUp | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm]         = useState<typeof BLANK>(BLANK);

  useEffect(() => {
    checkOverdueFollowUps();
    const id = setInterval(checkOverdueFollowUps, 60_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = filter === 'All' ? followUps : followUps.filter((f) => f.status === filter);
  const overdue  = followUps.filter((f) => f.status === 'Overdue').length;

  function openAdd() { setEditing(null); setForm(BLANK); setShowForm(true); }
  function openEdit(f: FollowUp) { setEditing(f); const { id, createdAt, ...r } = f; setForm(r); setShowForm(true); }
  function cancel() { setShowForm(false); setEditing(null); }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function set(k: keyof typeof BLANK, v: any) { if (v === null) return; setForm((f2) => ({ ...f2, [k]: v })); }
  function handlePatient(pid: string | null) { if (!pid) return; const p = patients.find((x) => x.id === pid); set('patientId', pid); if (p) set('patientName', p.fullName); }
  function save() {
    if (editing) updateFollowUp({ ...editing, ...form });
    else addFollowUp({ id: uid(), createdAt: new Date().toISOString(), ...form });
    cancel();
  }
  function markComplete(f: FollowUp) { updateFollowUp({ ...f, status:'Completed', completedAt: new Date().toISOString() }); }
  function sendSMS(f: FollowUp) { updateFollowUp({ ...f, smsReminderSent:true }); }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Follow-ups</h1>
          <p className="text-sm text-slate-500">{followUps.length} total</p>
        </div>
        {can('followups','create') && !showForm && <Button onClick={openAdd} className="bg-teal-600 hover:bg-teal-700 text-white gap-2 rounded-xl"><Plus size={15} />Add Follow-up</Button>}
        {showForm && <Button variant="outline" onClick={cancel} className="gap-2 rounded-xl text-slate-600"><X size={14} />Cancel</Button>}
      </div>

      {overdue > 0 && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-sm font-medium">
          <span className="inline-flex items-center justify-center bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 shrink-0">{overdue}</span>
          {overdue === 1 ? '1 overdue follow-up' : `${overdue} overdue follow-ups`} - please review and update status
        </div>
      )}

      {showForm && (
        <InlineForm title={editing ? `Edit â€" ${editing.patientName}` : 'Add Follow-up'}
          onClose={cancel} onSave={save} saveLabel={editing ? 'Update' : 'Add'} saveDisabled={!form.patientId || !form.dueDate}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="col-span-2"><Label className="text-xs mb-1 block">Patient *</Label>
              <Select value={form.patientId} onValueChange={handlePatient}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select patient" /></SelectTrigger>
                <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.fullName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs mb-1 block">Milestone</Label>
              <Select value={form.milestone} onValueChange={(v) => set('milestone', v)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{MILESTONES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs mb-1 block">Status</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs mb-1 block">Due Date *</Label><Input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} className="rounded-xl" /></div>
            <div><Label className="text-xs mb-1 block">Post-op VA Right</Label><Input value={form.vaRightPost ?? ''} onChange={(e) => set('vaRightPost', e.target.value)} className="rounded-xl" placeholder="6/12" /></div>
            <div><Label className="text-xs mb-1 block">Post-op VA Left</Label><Input value={form.vaLeftPost ?? ''} onChange={(e) => set('vaLeftPost', e.target.value)} className="rounded-xl" placeholder="6/9" /></div>
            <div><Label className="text-xs mb-1 block">Complications</Label><Input value={form.complications} onChange={(e) => set('complications', e.target.value)} className="rounded-xl" /></div>
            <div className="col-span-2 md:col-span-4"><Label className="text-xs mb-1 block">Notes</Label>
              <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 resize-none h-14" />
            </div>
          </div>
        </InlineForm>
      )}

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {(['All', ...STATUSES] as (FollowUpStatus|'All')[]).map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${filter === s ? 'bg-teal-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-teal-300 hover:text-teal-600'}`}>
            {s} {s !== 'All' && `(${followUps.filter((f) => f.status === s).length})`}
          </button>
        ))}
      </div>

      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>{['Patient','Milestone','Due Date','Days','Status','Post-op VA','SMS',''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-slate-400">No follow-ups found.</td></tr>}
                {filtered.map((f) => {
                  const days = daysUntil(f.dueDate);
                  return (
                    <tr key={f.id} className={`border-b border-slate-50 hover:bg-slate-50/70 transition-colors ${f.status === 'Overdue' ? 'bg-red-50/20' : ''} ${editing?.id === f.id ? 'bg-teal-50/30' : ''}`}>
                      <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{f.patientName}</td>
                      <td className="px-4 py-3 whitespace-nowrap"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${MS_STYLE[f.milestone]}`}>{f.milestone}</span></td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(f.dueDate)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {f.status !== 'Completed' && f.status !== 'Missed' && (
                          <span className={`text-xs font-medium ${days < 0 ? 'text-red-600' : days <= 2 ? 'text-amber-600' : 'text-slate-500'}`}>
                            {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d`}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[f.status]}`}>{f.status}</span></td>
                      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{f.vaRightPost || 'â€"'} / {f.vaLeftPost || 'â€"'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {f.smsReminderSent
                          ? <span className="text-xs text-green-600 font-medium flex items-center gap-1"><CheckCircle size={11} />Sent</span>
                          : <button onClick={() => sendSMS(f)} className="text-xs flex items-center gap-1 text-teal-600 hover:text-teal-800 font-medium"><Bell size={11} />Send</button>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex gap-1">
                          {f.status !== 'Completed' && <button onClick={() => markComplete(f)} className="p-1.5 rounded-lg hover:bg-green-50 text-slate-400 hover:text-green-600" title="Mark complete"><CheckCircle size={13} /></button>}
                          {can('followups','edit') && <button onClick={() => openEdit(f)} className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600"><Pencil size={13} /></button>}
                          {can('followups','delete') && <button onClick={() => setDeleteId(f.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 size={13} /></button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader><AlertDialogTitle>Delete Follow-up?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) deleteFollowUp(deleteId); setDeleteId(null); }} className="bg-red-600 hover:bg-red-700 rounded-xl">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
