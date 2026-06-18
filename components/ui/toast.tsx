'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'info';

type ToastPayload = {
  title: string;
  description?: string;
  variant?: ToastVariant;
};

type ToastItem = ToastPayload & {
  id: string;
  variant: ToastVariant;
};

const TOAST_EVENT = 'das-health-toast';

export function toast(payload: ToastPayload) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ToastPayload>(TOAST_EVENT, { detail: payload }));
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    function addToast(event: Event) {
      const detail = (event as CustomEvent<ToastPayload>).detail;
      const id = crypto.randomUUID();
      const item: ToastItem = {
        id,
        title: detail.title,
        description: detail.description,
        variant: detail.variant ?? 'success',
      };
      setItems((current) => [item, ...current].slice(0, 4));
      window.setTimeout(() => {
        setItems((current) => current.filter((toastItem) => toastItem.id !== id));
      }, detail.variant === 'error' ? 6500 : 4200);
    }

    window.addEventListener(TOAST_EVENT, addToast);
    return () => window.removeEventListener(TOAST_EVENT, addToast);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="fixed right-4 top-4 z-[80] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3 sm:right-6 sm:top-6">
      {items.map((item) => (
        <ToastCard
          key={item.id}
          item={item}
          onDismiss={() => setItems((current) => current.filter((toastItem) => toastItem.id !== item.id))}
        />
      ))}
    </div>
  );
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const config = {
    success: {
      Icon: CheckCircle2,
      className: 'border-[#A6DCB5] bg-white text-[#141920]',
      iconClassName: 'bg-[#EBF7EE] text-[#2C9942]',
    },
    error: {
      Icon: AlertTriangle,
      className: 'border-[#FACDCB] bg-white text-[#141920]',
      iconClassName: 'bg-[#FDECEB] text-[#E53935]',
    },
    info: {
      Icon: Info,
      className: 'border-[#B8D7F3] bg-white text-[#141920]',
      iconClassName: 'bg-[#E7F0FB] text-[#002E63]',
    },
  }[item.variant];
  const Icon = config.Icon;

  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-xl border p-3 shadow-lg ${config.className}`}
    >
      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${config.iconClassName}`}>
        <Icon size={17} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-5">{item.title}</p>
        {item.description && <p className="mt-0.5 text-xs leading-5 text-[#4B5666]">{item.description}</p>}
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={onDismiss}
        className="rounded-md p-1 text-[#647184] transition hover:bg-[#F5F7FA] hover:text-[#141920]"
      >
        <X size={14} />
      </button>
    </div>
  );
}
