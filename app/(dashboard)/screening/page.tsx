'use client';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { uid, formatDateTime } from '@/lib/utils';
import type { Screening, VAGrade } from '@/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import InlineForm from '@/components/forms/InlineForm';
import { Plus, Search, Pencil, Trash2, Eye, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/lib/auth';

const VA_GRADES: VAGrade[] = ['6/6','6/9','6/12','6/18','6/24','6/36','6/60','<6/60','CF','HM','PL','NPL'];
const RECS = ['Discharge','Refer for Surgery','Further Investigation','Glasses','Follow-up'];

const BLANK: Omit<Screening, 'id' | 'createdAt'> = {
  patientId:'', patientName:'', campaignId:'', locationId:'',
  screenedBy:'', screenedAt: new Date().toISOString().slice(0,16),
  vaRightUnaided:'6/6', vaLeftUnaided:'6/6',
  iopRight:undefined, iopLeft:undefined,
  cataractSuspected:false, glaucomaSuspected:false, diabeticRetinopathy:false,
  otherFindings:'', medicalHistory:'', currentMedications:'',
  recommendation:'Discharge', notes:'',
};

export default function ScreeningPage() {
  const { screenings, patients, campaigns, referrals, addScreening, updateScreening, deleteScreening, addReferral, updateReferral, addSurgery } = useStore();
  const { can } = usePermissions();
  const [search, setSearch]     = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<Screening | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm]         = useState<typeof BLANK>(BLANK);

  const filtered = screenings.filter((s) =>
    s.patientName.toLowerCase().includes(search.toLowerCase()) ||
    s.screenedBy.toLowerCase().includes(search.toLowerCase()),
  );

  function openAdd() { setEditing(null); setForm(BLANK); setShowForm(true); }
  function openEdit(s: Screening) { setEditing(s); const { id, createdAt, ...r } = s; setForm(r); setShowForm(true); }
  function cancel() { setShowForm(false); setEditing(null); }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function set(k: keyof typeof BLANK, v: any) { if (v === null) return; setForm((f) => ({ ...f, [k]: v })); }
  function handlePatient(pid: string | null) { if (!pid) return; const p = patients.find((x) => x.id === pid); set('patientId', pid); if (p) set('patientName', p.fullName); }
  const CLINICAL_RECS = ['Further Investigation', 'Glasses', 'Follow-up'] as const;

  function save() {
    const patient = patients.find((p) => p.id === form.patientId);
    const today   = new Date().toISOString().split('T')[0];

    if (editing) {
      // â”€â”€ Update the screening record â”€â”€
      updateScreening({ ...editing, ...form });

      // â”€â”€ Auto-sync the linked referral (if any) â”€â”€
      const linked = referrals.find((r) => r.screeningId === editing.id);

      if (form.recommendation === 'Refer for Surgery') {
        if (linked) {
          // Escalate existing referral â†’ mark Converted then create Surgery
          updateReferral({ ...linked, status: 'Converted' });
        }
        // Create Surgery entry
        addSurgery({
          id: uid(),
          createdAt: new Date().toISOString(),
          patientId: form.patientId,
          patientName: form.patientName,
          campaignId: form.campaignId,
          locationId: form.locationId,
          surgeonId: '',
          surgeonName: '',
          eye: 'Left',
          lensType: 'Foldable Acrylic',
          scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'Scheduled',
          preOpVA: form.vaRightUnaided,
          complications: '',
          intraopNotes: `Referred from screening by ${form.screenedBy}. ${form.notes}`.trim(),
        });
      } else if (CLINICAL_RECS.includes(form.recommendation as typeof CLINICAL_RECS[number])) {
        if (linked) {
          // Update existing referral fields to stay in sync
          updateReferral({
            ...linked,
            patientName: form.patientName,
            patientPhone: patient?.phone ?? linked.patientPhone,
            referredBy:  form.screenedBy,
            campaignId:  form.campaignId,
            locationId:  form.locationId,
            notes:       form.recommendation,   // type may have changed
          });
        } else {
          // No referral existed yet â€” create one now
          addReferral({
            id: uid(),
            createdAt: new Date().toISOString(),
            screeningId: editing.id,
            patientName: form.patientName,
            patientPhone: patient?.phone ?? '',
            source: 'Facility',
            referredBy: form.screenedBy,
            campaignId: form.campaignId,
            locationId: form.locationId,
            status: 'Pending',
            referredAt: today,
            notes: form.recommendation,
          });
        }
      } else if (form.recommendation === 'Discharge') {
        // Close linked referral if it exists
        if (linked) updateReferral({ ...linked, status: 'Converted' });
      }

    } else {
      // â”€â”€ New screening â”€â”€
      const newId = uid();
      addScreening({ id: newId, createdAt: new Date().toISOString(), ...form });

      if (form.recommendation === 'Refer for Surgery') {
        // Goes directly to Surgery section (not Referrals)
        addSurgery({
          id: uid(),
          createdAt: new Date().toISOString(),
          patientId: form.patientId,
          patientName: form.patientName,
          campaignId: form.campaignId,
          locationId: form.locationId,
          surgeonId: '',
          surgeonName: '',
          eye: 'Left',
          lensType: 'Foldable Acrylic',
          scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'Scheduled',
          preOpVA: form.vaRightUnaided,
          complications: '',
          intraopNotes: `Referred from screening by ${form.screenedBy}. ${form.notes}`.trim(),
        });
      } else if (CLINICAL_RECS.includes(form.recommendation as typeof CLINICAL_RECS[number])) {
        // Clinical referral â†’ Referrals section, linked by screeningId
        addReferral({
          id: uid(),
          createdAt: new Date().toISOString(),
          screeningId: newId,
          patientName: form.patientName,
          patientPhone: patient?.phone ?? '',
          source: 'Facility',
          referredBy: form.screenedBy,
          campaignId: form.campaignId,
          locationId: form.locationId,
          status: 'Pending',
          referredAt: today,
          notes: form.recommendation,
        });
      }
      // 'Discharge' â†’ nothing
    }

    cancel();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Screening Records</h1>
          <p className="text-sm text-slate-500">{screenings.length} assessments Â· {screenings.filter((s) => s.cataractSuspected).length} cataract suspected</p>
        </div>
        {can('screening','create') && !showForm && <Button onClick={openAdd} className="bg-teal-600 hover:bg-teal-700 text-white gap-2 rounded-xl"><Plus size={15} />New Screening</Button>}
        {showForm && <Button variant="outline" onClick={cancel} className="gap-2 rounded-xl text-slate-600"><X size={14} />Cancel</Button>}
      </div>

      {showForm && (
        <InlineForm title={editing ? `Edit Screening â€” ${editing.patientName}` : 'New Screening Record'}
          onClose={cancel} onSave={save} saveLabel={editing ? 'Update' : 'Save Screening'} saveDisabled={!form.patientId}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="col-span-2"><Label className="text-xs mb-1 block">Patient *</Label>
              <Select value={form.patientId} onValueChange={handlePatient}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select patient">
                    {form.patientId ? (patients.find((p) => p.id === form.patientId)?.fullName ?? null) : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.fullName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs mb-1 block">Screened By</Label><Input value={form.screenedBy} onChange={(e) => set('screenedBy', e.target.value)} className="rounded-xl" /></div>
            <div><Label className="text-xs mb-1 block">Date & Time</Label><Input type="datetime-local" value={form.screenedAt} onChange={(e) => set('screenedAt', e.target.value)} className="rounded-xl" /></div>
            <div><Label className="text-xs mb-1 block">VA Right (Unaided)</Label>
              <Select value={form.vaRightUnaided} onValueChange={(v) => set('vaRightUnaided', v as VAGrade)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{VA_GRADES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs mb-1 block">VA Left (Unaided)</Label>
              <Select value={form.vaLeftUnaided} onValueChange={(v) => set('vaLeftUnaided', v as VAGrade)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{VA_GRADES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs mb-1 block">IOP Right (mmHg)</Label><Input type="number" value={form.iopRight ?? ''} onChange={(e) => set('iopRight', e.target.value ? +e.target.value : undefined)} className="rounded-xl" /></div>
            <div><Label className="text-xs mb-1 block">IOP Left (mmHg)</Label><Input type="number" value={form.iopLeft ?? ''} onChange={(e) => set('iopLeft', e.target.value ? +e.target.value : undefined)} className="rounded-xl" /></div>
            <div className="col-span-2 md:col-span-4 flex flex-wrap gap-4">
              {[{k:'cataractSuspected',label:'Cataract Suspected'},{k:'glaucomaSuspected',label:'Glaucoma Suspected'},{k:'diabeticRetinopathy',label:'Diabetic Retinopathy'}].map(({k,label}) => (
                <label key={k} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" checked={!!form[k as keyof typeof form]} onChange={(e) => set(k as keyof typeof BLANK, e.target.checked)} className="w-4 h-4 accent-teal-600 rounded" />
                  {label}
                </label>
              ))}
            </div>
            <div className="col-span-2"><Label className="text-xs mb-1 block">Other Findings</Label><Input value={form.otherFindings} onChange={(e) => set('otherFindings', e.target.value)} className="rounded-xl" /></div>
            <div><Label className="text-xs mb-1 block">Medical History</Label><Input value={form.medicalHistory} onChange={(e) => set('medicalHistory', e.target.value)} className="rounded-xl" /></div>
            <div><Label className="text-xs mb-1 block">Current Medications</Label><Input value={form.currentMedications} onChange={(e) => set('currentMedications', e.target.value)} className="rounded-xl" /></div>
            <div><Label className="text-xs mb-1 block">Recommendation *</Label>
              <Select value={form.recommendation} onValueChange={(v) => set('recommendation', v as Screening['recommendation'])}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{RECS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2 md:col-span-3"><Label className="text-xs mb-1 block">Notes</Label>
              <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 resize-none h-14" />
            </div>
          </div>
        </InlineForm>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search patient or screenerâ€¦" className="pl-9 rounded-xl border-slate-200" />
        {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><X size={13} /></button>}
      </div>

      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>{['Patient','VA R / L','Cataract','Glaucoma','DR','Recommendation','Screened By','Date',''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {filtered.length === 0 && <tr><td colSpan={9} className="text-center py-12 text-slate-400 text-sm">No records found.</td></tr>}
                {filtered.map((s) => (
                  <tr key={s.id} className={`border-b border-slate-50 hover:bg-slate-50/70 transition-colors ${editing?.id === s.id ? 'bg-teal-50/30' : ''}`}>
                    <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{s.patientName}</td>
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{s.vaRightUnaided} / {s.vaLeftUnaided}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{s.cataractSuspected ? <span className="flex items-center gap-1 text-red-600 text-xs font-medium"><AlertTriangle size={11} />Yes</span> : <span className="text-slate-400 text-xs">No</span>}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{s.glaucomaSuspected ? <span className="text-orange-600 text-xs font-medium">Yes</span> : <span className="text-slate-400 text-xs">No</span>}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{s.diabeticRetinopathy ? <span className="text-purple-600 text-xs font-medium">Yes</span> : <span className="text-slate-400 text-xs">No</span>}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.recommendation === 'Refer for Surgery' ? 'bg-red-100 text-red-700' : s.recommendation === 'Discharge' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{s.recommendation}</span></td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{s.screenedBy}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{formatDateTime(s.screenedAt)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex gap-1">
                        {can('screening','edit') && <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600"><Pencil size={13} /></button>}
                        {can('screening','delete') && <button onClick={() => setDeleteId(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 size={13} /></button>}
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
          <AlertDialogHeader><AlertDialogTitle>Delete Screening?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) deleteScreening(deleteId); setDeleteId(null); }} className="bg-red-600 hover:bg-red-700 rounded-xl">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
