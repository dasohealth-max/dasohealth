'use client';

import { useState } from 'react';
import { Archive, X } from 'lucide-react';
import { actionArchivePatient } from '@/app/actions/patients';
import { actionCreateChangeRequest } from '@/app/actions/change_requests';
import { toast } from '@/components/ui/toast';
import type { Patient } from '@/types';

const ARCHIVE_REASONS = [
  'Duplicate registration',
  'Entered in error',
  'Consent withdrawn',
  'Patient has passed away',
  'Other reason',
] as const;

export default function PatientArchiveDialog({
  patient,
  mode,
  onClose,
  onArchived,
}: {
  patient: Patient;
  mode: 'direct' | 'request';
  onClose: () => void;
  onArchived?: () => void;
}) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);

  const notesRequired = reason === 'Other reason';
  const reasonReady = !!reason && (!notesRequired || notes.trim().length >= 10);
  const confirmationReady = mode === 'request' || confirmation === patient.patientCode;
  const canSubmit = reasonReady && confirmationReady && !saving;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const result = mode === 'direct'
        ? await actionArchivePatient(
            patient.id,
            notes.trim() ? `${reason} — ${notes.trim()}` : reason,
          )
        : await actionCreateChangeRequest({
            entity: 'Patient',
            entityId: patient.id,
            entityLabel: patient.fullName,
            requestType: 'archive',
            reason,
            notes: notes.trim(),
            region: patient.region,
            campaignId: patient.campaignId,
          });

      if (!result.ok) {
        toast({ title: mode === 'direct' ? 'Could not archive patient' : 'Could not submit archive request', description: result.error, variant: 'error' });
        return;
      }
      toast({
        title: mode === 'direct' ? 'Patient archived' : 'Archive request submitted',
        description: mode === 'direct'
          ? 'The clinical record was preserved and removed from active work queues.'
          : 'The patient remains active until a Super Administrator approves the request.',
        variant: 'success',
      });
      if (mode === 'direct') onArchived?.();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="archive-patient-title">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-amber-100 p-2 text-amber-700"><Archive size={18} /></div>
            <div>
              <h2 id="archive-patient-title" className="text-base font-bold text-[#141920]">
                {mode === 'direct' ? 'Archive Patient Record' : 'Request Patient Archival'}
              </h2>
              <p className="mt-0.5 text-sm text-[#647184]">{patient.patientCode} · {patient.fullName}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close archive dialog" className="rounded-md p-1.5 text-[#647184] transition hover:bg-[#EAEEF3]">
            <X size={16} />
          </button>
        </div>

        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
          This never deletes clinical data. The patient will leave active work queues, while screenings, surgeries, follow-ups, and the audit history remain preserved.
          {mode === 'request' && ' No records change until a Super Administrator approves the request.'}
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[#647184]">Archive reason <span className="text-red-500">*</span></legend>
          {ARCHIVE_REASONS.map((item) => (
            <label key={item} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 ${reason === item ? 'border-amber-500 bg-amber-50' : 'border-[#DDE3EA] hover:bg-[#F5F7FA]'}`}>
              <input type="radio" name="patientArchiveReason" value={item} checked={reason === item} onChange={() => setReason(item)} className="accent-amber-600" />
              <span className="text-sm text-[#141920]">{item}</span>
            </label>
          ))}
        </fieldset>

        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#647184]">
            Additional notes {notesRequired ? <span className="text-red-500">*</span> : <span className="text-[#94A0AE]">(optional)</span>}
          </label>
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Add context for the approver and audit history..." className="w-full rounded-md border border-[#DDE3EA] px-3 py-2 text-sm outline-none focus:border-[#2C9942] focus:ring-2 focus:ring-[#2C9942]/10" />
          {notesRequired && notes.trim().length < 10 && <p className="mt-1 text-xs text-red-600">Provide at least 10 characters for Other reason.</p>}
        </div>

        {mode === 'direct' && (
          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#647184]">Type {patient.patientCode} to confirm</label>
            <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" className="w-full rounded-md border border-[#DDE3EA] px-3 py-2 text-sm font-semibold outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10" />
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-[#DDE3EA] px-4 py-2 text-sm font-medium text-[#4B5666] hover:bg-[#F5F7FA]">Cancel</button>
          <button type="button" onClick={submit} disabled={!canSubmit} className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? 'Saving...' : mode === 'direct' ? 'Archive Patient' : 'Submit Archive Request'}
          </button>
        </div>
      </div>
    </div>
  );
}
