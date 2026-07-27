'use client';

import { useState } from 'react';
import { actionCreateChangeRequest } from '@/app/actions/change_requests';
import ModalForm from '@/components/forms/ModalForm';
import { toast } from '@/components/ui/toast';

export interface ChangeRequestTarget {
  entity: 'Patient' | 'Surgery';
  entityId: string;
  entityLabel: string;
  region?: string;
  campaignId?: string;
}

interface Props {
  target: ChangeRequestTarget;
  onClose: () => void;
  onSubmitted?: () => void;
}

const REQUEST_TYPES: { value: 'archive' | 'correct' | 'other'; label: string; hint: string }[] = [
  { value: 'archive', label: 'Archive / Remove', hint: 'Request this record to be archived (soft-deleted) by a Super Admin' },
  { value: 'correct', label: 'Correction', hint: 'Request a correction to data that cannot be changed at your permission level' },
  { value: 'other', label: 'Other', hint: 'Any other change that requires Super Admin approval' },
];

export default function ChangeRequestDialog({ target, onClose, onSubmitted }: Props) {
  const [requestType, setRequestType] = useState<'archive' | 'correct' | 'other'>('archive');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (reason.trim().length < 10) {
      toast({ title: 'Please provide a more detailed reason (at least 10 characters)', variant: 'error' });
      return;
    }
    setSaving(true);
    try {
      const result = await actionCreateChangeRequest({
        entity: target.entity,
        entityId: target.entityId,
        entityLabel: target.entityLabel,
        requestType,
        reason: reason.trim(),
        region: target.region,
        campaignId: target.campaignId,
      });
      if (!result.ok) {
        toast({ title: 'Could not submit request', description: result.error, variant: 'error' });
        return;
      }
      toast({ title: 'Change request submitted', description: 'Your Super Administrator will be notified to review this request.' });
      onSubmitted?.();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const selectedType = REQUEST_TYPES.find((t) => t.value === requestType)!;

  return (
    <ModalForm
      title="Submit Change Request"
      subtitle={`${target.entity}: ${target.entityLabel}`}
      onClose={onClose}
      onSave={submit}
      saveLabel="Submit Request"
      saveDisabled={saving || reason.trim().length < 10}
    >
      <div className="space-y-4">
        {/* Info banner */}
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <strong>Why this form?</strong> This {target.entity.toLowerCase()} has reached surgery level and cannot be
          deleted directly. Your Super Administrator will review and act on this request.
        </div>

        {/* Request type */}
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#647184]">
            Request Type
          </label>
          <div className="space-y-2">
            {REQUEST_TYPES.map((rt) => (
              <label
                key={rt.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                  requestType === rt.value
                    ? 'border-[#2C9942] bg-[#EBF7EE]'
                    : 'border-[#DDE3EA] hover:bg-[#EAEEF3]'
                }`}
              >
                <input
                  type="radio"
                  name="requestType"
                  value={rt.value}
                  checked={requestType === rt.value}
                  onChange={() => setRequestType(rt.value)}
                  className="mt-0.5 accent-[#2C9942]"
                />
                <div>
                  <p className="text-sm font-semibold text-[#141920]">{rt.label}</p>
                  <p className="text-xs text-[#647184]">{rt.hint}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Reason */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#647184]">
            Reason <span className="text-red-500">*</span>
          </label>
          <p className="mb-1.5 text-xs text-[#647184]">{selectedType.hint}</p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="Describe why this change is needed. Include any supporting details that will help your Super Admin make a decision..."
            className="w-full rounded-md border border-[#DDE3EA] bg-white px-3 py-2 text-sm text-[#141920] outline-none transition placeholder:text-[#647184] focus:border-[#2C9942] focus:ring-2 focus:ring-[#2C9942]/10"
          />
          <p className={`mt-1 text-right text-[10px] ${reason.trim().length < 10 ? 'text-red-500' : 'text-[#647184]'}`}>
            {reason.trim().length} / 10 min
          </p>
        </div>
      </div>
    </ModalForm>
  );
}
