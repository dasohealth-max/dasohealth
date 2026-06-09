'use client';
import { X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface InlineFormProps {
  title: string;
  onClose: () => void;
  onSave: () => void;
  saveLabel?: string;
  saveDisabled?: boolean;
  children: React.ReactNode;
}

export default function InlineForm({ title, onClose, onSave, saveLabel = 'Save', saveDisabled, children }: InlineFormProps) {
  return (
    <Card className="border-0 shadow-md ring-1 ring-teal-200 bg-white">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-800">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"><X size={15} /></button>
        </div>
        {children}
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button onClick={onSave} disabled={saveDisabled}
            className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {saveLabel}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
