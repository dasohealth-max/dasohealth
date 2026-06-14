'use client';

import { useEffect, useState } from 'react';
import type { FollowUp, FollowUpMedication, FollowUpStatus, DoctorReviewStatus, MedicationStatus } from '@/types';
import {
  actionUpdateFollowUp, checkAndMarkOverdue, getFollowUpsPaginated, getFollowUpTabCounts,
  getMedicationsForFollowUp,
  actionCreateMedication, actionUpdateMedication, actionDeleteMedication,
} from '@/app/actions/follow_ups';
import Pagination from '@/components/ui/Pagination';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import InlineForm from '@/components/forms/InlineForm';
import { daysUntil, formatDate } from '@/lib/utils';
import { usePermissions } from '@/lib/auth';
import { CheckCircle, Pencil, Plus, Trash2, X } from 'lucide-react';

const PAGE_SIZE = 50;

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUSES: FollowUpStatus[] = ['Pending', 'Due', 'Overdue', 'Completed', 'Missed'];
const DR_STATUSES: DoctorReviewStatus[] = ['Not Needed', 'Pending', 'Completed'];
const MED_STATUSES: MedicationStatus[] = ['Prescribed', 'Taking', 'Completed', 'Stopped'];

type Tab = 'due' | 'overdue' | 'needs-review' | 'review-completed' | 'all';

const TABS: { id: Tab; label: string }[] = [
  { id: 'due', label: 'Due Follow-ups' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'needs-review', label: 'Needs Doctor Review' },
  { id: 'review-completed', label: 'Doctor Review Completed' },
  { id: 'all', label: 'All Follow-ups' },
];

const BLANK: Omit<FollowUp, 'id' | 'createdAt'> = {
  patientId: '', patientName: '', surgeryId: '', campaignId: '', region: '',
  milestone: 'Day 1', dueDate: '', completedAt: '', status: 'Pending',
  vaRightPost: '', vaLeftPost: '', complications: '', notes: '',
  needsDoctorReview: false,
  doctorReviewStatus: 'Not Needed', doctorReviewedAt: '',
  doctorName: '', doctorDiagnosis: '', doctorTreatmentPlan: '', doctorNotes: '',
  nextAppointmentDate: '', completedById: '', completedByName: '',
};

const BLANK_MED: Omit<FollowUpMedication, 'id' | 'createdAt' | 'followUpId'> = {
  drugName: '', dosage: '', frequency: '', duration: '', instructions: '',
  status: 'Prescribed', notes: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: FollowUpStatus) {
  const styles: Record<FollowUpStatus, string> = {
    Pending: 'bg-[#F0EDE6] text-[#1C2B22]',
    Due: 'bg-[#FEF3DC] text-[#C47D11]',
    Overdue: 'bg-[#FCE8E8] text-[#B52A2A]',
    Completed: 'bg-[#E8F5EE] text-[#1A7A46]',
    Missed: 'bg-[#FCE8E8] text-[#B52A2A]',
  };
  return `rounded-full px-2 py-1 text-xs font-medium ${styles[status] ?? 'bg-[#F0EDE6] text-[#1C2B22]'}`;
}

function drBadge(status: DoctorReviewStatus) {
  const styles: Record<DoctorReviewStatus, string> = {
    'Not Needed': 'bg-[#F0EDE6] text-[#4A6455]',
    Pending: 'bg-[#FEF3DC] text-[#C47D11]',
    Completed: 'bg-[#E8F5EE] text-[#1A7A46]',
  };
  return `rounded-full px-2 py-1 text-xs font-medium ${styles[status] ?? 'bg-[#F0EDE6] text-[#4A6455]'}`;
}

function milestoneBadge(m: string) {
  const c = m === 'Day 1' ? 'bg-[#E8F5EE] text-[#0F4D2A]' : m === 'Week 1' ? 'bg-[#D0E8DA] text-[#1A7A46]' : 'bg-[#FEF3DC] text-[#C47D11]';
  return `rounded-full px-2 py-1 text-xs font-medium ${c}`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FollowUpsPage() {
  const { can } = usePermissions();
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [counts, setCounts] = useState<Record<Tab, number>>({ due: 0, overdue: 0, 'needs-review': 0, 'review-completed': 0, all: 0 });
  const [form, setForm] = useState(BLANK);
  const [editing, setEditing] = useState<FollowUp | null>(null);
  const [tab, setTab] = useState<Tab>('due');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Medications state
  const [medications, setMedications] = useState<FollowUpMedication[]>([]);
  const [medForm, setMedForm] = useState<Omit<FollowUpMedication, 'id' | 'createdAt' | 'followUpId'>>(BLANK_MED);
  const [editingMed, setEditingMed] = useState<FollowUpMedication | null>(null);
  const [showMedForm, setShowMedForm] = useState(false);
  const [medError, setMedError] = useState('');

  // Mark overdue + load tab counts on mount
  useEffect(() => {
    checkAndMarkOverdue().then(() => getFollowUpTabCounts()).then(setCounts);
  }, []);

  // Debounce search, reset page
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  // Load paginated data
  useEffect(() => {
    let cancelled = false;
    getFollowUpsPaginated({ tab, search: debouncedSearch, page, pageSize: PAGE_SIZE })
      .then(({ data, total: t }) => {
        if (!cancelled) { setFollowUps(data); setTotal(t); setIsLoading(false); }
      })
      .catch(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [tab, debouncedSearch, page]);

  function set<K extends keyof typeof BLANK>(key: K, value: (typeof BLANK)[K]) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      // Auto-set doctorReviewStatus when needsDoctorReview is toggled
      if (key === 'needsDoctorReview') {
        if (value === true && next.doctorReviewStatus === 'Not Needed') {
          next.doctorReviewStatus = 'Pending';
        } else if (value === false && next.doctorReviewStatus === 'Pending') {
          next.doctorReviewStatus = 'Not Needed';
        }
      }
      return next;
    });
  }

  function setMed<K extends keyof typeof BLANK_MED>(key: K, value: (typeof BLANK_MED)[K]) {
    setMedForm((current) => ({ ...current, [key]: value }));
  }

  function openEdit(followUp: FollowUp) {
    const editable = Object.fromEntries(
      Object.entries(followUp).filter(([key]) => key !== 'id' && key !== 'createdAt')
    ) as typeof BLANK;
    setForm(editable);
    setEditing(followUp);
    setSaveError('');
    setShowForm(true);
    setShowMedForm(false);
    setEditingMed(null);
    // Load medications
    getMedicationsForFollowUp(followUp.id).then(setMedications);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setMedications([]);
    setShowMedForm(false);
    setEditingMed(null);
  }

  async function save() {
    if (!editing) return;
    setSaveError('');
    const result = await actionUpdateFollowUp(editing.id, form);
    if (!result.ok) { setSaveError(result.error); return; }
    setFollowUps((rows) => rows.map((row) => row.id === editing.id ? result.data : row));
    // Refresh counts
    getFollowUpTabCounts().then(setCounts);
    closeForm();
  }

  async function complete(followUp: FollowUp) {
    if (!confirm(`Mark ${followUp.milestone} follow-up for "${followUp.patientName}" as completed?`)) return;
    const result = await actionUpdateFollowUp(followUp.id, {
      ...followUp,
      status: 'Completed',
      completedAt: new Date().toISOString(),
    });
    if (result.ok) {
      setFollowUps((rows) => rows.map((row) => row.id === followUp.id ? result.data : row));
      getFollowUpTabCounts().then(setCounts);
    }
  }

  // Medication handlers
  function openAddMed() {
    setMedForm(BLANK_MED);
    setEditingMed(null);
    setMedError('');
    setShowMedForm(true);
  }

  function openEditMed(med: FollowUpMedication) {
    setMedForm({
      drugName: med.drugName,
      dosage: med.dosage,
      frequency: med.frequency,
      duration: med.duration,
      instructions: med.instructions,
      status: med.status,
      notes: med.notes,
    });
    setEditingMed(med);
    setMedError('');
    setShowMedForm(true);
  }

  async function saveMed() {
    if (!editing) return;
    setMedError('');
    if (!medForm.drugName.trim()) { setMedError('Drug name is required'); return; }

    if (editingMed) {
      const result = await actionUpdateMedication(editingMed.id, { ...medForm, followUpId: editing.id });
      if (!result.ok) { setMedError(result.error); return; }
      setMedications((prev) => prev.map((m) => m.id === editingMed.id ? result.data : m));
    } else {
      const result = await actionCreateMedication({ ...medForm, followUpId: editing.id });
      if (!result.ok) { setMedError(result.error); return; }
      setMedications((prev) => [...prev, result.data]);
    }
    setShowMedForm(false);
    setEditingMed(null);
  }

  async function deleteMed(med: FollowUpMedication) {
    if (!confirm(`Remove ${med.drugName}?`)) return;
    const result = await actionDeleteMedication(med.id);
    if (result.ok) setMedications((prev) => prev.filter((m) => m.id !== med.id));
  }

  const showDoctorSection = form.needsDoctorReview || form.doctorReviewStatus !== 'Not Needed';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#1C2B22]">Follow-ups</h1>
          <p className="text-sm text-[#4A6455]">Day 1, Week 1 and Month 1 follow-ups after completed surgery</p>
        </div>
        {showForm && (
          <Button variant="outline" onClick={closeForm} className="gap-2 rounded-xl">
            <X size={14} />Cancel
          </Button>
        )}
      </div>

      {/* Edit form */}
      {showForm && (
        <InlineForm
          title={editing ? `Follow-up · ${editing.patientName} · ${editing.milestone}` : 'Follow-up'}
          onClose={closeForm}
          onSave={save}
          saveLabel="Save Follow-up"
          saveDisabled={!editing}
        >
          {saveError && <p className="mb-3 text-xs text-[#B52A2A]">{saveError}</p>}

          {/* Clinical section */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <Label className="mb-1 block text-xs">Patient</Label>
              <Input value={form.patientName} disabled className="rounded-xl bg-[#FAFAF8]" />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Milestone</Label>
              <Input value={form.milestone} disabled className="rounded-xl bg-[#FAFAF8]" />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Status</Label>
              <Select value={form.status} onValueChange={(v) => { if (v) set('status', v as FollowUpStatus); }}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs">Post-op VA Right</Label>
              <Input value={form.vaRightPost ?? ''} onChange={(e) => set('vaRightPost', e.target.value)} className="rounded-xl" />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Post-op VA Left</Label>
              <Input value={form.vaLeftPost ?? ''} onChange={(e) => set('vaLeftPost', e.target.value)} className="rounded-xl" />
            </div>
            <div className="md:col-span-2">
              <Label className="mb-1 block text-xs">Complications / Problem</Label>
              <Input value={form.complications} onChange={(e) => set('complications', e.target.value)} className="rounded-xl" />
            </div>
            <label className="flex items-center gap-2 text-sm md:col-span-4">
              <input
                type="checkbox"
                checked={form.needsDoctorReview}
                onChange={(e) => set('needsDoctorReview', e.target.checked)}
                className="accent-[#1A7A46]"
              />
              Patient has a problem — needs doctor review
            </label>
            <div className="md:col-span-4">
              <Label className="mb-1 block text-xs">Follow-up Notes</Label>
              <textarea
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                className="h-20 w-full resize-none rounded-xl border border-[#E2DDD5] px-3 py-2 text-sm outline-none focus:border-[#1A7A46]"
              />
            </div>
          </div>

          {/* Doctor review section */}
          {showDoctorSection && (
            <div className="mt-4 rounded-xl border border-[#F0D898] bg-[#FEF3DC]/60 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#C47D11]">Doctor Review</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div>
                  <Label className="mb-1 block text-xs">Review Status</Label>
                  <Select
                    value={form.doctorReviewStatus}
                    onValueChange={(v) => { if (v) set('doctorReviewStatus', v as DoctorReviewStatus); }}
                  >
                    <SelectTrigger className="rounded-xl bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>{DR_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1 block text-xs">Doctor Name</Label>
                  <Input value={form.doctorName} onChange={(e) => set('doctorName', e.target.value)} className="rounded-xl bg-white" />
                </div>
                <div>
                  <Label className="mb-1 block text-xs">Reviewed At</Label>
                  <Input
                    type="date"
                    value={form.doctorReviewedAt ? form.doctorReviewedAt.split('T')[0] : ''}
                    onChange={(e) => set('doctorReviewedAt', e.target.value)}
                    className="rounded-xl bg-white"
                  />
                </div>
                <div>
                  <Label className="mb-1 block text-xs">Next Appointment</Label>
                  <Input
                    type="date"
                    value={form.nextAppointmentDate ?? ''}
                    onChange={(e) => set('nextAppointmentDate', e.target.value)}
                    className="rounded-xl bg-white"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="mb-1 block text-xs">Diagnosis</Label>
                  <Input value={form.doctorDiagnosis} onChange={(e) => set('doctorDiagnosis', e.target.value)} className="rounded-xl bg-white" />
                </div>
                <div className="md:col-span-2">
                  <Label className="mb-1 block text-xs">Treatment Plan</Label>
                  <Input value={form.doctorTreatmentPlan} onChange={(e) => set('doctorTreatmentPlan', e.target.value)} className="rounded-xl bg-white" />
                </div>
                <div className="md:col-span-4">
                  <Label className="mb-1 block text-xs">Doctor Notes</Label>
                  <textarea
                    value={form.doctorNotes}
                    onChange={(e) => set('doctorNotes', e.target.value)}
                    className="h-16 w-full resize-none rounded-xl border border-[#E2DDD5] bg-white px-3 py-2 text-sm outline-none focus:border-[#1A7A46]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Medications section */}
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#4A6455]">Medications</p>
              {can('followups', 'edit') && (
                <button
                  type="button"
                  onClick={openAddMed}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#1A7A46] hover:bg-[#E8F5EE]"
                >
                  <Plus size={12} />Add medication
                </button>
              )}
            </div>

            {showMedForm && (
              <div className="mb-3 rounded-xl border border-[#E2DDD5] bg-[#FAFAF8] p-3">
                {medError && <p className="mb-2 text-xs text-[#B52A2A]">{medError}</p>}
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  <div className="md:col-span-2">
                    <Label className="mb-1 block text-xs">Drug Name *</Label>
                    <Input value={medForm.drugName} onChange={(e) => setMed('drugName', e.target.value)} className="rounded-xl" placeholder="e.g. Prednisolone" />
                  </div>
                  <div>
                    <Label className="mb-1 block text-xs">Dosage</Label>
                    <Input value={medForm.dosage} onChange={(e) => setMed('dosage', e.target.value)} className="rounded-xl" placeholder="e.g. 1%" />
                  </div>
                  <div>
                    <Label className="mb-1 block text-xs">Status</Label>
                    <Select value={medForm.status} onValueChange={(v) => { if (v) setMed('status', v as MedicationStatus); }}>
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>{MED_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="mb-1 block text-xs">Frequency</Label>
                    <Input value={medForm.frequency} onChange={(e) => setMed('frequency', e.target.value)} className="rounded-xl" placeholder="e.g. 4x/day" />
                  </div>
                  <div>
                    <Label className="mb-1 block text-xs">Duration</Label>
                    <Input value={medForm.duration} onChange={(e) => setMed('duration', e.target.value)} className="rounded-xl" placeholder="e.g. 2 weeks" />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="mb-1 block text-xs">Instructions</Label>
                    <Input value={medForm.instructions} onChange={(e) => setMed('instructions', e.target.value)} className="rounded-xl" placeholder="e.g. Apply to affected eye" />
                  </div>
                </div>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" className="rounded-xl bg-[#1A7A46] text-white hover:bg-[#0F4D2A]" onClick={saveMed}>
                    {editingMed ? 'Update' : 'Add'}
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setShowMedForm(false)}>Cancel</Button>
                </div>
              </div>
            )}

            {medications.length === 0 ? (
              <p className="text-xs text-[#7A9A87]">No medications recorded.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-[#E2DDD5]">
                <table className="w-full text-xs">
                  <thead className="bg-[#FAFAF8]">
                    <tr>
                      {['Drug', 'Dosage', 'Frequency', 'Duration', 'Status', ''].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-[#7A9A87]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {medications.map((med) => (
                      <tr key={med.id} className="border-t border-[#F0EDE6] hover:bg-[#FAFAF8]">
                        <td className="px-3 py-2 font-medium text-[#1C2B22]">{med.drugName}</td>
                        <td className="px-3 py-2 text-[#4A6455]">{med.dosage || '-'}</td>
                        <td className="px-3 py-2 text-[#4A6455]">{med.frequency || '-'}</td>
                        <td className="px-3 py-2 text-[#4A6455]">{med.duration || '-'}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                            med.status === 'Prescribed' ? 'bg-[#FEF3DC] text-[#C47D11]' :
                            med.status === 'Taking' ? 'bg-[#E8F5EE] text-[#1A7A46]' :
                            med.status === 'Completed' ? 'bg-[#F0EDE6] text-[#4A6455]' :
                            'bg-[#FCE8E8] text-[#B52A2A]'
                          }`}>{med.status}</span>
                        </td>
                        <td className="px-3 py-2">
                          {can('followups', 'edit') && (
                            <div className="flex gap-1">
                              <button onClick={() => openEditMed(med)} className="rounded p-1 text-[#7A9A87] hover:bg-[#E8F5EE] hover:text-[#1A7A46]"><Pencil size={11} /></button>
                              <button onClick={() => deleteMed(med)} className="rounded p-1 text-[#7A9A87] hover:bg-[#FCE8E8] hover:text-[#B52A2A]"><Trash2 size={11} /></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </InlineForm>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-[#E2DDD5] pb-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setPage(1); }}
            className={`flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-xs font-semibold transition-colors ${
              tab === t.id
                ? 'border-b-2 border-[#1A7A46] text-[#0F4D2A]'
                : 'text-[#4A6455] hover:text-[#1C2B22]'
            }`}
          >
            {t.label}
            {counts[t.id] > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                tab === t.id ? 'bg-[#E8F5EE] text-[#0F4D2A]' : 'bg-[#F0EDE6] text-[#4A6455]'
              }`}>{counts[t.id]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by patient name, region, or milestone…"
          className="max-w-sm rounded-xl"
        />
        {search && (
          <button onClick={() => setSearch('')} className="rounded-lg p-1.5 text-[#7A9A87] hover:bg-[#F0EDE6]">
            <X size={14} />
          </button>
        )}
        <span className="text-xs text-[#7A9A87]">{total} record{total !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <Card className="overflow-hidden border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-[#F0EDE6] bg-[#FAFAF8]">
                <tr>
                  {['Patient', 'Region', 'Milestone', 'Due', 'Days', 'Status', 'Dr. Review', 'Completed By', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#7A9A87]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={9} className="py-10 text-center text-sm text-[#7A9A87]">Loading follow-ups…</td></tr>
                )}
                {!isLoading && followUps.length === 0 && (
                  <tr><td colSpan={9} className="py-10 text-center text-sm text-[#7A9A87]">No follow-ups found.</td></tr>
                )}
                {!isLoading && followUps.map((fu) => {
                  const days = daysUntil(fu.dueDate);
                  return (
                    <tr key={fu.id} className="border-b border-[#F0EDE6] hover:bg-[#FAFAF8]">
                      <td className="px-4 py-3 font-medium text-[#1C2B22]">{fu.patientName}</td>
                      <td className="px-4 py-3 text-[#4A6455]">{fu.region}</td>
                      <td className="px-4 py-3"><span className={milestoneBadge(fu.milestone)}>{fu.milestone}</span></td>
                      <td className="px-4 py-3 text-[#4A6455]">{formatDate(fu.dueDate)}</td>
                      <td className="px-4 py-3 text-xs text-[#4A6455]">
                        {fu.status === 'Completed' ? '-' : days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d`}
                      </td>
                      <td className="px-4 py-3"><span className={statusBadge(fu.status)}>{fu.status}</span></td>
                      <td className="px-4 py-3"><span className={drBadge(fu.doctorReviewStatus)}>{fu.doctorReviewStatus}</span></td>
                      <td className="px-4 py-3 text-[#4A6455]">{fu.completedByName || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {fu.status !== 'Completed' && can('followups', 'edit') && (
                            <button onClick={() => complete(fu)} title="Mark complete" className="rounded-lg p-1.5 text-[#7A9A87] hover:bg-[#E8F5EE] hover:text-[#1A7A46]">
                              <CheckCircle size={14} />
                            </button>
                          )}
                          {can('followups', 'edit') && (
                            <button onClick={() => openEdit(fu)} title="Edit" className="rounded-lg p-1.5 text-[#7A9A87] hover:bg-[#E8F5EE] hover:text-[#1A7A46]">
                              <Pencil size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        </CardContent>
      </Card>
    </div>
  );
}
