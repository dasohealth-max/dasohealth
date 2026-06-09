'use client';
import { useState, useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';
import { uid, formatDate, nextPatientCode } from '@/lib/utils';
import type { Patient, Sex, DisabilityStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Search, Pencil, Trash2, Eye, Phone, MapPin, X, UserPlus,
  ChevronLeft, ChevronRight, QrCode, ArrowLeft, Save, Navigation, AlertTriangle,
} from 'lucide-react';
import { usePermissions } from '@/lib/auth';
import LocationMapPicker from '@/components/ui/LocationMapPicker';

const PAGE_SIZE = 10;

const BLANK: Omit<Patient, 'id' | 'patientCode' | 'createdAt'> = {
  fullName: '', dateOfBirth: '', sex: 'Female', phone: '', email: '',
  district: '', region: '', occupation: '', education: '',
  disabilityStatus: 'None', insuranceStatus: 'None',
  emergencyContact: '', emergencyPhone: '',
  consentGiven: true, consentDate: new Date().toISOString().split('T')[0],
  campaignId: '', locationId: '', referralSource: 'CHW', notes: '',
  lat: undefined, lng: undefined,
};

// ─── DisabilityBadge ─────────────────────────────────────────────────────────
function DisabilityBadge({ status }: { status: DisabilityStatus }) {
  const color = status === 'None' ? 'bg-slate-100 text-slate-500' :
    status === 'Visual' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700';
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{status}</span>;
}

// ─── Native styled select ─────────────────────────────────────────────────────
function Sel({ value, onChange, children, className = '' }: {
  value: string; onChange: (v: string) => void;
  children: React.ReactNode; className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 cursor-pointer transition-colors ${className}`}
    >
      {children}
    </select>
  );
}

// ─── Full-page Patient Form ───────────────────────────────────────────────────
function PatientFullForm({
  editing, form, setForm, campaigns, locations, onSave, onCancel, isValid, patients,
}: {
  editing: Patient | null;
  form: typeof BLANK;
  setForm: React.Dispatch<React.SetStateAction<typeof BLANK>>;
  campaigns: ReturnType<typeof useStore>['campaigns'];
  locations: ReturnType<typeof useStore>['locations'];
  onSave: () => void;
  onCancel: () => void;
  isValid: boolean;
  patients: Patient[];
}) {
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function set(k: keyof typeof BLANK, v: any) {
    if (v === null || v === undefined) return;
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handlePhoneChange(value: string) {
    set('phone', value);
    const trimmed = value.trim();
    if (!trimmed) { setDuplicateWarning(null); return; }
    const match = patients.find((p) => p.phone.trim() === trimmed && p.id !== editing?.id);
    setDuplicateWarning(match ? `${match.fullName} (${match.patientCode})` : null);
  }

  function handleMapSelect(d: { district: string; region: string; lat: number; lng: number }) {
    setForm((f) => ({ ...f, district: d.district, region: d.region, lat: d.lat, lng: d.lng }));
  }

  const field = 'w-full h-9 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors placeholder:text-slate-400';

  return (
    <div className="-m-4 sm:-m-6 bg-slate-50 flex flex-col" style={{ height: 'calc(100vh - 3.5rem)' }}>
      {/* Top bar */}
      <div className="bg-white border-b border-slate-100 px-6 py-3.5 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-base font-bold text-slate-900">
              {editing ? `Edit Patient — ${editing.fullName}` : 'Register New Patient'}
            </h1>
            <p className="text-xs text-slate-400">Fill in all required fields (*) then save</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onCancel} className="rounded-xl text-slate-600">Cancel</Button>
          <Button
            onClick={onSave}
            disabled={!isValid}
            className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl gap-2 disabled:opacity-50"
          >
            <Save size={14} />
            {editing ? 'Update Patient' : 'Register Patient'}
          </Button>
        </div>
      </div>

      {/* Body — two columns */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* ── Left: Form fields ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* 1. Identity */}
          <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">1. Patient Identity</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-3">
                <Label className="text-xs mb-1 block font-medium text-slate-600">Full Name *</Label>
                <input value={form.fullName} onChange={(e) => set('fullName', e.target.value)}
                  className={`${field} ${!form.fullName.trim() ? 'border-red-300 focus:border-red-400' : ''}`}
                  placeholder="e.g. Hodan Ali Omar" />
                {!form.fullName.trim() && <p className="text-[11px] text-red-500 mt-0.5">Required</p>}
              </div>
              <div>
                <Label className="text-xs mb-1 block font-medium text-slate-600">Date of Birth *</Label>
                <input type="date" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)}
                  className={`${field} ${!form.dateOfBirth ? 'border-red-300' : ''}`} />
              </div>
              <div>
                <Label className="text-xs mb-1 block font-medium text-slate-600">Sex *</Label>
                <Sel value={form.sex} onChange={(v) => set('sex', v as Sex)}>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                </Sel>
              </div>
              <div>
                <Label className="text-xs mb-1 block font-medium text-slate-600">Referral Source</Label>
                <Sel value={form.referralSource} onChange={(v) => set('referralSource', v)}>
                  {['CHW','Self','School','Facility','Community Leader','Volunteer'].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </Sel>
              </div>
            </div>
          </section>

          {/* 2. Contact */}
          <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">2. Contact Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block font-medium text-slate-600">Phone Number *</Label>
                <input value={form.phone} onChange={(e) => handlePhoneChange(e.target.value)}
                  className={`${field} ${!form.phone.trim() ? 'border-red-300' : ''}`}
                  placeholder="+252 61 …" />
                {!form.phone.trim() && <p className="text-[11px] text-red-500 mt-0.5">Required</p>}
                {duplicateWarning && (
                  <div className="mt-2 flex items-start gap-2 bg-amber-50 border border-amber-300 text-amber-800 rounded-lg p-3 text-sm">
                    <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                    <span>Warning: A patient with this phone number already exists — <strong>{duplicateWarning}</strong>. You can still save if this is intentional.</span>
                  </div>
                )}
              </div>
              <div>
                <Label className="text-xs mb-1 block font-medium text-slate-600">Email (optional)</Label>
                <input type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)}
                  className={field} placeholder="patient@example.com" />
              </div>
            </div>
          </section>

          {/* 3. Location — auto-filled from map */}
          <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">3. Location (from map →)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block font-medium text-slate-600">District</Label>
                <input value={form.district} onChange={(e) => set('district', e.target.value)}
                  className={field} placeholder="Auto-filled from map" />
              </div>
              <div>
                <Label className="text-xs mb-1 block font-medium text-slate-600">Region</Label>
                <input value={form.region} onChange={(e) => set('region', e.target.value)}
                  className={field} placeholder="Auto-filled from map" />
              </div>
              {form.lat !== undefined && form.lng !== undefined && (
                <div className="md:col-span-2 flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-xl px-3 py-2">
                  <Navigation size={13} className="text-teal-600 shrink-0" />
                  <p className="text-xs text-teal-700 font-medium">
                    GPS: {form.lat.toFixed(4)}°, {form.lng.toFixed(4)}°
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* 4. Programme */}
          <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">4. Programme</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block font-medium text-slate-600">Campaign</Label>
                <Sel value={form.campaignId ?? ''} onChange={(v) => set('campaignId', v)}>
                  <option value="">— Select campaign —</option>
                  {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Sel>
              </div>
            </div>
          </section>

          {/* 5. Demographics */}
          <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">5. Demographics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block font-medium text-slate-600">Occupation</Label>
                <input value={form.occupation ?? ''} onChange={(e) => set('occupation', e.target.value)}
                  className={field} placeholder="e.g. Farmer, Teacher" />
              </div>
              <div>
                <Label className="text-xs mb-1 block font-medium text-slate-600">Education Level</Label>
                <Sel value={form.education ?? ''} onChange={(v) => set('education', v)}>
                  <option value="">— Select —</option>
                  {['None','Primary','Secondary','University','Vocational'].map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </Sel>
              </div>
              <div>
                <Label className="text-xs mb-1 block font-medium text-slate-600">Disability Status</Label>
                <Sel value={form.disabilityStatus} onChange={(v) => set('disabilityStatus', v as DisabilityStatus)}>
                  {(['None','Visual','Hearing','Mobility','Cognitive','Multiple'] as DisabilityStatus[]).map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </Sel>
              </div>
              <div>
                <Label className="text-xs mb-1 block font-medium text-slate-600">Insurance Status</Label>
                <Sel value={form.insuranceStatus} onChange={(v) => set('insuranceStatus', v)}>
                  {['None','Government','Private','NGO-Sponsored'].map((i) => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </Sel>
              </div>
            </div>
          </section>

          {/* 6. Emergency */}
          <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">6. Emergency Contact</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block font-medium text-slate-600">Emergency Contact Name</Label>
                <input value={form.emergencyContact} onChange={(e) => set('emergencyContact', e.target.value)}
                  className={field} placeholder="Full name" />
              </div>
              <div>
                <Label className="text-xs mb-1 block font-medium text-slate-600">Emergency Phone</Label>
                <input value={form.emergencyPhone} onChange={(e) => set('emergencyPhone', e.target.value)}
                  className={field} placeholder="+252 …" />
              </div>
            </div>
          </section>

          {/* 7. Consent */}
          <section className="pb-8">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">7. Informed Consent</h3>
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-3">
              <p className="text-xs text-teal-800 leading-relaxed">
                The patient has been informed about the eye health programme, data collection, and how their information will be used.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={form.consentGiven}
                    onChange={(e) => set('consentGiven', e.target.checked)}
                    className="w-4 h-4 accent-teal-600 rounded" />
                  <span className="text-sm font-medium text-slate-700">Patient has given informed consent</span>
                </label>
              </div>
              <div>
                <Label className="text-xs mb-1 block font-medium text-slate-600">Consent Date</Label>
                <input type="date" value={form.consentDate} onChange={(e) => set('consentDate', e.target.value)}
                  className={field} />
              </div>
              <div>
                <Label className="text-xs mb-1 block font-medium text-slate-600">Notes</Label>
                <textarea value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-teal-500 resize-none h-20 placeholder:text-slate-400"
                  placeholder="Any additional notes…" />
              </div>
            </div>
          </section>
        </div>

        {/* ── Right: Map ── */}
        <div className="w-[400px] xl:w-[460px] shrink-0 border-l border-slate-100 bg-white p-4 flex flex-col gap-3 overflow-y-auto">
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">GPS Location</h3>
            <p className="text-[11px] text-slate-400">Search a city or click anywhere on the map</p>
          </div>
          <div className="flex-1 min-h-0">
            <LocationMapPicker
              lat={form.lat}
              lng={form.lng}
              onLocationSelect={handleMapSelect}
            />
          </div>
          {(form.district || form.region) && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1 shrink-0">
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Selected Location</p>
              {form.district && <p className="text-sm font-medium text-slate-700"><span className="text-slate-400 text-xs">District:</span> {form.district}</p>}
              {form.region && <p className="text-sm font-medium text-slate-700"><span className="text-slate-400 text-xs">Region:</span> {form.region}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PatientsPage() {
  const { patients, campaigns, locations, addPatient, updatePatient, deletePatient } = useStore();
  const { can, maskPatient } = usePermissions();

  const [search, setSearch]     = useState('');
  const [page, setPage]         = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<Patient | null>(null);
  const [viewPt, setViewPt]     = useState<Patient | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm]         = useState<typeof BLANK>(BLANK);

  const filtered = patients.filter((p) =>
    p.fullName.toLowerCase().includes(search.toLowerCase()) ||
    p.patientCode.toLowerCase().includes(search.toLowerCase()) ||
    p.phone.includes(search),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const isValid = form.fullName.trim().length > 0 && form.dateOfBirth.length > 0 && form.phone.trim().length > 0;

  function openAdd() { setEditing(null); setForm(BLANK); setShowForm(true); }
  function openEdit(p: Patient) {
    setEditing(p);
    const { id, patientCode, createdAt, ...rest } = p;
    setForm(rest);
    setShowForm(true);
  }
  function cancel() { setShowForm(false); setEditing(null); }

  function save() {
    if (editing) {
      updatePatient({ ...editing, ...form });
    } else {
      addPatient({ id: uid(), patientCode: nextPatientCode(patients.map((p) => p.patientCode)), createdAt: new Date().toISOString(), ...form });
    }
    setShowForm(false); setEditing(null);
  }

  // ── Full-page form mode ──
  if (showForm) {
    return (
      <PatientFullForm
        editing={editing}
        form={form}
        setForm={setForm}
        campaigns={campaigns}
        locations={locations}
        onSave={save}
        onCancel={cancel}
        isValid={isValid}
        patients={patients}
      />
    );
  }

  // ── List mode ──
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Patients</h1>
          <p className="text-sm text-slate-500">{patients.length} registered beneficiaries</p>
        </div>
        {can('patients', 'create') && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            <UserPlus size={15} /> Add Patient
          </button>
        )}
      </div>

      {/* Search */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name, code, phone…" className="pl-9 rounded-xl border-slate-200" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { label: 'All',    count: patients.length,                                   color: 'bg-slate-100 text-slate-700' },
            { label: 'Female', count: patients.filter((p) => p.sex === 'Female').length,  color: 'bg-pink-100 text-pink-700' },
            { label: 'Male',   count: patients.filter((p) => p.sex === 'Male').length,    color: 'bg-blue-100 text-blue-700' },
          ].map(({ label, count, color }) => (
            <span key={label} className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${color}`}>{label}: {count}</span>
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
                  {['Patient Code','Full Name','Sex / DOB','Phone','District','Disability','Campaign','Registered',''].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-12 text-slate-400 text-sm">No patients found.</td></tr>
                )}
                {paged.map((p) => {
                  const camp = campaigns.find((c) => c.id === p.campaignId);
                  return (
                    <tr key={p.id} className={`border-b border-slate-50 hover:bg-slate-50/70 transition-colors ${editing?.id === p.id ? 'bg-teal-50/40' : ''}`}>
                      <td className="px-4 py-3 font-mono text-xs text-teal-700 font-semibold whitespace-nowrap">{maskPatient ? '***' : p.patientCode}</td>
                      <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{maskPatient ? '— Masked —' : p.fullName}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{p.sex} · {maskPatient ? '••••' : (p.dateOfBirth ? new Date(p.dateOfBirth).getFullYear() : '—')}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{maskPatient ? '•••••••••' : p.phone}</td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{p.district}</td>
                      <td className="px-4 py-3 whitespace-nowrap"><DisabilityBadge status={p.disabilityStatus} /></td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {camp ? <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full px-2 py-0.5 font-medium">{camp.type}</span> : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{formatDate(p.createdAt)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setViewPt(p)} className="p-1.5 rounded-lg hover:bg-teal-50 text-slate-400 hover:text-teal-600 transition-colors" title="View"><Eye size={14} /></button>
                          {can('patients', 'edit') && <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors" title="Edit"><Pencil size={14} /></button>}
                          {can('patients', 'delete') && <button onClick={() => setDeleteId(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors" title="Delete"><Trash2 size={14} /></button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-400">{filtered.length} patient{filtered.length !== 1 ? 's' : ''} · page {page} of {totalPages}</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 disabled:opacity-30"><ChevronLeft size={14} /></button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 disabled:opacity-30"><ChevronRight size={14} /></button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* View detail inline card */}
      {viewPt && (
        <Card className="border-0 shadow-md ring-1 ring-slate-200">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center">
                  <Eye size={14} className="text-teal-600" />
                </div>
                {viewPt.fullName}
                <span className="font-mono text-xs text-teal-700 font-semibold bg-teal-50 px-2 py-0.5 rounded-full">{viewPt.patientCode}</span>
              </h3>
              <button onClick={() => setViewPt(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><p className="text-xs text-slate-400 font-medium">Sex / DOB</p><p className="font-medium">{viewPt.sex} · {viewPt.dateOfBirth}</p></div>
              <div><p className="text-xs text-slate-400 font-medium flex items-center gap-1"><Phone size={10} />Phone</p><p>{viewPt.phone}</p></div>
              <div><p className="text-xs text-slate-400 font-medium flex items-center gap-1"><MapPin size={10} />District</p><p>{viewPt.district}, {viewPt.region}</p></div>
              <div><p className="text-xs text-slate-400 font-medium">Disability</p><DisabilityBadge status={viewPt.disabilityStatus} /></div>
              <div><p className="text-xs text-slate-400 font-medium">Insurance</p><p>{viewPt.insuranceStatus}</p></div>
              <div><p className="text-xs text-slate-400 font-medium">Referral</p><p>{viewPt.referralSource}</p></div>
              {viewPt.lat !== undefined && viewPt.lng !== undefined && (
                <div><p className="text-xs text-slate-400 font-medium flex items-center gap-1"><Navigation size={10} />GPS</p>
                  <p className="font-mono text-xs">{viewPt.lat.toFixed(3)}, {viewPt.lng.toFixed(3)}</p></div>
              )}
              <div><p className="text-xs text-slate-400 font-medium">Consent</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${viewPt.consentGiven ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                  {viewPt.consentGiven ? '✓ Given' : '✗ Not given'}
                </span>
              </div>
            </div>
            {viewPt.notes && <p className="mt-3 text-sm text-slate-600 bg-slate-50 rounded-xl p-3">{viewPt.notes}</p>}
            <div className="mt-4 flex gap-2">
              {can('patients', 'edit') && (
                <button onClick={() => { setViewPt(null); openEdit(viewPt); }}
                  className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors">
                  <Pencil size={13} /> Edit
                </button>
              )}
              <button onClick={() => setViewPt(null)}
                className="flex items-center gap-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors">
                Close
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader><AlertDialogTitle>Delete Patient?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the patient record. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) deletePatient(deleteId); setDeleteId(null); }} className="bg-red-600 hover:bg-red-700 rounded-xl">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
