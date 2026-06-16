'use client';

import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Delete',
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
        <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-full ${danger ? 'bg-[#FDECEB]' : 'bg-[#FFF5E6]'}`}>
          <AlertTriangle className={danger ? 'text-[#E53935]' : 'text-[#F59E0B]'} size={20} />
        </div>
        <h3 className="mb-1.5 text-base font-bold text-[#141920]">{title}</h3>
        <p className="mb-6 text-sm leading-relaxed text-[#4B5666]">{description}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-md border border-[#DDE3EA] py-2 text-sm font-medium text-[#4B5666] transition hover:bg-[#EAEEF3]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 rounded-md py-2 text-sm font-medium text-white transition ${
              danger ? 'bg-[#E53935] hover:bg-[#C92E2A]' : 'bg-[#F59E0B] hover:bg-[#A8690A]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

