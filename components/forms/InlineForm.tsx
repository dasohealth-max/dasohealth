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
    <Card className="border-0 bg-white shadow-md ring-1 ring-[#A6DCB5]">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-[#141920]">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#EBF7EE] text-[#647184] hover:text-[#141920]"><X size={15} /></button>
        </div>
        {children}
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-[#DDE3EA]">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-[#4B5666] bg-white border border-[#DDE3EA] rounded-md hover:bg-[#EAEEF3] transition-colors">
            Cancel
          </button>
          <button onClick={onSave} disabled={saveDisabled}
            className="px-4 py-2 text-sm font-medium text-white bg-[#2C9942] rounded-md hover:bg-[#002E63] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {saveLabel}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

