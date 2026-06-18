'use client';

import { useEffect, useState } from 'react';
import type { FollowUp, FollowUpMedication, FollowUpStatus, DoctorReviewStatus, MedicationStatus } from '@/types';
import {
  actionUpdateFollowUp, checkAndMarkOverdue, getFollowUpsPaginated, getFollowUpTabCounts,
  getMedicationsForFollowUp,
  actionCreateMedication, actionUpdateMedication, actionDeleteMedication,
} from '@/app/actions/follow_ups';
import type { FollowUpGroup } from '@/app/actions/follow_ups';
import Pagination from '@/components/ui/Pagination';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ModalForm from '@/components/forms/ModalForm';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { TableSkeletonRows } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { daysUntil, formatDate } from '@/lib/utils';
import { usePermissions } from '@/lib/auth';
import { patientDisplayName } from '@/lib/patient-code';
import { AlertTriangle, CheckCircle, ChevronDown, ChevronRight, Clock, Eye, Pencil, Plus, Trash2, UserX, X } from 'lucide-react';

const PAGE_SIZE = 50;

// ─── Constants ────────────────────────────────────────────────────────────────

const DR_STATUSES: DoctorReviewStatus[] = ['Not Needed', 'Pending', 'Completed'];
const MED_STATUSES: MedicationStatus[] = ['Prescribed', 'Taking', 'Completed', 'Stopped'];

type Tab = 'due' | 'overdue' | 'missed' | 'needs-review' | 'review-completed' | 'all';

const TABS: { id: Tab; label: string }[] = [
  { id: 'due', label: 'Due Follow-ups' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'missed', label: 'Missed' },
  { id: 'needs-review', label: 'Needs Doctor Review' },
  { id: 'review-completed', label: 'Doctor Review Completed' },
  { id: 'all', label: 'All Follow-ups' },
];

const MILESTONE_FLOW = [
  { milestone: 'Day 1', timing: '24 hours', focus: 'Early recovery check' },
  { milestone: 'Week 1', timing: '7 days', focus: 'Healing and medicines' },
  { milestone: 'Month 1', timing: '30 days', focus: 'Vision and complications' },
] as const;

const BLANK: Omit<FollowUp, 'id' | 'createdAt'> = {
  patientId: '', patientCode: '', patientName: '', surgeryId: '', campaignId: '', region: '',
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
    Pending: 'bg-[#EAEEF3] text-[#141920]',
    Due: 'bg-[#FFF5E6] text-[#F59E0B]',
    Overdue: 'bg-[#FDECEB] text-[#E53935]',
    Completed: 'bg-[#EBF7EE] text-[#2C9942]',
    Missed: 'bg-[#FDECEB] text-[#E53935]',
  };
  return `rounded-full px-2 py-1 text-xs font-medium ${styles[status] ?? 'bg-[#EAEEF3] text-[#141920]'}`;
}

function drBadge(status: DoctorReviewStatus) {
  const styles: Record<DoctorReviewStatus, string> = {
    'Not Needed': 'bg-[#EAEEF3] text-[#4B5666]',
    Pending: 'bg-[#FFF5E6] text-[#F59E0B]',
    Completed: 'bg-[#EBF7EE] text-[#2C9942]',
  };
  return `rounded-full px-2 py-1 text-xs font-medium ${styles[status] ?? 'bg-[#EAEEF3] text-[#4B5666]'}`;
}

function milestoneBadge(m: string) {
  const c = m === 'Day 1' ? 'bg-[#EBF7EE] text-[#002E63]' : m === 'Week 1' ? 'bg-[#A6DCB5] text-[#2C9942]' : 'bg-[#FFF5E6] text-[#F59E0B]';
  return `rounded-full px-2 py-1 text-xs font-medium ${c}`;
}

function followUpBelongsToTab(followUp: FollowUp, target: Tab) {
  if (target === 'due') return ['Pending', 'Due'].includes(followUp.status);
  if (target === 'overdue') return followUp.status === 'Overdue';
  if (target === 'missed') return followUp.status === 'Missed';
  if (target === 'needs-review') return followUp.needsDoctorReview && followUp.doctorReviewStatus === 'Pending';
  if (target === 'review-completed') return followUp.doctorReviewStatus === 'Completed';
  return true;
}

function groupBelongsToTab(group: FollowUpGroup, target: Tab) {
  return group.followUps.some((followUp) => followUpBelongsToTab(followUp, target));
}

function groupSummary(group: FollowUpGroup) {
  const completed = group.followUps.filter((fu) => fu.status === 'Completed').length;
  const missed = group.followUps.filter((fu) => fu.status === 'Missed').length;
  const overdue = group.followUps.filter((fu) => fu.status === 'Overdue').length;
  const pending = group.followUps.filter((fu) => ['Pending', 'Due'].includes(fu.status)).length;
  return { completed, missed, overdue, pending, total: group.followUps.length };
}

function mostUrgentFollowUp(group: FollowUpGroup, target: Tab) {
  return group.followUps.find((fu) => followUpBelongsToTab(fu, target)) ?? group.followUps[0];
}

function updateFollowUpInGroups(groups: FollowUpGroup[], updated: FollowUp, target: Tab) {
  return groups.flatMap((group) => {
    if (group.surgeryId !== updated.surgeryId) return [group];
    const followUps = group.followUps.map((followUp) => followUp.id === updated.id ? updated : followUp);
    const nextGroup = { ...group, followUps };
    return groupBelongsToTab(nextGroup, target) ? [nextGroup] : [];
  });
}

function nextActionForCounts(counts: Record<Tab, number>) {
  if (counts.overdue > 0) {
    return {
      tab: 'overdue' as Tab,
      title: 'Overdue follow-ups',
      count: counts.overdue,
      detail: 'Start here before routine due visits.',
      tone: 'red' as const,
      Icon: AlertTriangle,
    };
  }
  if (counts.due > 0) {
    return {
      tab: 'due' as Tab,
      title: 'Follow-ups due',
      count: counts.due,
      detail: 'Complete today and keep the patient schedule current.',
      tone: 'amber' as const,
      Icon: Clock,
    };
  }
  if (counts['needs-review'] > 0) {
    return {
      tab: 'needs-review' as Tab,
      title: 'Doctor review needed',
      count: counts['needs-review'],
      detail: 'Send clinical problem cases for doctor review.',
      tone: 'amber' as const,
      Icon: Eye,
    };
  }
  return {
    tab: 'all' as Tab,
    title: 'Follow-up queue clear',
    count: counts.all,
    detail: 'Review all records or wait for the next due date.',
    tone: 'green' as const,
    Icon: CheckCircle,
  };
}

const ACTION_PANEL_TONE = {
  red: 'border-[#FACDCB] bg-[#FDECEB] text-[#E53935]',
  amber: 'border-[#FFE3B3] bg-[#FFF5E6] text-[#A16207]',
  green: 'border-[#A6DCB5] bg-[#EBF7EE] text-[#238038]',
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function FollowUpsPage() {
  const { can } = usePermissions();
  const [followUpGroups, setFollowUpGroups] = useState<FollowUpGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [counts, setCounts] = useState<Record<Tab, number>>({ due: 0, overdue: 0, missed: 0, 'needs-review': 0, 'review-completed': 0, all: 0 });
  const [form, setForm] = useState(BLANK);
  const [editing, setEditing] = useState<FollowUp | null>(null);
  const [tab, setTab] = useState<Tab>('due');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Medications state
  const [medications, setMedications] = useState<FollowUpMedication[]>([]);
  const [medForm, setMedForm] = useState<Omit<FollowUpMedication, 'id' | 'createdAt' | 'followUpId'>>(BLANK_MED);
  const [editingMed, setEditingMed] = useState<FollowUpMedication | null>(null);
  const [deleteMedTarget, setDeleteMedTarget] = useState<FollowUpMedication | null>(null);
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
        if (!cancelled) { setFollowUpGroups(data); setTotal(t); setIsLoading(false); }
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

  function toggleGroup(surgeryId: string) {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(surgeryId)) next.delete(surgeryId);
      else next.add(surgeryId);
      return next;
    });
  }

  function setRecoveryStatus(hasProblem: boolean) {
    setForm((current) => ({
      ...current,
      needsDoctorReview: hasProblem,
      doctorReviewStatus: hasProblem && current.doctorReviewStatus === 'Not Needed'
        ? 'Pending'
        : !hasProblem
          ? 'Not Needed'
          : current.doctorReviewStatus,
    }));
    if (!hasProblem) {
      setShowMedForm(false);
      setEditingMed(null);
      setMedError('');
    }
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
    if (!result.ok) {
      setSaveError(result.error);
      toast({ title: 'Follow-up update failed', description: result.error, variant: 'error' });
      return;
    }
    setFollowUpGroups((groups) => {
      const next = updateFollowUpInGroups(groups, result.data, tab);
      if (next.length < groups.length) setTotal((current) => Math.max(0, current - 1));
      return next;
    });
    toast({ title: 'Follow-up updated', description: `${patientDisplayName(result.data.patientName, result.data.patientCode)} - ${result.data.milestone}` });
    // Refresh counts
    getFollowUpTabCounts().then(setCounts);
    closeForm();
  }

  async function complete(followUp: FollowUp) {
    if (!confirm(`Mark ${followUp.milestone} follow-up for "${patientDisplayName(followUp.patientName, followUp.patientCode)}" as completed?`)) return;
    const result = await actionUpdateFollowUp(followUp.id, {
      ...followUp,
      status: 'Completed',
      completedAt: new Date().toISOString(),
    });
    if (result.ok) {
      setFollowUpGroups((groups) => {
        const next = updateFollowUpInGroups(groups, result.data, tab);
        if (next.length < groups.length) setTotal((current) => Math.max(0, current - 1));
        return next;
      });
      toast({ title: 'Follow-up completed', description: `${patientDisplayName(result.data.patientName, result.data.patientCode)} - ${result.data.milestone}` });
      getFollowUpTabCounts().then(setCounts);
    } else {
      toast({ title: 'Could not complete follow-up', description: result.error, variant: 'error' });
    }
  }

  async function markMissed(followUp: FollowUp) {
    if (!confirm(`Mark ${followUp.milestone} follow-up for "${patientDisplayName(followUp.patientName, followUp.patientCode)}" as missed?`)) return;
    const result = await actionUpdateFollowUp(followUp.id, {
      ...followUp,
      status: 'Missed',
      completedAt: '',
    });
    if (result.ok) {
      setFollowUpGroups((groups) => {
        const next = updateFollowUpInGroups(groups, result.data, tab);
        if (next.length < groups.length) setTotal((current) => Math.max(0, current - 1));
        return next;
      });
      toast({ title: 'Follow-up marked missed', description: `${patientDisplayName(result.data.patientName, result.data.patientCode)} - ${result.data.milestone}` });
      getFollowUpTabCounts().then(setCounts);
    } else {
      toast({ title: 'Could not mark follow-up missed', description: result.error, variant: 'error' });
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
      if (!result.ok) {
        setMedError(result.error);
        toast({ title: 'Medication update failed', description: result.error, variant: 'error' });
        return;
      }
      setMedications((prev) => prev.map((m) => m.id === editingMed.id ? result.data : m));
      toast({ title: 'Medication updated', description: result.data.drugName });
    } else {
      const result = await actionCreateMedication({ ...medForm, followUpId: editing.id });
      if (!result.ok) {
        setMedError(result.error);
        toast({ title: 'Medication add failed', description: result.error, variant: 'error' });
        return;
      }
      setMedications((prev) => [...prev, result.data]);
      toast({ title: 'Medication added', description: result.data.drugName });
    }
    setShowMedForm(false);
    setEditingMed(null);
  }

  async function confirmDeleteMed() {
    if (!deleteMedTarget) return;
    const result = await actionDeleteMedication(deleteMedTarget.id);
    if (result.ok) {
      const drugName = deleteMedTarget.drugName;
      setMedications((prev) => prev.filter((m) => m.id !== deleteMedTarget.id));
      toast({ title: 'Medication deleted', description: drugName });
    } else {
      toast({ title: 'Medication delete failed', description: result.error, variant: 'error' });
    }
    setDeleteMedTarget(null);
  }

  const showDoctorSection = form.needsDoctorReview || form.doctorReviewStatus !== 'Not Needed';
  const nextAction = nextActionForCounts(counts);
  const NextActionIcon = nextAction.Icon;

  return (
    <div className="space-y-4">
      <ConfirmDialog
        open={!!deleteMedTarget}
        title="Delete Medication"
        description={deleteMedTarget ? `Remove ${deleteMedTarget.drugName} from this follow-up record? This cannot be undone.` : ''}
        confirmLabel="Delete Medication"
        confirmationText="DELETE"
        onConfirm={confirmDeleteMed}
        onCancel={() => setDeleteMedTarget(null)}
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#141920]">Follow-ups</h1>
          <p className="text-sm text-[#4B5666]">Day 1, Week 1, and Month 1 follow-ups after completed surgery</p>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-xl border border-[#DDE3EA] bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-[#141920]">Patient Follow-up Flow</p>
              <p className="text-xs text-[#647184]">Completed surgery creates the follow-up schedule automatically.</p>
            </div>
            <span className="rounded-full bg-[#EBF7EE] px-2.5 py-1 text-xs font-semibold text-[#238038]">
              3 required milestones
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {MILESTONE_FLOW.map((step, index) => (
              <div key={step.milestone} className="relative rounded-lg border border-[#EAEEF3] bg-[#F8FAFC] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className={milestoneBadge(step.milestone)}>{step.milestone}</span>
                  <span className="text-[11px] font-semibold text-[#647184]">{step.timing}</span>
                </div>
                <p className="mt-3 text-sm font-semibold text-[#141920]">{step.focus}</p>
                <p className="mt-1 text-xs text-[#647184]">Step {index + 1} of 3</p>
              </div>
            ))}
          </div>
        </div>

        <div className={`rounded-xl border p-4 shadow-sm ${ACTION_PANEL_TONE[nextAction.tone]}`}>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/70">
              <NextActionIcon size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold">{nextAction.title}</p>
              <p className="mt-1 text-2xl font-bold">{nextAction.count.toLocaleString()}</p>
              <p className="mt-1 text-xs opacity-90">{nextAction.detail}</p>
            </div>
          </div>
          <p className="mt-4 rounded-lg bg-white px-3 py-2 text-center text-xs font-semibold text-[#002E63] shadow-sm">
            Use the filter tabs below to open this queue.
          </p>
        </div>
      </section>

      {/* Edit form */}
      {showForm && (
        <ModalForm
          title={editing ? `Follow-up - ${patientDisplayName(editing.patientName, editing.patientCode)} - ${editing.milestone}` : 'Follow-up'}
          subtitle="Record the clinical check, then escalate only if the patient has a problem."
          onClose={closeForm}
          onSave={save}
          saveLabel="Save Follow-up"
          saveDisabled={!editing}
          wide
        >
          {saveError && <p className="mb-3 text-xs text-[#E53935]">{saveError}</p>}

          {/* Clinical section */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <Label className="mb-1 block text-xs">Patient</Label>
              <Input value={patientDisplayName(form.patientName, form.patientCode)} disabled className="rounded-xl bg-[#F5F7FA]" />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Milestone</Label>
              <Input value={form.milestone} disabled className="rounded-xl bg-[#F5F7FA]" />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Current Queue Status</Label>
              <div className="flex h-10 items-center rounded-xl border border-[#DDE3EA] bg-[#F5F7FA] px-3">
                <span className={statusBadge(form.status)}>{form.status}</span>
              </div>
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
            <div className="md:col-span-4">
              <Label className="mb-2 block text-xs">Visit Outcome</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => set('status', 'Completed')}
                  className={`rounded-xl border px-4 py-3 text-left transition ${
                    form.status === 'Completed'
                      ? 'border-[#2C9942] bg-[#EBF7EE] text-[#002E63] ring-1 ring-[#A6DCB5]'
                      : 'border-[#DDE3EA] bg-white text-[#4B5666] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <span className="block text-sm font-semibold">Completed</span>
                  <span className="mt-1 block text-xs">The patient attended and this follow-up was done.</span>
                </button>
                <button
                  type="button"
                  onClick={() => set('status', 'Missed')}
                  className={`rounded-xl border px-4 py-3 text-left transition ${
                    form.status === 'Missed'
                      ? 'border-[#E53935] bg-[#FDECEB] text-[#8A1F1D] ring-1 ring-[#FACDCB]'
                      : 'border-[#DDE3EA] bg-white text-[#4B5666] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <span className="block text-sm font-semibold">Missed</span>
                  <span className="mt-1 block text-xs">The patient did not attend or the visit could not be completed.</span>
                </button>
              </div>
            </div>
            <div className="md:col-span-4">
              <Label className="mb-2 block text-xs">Recovery Status</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setRecoveryStatus(false)}
                  className={`rounded-xl border px-4 py-3 text-left transition ${
                    !showDoctorSection
                      ? 'border-[#2C9942] bg-[#EBF7EE] text-[#002E63] ring-1 ring-[#A6DCB5]'
                      : 'border-[#DDE3EA] bg-white text-[#4B5666] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <span className="block text-sm font-semibold">Patient okay</span>
                  <span className="mt-1 block text-xs">No doctor review or medication needed.</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRecoveryStatus(true)}
                  className={`rounded-xl border px-4 py-3 text-left transition ${
                    showDoctorSection
                      ? 'border-[#F59E0B] bg-[#FFF5E6] text-[#7C4A03] ring-1 ring-[#FFE3B3]'
                      : 'border-[#DDE3EA] bg-white text-[#4B5666] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <span className="block text-sm font-semibold">Problem / doctor review needed</span>
                  <span className="mt-1 block text-xs">Show review fields and optional medications.</span>
                </button>
              </div>
            </div>
            <div className="md:col-span-4">
              <Label className="mb-1 block text-xs">Follow-up Notes</Label>
              <textarea
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                className="h-20 w-full resize-none rounded-xl border border-[#DDE3EA] px-3 py-2 text-sm outline-none focus:border-[#2C9942]"
              />
            </div>
          </div>

          {/* Doctor review section */}
          {showDoctorSection && (
            <div className="mt-4 rounded-xl border border-[#FFE3B3] bg-[#FFF5E6]/60 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#F59E0B]">Doctor Review</p>
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
                    className="h-16 w-full resize-none rounded-xl border border-[#DDE3EA] bg-white px-3 py-2 text-sm outline-none focus:border-[#2C9942]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Medications section */}
          {showDoctorSection && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#4B5666]">Medications</p>
              {can('followups', 'edit') && (
                <button
                  type="button"
                  onClick={openAddMed}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#2C9942] hover:bg-[#EBF7EE]"
                >
                  <Plus size={12} />Add medication
                </button>
              )}
            </div>

            {showMedForm && (
              <div className="mb-3 rounded-xl border border-[#DDE3EA] bg-[#F5F7FA] p-3">
                {medError && <p className="mb-2 text-xs text-[#E53935]">{medError}</p>}
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
                  <Button size="sm" className="rounded-xl bg-[#2C9942] text-white hover:bg-[#002E63]" onClick={saveMed}>
                    {editingMed ? 'Update' : 'Add'}
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setShowMedForm(false)}>Cancel</Button>
                </div>
              </div>
            )}

            {medications.length === 0 ? (
              <p className="text-xs text-[#647184]">No medications recorded.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-[#DDE3EA]">
                <table className="w-full text-xs">
                  <thead className="bg-[#F5F7FA]">
                    <tr>
                      {['Drug', 'Dosage', 'Frequency', 'Duration', 'Status', ''].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-[#647184]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {medications.map((med) => (
                      <tr key={med.id} className="border-t border-[#EAEEF3] hover:bg-[#F5F7FA]">
                        <td className="px-3 py-2 font-medium text-[#141920]">{med.drugName}</td>
                        <td className="px-3 py-2 text-[#4B5666]">{med.dosage || '-'}</td>
                        <td className="px-3 py-2 text-[#4B5666]">{med.frequency || '-'}</td>
                        <td className="px-3 py-2 text-[#4B5666]">{med.duration || '-'}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                            med.status === 'Prescribed' ? 'bg-[#FFF5E6] text-[#F59E0B]' :
                            med.status === 'Taking' ? 'bg-[#EBF7EE] text-[#2C9942]' :
                            med.status === 'Completed' ? 'bg-[#EAEEF3] text-[#4B5666]' :
                            'bg-[#FDECEB] text-[#E53935]'
                          }`}>{med.status}</span>
                        </td>
                        <td className="px-3 py-2">
                          {can('followups', 'edit') && (
                            <div className="flex gap-1">
                              <button onClick={() => openEditMed(med)} className="rounded p-1 text-[#647184] hover:bg-[#EBF7EE] hover:text-[#2C9942]"><Pencil size={11} /></button>
                              <button onClick={() => setDeleteMedTarget(med)} className="rounded p-1 text-[#647184] hover:bg-[#FDECEB] hover:text-[#E53935]"><Trash2 size={11} /></button>
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
          )}
        </ModalForm>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-[#DDE3EA] pb-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setPage(1); }}
            className={`flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-xs font-semibold transition-colors ${
              tab === t.id
                ? 'border-b-2 border-[#2C9942] text-[#002E63]'
                : 'text-[#4B5666] hover:text-[#141920]'
            }`}
          >
            {t.label}
            {counts[t.id] > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                tab === t.id ? 'bg-[#EBF7EE] text-[#002E63]' : 'bg-[#EAEEF3] text-[#4B5666]'
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
          <button onClick={() => setSearch('')} className="rounded-lg p-1.5 text-[#647184] hover:bg-[#EAEEF3]">
            <X size={14} />
          </button>
        )}
        <span className="text-xs text-[#647184]">{total} patient follow-up group{total !== 1 ? 's' : ''}</span>
      </div>

      {/* Grouped follow-up list */}
      <Card className="overflow-hidden border-0 shadow-sm">
        <CardContent className="p-0">
          {isLoading && (
            <div className="p-4">
              <table className="w-full text-sm">
                <tbody><TableSkeletonRows rows={6} columns={6} /></tbody>
              </table>
            </div>
          )}
          {!isLoading && followUpGroups.length === 0 && (
            <div className="py-10 text-center text-sm text-[#647184]">No follow-ups found.</div>
          )}
          {!isLoading && followUpGroups.length > 0 && (
            <div className="divide-y divide-[#EAEEF3]">
              {followUpGroups.map((group) => {
                const summary = groupSummary(group);
                const urgent = mostUrgentFollowUp(group, tab);
                const urgentDays = daysUntil(urgent.dueDate);
                const expanded = expandedGroups.has(group.surgeryId);
                return (
                  <section key={group.surgeryId}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.surgeryId)}
                      className="flex w-full flex-wrap items-start justify-between gap-3 p-4 text-left transition hover:bg-[#F8FAFC]"
                      aria-expanded={expanded}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#EAEEF3] text-[#647184]">
                          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-semibold text-[#141920]">{patientDisplayName(group.patientName, group.patientCode)}</span>
                          <span className="mt-0.5 block text-xs text-[#647184]">{group.region} · Click to {expanded ? 'hide' : 'view'} follow-up milestones</span>
                        </span>
                      </div>
                      <span className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-full bg-[#EBF7EE] px-2 py-1 font-semibold text-[#2C9942]">{summary.completed}/{summary.total} completed</span>
                        {summary.overdue > 0 && <span className="rounded-full bg-[#FDECEB] px-2 py-1 font-semibold text-[#E53935]">{summary.overdue} overdue</span>}
                        {summary.missed > 0 && <span className="rounded-full bg-[#FDECEB] px-2 py-1 font-semibold text-[#8A1F1D]">{summary.missed} missed</span>}
                        {summary.pending > 0 && <span className="rounded-full bg-[#FFF5E6] px-2 py-1 font-semibold text-[#A16207]">{summary.pending} pending</span>}
                        <span className="rounded-full bg-[#EAEEF3] px-2 py-1 font-medium text-[#4B5666]">
                          Next: {urgent.milestone} · {urgent.status === 'Completed' ? 'done' : urgentDays < 0 ? `${Math.abs(urgentDays)}d overdue` : urgentDays === 0 ? 'today' : `${urgentDays}d`}
                        </span>
                      </span>
                    </button>
                    {expanded && (
                    <div className="grid grid-cols-1 gap-3 px-4 pb-4 lg:grid-cols-3">
                      {group.followUps.map((fu) => {
                        const days = daysUntil(fu.dueDate);
                        return (
                          <div key={fu.id} className="rounded-lg border border-[#EAEEF3] bg-[#F8FAFC] p-3">
                            <div className="flex items-start justify-between gap-2">
                              <span className={milestoneBadge(fu.milestone)}>{fu.milestone}</span>
                              <span className={statusBadge(fu.status)}>{fu.status}</span>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[#4B5666]">
                              <div>
                                <p className="font-semibold uppercase tracking-wide text-[#647184]">Due</p>
                                <p className="mt-0.5">{formatDate(fu.dueDate)}</p>
                              </div>
                              <div>
                                <p className="font-semibold uppercase tracking-wide text-[#647184]">Days</p>
                                <p className="mt-0.5">{fu.status === 'Completed' ? '-' : days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d`}</p>
                              </div>
                              <div>
                                <p className="font-semibold uppercase tracking-wide text-[#647184]">Dr. Review</p>
                                <p className="mt-1"><span className={drBadge(fu.doctorReviewStatus)}>{fu.doctorReviewStatus}</span></p>
                              </div>
                              <div>
                                <p className="font-semibold uppercase tracking-wide text-[#647184]">Completed By</p>
                                <p className="mt-0.5">{fu.completedByName || '-'}</p>
                              </div>
                            </div>
                            {can('followups', 'edit') && (
                              <div className="mt-3 flex justify-end gap-1">
                                {!['Completed', 'Missed'].includes(fu.status) && (
                                  <button onClick={() => complete(fu)} title="Mark complete" className="rounded-lg p-1.5 text-[#647184] hover:bg-[#EBF7EE] hover:text-[#2C9942]">
                                    <CheckCircle size={14} />
                                  </button>
                                )}
                                {!['Completed', 'Missed'].includes(fu.status) && (
                                  <button onClick={() => markMissed(fu)} title="Mark missed" className="rounded-lg p-1.5 text-[#647184] hover:bg-[#FDECEB] hover:text-[#E53935]">
                                    <UserX size={14} />
                                  </button>
                                )}
                                <button onClick={() => openEdit(fu)} title="Edit" className="rounded-lg p-1.5 text-[#647184] hover:bg-[#EBF7EE] hover:text-[#2C9942]">
                                  <Pencil size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        </CardContent>
      </Card>
    </div>
  );
}


