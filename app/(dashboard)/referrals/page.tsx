'use client';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { uid, formatDate } from '@/lib/utils';
import type { Referral, ReferralStatus } from '@/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import InlineForm from '@/components/forms/InlineForm';
import {
  Plus, Pencil, Trash2, X, Search, Microscope, Glasses, ClipboardList,
  CheckCircle2, Clock, AlertCircle, Phone, Scissors,
} from 'lucide-react';
import { usePermissions } from '@/lib/auth';

// â”€â”€â”€ Clinical referral types (from screening recommendations) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const REF_TYPES = ['Further Investigation', 'Glasses', 'Follow-up'] as const;
type RefType = typeof REF_TYPES[number];

const TYPE_META: Record<RefType, { label: string; icon: React.ElementType; bg: string; text: string; border: string }> = {
  'Further Investigation': { label: 'Further Investigation', icon: Microscope,    bg: 'bg-indigo-50',  text: 'text-indigo-700', border: 'border-indigo-200' },
  'Glasses':               { label: 'Glasses',               icon: Glasses,       bg: 'bg-sky-50',     text: 'text-sky-700',    border: 'border-sky-200'    },
  'Follow-up':             { label: 'Follow-up',             icon: ClipboardList, bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-200'  },
};

// Status pipeline for clinical referrals
const STATUSES: ReferralStatus[] = ['Pending', 'Contacted', 'Screened', 'Converted', 'Lost'];
const STATUS_META: Record<ReferralStatus, { label: string; icon: React.ElementType; bg: string; text: string }> = {
  Pending:   { label: 'Pending',     icon: Clock,          bg: 'bg-slate-100',  text: 'text-slate-600'  },
  Contacted: { label: 'Contacted',   icon: Phone,          bg: 'bg-blue-100',   text: 'text-blue-700'   },
  Screened:  { label: 'Under Review',icon: Microscope,     bg: 'bg-indigo-100', text: 'text-indigo-700' },
  Converted: { label: 'Completed',   icon: CheckCircle2,   bg: 'bg-green-100',  text: 'text-green-700'  },
  Lost:      { label: 'Lost',        icon: AlertCircle,    bg: 'bg-red-100',    text: 'text-red-600'    },
};

const BLANK: Omit<Referral, 'id' | 'createdAt'> = {
  patientName: '', patientPhone: '', source: 'Facility', referredBy: '',
  campaignId: '', locationId: '', status: 'Pending',
  referredAt: new Date().toISOString().split('T')[0],
  notes: 'Further Investigation',
};

function TypeBadge({ type }: { type: string }) {
  const meta = TYPE_META[type as RefType];
  if (!meta) return <span className="text-xs text-slate-400 italic">{type || 'â€”'}</span>;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${meta.bg} ${meta.text} ${meta.border}`}>
      <Icon size={11} />{meta.label}
    </span>
  );
}

function StatusBadge({ status }: { status: ReferralStatus }) {
  const m = STATUS_META[status];
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${m.bg} ${m.text}`}>
      <Icon size={10} />{m.label}
    </span>
  );
}

export default function ReferralsPage() {
  const { referrals, campaigns, locations, screenings, patients, addReferral, updateReferral, deleteReferral, addSurgery } = useStore();
  const { can } = usePermissions();
  const [transferTarget, setTransferTarget] = useState<Referral | null>(null);

  const [search, setSearch]     = useState('');
  const [filterType, setFilterType] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<Referral | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm]         = useState<typeof BLANK>(BLANK);

  // Only clinical referrals (not surgery â€” those go to Surgery section)
  const clinicalReferrals = referrals.filter((r) =>
    r.notes === 'Further Investigation' || r.notes === 'Glasses' || r.notes === 'Follow-up' || r.source !== 'Facility' || !r.notes
  );

  const filtered = clinicalReferrals.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.patientName.toLowerCase().includes(q) || r.patientPhone.includes(q) || r.referredBy.toLowerCase().includes(q);
    const matchType   = filterType === 'All' || r.notes === filterType;
    const matchStatus = filterStatus === 'All' || r.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  function openAdd() { setEditing(null); setForm(BLANK); setShowForm(true); }
  function openEdit(r: Referral) { setEditing(r); const { id, createdAt, ...rest } = r; setForm(rest); setShowForm(true); }
  function cancel() { setShowForm(false); setEditing(null); }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function set(k: keyof typeof BLANK, v: any) { if (v === null) return; setForm((f) => ({ ...f, [k]: v })); }
  function save() {
    if (editing) updateReferral({ ...editing, ...form });
    else addReferral({ id: uid(), createdAt: new Date().toISOString(), ...form });
    cancel();
  }
  function transferToSurgery(r: Referral) {
    // Find linked screening for pre-op VA / campaign / location
    const sc = screenings.find((s) => s.id === r.screeningId);
    const patient = patients.find((p) => p.patientName === r.patientName);
    addSurgery({
      id: uid(),
      createdAt: new Date().toISOString(),
      patientId: sc?.patientId ?? patient?.id ?? '',
      patientName: r.patientName,
      campaignId: r.campaignId,
      locationId: r.locationId,
      surgeonId: '',
      surgeonName: '',
      eye: 'Left',
      lensType: 'Foldable Acrylic',
      scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'Scheduled',
      preOpVA: sc?.vaRightUnaided ?? '6/60',
      complications: '',
      intraopNotes: `Escalated from Further Investigation referral. Referred by ${r.referredBy}.`,
    });
    // Mark referral as Converted (resolved by escalation)
    updateReferral({ ...r, status: 'Converted' });
    setTransferTarget(null);
  }

  function advanceStatus(r: Referral) {
    const idx = STATUSES.indexOf(r.status);
    if (idx < STATUSES.length - 2) updateReferral({ ...r, status: STATUSES[idx + 1] });
  }
  function setStatus(r: Referral, status: ReferralStatus) {
    updateReferral({ ...r, status });
  }

  // Stats
  const pending   = clinicalReferrals.filter((r) => r.status === 'Pending').length;
  const completed = clinicalReferrals.filter((r) => r.status === 'Converted').length;
  const byType: Record<string, number> = {};
  REF_TYPES.forEach((t) => { byType[t] = clinicalReferrals.filter((r) => r.notes === t).length; });

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Clinical Referrals</h1>
          <p className="text-sm text-slate-500">
            {clinicalReferrals.length} referrals Â· {pending} pending Â· {completed} completed
          </p>
        </div>
        <div className="flex items-center gap-2">
          {showForm && <Button variant="outline" onClick={cancel} className="gap-2 rounded-xl text-slate-600"><X size={14} />Cancel</Button>}
          {can('referrals', 'create') && !showForm && (
            <Button onClick={openAdd} className="bg-teal-600 hover:bg-teal-700 text-white gap-2 rounded-xl">
              <Plus size={15} />Add Referral
            </Button>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">Total</p>
            <p className="text-2xl font-bold text-slate-800">{clinicalReferrals.length}</p>
          </CardContent>
        </Card>
        {REF_TYPES.map((t) => {
          const meta = TYPE_META[t];
          const Icon = meta.icon;
          return (
            <Card key={t} className={`border-0 shadow-sm ${meta.bg}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon size={13} className={meta.text} />
                  <p className={`text-xs font-medium ${meta.text}`}>{meta.label}</p>
                </div>
                <p className={`text-2xl font-bold ${meta.text}`}>{byType[t] ?? 0}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <InlineForm
          title={editing ? `Edit â€” ${editing.patientName}` : 'New Clinical Referral'}
          onClose={cancel} onSave={save}
          saveLabel={editing ? 'Update' : 'Add Referral'}
          saveDisabled={!form.patientName.trim()}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="col-span-2">
              <Label className="text-xs mb-1 block">Patient Name *</Label>
              <Input value={form.patientName} onChange={(e) => set('patientName', e.target.value)} className="rounded-xl" placeholder="Full name" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Phone</Label>
              <Input value={form.patientPhone} onChange={(e) => set('patientPhone', e.target.value)} className="rounded-xl" placeholder="+252 â€¦" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Date</Label>
              <Input type="date" value={form.referredAt} onChange={(e) => set('referredAt', e.target.value)} className="rounded-xl" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Referral Type</Label>
              <select value={form.notes} onChange={(e) => set('notes', e.target.value)}
                className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 cursor-pointer">
                {REF_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Referred By</Label>
              <Input value={form.referredBy} onChange={(e) => set('referredBy', e.target.value)} className="rounded-xl" placeholder="Screener name" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Status</Label>
              <select value={form.status} onChange={(e) => set('status', e.target.value as ReferralStatus)}
                className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 cursor-pointer">
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Campaign</Label>
              <select value={form.campaignId} onChange={(e) => set('campaignId', e.target.value)}
                className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 cursor-pointer">
                <option value="">â€” Campaign â€”</option>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
        </InlineForm>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative min-w-[200px] max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patient or screenerâ€¦" className="pl-9 rounded-xl border-slate-200" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><X size={13} /></button>}
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-1 flex-wrap">
          {['All', ...REF_TYPES].map((t) => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`text-xs font-medium px-3 py-1.5 rounded-xl border transition-colors ${filterType === t ? 'bg-teal-600 text-white border-teal-600' : 'bg-white border-slate-200 text-slate-600 hover:border-teal-400'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1 flex-wrap">
          {['All', ...STATUSES].map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`text-xs font-medium px-3 py-1.5 rounded-xl border transition-colors ${filterStatus === s ? 'bg-slate-700 text-white border-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'}`}>
              {s === 'All' ? 'All Status' : STATUS_META[s as ReferralStatus].label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Patient', 'Phone', 'Type', 'Referred By', 'Date', 'Status', 'Location', ''].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-16 text-slate-400">
                      <ClipboardList size={32} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No clinical referrals found.</p>
                      <p className="text-xs mt-0.5">Referrals appear here when a screening recommends Further Investigation, Glasses, or Follow-up.</p>
                    </td>
                  </tr>
                )}
                {filtered.map((r) => {
                  const loc = locations.find((l) => l.id === r.locationId);
                  return (
                    <tr key={r.id} className={`border-b border-slate-50 hover:bg-slate-50/70 transition-colors ${editing?.id === r.id ? 'bg-teal-50/30' : ''}`}>
                      <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{r.patientName}</td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">{r.patientPhone || 'â€”'}</td>
                      <td className="px-4 py-3 whitespace-nowrap"><TypeBadge type={r.notes} /></td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{r.referredBy || 'â€”'}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{formatDate(r.referredAt)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {/* Inline status selector */}
                        <select
                          value={r.status}
                          onChange={(e) => setStatus(r, e.target.value as ReferralStatus)}
                          className={`text-xs font-medium px-2 py-0.5 rounded-full border-0 outline-none cursor-pointer ${STATUS_META[r.status].bg} ${STATUS_META[r.status].text}`}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>{STATUS_META[s].label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{loc?.name ?? 'â€”'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1 flex-wrap">
                          {/* Transfer to Surgery â€” only for Further Investigation */}
                          {r.notes === 'Further Investigation' && r.status !== 'Converted' && r.status !== 'Lost' && (
                            <button onClick={() => setTransferTarget(r)}
                              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold hover:bg-red-200 transition-colors whitespace-nowrap">
                              <Scissors size={9} />Transfer to Surgery
                            </button>
                          )}
                          {/* Advance status */}
                          {r.status !== 'Converted' && r.status !== 'Lost' && (
                            <button onClick={() => advanceStatus(r)}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 font-semibold hover:bg-teal-200 transition-colors whitespace-nowrap">
                              â†’ Next
                            </button>
                          )}
                          {can('referrals', 'edit') && (
                            <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600">
                              <Pencil size={13} />
                            </button>
                          )}
                          {can('referrals', 'delete') && (
                            <button onClick={() => setDeleteId(r.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600">
                              <Trash2 size={13} />
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
        </CardContent>
      </Card>

      {/* Info note */}
      <div className="flex items-start gap-2 text-xs text-slate-400 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
        <AlertCircle size={13} className="mt-0.5 text-amber-500 shrink-0" />
        <p>
          <span className="font-semibold text-slate-600">Surgery referrals</span> are automatically routed to the{' '}
          <span className="font-semibold text-slate-600">Surgery section</span> and do not appear here.
          Only <span className="font-semibold">Further Investigation</span>, <span className="font-semibold">Glasses</span>, and{' '}
          <span className="font-semibold">Follow-up</span> referrals are managed on this page.
        </p>
      </div>

      {/* Transfer to Surgery confirmation */}
      <AlertDialog open={!!transferTarget} onOpenChange={() => setTransferTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Scissors size={16} className="text-red-600" />
              Transfer to Surgery?
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{transferTarget?.patientName}</strong> will be moved from Further Investigation
              to the <strong>Surgery section</strong> with status <em>Scheduled</em>.
              This referral will be marked as Completed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => transferTarget && transferToSurgery(transferTarget)}
              className="bg-red-600 hover:bg-red-700 rounded-xl gap-2 flex items-center"
            >
              <Scissors size={13} />Transfer to Surgery
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Referral?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) deleteReferral(deleteId); setDeleteId(null); }} className="bg-red-600 hover:bg-red-700 rounded-xl">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
