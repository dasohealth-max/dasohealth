'use client';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { uid } from '@/lib/utils';
import type { Campaign, CampaignType, CampaignStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import InlineForm from '@/components/forms/InlineForm';
import { Plus, Pencil, Trash2, Megaphone, Calendar, DollarSign, Target, X } from 'lucide-react';
import { usePermissions } from '@/lib/auth';

const BLANK: Omit<Campaign, 'id' | 'createdAt'> = {
  name: '', type: 'Cataract', status: 'Planned', startDate: '', endDate: '',
  budget: 0, donors: '', targetScreenings: 0, targetSurgeries: 0, targetFollowUps: 0,
  locationIds: [], description: '',
};
const STATUS_COLORS: Record<CampaignStatus, string> = {
  Active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Planned: 'bg-amber-100 text-amber-700 border-amber-200',
  Completed: 'bg-slate-100 text-slate-600 border-slate-200',
  Suspended: 'bg-red-100 text-red-700 border-red-200',
};

export default function CampaignsPage() {
  const { campaigns, screenings, surgeries, addCampaign, updateCampaign, deleteCampaign } = useStore();
  const { can } = usePermissions();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<typeof BLANK>(BLANK);

  function openAdd() { setEditing(null); setForm(BLANK); setShowForm(true); }
  function openEdit(c: Campaign) { setEditing(c); const { id, createdAt, ...r } = c; setForm(r); setShowForm(true); }
  function cancel() { setShowForm(false); setEditing(null); }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function set(k: keyof typeof BLANK, v: any) { setForm((f) => ({ ...f, [k]: v })); }
  function save() {
    if (editing) updateCampaign({ ...editing, ...form });
    else addCampaign({ id: uid(), createdAt: new Date().toISOString(), ...form });
    cancel();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Campaigns</h1>
          <p className="text-sm text-slate-500">{campaigns.length} campaigns Â· {campaigns.filter((c) => c.status === 'Active').length} active</p>
        </div>
        {can('campaigns', 'create') && !showForm && <Button onClick={openAdd} className="bg-teal-600 hover:bg-teal-700 text-white gap-2 rounded-xl"><Plus size={15} />New Campaign</Button>}
        {showForm && <Button variant="outline" onClick={cancel} className="gap-2 rounded-xl text-slate-600"><X size={14} />Cancel</Button>}
      </div>

      {/* Inline form */}
      {showForm && (
        <InlineForm title={editing ? `Edit â€” ${editing.name}` : 'New Campaign'} onClose={cancel} onSave={save}
          saveLabel={editing ? 'Update Campaign' : 'Create Campaign'} saveDisabled={!form.name}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="col-span-2 md:col-span-2">
              <Label className="text-xs mb-1 block">Campaign Name *</Label>
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} className="rounded-xl" placeholder="e.g. Rural Cataract Outreach" />
            </div>
            <div><Label className="text-xs mb-1 block">Type</Label>
              <Select value={form.type} onValueChange={(v) => set('type', v)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{(['Cataract','School Eye Health','Diabetic Retinopathy','Glaucoma','General'] as CampaignType[]).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs mb-1 block">Status</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{(['Planned','Active','Completed','Suspended'] as CampaignStatus[]).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs mb-1 block">Start Date</Label><Input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} className="rounded-xl" /></div>
            <div><Label className="text-xs mb-1 block">End Date</Label><Input type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} className="rounded-xl" /></div>
            <div><Label className="text-xs mb-1 block">Budget ($)</Label><Input type="number" value={form.budget} onChange={(e) => set('budget', +e.target.value)} className="rounded-xl" /></div>
            <div><Label className="text-xs mb-1 block">Donors</Label><Input value={form.donors} onChange={(e) => set('donors', e.target.value)} className="rounded-xl" placeholder="WHO, Lions Clubâ€¦" /></div>
            <div><Label className="text-xs mb-1 block">Target Screenings</Label><Input type="number" value={form.targetScreenings} onChange={(e) => set('targetScreenings', +e.target.value)} className="rounded-xl" /></div>
            <div><Label className="text-xs mb-1 block">Target Surgeries</Label><Input type="number" value={form.targetSurgeries} onChange={(e) => set('targetSurgeries', +e.target.value)} className="rounded-xl" /></div>
            <div><Label className="text-xs mb-1 block">Target Follow-ups</Label><Input type="number" value={form.targetFollowUps} onChange={(e) => set('targetFollowUps', +e.target.value)} className="rounded-xl" /></div>
            <div className="col-span-2 md:col-span-4">
              <Label className="text-xs mb-1 block">Description</Label>
              <textarea value={form.description} onChange={(e) => set('description', e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 resize-none h-16" />
            </div>
          </div>
        </InlineForm>
      )}

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {campaigns.map((c) => {
          const cs = screenings.filter((s) => s.campaignId === c.id).length;
          const csg = surgeries.filter((s) => s.campaignId === c.id).length;
          const spct = c.targetScreenings ? Math.min(100, Math.round((cs / c.targetScreenings) * 100)) : 0;
          const sgpct = c.targetSurgeries ? Math.min(100, Math.round((csg / c.targetSurgeries) * 100)) : 0;
          return (
            <Card key={c.id} className={`border-0 shadow-sm hover:shadow-md transition-shadow ${editing?.id === c.id ? 'ring-1 ring-teal-300' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center shrink-0"><Megaphone size={16} className="text-teal-600" /></div>
                    <div><p className="font-semibold text-slate-800 text-sm leading-tight">{c.name}</p><p className="text-xs text-slate-400 mt-0.5">{c.type}</p></div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${STATUS_COLORS[c.status]}`}>{c.status}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5"><Calendar size={11} />{c.startDate} â†’ {c.endDate}</div>
                  <div className="flex items-center gap-1.5"><DollarSign size={11} />${c.budget.toLocaleString()}</div>
                </div>
                {c.donors && <p className="text-xs text-slate-400 truncate">Donors: {c.donors}</p>}
                <div className="space-y-1.5">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500 flex items-center gap-1"><Target size={10} />Screenings</span>
                      <span className="font-medium">{cs}/{c.targetScreenings}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-teal-500 rounded-full" style={{ width: `${spct}%` }} /></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500 flex items-center gap-1"><Target size={10} />Surgeries</span>
                      <span className="font-medium">{csg}/{c.targetSurgeries}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 rounded-full" style={{ width: `${sgpct}%` }} /></div>
                  </div>
                </div>
                <div className="flex gap-2 pt-1 border-t border-slate-100">
                  {can('campaigns','edit') && <Button size="sm" variant="outline" onClick={() => openEdit(c)} className="gap-1.5 rounded-lg text-xs flex-1"><Pencil size={11} />Edit</Button>}
                  {can('campaigns','delete') && <Button size="sm" variant="outline" onClick={() => setDeleteId(c.id)} className="gap-1.5 rounded-lg text-xs text-red-500 hover:bg-red-50 border-red-100"><Trash2 size={11} /></Button>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader><AlertDialogTitle>Delete Campaign?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) deleteCampaign(deleteId); setDeleteId(null); }} className="bg-red-600 hover:bg-red-700 rounded-xl">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
