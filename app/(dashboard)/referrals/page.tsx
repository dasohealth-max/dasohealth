'use client';
import { useState, useEffect } from 'react';
import { formatDate } from '@/lib/utils';
import type { Referral, ReferralStatus, Campaign, Location, Screening } from '@/types';
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
import { getAllReferrals, actionCreateReferral, actionUpdateReferral, actionDeleteReferral } from '@/app/actions/referrals';
import { getAllCampaigns } from '@/app/actions/campaigns';
import { getAllLocations } from '@/app/actions/locations';
import { getAllScreenings } from '@/app/actions/screenings';
import { actionCreateSurgery } from '@/app/actions/surgeries';

const REF_TYPES = ['Further Investigation', 'Glasses', 'Follow-up'] as const;
type RefType = typeof REF_TYPES[number];

const TYPE_META: Record<RefType, { label: string; icon: React.ElementType; bg: string; text: string; border: string }> = {
  'Further Investigation': { label: 'Further Investigation', icon: Microscope,    bg: 'bg-indigo-50',  text: 'text-indigo-700', border: 'border-indigo-200' },
  'Glasses':               { label: 'Glasses',               icon: Glasses,       bg: 'bg-sky-50',     text: 'text-sky-700',    border: 'border-sky-200'    },
  'Follow-up':             { label: 'Follow-up',             icon: ClipboardList, bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-200'  },
};

const STATUSES: ReferralStatus[] = ['Pending', 'Contacted', 'Screened', 'Converted', 'Lost'];
const STATUS_META: Record<ReferralStatus, { label: string; icon: React.ElementType; bg: string; text: string }> = {
  Pending:   { label: 'Pending',      icon: Clock,        bg: 'bg-slate-100',  text: 'text-slate-600'  },
  Contacted: { label: 'Contacted',    icon: Phone,        bg: 'bg-blue-100',   text: 'text-blue-700'   },
  Screened:  { label: 'Under Review', icon: Microscope,   bg: 'bg-indigo-100', text: 'text-indigo-700' },
  Converted: { label: 'Completed',    icon: CheckCircle2, bg: 'bg-green-100',  text: 'text-green-700'  },
  Lost:      { label: 'Lost',         icon: AlertCircle,  bg: 'bg-red-100',    text: 'text-red-600'    },
};

const BLANK: Omit<Referral, 'id' | 'createdAt'> = {
  patientName: '', patientPhone: '', source: 'Facility', referredBy: '',
  campaignId: '', locationId: '', status: 'Pending',
  referredAt: new Date().toISOString().split('T')[0],
  notes: 'Further Investigation',
};

function TypeBadge({ type }: { type: string }) {
  const meta = TYPE_META[type as RefType];
  if (!meta) return <span className="text-xs text-slate-400 italic">{type || '--'}</span>;
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
  const { can } = usePermissions();
  const [referrals, setReferrals]   = useState<Referral[]>([]);
  const [campaigns, setCampaigns]   = useState<Campaign[]>([]);
  const [locations, setLocations]   = useState<Location[]>([]);
  const [screenings, setScreenings] = useState<Screening[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [saveError, setSaveError]   = useState('');
  const [transferTarget, setTransferTarget] = useState<Referral | null>(null);
  const [search, setSearch]         = useState('');
  const [filterType, setFilterType]     = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState<Referral | null>(null);
  const [deleteId, setDeleteId]     = useState<string | null>(null);
  const [form, setForm]             = useState<typeof BLANK>(BLANK);

  useEffect(() => {
    Promise.all([getAllReferrals(), getAllCampaigns(), getAllLocations(), getAllScreenings()])
      .then(([r, c, l, s]) => { setReferrals(r); setCampaigns(c); setLocations(l); setScreenings(s); setIsLoading(false); });
  }, []);

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

  function openAdd() { setEditing(null); setForm(BLANK); setSaveError(''); setShowForm(true); }
  function openEdit(r: Referral) { setEditing(r); const { id, createdAt, ...rest } = r; setForm(rest); setSaveError(''); setShowForm(true); }
  function cancel() { setShowForm(false); setEditing(null); }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function set(k: keyof typeof BLANK, v: any) { if (v === null) return; setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    setSaveError('');
    if (editing) {
      const res = await actionUpdateReferral(editing.id, form);
      if (!res.ok) { setSaveError(res.error); return; }
      setReferrals((prev) => prev.map((r) => r.id === editing.id ? res.data : r));
    } else {
      const res = await actionCreateReferral(form);
      if (!res.ok) { setSaveError(res.error); return; }
      setReferrals((prev) => [res.data, ...prev]);
    }
    cancel();
  }

  async function transferToSurgery(r: Referral) {
    const sc = screenings.find((s) => s.id === r.screeningId);
    const res = await actionCreateSurgery({
      patientId: sc?.patientId ?? '',
      patientName: r.patientName,
      campaignId: r.campaignId,
      locationId: r.locationId,
      surgeonId: '',
      surgeonName: '',
      eye: 'Left',
      lensType: 'Foldable Acrylic',
      scheduledAt: new Date(Date.now() + 7 * 86400_000).toISOString(),
      status: 'Scheduled',
      preOpVA: sc?.vaRightUnaided ?? '6/60',
      complications: '',
      intraopNotes: `Escalated from Further Investigation referral. Referred by ${r.referredBy}.`,
    });
    if (res.ok) {
      const upd = await actionUpdateReferral(r.id, { ...r, status: 'Converted' });
      if (upd.ok) setReferrals((prev) => prev.map((x) => x.id === r.id ? upd.data : x));
    }
    setTransferTarget(null);
  }

  async function advanceStatus(r: Referral) {
    const idx = STATUSES.indexOf(r.status);
    if (idx >= STATUSES.length - 2) return;
    const res = await actionUpdateReferral(r.id, { ...r, status: STATUSES[idx + 1] });
    if (res.ok) setReferrals((prev) => prev.map((x) => x.id === r.id ? res.data : x));
  }

  async function setStatus(r: Referral, status: ReferralStatus) {
    const res = await actionUpdateReferral(r.id, { ...r, status });
    if (res.ok) setReferrals((prev) => prev.map((x) => x.id === r.id ? res.data : x));
  }

  const pending   = clinicalReferrals.filter((r) => r.status === 'Pending').length;
  const completed = clinicalReferrals.filter((r) => r.status === 'Converted').length;
  const byType: Record<string, number> = {};
  REF_TYPES.forEach((t) => { byType[t] = clinicalReferrals.filter((r) => r.notes === t).length; });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Clinical Referrals</h1>
          <p className="text-sm text-slate-500">
            {isLoading ? 'Loading...' : `${clinicalReferrals.length} referrals · ${pending} pending · ${completed} completed`}
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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

      {showForm && (
        <InlineForm
          title={editing ? `Edit - ${editing.patientName}` : 'New Clinical Referral'}
          onClose={cancel} onSave={save}
          saveLabel={editing ? 'Update' : 'Add Referral'}
          saveDisabled={!form.patientName.trim() || !form.campaignId || !form.locationId}>
          {saveError && <p className="text-xs text-red-600 mb-2">{saveError}</p>}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="col-span-2">
              <Label className="text-xs mb-1 block">Patient Name *</Label>
              <Input value={form.patientName} onChange={(e) => set('patientName', e.target.value)} className="rounded-xl" placeholder="Full name" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Phone</Label>
              <Input value={form.patientPhone} onChange={(e) => set('patientPhone', e.target.value)} className="rounded-xl" placeholder="+252 ..." />
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
              <Label className="text-xs mb-1 block">Campaign *</Label>
              <select value={form.campaignId} onChange={(e) => set('campaignId', e.target.value)}
                className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 cursor-pointer">
                <option value="">-- Campaign --</option>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Location *</Label>
              <select value={form.locationId} onChange={(e) => set('locationId', e.target.value)}
                className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 cursor-pointer">
                <option value="">-- Location --</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          </div>
        </InlineForm>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patient or screener..." className="pl-9 rounded-xl border-slate-200" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><X size={13} /></button>}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {['All', ...REF_TYPES].map((t) => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`text-xs font-medium px-3 py-1.5 rounded-xl border transition-colors ${filterType === t ? 'bg-teal-600 text-white border-teal-600' : 'bg-white border-slate-200 text-slate-600 hover:border-teal-400'}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {['All', ...STATUSES].map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`text-xs font-medium px-3 py-1.5 rounded-xl border transition-colors ${filterStatus === s ? 'bg-slate-700 text-white border-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'}`}>
              {s === 'All' ? 'All Status' : STATUS_META[s as ReferralStatus].label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-slate-400 text-sm">Loading...</div>
      ) : (
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
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">{r.patientPhone || '--'}</td>
                        <td className="px-4 py-3 whitespace-nowrap"><TypeBadge type={r.notes} /></td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{r.referredBy || '--'}</td>
                        <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{formatDate(r.referredAt)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <select
                            value={r.status}
                            onChange={(e) => setStatus(r, e.target.value as ReferralStatus)}
                            className={`text-xs font-medium px-2 py-0.5 rounded-full border-0 outline-none cursor-pointer ${STATUS_META[r.status].bg} ${STATUS_META[r.status].text}`}>
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>{STATUS_META[s].label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{loc?.name ?? '--'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1 flex-wrap">
                            {r.notes === 'Further Investigation' && r.status !== 'Converted' && r.status !== 'Lost' && (
                              <button onClick={() => setTransferTarget(r)}
                                className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold hover:bg-red-200 transition-colors whitespace-nowrap">
                                <Scissors size={9} />Transfer to Surgery
                              </button>
                            )}
                            {r.status !== 'Converted' && r.status !== 'Lost' && (
                              <button onClick={() => advanceStatus(r)}
                                className="text-[10px] px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 font-semibold hover:bg-teal-200 transition-colors whitespace-nowrap">
                                Next
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
      )}

      <div className="flex items-start gap-2 text-xs text-slate-400 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
        <AlertCircle size={13} className="mt-0.5 text-amber-500 shrink-0" />
        <p>
          <span className="font-semibold text-slate-600">Surgery referrals</span> are automatically routed to the{' '}
          <span className="font-semibold text-slate-600">Surgery section</span> and do not appear here.
          Only <span className="font-semibold">Further Investigation</span>, <span className="font-semibold">Glasses</span>, and{' '}
          <span className="font-semibold">Follow-up</span> referrals are managed on this page.
        </p>
      </div>

      <AlertDialog open={!!transferTarget} onOpenChange={() => setTransferTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Scissors size={16} className="text-red-600" />Transfer to Surgery?
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{transferTarget?.patientName}</strong> will be moved from Further Investigation
              to the <strong>Surgery section</strong> with status <em>Scheduled</em>.
              This referral will be marked as Completed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => transferTarget && transferToSurgery(transferTarget)}
              className="bg-red-600 hover:bg-red-700 rounded-xl gap-2 flex items-center">
              <Scissors size={13} />Transfer to Surgery
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader><AlertDialogTitle>Delete Referral?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (deleteId) { await actionDeleteReferral(deleteId); setReferrals((prev) => prev.filter((r) => r.id !== deleteId)); } setDeleteId(null); }} className="bg-red-600 hover:bg-red-700 rounded-xl">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
