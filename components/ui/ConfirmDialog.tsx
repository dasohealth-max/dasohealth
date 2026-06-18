'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmationText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Delete',
  confirmationText,
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [typedConfirmation, setTypedConfirmation] = useState('');

  if (!open) return null;

  const confirmationMatches = !confirmationText || typedConfirmation === confirmationText;
  const cancel = () => {
    setTypedConfirmation('');
    onCancel();
  };
  const confirm = () => {
    if (!confirmationMatches) return;
    setTypedConfirmation('');
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={cancel} />
      <div className="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
        <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-full ${danger ? 'bg-[#FDECEB]' : 'bg-[#FFF5E6]'}`}>
          <AlertTriangle className={danger ? 'text-[#E53935]' : 'text-[#F59E0B]'} size={20} />
        </div>
        <h3 className="mb-1.5 text-base font-bold text-[#141920]">{title}</h3>
        <p className="mb-4 text-sm leading-relaxed text-[#4B5666]">{description}</p>
        {confirmationText && (
          <div className="mb-5">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#647184]">
              Type {confirmationText} to confirm
            </label>
            <input
              value={typedConfirmation}
              onChange={(event) => setTypedConfirmation(event.target.value)}
              className="w-full rounded-md border border-[#DDE3EA] bg-white px-3 py-2 text-sm font-semibold text-[#141920] outline-none transition focus:border-[#E53935] focus:ring-2 focus:ring-[#E53935]/10"
              autoFocus
            />
          </div>
        )}
        <div className="flex gap-3">
          <button
            onClick={cancel}
            className="flex-1 rounded-md border border-[#DDE3EA] py-2 text-sm font-medium text-[#4B5666] transition hover:bg-[#EAEEF3]"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={!confirmationMatches}
            className={`flex-1 rounded-md py-2 text-sm font-medium text-white transition ${
              danger ? 'bg-[#E53935] hover:bg-[#C92E2A]' : 'bg-[#F59E0B] hover:bg-[#A8690A]'
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

