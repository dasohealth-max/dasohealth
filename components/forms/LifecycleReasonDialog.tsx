'use client';

import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function LifecycleReasonDialog({
  open,
  title,
  subject,
  impact,
  actionLabel,
  confirmationText,
  saving = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  subject: string;
  impact: string;
  actionLabel: string;
  confirmationText?: string;
  saving?: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');

  if (!open) return null;
  const valid = reason.trim().length >= 10
    && (!confirmationText || confirmation === confirmationText)
    && !saving;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="lifecycle-dialog-title">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-amber-100 p-2 text-amber-700"><AlertTriangle size={18} /></div>
            <div>
              <h2 id="lifecycle-dialog-title" className="font-bold text-[#141920]">{title}</h2>
              <p className="mt-0.5 text-sm text-[#647184]">{subject}</p>
            </div>
          </div>
          <button type="button" onClick={() => { setReason(''); setConfirmation(''); onCancel(); }} aria-label="Close dialog" className="rounded-md p-1.5 text-[#647184] hover:bg-[#EAEEF3]"><X size={16} /></button>
        </div>

        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">{impact}</div>

        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#647184]">Reason <span className="text-red-500">*</span></label>
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} autoFocus placeholder="Explain why this action is required..." className="w-full rounded-md border border-[#DDE3EA] px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10" />
          <p className="mt-1 text-right text-xs text-[#647184]">{reason.trim().length} / 10 min</p>
        </div>

        {confirmationText && (
          <div className="mt-3">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#647184]">Type {confirmationText} to confirm</label>
            <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" className="w-full rounded-md border border-[#DDE3EA] px-3 py-2 text-sm font-semibold outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10" />
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => { setReason(''); setConfirmation(''); onCancel(); }} className="rounded-md border border-[#DDE3EA] px-4 py-2 text-sm font-medium text-[#4B5666] hover:bg-[#F5F7FA]">Cancel</button>
          <button type="button" disabled={!valid} onClick={() => { onConfirm(reason.trim()); setReason(''); setConfirmation(''); }} className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? 'Saving...' : actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
