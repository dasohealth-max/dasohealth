'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Clock, Inbox, XCircle } from 'lucide-react';
import { getChangeRequests, actionResolveChangeRequest } from '@/app/actions/change_requests';
import { usePermissions } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { TableSkeletonRows } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import ModalForm from '@/components/forms/ModalForm';
import type { ChangeRequest, ChangeRequestStatus } from '@/types';

const PAGE_SIZE = 25;
type Tab = 'Pending' | 'all';

const STATUS_CONFIG: Record<ChangeRequestStatus, { label: string; className: string }> = {
  Pending: { label: 'Pending', className: 'bg-amber-100 text-amber-800' },
  Approved: { label: 'Approved', className: 'bg-green-100 text-green-800' },
  Rejected: { label: 'Rejected', className: 'bg-red-100 text-red-800' },
  Resolved: { label: 'Resolved', className: 'bg-blue-100 text-blue-800' },
};

const TYPE_LABELS: Record<string, string> = {
  archive: 'Archive Request',
  correct: 'Correction Request',
  other: 'Other Request',
};

export default function InboxPage() {
  const { role } = usePermissions();
  const isSuperAdmin = role === 'Super Administrator';

  const [tab, setTab] = useState<Tab>('Pending');
  const [items, setItems] = useState<ChangeRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [resolving, setResolving] = useState<ChangeRequest | null>(null);
  const [resolution, setResolution] = useState<'Approved' | 'Rejected' | 'Resolved'>('Approved');
  const [resolutionNote, setResolutionNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const status: ChangeRequestStatus | undefined = tab === 'Pending' ? 'Pending' : undefined;
      const result = await getChangeRequests({ status, page, pageSize: PAGE_SIZE });
      setItems(result.data);
      setTotal(result.total);
    } finally {
      setLoading(false);
    }
  }, [tab, page]);

  useEffect(() => {
    load();
  }, [load]);

  function openResolve(item: ChangeRequest, defaultResolution: 'Approved' | 'Rejected' | 'Resolved') {
    setResolving(item);
    setResolution(defaultResolution);
    setResolutionNote('');
  }

  async function submitResolution() {
    if (!resolving) return;
    if (!resolutionNote.trim()) {
      toast({ title: 'Please add a resolution note', variant: 'error' });
      return;
    }
    setSaving(true);
    try {
      const result = await actionResolveChangeRequest(resolving.id, { resolution, resolutionNote });
      if (!result.ok) { toast({ title: result.error, variant: 'error' }); return; }
      toast({ title: `Request ${resolution.toLowerCase()} successfully`, variant: 'success' });
      setResolving(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--surface-brand-soft)]">
          <Inbox size={20} className="text-[var(--text-brand)]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--text-strong)]">Inbox</h1>
          <p className="text-sm text-[var(--text-muted)]">
            {isSuperAdmin ? 'Review and resolve change requests from your team' : 'Track your submitted change requests'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border-subtle)]">
        {(['Pending', 'all'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setPage(1); }}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t
                ? 'border-b-2 border-[var(--border-brand)] text-[var(--text-brand)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]'
            }`}
          >
            {t === 'Pending' ? 'Pending' : 'All Requests'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--surface-raised)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-sunken)]">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Request</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Submitted By</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Date</th>
              {isSuperAdmin && (
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {loading ? (
              <TableSkeletonRows columns={isSuperAdmin ? 5 : 4} rows={6} />
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={isSuperAdmin ? 5 : 4} className="px-4 py-12 text-center text-sm text-[var(--text-muted)]">
                  {tab === 'Pending' ? 'No pending requests — all clear!' : 'No change requests found.'}
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const statusCfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.Pending;
                return (
                  <tr key={item.id} className="transition-colors hover:bg-[var(--surface-hover)]">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[var(--text-strong)]">
                        {TYPE_LABELS[item.requestType] ?? item.requestType}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {item.entity}: <span className="font-medium text-[var(--text-strong)]">{item.entityLabel}</span>
                      </p>
                      <p className="mt-1 max-w-xs text-xs text-[var(--text-muted)] line-clamp-2">{item.reason}</p>
                      {item.region && (
                        <p className="mt-0.5 text-[10px] text-[var(--text-subtle)]">Region: {item.region}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--text-strong)]">{item.requestedByName}</p>
                      <p className="text-xs text-[var(--text-muted)]">{item.requestedByRole}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${statusCfg.className}`}>
                        {item.status === 'Pending' && <Clock size={10} />}
                        {(item.status === 'Approved' || item.status === 'Resolved') && <CheckCircle size={10} />}
                        {item.status === 'Rejected' && <XCircle size={10} />}
                        {statusCfg.label}
                      </span>
                      {item.resolvedByName && (
                        <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                          by {item.resolvedByName}
                        </p>
                      )}
                      {item.resolutionNote && (
                        <p className="mt-0.5 max-w-[180px] text-[10px] italic text-[var(--text-muted)] line-clamp-2">
                          &ldquo;{item.resolutionNote}&rdquo;
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--text-muted)] whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    {isSuperAdmin && (
                      <td className="px-4 py-3 text-right">
                        {item.status === 'Pending' ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openResolve(item, 'Rejected')}
                              className="border-red-200 text-red-700 hover:bg-red-50"
                            >
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => openResolve(item, 'Approved')}
                              className="bg-[var(--color-brand-primary)] text-white hover:bg-[var(--color-brand-primary-hover)]"
                            >
                              Approve
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-[var(--text-muted)]">
          <span>
            Showing {Math.min((page - 1) * PAGE_SIZE + 1, total)}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Resolve Modal */}
      {resolving && (
        <ModalForm
          title={resolution === 'Approved' ? 'Approve Request' : resolution === 'Rejected' ? 'Reject Request' : 'Resolve Request'}
          subtitle={`${TYPE_LABELS[resolving.requestType] ?? resolving.requestType} — ${resolving.entityLabel}`}
          onClose={() => setResolving(null)}
          onSave={submitResolution}
          saveLabel={resolution === 'Approved' ? 'Approve' : resolution === 'Rejected' ? 'Reject' : 'Resolve'}
          saveDisabled={saving || !resolutionNote.trim()}
        >
          <div className="space-y-4">
            {/* Summary */}
            <div className="rounded-lg bg-[var(--surface-sunken)] p-3 text-sm">
              <p className="font-semibold text-[var(--text-strong)]">{resolving.entityLabel}</p>
              <p className="mt-1 text-[var(--text-muted)]">{resolving.reason}</p>
              <p className="mt-1 text-xs text-[var(--text-subtle)]">Requested by {resolving.requestedByName} ({resolving.requestedByRole})</p>
            </div>

            {/* Resolution selector */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Resolution
              </label>
              <div className="flex gap-2">
                {(['Approved', 'Rejected', 'Resolved'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setResolution(r)}
                    className={`flex-1 rounded-md border py-2 text-sm font-medium transition-colors ${
                      resolution === r
                        ? r === 'Rejected'
                          ? 'border-red-500 bg-red-50 text-red-700'
                          : 'border-[var(--border-brand)] bg-[var(--surface-brand-soft)] text-[var(--text-brand)]'
                        : 'border-[var(--border-default)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Note */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Resolution Note <span className="text-red-500">*</span>
              </label>
              <textarea
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                rows={3}
                placeholder="Explain your decision or any action taken..."
                className="w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-sunken)] px-3 py-2 text-sm text-[var(--text-strong)] outline-none transition placeholder:text-[var(--text-subtle)] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--ring-soft)]"
              />
            </div>
          </div>
        </ModalForm>
      )}
    </div>
  );
}
