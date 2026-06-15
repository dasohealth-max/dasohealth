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
    <Card className="border-0 bg-white shadow-md ring-1 ring-[#8FBFA4]">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-[#1C2B22]">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#E8F5EE] text-[#7A9A87] hover:text-[#1C2B22]"><X size={15} /></button>
        </div>
        {children}
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-[#D0E8DA]">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-[#4A6455] bg-white border border-[#D0E8DA] rounded-md hover:bg-[#F0EDE6] transition-colors">
            Cancel
          </button>
          <button onClick={onSave} disabled={saveDisabled}
            className="px-4 py-2 text-sm font-medium text-white bg-[#1A7A46] rounded-md hover:bg-[#0F4D2A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {saveLabel}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
