'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalFormProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  onSave: () => void;
  saveLabel?: string;
  saveDisabled?: boolean;
  children: React.ReactNode;
  wide?: boolean;
}

export default function ModalForm({
  title,
  subtitle,
  onClose,
  onSave,
  saveLabel = 'Save',
  saveDisabled,
  children,
  wide = false,
}: ModalFormProps) {
  // Lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-8" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className={`relative flex w-full flex-col rounded-xl bg-white shadow-2xl ${wide ? 'max-w-5xl' : 'max-w-2xl'} my-auto`}>
        {/* Header â€” sticky */}
        <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between rounded-t-xl border-b border-[#DDE3EA] bg-white px-6 py-4">
          <div>
            <h2 className="text-sm font-bold text-[#141920]">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-[#4B5666]">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-[#647184] transition hover:bg-[#EBF7EE] hover:text-[#141920]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {children}
        </div>

        {/* Footer â€” sticky */}
        <div className="sticky bottom-0 flex shrink-0 justify-end gap-3 rounded-b-xl border-t border-[#DDE3EA] bg-white px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-md border border-[#DDE3EA] px-4 py-2 text-sm font-medium text-[#4B5666] transition hover:bg-[#EAEEF3]"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saveDisabled}
            className="rounded-md bg-[#2C9942] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#002E63] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

