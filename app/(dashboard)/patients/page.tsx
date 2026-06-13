'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Campaign, DisabilityStatus, Patient, Sex } from '@/types';
import { actionCreatePatient, actionDeletePatient, actionUpdatePatient, getAllPatients } from '@/app/actions/patients';
import { getAllCampaigns } from '@/app/actions/campaigns';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import InlineForm from '@/components/forms/InlineForm';
import { formatDate } from '@/lib/utils';
import { usePermissions } from '@/lib/auth';
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react';

const SEXES: Sex[] = ['Female', 'Male', 'Other'];
const DISABILITIES: DisabilityStatus[] = ['None', 'Visual', 'Hearing', 'Mobility', 'Cognitive', 'Multiple'];

const BLANK: Omit<Patient, 'id' | 'patientCode' | 'createdAt'> = {
  fullName: '',
  dateOfBirth: '',
  sex: 'Female',
  phone: '',
  email: '',
  district: '',
  region: '',
  operationDistrict: '',
  occupation: '',
  education: '',
  disabilityStatus: 'None',
  insuranceStatus: 'None',
  emergencyContact: '',
  emergencyPhone: '',
  consentGiven: true,
  consentDate: new Date().toISOString().split('T')[0],
  campaignId: '',
  locationId: '',
  referralSource: 'Campaign walk-in',
  notes: '',
  registeredById: '',
  registeredByName: '',
  screeningStatus: 'Awaiting Screening',
};

export default function PatientsPage() {
  const { can, role } = usePermissions();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [form, setForm] = useState(BLANK);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([getAllPatients(), getAllCampaigns()]).then(([patientRows, campaignRows]) => {
      setPatients(patientRows);
      setCampaigns(campaignRows);
      const defaultCampaign = campaignRows.find((campaign) => campaign.status === 'Active') ?? campaignRows[0];
      if (defaultCampaign) {
        setForm((current) => applyCampaignContext(current, defaultCampaign));
      }
      setIsLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((patient) =>
      patient.fullName.toLowerCase().includes(q) ||
      patient.patientCode.toLowerCase().includes(q) ||
      patient.phone.includes(q) ||
      patient.region.toLowerCase().includes(q),
    );
  }, [patients, search]);

  function set<K extends keyof typeof BLANK>(key: K, value: (typeof BLANK)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function chooseCampaign(campaignId: string) {
    const campaign = campaigns.find((item) => item.id === campaignId);
    if (!campaign) return;
    setForm((current) => applyCampaignContext(current, campaign));
  }

  function openAdd() {
    setEditing(null);
    const defaultCampaign = campaigns.find((campaign) => campaign.status === 'Active') ?? campaigns[0];
    setForm(defaultCampaign ? applyCampaignContext(BLANK, defaultCampaign) : BLANK);
    setSaveError('');
    setShowForm(true);
  }

  function openEdit(patient: Patient) {
    const editable = Object.fromEntries(
      Object.entries(patient).filter(([key]) => key !== 'id' && key !== 'patientCode' && key !== 'createdAt')
    ) as typeof BLANK;
    setEditing(patient);
    setForm(editable);
    setSaveError('');
    setShowForm(true);
  }

  async function save() {
    setSaveError('');
    const result = editing
      ? await actionUpdatePatient(editing.id, form)
      : await actionCreatePatient(form);
    if (!result.ok) {
      setSaveError(result.error);
      return;
    }
    setPatients((rows) => editing
      ? rows.map((row) => row.id === editing.id ? result.data : row)
      : [result.data, ...rows]);
    setShowForm(false);
    setEditing(null);
  }

  async function remove(patient: Patient) {
    const result = await actionDeletePatient(patient.id);
    if (result.ok) setPatients((rows) => rows.filter((row) => row.id !== patient.id));
  }

  const selectedCampaign = campaigns.find((campaign) => campaign.id === form.campaignId);
  const clerkCampaignLocked = role === 'Data Clerk' && !!selectedCampaign;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Patients</h1>
          <p className="text-sm text-slate-500">Register patients into a regional campaign and screening queue</p>
        </div>
        {can('patients', 'create') && !showForm && <Button onClick={openAdd} className="gap-2 rounded-xl bg-teal-600 text-white hover:bg-teal-700"><Plus size={15} />Register Patient</Button>}
        {showForm && <Button variant="outline" onClick={() => setShowForm(false)} className="gap-2 rounded-xl"><X size={14} />Cancel</Button>}
      </div>

      {showForm && (
        <InlineForm
          title={editing ? `Edit ${editing.fullName}` : 'Register Patient'}
          onClose={() => setShowForm(false)}
          onSave={save}
          saveLabel={editing ? 'Update Patient' : 'Register Patient'}
          saveDisabled={!form.fullName || !form.dateOfBirth || !form.phone || !form.campaignId}
        >
          {saveError && <p className="mb-2 text-xs text-red-600">{saveError}</p>}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="md:col-span-2"><Label className="mb-1 block text-xs">Full Name *</Label><Input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} className="rounded-xl" /></div>
            <div><Label className="mb-1 block text-xs">Date of Birth *</Label><Input type="date" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} className="rounded-xl" /></div>
            <div>
              <Label className="mb-1 block text-xs">Sex</Label>
              <Select value={form.sex} onValueChange={(value) => { if (value) set('sex', value as Sex); }}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{SEXES.map((sex) => <SelectItem key={sex} value={sex}>{sex}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="mb-1 block text-xs">Phone *</Label><Input value={form.phone} onChange={(e) => set('phone', e.target.value)} className="rounded-xl" /></div>
            <div><Label className="mb-1 block text-xs">Email</Label><Input type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} className="rounded-xl" /></div>
            <div className="md:col-span-2">
              <Label className="mb-1 block text-xs">Campaign *</Label>
              {clerkCampaignLocked ? (
                <Input value={`${selectedCampaign.name} | ${selectedCampaign.region}`} disabled className="rounded-xl bg-slate-50" />
              ) : (
                <Select value={form.campaignId ?? ''} onValueChange={(value) => { if (value) chooseCampaign(value); }}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select campaign" /></SelectTrigger>
                  <SelectContent>{campaigns.map((campaign) => <SelectItem key={campaign.id} value={campaign.id}>{campaign.name} | {campaign.region}</SelectItem>)}</SelectContent>
                </Select>
              )}
              <p className="mt-1 text-xs text-slate-400">Region and operation district are locked from the selected campaign.</p>
            </div>
            <div><Label className="mb-1 block text-xs">Region</Label><Input value={form.region} disabled className="rounded-xl bg-slate-50" /></div>
            <div><Label className="mb-1 block text-xs">Operation District</Label><Input value={form.operationDistrict} disabled className="rounded-xl bg-slate-50" /></div>
            <div><Label className="mb-1 block text-xs">Occupation</Label><Input value={form.occupation ?? ''} onChange={(e) => set('occupation', e.target.value)} className="rounded-xl" /></div>
            <div>
              <Label className="mb-1 block text-xs">Disability Status</Label>
              <Select value={form.disabilityStatus} onValueChange={(value) => { if (value) set('disabilityStatus', value as DisabilityStatus); }}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{DISABILITIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="mb-1 block text-xs">Emergency Contact</Label><Input value={form.emergencyContact} onChange={(e) => set('emergencyContact', e.target.value)} className="rounded-xl" /></div>
            <div><Label className="mb-1 block text-xs">Emergency Phone</Label><Input value={form.emergencyPhone} onChange={(e) => set('emergencyPhone', e.target.value)} className="rounded-xl" /></div>
            <div className="md:col-span-4"><Label className="mb-1 block text-xs">Notes</Label><textarea value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} className="h-16 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500" /></div>
          </div>
        </InlineForm>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search patients..." className="rounded-xl pl-9" />
      </div>

      <Card className="overflow-hidden border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>{['Code', 'Patient', 'Phone', 'Region', 'Campaign', 'Screening', 'Registered By', ''].map((heading) => <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{heading}</th>)}</tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={8} className="py-10 text-center text-sm text-slate-400">Loading patients...</td></tr>}
                {!isLoading && filtered.map((patient) => {
                  const campaign = campaigns.find((item) => item.id === patient.campaignId);
                  return (
                    <tr key={patient.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{patient.patientCode}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{patient.fullName}<span className="ml-2 text-xs text-slate-400">{formatDate(patient.dateOfBirth)}</span></td>
                      <td className="px-4 py-3 text-slate-600">{patient.phone}</td>
                      <td className="px-4 py-3 text-slate-600">{patient.region}</td>
                      <td className="px-4 py-3 text-slate-600">{campaign?.name ?? '-'}</td>
                      <td className="px-4 py-3"><span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">{patient.screeningStatus}</span></td>
                      <td className="px-4 py-3 text-slate-600">{patient.registeredByName || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {can('patients', 'edit') && <button onClick={() => openEdit(patient)} className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"><Pencil size={14} /></button>}
                          {can('patients', 'delete') && <button onClick={() => remove(patient)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>}
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
    </div>
  );
}

function applyCampaignContext(form: typeof BLANK, campaign: Campaign): typeof BLANK {
  return {
    ...form,
    campaignId: campaign.id,
    region: campaign.region,
    operationDistrict: campaign.operationDistrict,
    district: campaign.operationDistrict,
  };
}
