'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Campaign, Patient, Screening, VAGrade } from '@/types';
import { actionCreateScreening, actionDeleteScreening, actionUpdateScreening, getAllScreenings } from '@/app/actions/screenings';
import { getAllPatients } from '@/app/actions/patients';
import { getAllCampaigns } from '@/app/actions/campaigns';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import InlineForm from '@/components/forms/InlineForm';
import { formatDateTime } from '@/lib/utils';
import { usePermissions } from '@/lib/auth';
import { AlertTriangle, Pencil, Plus, Search, Trash2, X } from 'lucide-react';

const VA_GRADES: VAGrade[] = ['6/6', '6/9', '6/12', '6/18', '6/24', '6/36', '6/60', '<6/60', 'CF', 'HM', 'PL', 'NPL'];
const RECOMMENDATIONS: Screening['recommendation'][] = ['Discharge', 'Refer for Surgery', 'Further Investigation', 'Glasses', 'Follow-up'];

const BLANK: Omit<Screening, 'id' | 'createdAt'> = {
  patientId: '',
  patientName: '',
  campaignId: '',
  locationId: '',
  region: '',
  operationDistrict: '',
  screenedBy: '',
  screenedById: '',
  screenedByName: '',
  screenedAt: new Date().toISOString().slice(0, 16),
  vaRightUnaided: '6/6',
  vaLeftUnaided: '6/6',
  cataractSuspected: false,
  glaucomaSuspected: false,
  diabeticRetinopathy: false,
  otherFindings: '',
  medicalHistory: '',
  currentMedications: '',
  recommendation: 'Discharge',
  notes: '',
};

export default function ScreeningPage() {
  const { can } = usePermissions();
  const [screenings, setScreenings] = useState<Screening[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [form, setForm] = useState(BLANK);
  const [editing, setEditing] = useState<Screening | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [queueSearch, setQueueSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([getAllScreenings(), getAllPatients(), getAllCampaigns()]).then(([screeningRows, patientRows, campaignRows]) => {
      setScreenings(screeningRows);
      setPatients(patientRows);
      setCampaigns(campaignRows);
      setIsLoading(false);
    });
  }, []);

  const queuedPatients = useMemo(() => patients.filter((patient) => patient.screeningStatus === 'Awaiting Screening'), [patients]);
  const filteredQueue = useMemo(() => {
    const q = queueSearch.trim().toLowerCase();
    if (!q) return queuedPatients;
    return queuedPatients.filter((patient) =>
      patient.patientCode.toLowerCase().includes(q) ||
      patient.fullName.toLowerCase().includes(q) ||
      patient.phone.includes(q) ||
      patient.region.toLowerCase().includes(q),
    );
  }, [queuedPatients, queueSearch]);
  const filteredScreenings = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return screenings;
    return screenings.filter((screening) =>
      screening.patientName.toLowerCase().includes(q) ||
      screening.region.toLowerCase().includes(q) ||
      screening.recommendation.toLowerCase().includes(q),
    );
  }, [historySearch, screenings]);

  function set<K extends keyof typeof BLANK>(key: K, value: (typeof BLANK)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function choosePatient(patientId: string) {
    const patient = patients.find((item) => item.id === patientId);
    const campaign = campaigns.find((item) => item.id === patient?.campaignId);
    setForm((current) => ({
      ...current,
      patientId,
      patientName: patient?.fullName ?? '',
      campaignId: patient?.campaignId ?? '',
      region: patient?.region ?? campaign?.region ?? '',
      operationDistrict: patient?.operationDistrict ?? campaign?.operationDistrict ?? '',
    }));
  }

  function openAdd(patient?: Patient) {
    setEditing(null);
    setForm(BLANK);
    setSaveError('');
    setShowForm(true);
    if (patient) choosePatient(patient.id);
  }

  function openEdit(screening: Screening) {
    const editable = Object.fromEntries(
      Object.entries(screening).filter(([key]) => key !== 'id' && key !== 'createdAt')
    ) as typeof BLANK;
    setEditing(screening);
    setForm({ ...editable, screenedAt: editable.screenedAt.slice(0, 16) });
    setSaveError('');
    setShowForm(true);
  }

  async function save() {
    setSaveError('');
    const result = editing
      ? await actionUpdateScreening(editing.id, form)
      : await actionCreateScreening(form);
    if (!result.ok) {
      setSaveError(result.error);
      return;
    }
    setScreenings((rows) => editing ? rows.map((row) => row.id === editing.id ? result.data : row) : [result.data, ...rows]);
    setPatients((rows) => rows.map((patient) => patient.id === result.data.patientId ? { ...patient, screeningStatus: 'Screened' } : patient));
    setShowForm(false);
    setEditing(null);
  }

  async function remove(screening: Screening) {
    const result = await actionDeleteScreening(screening.id);
    if (result.ok) setScreenings((rows) => rows.filter((row) => row.id !== screening.id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Screening</h1>
          <p className="text-sm text-slate-500">{queuedPatients.length} patients waiting for screening</p>
        </div>
        {can('screening', 'create') && !showForm && <Button onClick={() => openAdd()} className="gap-2 rounded-xl bg-teal-600 text-white hover:bg-teal-700"><Plus size={15} />New Screening</Button>}
        {showForm && <Button variant="outline" onClick={() => setShowForm(false)} className="gap-2 rounded-xl"><X size={14} />Cancel</Button>}
      </div>

      {showForm && (
        <InlineForm
          title={editing ? `Edit ${editing.patientName}` : 'Complete Screening'}
          onClose={() => setShowForm(false)}
          onSave={save}
          saveLabel={editing ? 'Update Screening' : 'Save Screening'}
          saveDisabled={!form.patientId || !form.campaignId}
        >
          {saveError && <p className="mb-2 text-xs text-red-600">{saveError}</p>}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <Label className="mb-1 block text-xs">Patient *</Label>
              <Select value={form.patientId} onValueChange={(value) => { if (value) choosePatient(value); }}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select patient" /></SelectTrigger>
                <SelectContent>
                  {(editing ? patients : queuedPatients).map((patient) => <SelectItem key={patient.id} value={patient.id}>{patient.patientCode} | {patient.fullName} | {patient.region}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="mb-1 block text-xs">Region</Label><Input value={form.region} disabled className="rounded-xl bg-slate-50" /></div>
            <div><Label className="mb-1 block text-xs">Date & Time</Label><Input type="datetime-local" value={form.screenedAt} onChange={(e) => set('screenedAt', e.target.value)} className="rounded-xl" /></div>
            <div><Label className="mb-1 block text-xs">VA Right</Label><Select value={form.vaRightUnaided} onValueChange={(value) => { if (value) set('vaRightUnaided', value as VAGrade); }}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{VA_GRADES.map((grade) => <SelectItem key={grade} value={grade}>{grade}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="mb-1 block text-xs">VA Left</Label><Select value={form.vaLeftUnaided} onValueChange={(value) => { if (value) set('vaLeftUnaided', value as VAGrade); }}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{VA_GRADES.map((grade) => <SelectItem key={grade} value={grade}>{grade}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="mb-1 block text-xs">IOP Right</Label><Input type="number" value={form.iopRight ?? ''} onChange={(e) => set('iopRight', e.target.value ? Number(e.target.value) : undefined)} className="rounded-xl" /></div>
            <div><Label className="mb-1 block text-xs">IOP Left</Label><Input type="number" value={form.iopLeft ?? ''} onChange={(e) => set('iopLeft', e.target.value ? Number(e.target.value) : undefined)} className="rounded-xl" /></div>
            <div className="flex flex-wrap gap-4 text-sm md:col-span-4">
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.cataractSuspected} onChange={(e) => set('cataractSuspected', e.target.checked)} className="accent-teal-600" /> Cataract suspected</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.glaucomaSuspected} onChange={(e) => set('glaucomaSuspected', e.target.checked)} className="accent-teal-600" /> Glaucoma suspected</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.diabeticRetinopathy} onChange={(e) => set('diabeticRetinopathy', e.target.checked)} className="accent-teal-600" /> Diabetic retinopathy</label>
            </div>
            <div>
              <Label className="mb-1 block text-xs">Recommendation *</Label>
              <Select value={form.recommendation} onValueChange={(value) => { if (value) set('recommendation', value as Screening['recommendation']); }}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{RECOMMENDATIONS.map((rec) => <SelectItem key={rec} value={rec}>{rec}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-3"><Label className="mb-1 block text-xs">Other Findings</Label><Input value={form.otherFindings} onChange={(e) => set('otherFindings', e.target.value)} className="rounded-xl" /></div>
            <div className="md:col-span-2"><Label className="mb-1 block text-xs">Medical History</Label><Input value={form.medicalHistory} onChange={(e) => set('medicalHistory', e.target.value)} className="rounded-xl" /></div>
            <div className="md:col-span-2"><Label className="mb-1 block text-xs">Current Medications</Label><Input value={form.currentMedications} onChange={(e) => set('currentMedications', e.target.value)} className="rounded-xl" /></div>
            <div className="md:col-span-4"><Label className="mb-1 block text-xs">Notes</Label><textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} className="h-16 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500" /></div>
          </div>
        </InlineForm>
      )}

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">Waiting Queue</p>
              <p className="text-xs text-slate-500">{queuedPatients.length} patient{queuedPatients.length === 1 ? '' : 's'} awaiting screening</p>
            </div>
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <Input value={queueSearch} onChange={(e) => setQueueSearch(e.target.value)} placeholder="Search code, name, phone, region..." className="rounded-xl pl-9" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>{['Code', 'Patient', 'Phone', 'Region', 'District', 'Registered By', ''].map((heading) => <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{heading}</th>)}</tr>
              </thead>
              <tbody>
                {filteredQueue.map((patient) => (
                  <tr key={patient.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{patient.patientCode}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{patient.fullName}</td>
                    <td className="px-4 py-3 text-slate-600">{patient.phone}</td>
                    <td className="px-4 py-3 text-slate-600">{patient.region}</td>
                    <td className="px-4 py-3 text-slate-600">{patient.operationDistrict}</td>
                    <td className="px-4 py-3 text-slate-600">{patient.registeredByName || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      {can('screening', 'create') && <Button size="sm" onClick={() => openAdd(patient)} className="rounded-lg bg-teal-600 text-white hover:bg-teal-700">Screen</Button>}
                    </td>
                  </tr>
                ))}
                {!isLoading && filteredQueue.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-sm text-slate-400">No waiting patients found.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
        <Input value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} placeholder="Search screening history..." className="rounded-xl pl-9" />
      </div>

      <Card className="overflow-hidden border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>{['Patient', 'Region', 'VA R/L', 'Finding', 'Recommendation', 'Screened By', 'Date', ''].map((heading) => <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{heading}</th>)}</tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={8} className="py-10 text-center text-sm text-slate-400">Loading screenings...</td></tr>}
                {!isLoading && filteredScreenings.map((screening) => (
                  <tr key={screening.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{screening.patientName}</td>
                    <td className="px-4 py-3 text-slate-600">{screening.region}</td>
                    <td className="px-4 py-3 font-mono text-xs">{screening.vaRightUnaided} / {screening.vaLeftUnaided}</td>
                    <td className="px-4 py-3">{screening.cataractSuspected ? <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600"><AlertTriangle size={12} />Cataract</span> : <span className="text-xs text-slate-400">No cataract</span>}</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-teal-50 px-2 py-1 text-xs font-medium text-teal-700">{screening.recommendation}</span></td>
                    <td className="px-4 py-3 text-slate-600">{screening.screenedByName || screening.screenedBy}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(screening.screenedAt)}</td>
                    <td className="px-4 py-3"><div className="flex gap-1">{can('screening', 'edit') && <button onClick={() => openEdit(screening)} className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"><Pencil size={14} /></button>}{can('screening', 'delete') && <button onClick={() => remove(screening)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>}</div></td>
                  </tr>
                ))}
                {!isLoading && filteredScreenings.length === 0 && <tr><td colSpan={8} className="py-10 text-center text-sm text-slate-400">No screenings found.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
