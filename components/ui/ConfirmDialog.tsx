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
        <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-full ${danger ? 'bg-[#FCE8E8]' : 'bg-[#FEF3DC]'}`}>
          <AlertTriangle className={danger ? 'text-[#B52A2A]' : 'text-[#C47D11]'} size={20} />
        </div>
        <h3 className="mb-1.5 text-base font-bold text-[#1C2B22]">{title}</h3>
        <p className="mb-6 text-sm leading-relaxed text-[#4A6455]">{description}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-md border border-[#E2DDD5] py-2 text-sm font-medium text-[#4A6455] transition hover:bg-[#F0EDE6]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 rounded-md py-2 text-sm font-medium text-white transition ${
              danger ? 'bg-[#B52A2A] hover:bg-[#8F1F1F]' : 'bg-[#C47D11] hover:bg-[#A36A0E]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
