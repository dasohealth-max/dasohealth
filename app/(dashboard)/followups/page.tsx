'use client';

import { useEffect, useState } from 'react';
import type { FollowUp, FollowUpStatus } from '@/types';
import { actionUpdateFollowUp, checkAndMarkOverdue, getAllFollowUps } from '@/app/actions/follow_ups';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import InlineForm from '@/components/forms/InlineForm';
import { daysUntil, formatDate } from '@/lib/utils';
import { usePermissions } from '@/lib/auth';
import { CheckCircle, Pencil, X } from 'lucide-react';

const STATUSES: FollowUpStatus[] = ['Pending', 'Due', 'Overdue', 'Completed', 'Missed'];

const BLANK: Omit<FollowUp, 'id' | 'createdAt'> = {
  patientId: '',
  patientName: '',
  surgeryId: '',
  campaignId: '',
  region: '',
  milestone: 'Day 1',
  dueDate: '',
  completedAt: '',
  status: 'Pending',
  vaRightPost: '',
  vaLeftPost: '',
  complications: '',
  notes: '',
  needsDoctorReview: false,
  completedById: '',
  completedByName: '',
};

export default function FollowUpsPage() {
  const { can } = usePermissions();
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [form, setForm] = useState(BLANK);
  const [editing, setEditing] = useState<FollowUp | null>(null);
  const [filter, setFilter] = useState<FollowUpStatus | 'All'>('All');
  const [showForm, setShowForm] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAndMarkOverdue().then(() => getAllFollowUps()).then((rows) => {
      setFollowUps(rows);
      setIsLoading(false);
    });
  }, []);

  const visible = filter === 'All' ? followUps : followUps.filter((item) => item.status === filter);

  function set<K extends keyof typeof BLANK>(key: K, value: (typeof BLANK)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openEdit(followUp: FollowUp) {
    const editable = Object.fromEntries(
      Object.entries(followUp).filter(([key]) => key !== 'id' && key !== 'createdAt')
    ) as typeof BLANK;
    setForm(editable);
    setEditing(followUp);
    setSaveError('');
    setShowForm(true);
  }

  async function save() {
    if (!editing) return;
    setSaveError('');
    const result = await actionUpdateFollowUp(editing.id, form);
    if (!result.ok) {
      setSaveError(result.error);
      return;
    }
    setFollowUps((rows) => rows.map((row) => row.id === editing.id ? result.data : row));
    setShowForm(false);
    setEditing(null);
  }

  async function complete(followUp: FollowUp) {
    if (!confirm(`Mark ${followUp.milestone} follow-up for "${followUp.patientName}" as completed?`)) return;
    const result = await actionUpdateFollowUp(followUp.id, {
      ...followUp,
      status: 'Completed',
      completedAt: new Date().toISOString(),
    });
    if (result.ok) setFollowUps((rows) => rows.map((row) => row.id === followUp.id ? result.data : row));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Follow-ups</h1>
          <p className="text-sm text-slate-500">Day 1 and Week 1 follow-ups generated after completed surgery</p>
        </div>
        {showForm && <Button variant="outline" onClick={() => setShowForm(false)} className="gap-2 rounded-xl"><X size={14} />Cancel</Button>}
      </div>

      {showForm && (
        <InlineForm
          title={editing ? `Follow-up · ${editing.patientName}` : 'Follow-up'}
          onClose={() => setShowForm(false)}
          onSave={save}
          saveLabel="Save Follow-up"
          saveDisabled={!editing}
        >
          {saveError && <p className="mb-2 text-xs text-red-600">{saveError}</p>}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="md:col-span-2"><Label className="mb-1 block text-xs">Patient</Label><Input value={form.patientName} disabled className="rounded-xl bg-slate-50" /></div>
            <div><Label className="mb-1 block text-xs">Milestone</Label><Input value={form.milestone} disabled className="rounded-xl bg-slate-50" /></div>
            <div>
              <Label className="mb-1 block text-xs">Status</Label>
              <Select value={form.status} onValueChange={(value) => { if (value) set('status', value as FollowUpStatus); }}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="mb-1 block text-xs">Post-op VA Right</Label><Input value={form.vaRightPost ?? ''} onChange={(e) => set('vaRightPost', e.target.value)} className="rounded-xl" /></div>
            <div><Label className="mb-1 block text-xs">Post-op VA Left</Label><Input value={form.vaLeftPost ?? ''} onChange={(e) => set('vaLeftPost', e.target.value)} className="rounded-xl" /></div>
            <div className="md:col-span-2"><Label className="mb-1 block text-xs">Complications / Problem</Label><Input value={form.complications} onChange={(e) => set('complications', e.target.value)} className="rounded-xl" /></div>
            <label className="flex items-center gap-2 text-sm md:col-span-4">
              <input type="checkbox" checked={form.needsDoctorReview} onChange={(e) => set('needsDoctorReview', e.target.checked)} className="accent-teal-600" />
              Needs doctor review again
            </label>
            <div className="md:col-span-4"><Label className="mb-1 block text-xs">Follow-up Notes</Label><textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} className="h-20 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500" /></div>
          </div>
        </InlineForm>
      )}

      <div className="flex flex-wrap gap-2">
        {(['All', ...STATUSES] as (FollowUpStatus | 'All')[]).map((status) => (
          <button key={status} onClick={() => setFilter(status)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${filter === status ? 'bg-teal-600 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>
            {status}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>{['Patient', 'Region', 'Milestone', 'Due', 'Days', 'Status', 'Doctor Review', 'Completed By', ''].map((heading) => <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{heading}</th>)}</tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={9} className="py-10 text-center text-sm text-slate-400">Loading follow-ups...</td></tr>}
                {!isLoading && visible.map((followUp) => {
                  const days = daysUntil(followUp.dueDate);
                  return (
                    <tr key={followUp.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{followUp.patientName}</td>
                      <td className="px-4 py-3 text-slate-600">{followUp.region}</td>
                      <td className="px-4 py-3"><span className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700">{followUp.milestone}</span></td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(followUp.dueDate)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{followUp.status === 'Completed' ? '-' : days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d`}</td>
                      <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{followUp.status}</span></td>
                      <td className="px-4 py-3 text-slate-600">{followUp.needsDoctorReview ? 'Yes' : 'No'}</td>
                      <td className="px-4 py-3 text-slate-600">{followUp.completedByName || '-'}</td>
                      <td className="px-4 py-3"><div className="flex gap-1">{followUp.status !== 'Completed' && can('followups', 'edit') && <button onClick={() => complete(followUp)} className="rounded-lg p-1.5 text-slate-400 hover:bg-green-50 hover:text-green-600"><CheckCircle size={14} /></button>}{can('followups', 'edit') && <button onClick={() => openEdit(followUp)} className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"><Pencil size={14} /></button>}</div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
