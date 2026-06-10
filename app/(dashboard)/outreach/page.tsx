'use client';
import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { uid, formatDate } from '@/lib/utils';
import { getAllCampaigns } from '@/app/actions/campaigns';
import { getAllLocations } from '@/app/actions/locations';
import type { OutreachActivity, OutreachType, Campaign, Location } from '@/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import InlineForm from '@/components/forms/InlineForm';
import { Plus, Pencil, Trash2, HeartPulse, TrendingUp, X } from 'lucide-react';
import { usePermissions } from '@/lib/auth';

const TYPES: OutreachType[] = ['Awareness Campaign','Community Meeting','Radio Broadcast','School Visit','Health Fair','CHW Training'];
const BLANK: Omit<OutreachActivity,'id'|'createdAt'> = {
  type:'Community Meeting', title:'', date: new Date().toISOString().split('T')[0],
  locationId:'', locationName:'', campaignId:'', reach:0, conversions:0, conductedBy:'', notes:'',
};

export default function OutreachPage() {
  const { outreach, addOutreach, updateOutreach, deleteOutreach } = useStore();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  useEffect(() => {
    Promise.all([getAllCampaigns(), getAllLocations()]).then(([c, l]) => { setCampaigns(c); setLocations(l); });
  }, []);
  const { can } = usePermissions();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<OutreachActivity | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm]         = useState<typeof BLANK>(BLANK);

  const totalReach = outreach.reduce((a, o) => a + o.reach, 0);
  const totalConv  = outreach.reduce((a, o) => a + o.conversions, 0);

  function openAdd() { setEditing(null); setForm(BLANK); setShowForm(true); }
  function openEdit(o: OutreachActivity) { setEditing(o); const { id, createdAt, ...r } = o; setForm(r); setShowForm(true); }
  function cancel() { setShowForm(false); setEditing(null); }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function set(k: keyof typeof BLANK, v: any) { if (v === null) return; setForm((f) => ({ ...f, [k]: v })); }
  function handleLocation(lid: string | null) { if (!lid) return; const l = locations.find((x) => x.id === lid); set('locationId', lid); if (l) set('locationName', l.name); }
  function save() {
    if (editing) updateOutreach({ ...editing, ...form });
    else addOutreach({ id: uid(), createdAt: new Date().toISOString(), ...form });
    cancel();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Community Outreach</h1>
          <p className="text-sm text-slate-500">{outreach.length} activities Â· {totalReach.toLocaleString()} total reach</p>
        </div>
        {can('outreach','create') && !showForm && <Button onClick={openAdd} className="bg-teal-600 hover:bg-teal-700 text-white gap-2 rounded-xl"><Plus size={15} />Log Activity</Button>}
        {showForm && <Button variant="outline" onClick={cancel} className="gap-2 rounded-xl text-slate-600"><X size={14} />Cancel</Button>}
      </div>

      {showForm && (
        <InlineForm title={editing ? `Edit â€” ${editing.title}` : 'Log Outreach Activity'}
          onClose={cancel} onSave={save} saveLabel={editing ? 'Update' : 'Log Activity'} saveDisabled={!form.title}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="col-span-2"><Label className="text-xs mb-1 block">Title *</Label><Input value={form.title} onChange={(e) => set('title', e.target.value)} className="rounded-xl" /></div>
            <div><Label className="text-xs mb-1 block">Type</Label>
              <Select value={form.type} onValueChange={(v) => set('type', v)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs mb-1 block">Date</Label><Input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} className="rounded-xl" /></div>
            <div className="col-span-2"><Label className="text-xs mb-1 block">Location</Label>
              <Select value={form.locationId} onValueChange={handleLocation}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label className="text-xs mb-1 block">Campaign</Label>
              <Select value={form.campaignId} onValueChange={(v) => set('campaignId', v)}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs mb-1 block">Reach</Label><Input type="number" value={form.reach} onChange={(e) => set('reach', +e.target.value)} className="rounded-xl" /></div>
            <div><Label className="text-xs mb-1 block">Conversions</Label><Input type="number" value={form.conversions} onChange={(e) => set('conversions', +e.target.value)} className="rounded-xl" /></div>
            <div className="col-span-2"><Label className="text-xs mb-1 block">Conducted By</Label><Input value={form.conductedBy} onChange={(e) => set('conductedBy', e.target.value)} className="rounded-xl" /></div>
            <div className="col-span-2 md:col-span-4"><Label className="text-xs mb-1 block">Notes</Label>
              <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 resize-none h-14" />
            </div>
          </div>
        </InlineForm>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label:'Activities', value: outreach.length, icon: HeartPulse, color:'bg-teal-500' },
          { label:'Total Reach', value: totalReach.toLocaleString(), icon: TrendingUp, color:'bg-indigo-500' },
          { label:'Conversions', value: totalConv, icon: TrendingUp, color:'bg-emerald-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-0 shadow-sm"><CardContent className="p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center shrink-0`}><Icon size={18} className="text-white" /></div>
            <div><p className="text-xs text-slate-500 font-medium">{label}</p><p className="text-xl font-bold text-slate-900">{value}</p></div>
          </CardContent></Card>
        ))}
      </div>

      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>{['Title','Type','Date','Location','Reach','Conversions','Rate','Conducted By',''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {outreach.length === 0 && <tr><td colSpan={9} className="text-center py-12 text-slate-400">No activities logged.</td></tr>}
                {outreach.map((o) => (
                  <tr key={o.id} className={`border-b border-slate-50 hover:bg-slate-50/70 transition-colors ${editing?.id === o.id ? 'bg-teal-50/30' : ''}`}>
                    <td className="px-4 py-3 font-medium text-slate-800">{o.title}</td>
                    <td className="px-4 py-3"><span className="text-xs bg-teal-50 text-teal-700 border border-teal-200 rounded-full px-2 py-0.5 font-medium">{o.type}</span></td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(o.date)}</td>
                    <td className="px-4 py-3 text-slate-500">{o.locationName}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{o.reach.toLocaleString()}</td>
                    <td className="px-4 py-3 font-semibold text-green-700">{o.conversions}</td>
                    <td className="px-4 py-3 text-slate-500">{o.reach ? `${Math.round((o.conversions / o.reach) * 100)}%` : 'â€”'}</td>
                    <td className="px-4 py-3 text-slate-500">{o.conductedBy}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {can('outreach','edit') && <button onClick={() => openEdit(o)} className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600"><Pencil size={13} /></button>}
                        {can('outreach','delete') && <button onClick={() => setDeleteId(o.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 size={13} /></button>}
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
          <AlertDialogHeader><AlertDialogTitle>Delete Activity?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) deleteOutreach(deleteId); setDeleteId(null); }} className="bg-red-600 hover:bg-red-700 rounded-xl">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
