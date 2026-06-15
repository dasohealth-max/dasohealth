'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Campaign, CampaignStatus, CampaignType, User } from '@/types';
import { actionCreateCampaign, actionCreateCampaignsBulk, actionDeleteCampaign, actionUpdateCampaign, getAllCampaigns } from '@/app/actions/campaigns';
import { actionGetAllUsers } from '@/app/actions/users';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import ModalForm from '@/components/forms/ModalForm';
import { defaultOperationDistrict, defaultSurgeryTarget, REGIONAL_CAMPAIGN_AREAS } from '@/lib/regions';
import { usePermissions } from '@/lib/auth';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Calendar, Pencil, Plus, RotateCcw, Target, Trash2, UserRound, X } from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPES: CampaignType[]   = ['Cataract', 'School Eye Health', 'Diabetic Retinopathy', 'Glaucoma', 'General'];
const STATUSES: CampaignStatus[] = ['Planned', 'Active', 'Completed', 'Suspended'];

// Shared input / label styles — professional, not bubbly
const F = {
  label: 'block text-[11px] font-semibold uppercase tracking-wide text-[#7A9A87] mb-1.5',
  input: 'w-full rounded-md border border-[#D0E8DA] bg-white px-3 py-2 text-sm text-[#1C2B22] placeholder:text-[#7A9A87] outline-none transition focus:border-[#1A7A46] focus:ring-2 focus:ring-[#1A7A46]/10 disabled:bg-[#F0EDE6] disabled:text-[#7A9A87]',
  select: 'rounded-md',
};

// ─── Form shape ───────────────────────────────────────────────────────────────

const BLANK: Omit<Campaign, 'id' | 'createdAt'> = {
  name: '',
  type: 'Cataract',
  status: 'Planned',
  region: 'Banadir / Mogadishu',
  operationDistrict: 'Mogadishu',
  projectManagerId: '',
  projectManagerName: '',
  startDate: '',
  endDate: '',
  budget: 0,
  donors: '',
  targetScreenings: 0,
  targetSurgeries: 800,
  targetFollowUps: 0,
  description: '',
};

type CampaignForm     = typeof BLANK;
type BulkCampaignForm = CampaignForm & { enabled: boolean };

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<CampaignStatus, string> = {
  Active:    'bg-[#1A7A46] text-white',
  Planned:   'bg-[#4A6455] text-white',
  Completed: 'bg-[#2B9E5C] text-white',
  Suspended: 'bg-[#C47D11] text-white',
};

function StatusBadge({ status }: { status: CampaignStatus }) {
  return (
    <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const { can, role } = usePermissions();
  const isSuperAdmin  = role === 'Super Administrator';

  const [campaigns,  setCampaigns]  = useState<Campaign[]>([]);
  const [users,      setUsers]      = useState<User[]>([]);
  const [form,       setForm]       = useState<CampaignForm>(BLANK);
  const [bulkForms,  setBulkForms]  = useState<BulkCampaignForm[]>(() => createBulkDefaults());
  const [editing,      setEditing]      = useState<Campaign | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null);
  const [showForm,     setShowForm]     = useState(false);
  const [saveError,    setSaveError]    = useState('');
  const [isLoading,  setIsLoading]  = useState(true);

  const managers = useMemo(
    () => users.filter((u) => u.role === 'Project Manager' && (!form.region || u.assignedRegion === form.region)),
    [form.region, users],
  );

  const enabledBulkForms  = bulkForms.filter((c) => c.enabled);
  const bulkSaveDisabled  = enabledBulkForms.length === 0 || enabledBulkForms.some(
    (c) => !c.name || !c.projectManagerId || !c.startDate || !c.endDate || c.targetSurgeries < 1,
  );

  useEffect(() => {
    Promise.all([getAllCampaigns(), actionGetAllUsers()]).then(([rows, userResult]) => {
      setCampaigns(rows);
      if (userResult.ok) setUsers(userResult.data);
      setIsLoading(false);
    });
  }, []);

  function set<K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function chooseRegion(region: string) {
    setForm((prev) => ({
      ...prev,
      region,
      operationDistrict: defaultOperationDistrict(region),
      targetSurgeries:   defaultSurgeryTarget(region),
      projectManagerId:  '',
      projectManagerName: '',
    }));
  }

  function chooseManager(id: string) {
    const mgr = users.find((u) => u.id === id);
    setForm((prev) => ({ ...prev, projectManagerId: id, projectManagerName: mgr?.name ?? '' }));
  }

  function updateBulk(index: number, patch: Partial<BulkCampaignForm>) {
    setBulkForms((rows) => rows.map((row, i) => i === index ? { ...row, ...patch } : row));
  }

  function chooseBulkManager(index: number, id: string) {
    const mgr = users.find((u) => u.id === id);
    updateBulk(index, { projectManagerId: id, projectManagerName: mgr?.name ?? '' });
  }

  function openAdd() {
    setForm(BLANK);
    setBulkForms(createBulkDefaults());
    setEditing(null);
    setSaveError('');
    setShowForm(true);
  }

  function openEdit(campaign: Campaign) {
    const { id: _id, createdAt: _ca, ...editable } = campaign;
    void _id; void _ca;
    setForm(editable);
    setEditing(campaign);
    setSaveError('');
    setShowForm(true);
  }

  async function save() {
    setSaveError('');

    if (!editing && isSuperAdmin) {
      const result = await actionCreateCampaignsBulk(enabledBulkForms.map(stripEnabled));
      if (!result.ok) { setSaveError(result.error); return; }
      setCampaigns((rows) => [...result.data, ...rows]);
      setShowForm(false);
      return;
    }

    const result = editing
      ? await actionUpdateCampaign(editing.id, form)
      : await actionCreateCampaign(form);
    if (!result.ok) { setSaveError(result.error); return; }
    setCampaigns((rows) => editing
      ? rows.map((row) => row.id === editing.id ? result.data : row)
      : [result.data, ...rows]);
    setShowForm(false);
    setEditing(null);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const result = await actionDeleteCampaign(deleteTarget.id);
    if (result.ok) setCampaigns((rows) => rows.filter((row) => row.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  const singleFormInvalid = !form.name || !form.region || !form.operationDistrict || !form.projectManagerId || !form.startDate || !form.endDate;
  const campaignEditDeniedReason = can('campaigns', 'edit')
    ? undefined
    : 'Access denied: only Super Administrators can change campaigns.';

  return (
    <div className="space-y-5">
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Campaign"
        description={deleteTarget
          ? `This will permanently delete "${deleteTarget.name}" along with all patients, screenings, surgeries, and follow-ups. This cannot be undone.`
          : ''}
        confirmLabel="Delete Campaign"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Page header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#1C2B22]">Campaigns</h1>
          <p className="text-sm text-[#4A6455]">Regional eye surgery campaigns with assigned Project Managers</p>
        </div>
        {can('campaigns', 'create') && !showForm && (
          <Button onClick={openAdd} className="gap-2 rounded-md bg-[#1A7A46] text-white hover:bg-[#0F4D2A]">
            <Plus size={15} /> {isSuperAdmin ? 'Create Campaigns' : 'New Campaign'}
          </Button>
        )}
        {showForm && (
          <Button variant="outline" onClick={() => setShowForm(false)} className="gap-2 rounded-md">
            <X size={14} /> Cancel
          </Button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <ModalForm
          title={editing ? `Edit — ${editing.name}` : isSuperAdmin ? 'Create Campaigns for All 9 Regions' : 'New Regional Campaign'}
          subtitle={!editing && isSuperAdmin ? 'Toggle which regions to include, assign a Project Manager to each, then save.' : undefined}
          onClose={() => setShowForm(false)}
          onSave={save}
          saveLabel={editing ? 'Save Changes' : isSuperAdmin ? `Create ${enabledBulkForms.length} Campaign${enabledBulkForms.length !== 1 ? 's' : ''}` : 'Create Campaign'}
          saveDisabled={editing || !isSuperAdmin ? singleFormInvalid : bulkSaveDisabled}
          wide={!editing && isSuperAdmin}
        >
          {saveError && (
            <div className="mb-4 rounded-md border border-[#F0C0C0] bg-[#FCE8E8] px-3 py-2 text-sm text-[#B52A2A]">
              {saveError}
            </div>
          )}

          {editing || !isSuperAdmin ? (
            <SingleCampaignForm form={form} managers={managers} set={set} chooseRegion={chooseRegion} chooseManager={chooseManager} />
          ) : (
            <BulkCampaignForm
              bulkForms={bulkForms}
              users={users}
              updateBulk={updateBulk}
              chooseBulkManager={chooseBulkManager}
              resetBulkDefaults={() => { setBulkForms(createBulkDefaults()); setSaveError(''); }}
            />
          )}
        </ModalForm>
      )}

      {/* Campaign cards */}
      {isLoading ? (
        <div className="py-16 text-center text-sm text-[#7A9A87]">Loading campaigns...</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              canEdit={can('campaigns', 'edit')}
              canDelete={can('campaigns', 'delete')}
              editDeniedReason={campaignEditDeniedReason}
              onEdit={() => openEdit(campaign)}
              onDelete={() => setDeleteTarget(campaign)}
            />
          ))}
          {campaigns.length === 0 && (
            <div className="rounded-xl border border-dashed border-[#D0E8DA] py-14 text-center text-sm text-[#7A9A87] md:col-span-2 xl:col-span-3">
              No campaigns yet. Create the first one above.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Campaign Card ────────────────────────────────────────────────────────────

function CampaignCard({
  campaign,
  canEdit,
  canDelete,
  editDeniedReason,
  onEdit,
  onDelete,
}: {
  campaign: Campaign;
  canEdit: boolean;
  canDelete: boolean;
  editDeniedReason?: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#F0EDE6] bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Region header — most prominent, always visible first */}
      <div className="bg-[#1C2B22] px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7A9A87]">
              {campaign.region}
            </p>
            <p className="mt-0.5 text-lg font-bold leading-tight text-white">
              {campaign.operationDistrict}
            </p>
          </div>
          <StatusBadge status={campaign.status} />
        </div>
      </div>

      {/* Campaign body */}
      <div className="p-4">
        <div className="mb-4">
          <p className="font-semibold text-[#1C2B22]">{campaign.name}</p>
          <p className="mt-0.5 text-xs text-[#7A9A87]">{campaign.type}</p>
        </div>

        <div className="space-y-2 text-sm text-[#4A6455]">
          <div className="flex items-center gap-2.5">
            <UserRound size={13} className="shrink-0 text-[#7A9A87]" />
            <span className="truncate">{campaign.projectManagerName || <span className="text-[#7A9A87] italic">No PM assigned</span>}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Target size={13} className="shrink-0 text-[#7A9A87]" />
            <span>{campaign.targetSurgeries.toLocaleString()} surgery target</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Calendar size={13} className="shrink-0 text-[#7A9A87]" />
            <span>{campaign.startDate} – {campaign.endDate}</span>
          </div>
        </div>

        {(canEdit || canDelete || editDeniedReason) && (
          <div className="mt-4 flex gap-2 border-t border-[#F0EDE6] pt-3">
            {canEdit ? (
              <button
                onClick={onEdit}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-[#D0E8DA] py-1.5 text-xs font-medium text-[#4A6455] transition hover:bg-[#FAFAF8]"
              >
                <Pencil size={12} /> Edit
              </button>
            ) : editDeniedReason ? (
              <Tooltip>
                <TooltipTrigger
                  className="flex flex-1 cursor-not-allowed items-center justify-center gap-1.5 rounded-md border border-[#D0E8DA] bg-[#F0EDE6] py-1.5 text-xs font-medium text-[#7A9A87] opacity-80"
                  aria-disabled="true"
                >
                  <Pencil size={12} /> Edit
                </TooltipTrigger>
                <TooltipContent>{editDeniedReason}</TooltipContent>
              </Tooltip>
            ) : null}
            {canDelete && (
              <button
                onClick={onDelete}
                className="flex items-center justify-center gap-1.5 rounded-md border border-[#F0C0C0] px-3 py-1.5 text-xs font-medium text-[#B52A2A] transition hover:bg-[#FCE8E8]"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Single Campaign Form ─────────────────────────────────────────────────────

function SingleCampaignForm({
  form, managers, set, chooseRegion, chooseManager,
}: {
  form: CampaignForm;
  managers: User[];
  set: <K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) => void;
  chooseRegion: (region: string) => void;
  chooseManager: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Section 1: Location & Accountability */}
      <section>
        <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-[#7A9A87]">Location & Accountability</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={F.label}>State / Region *</label>
            <Select value={form.region} onValueChange={(v) => { if (v) chooseRegion(v); }}>
              <SelectTrigger className={F.select}><SelectValue /></SelectTrigger>
              <SelectContent>{REGIONAL_CAMPAIGN_AREAS.map((a) => <SelectItem key={a.region} value={a.region}>{a.region}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className={F.label}>City / Operation District *</label>
            <input value={form.operationDistrict} onChange={(e) => set('operationDistrict', e.target.value)} className={F.input} />
          </div>
          <div className="sm:col-span-2">
            <label className={F.label}>Project Manager *</label>
            <Select value={form.projectManagerId} onValueChange={(v) => { if (v) chooseManager(v); }}>
              <SelectTrigger className={F.select}><SelectValue placeholder={managers.length ? 'Select a Project Manager' : 'No PMs for this region — add one in Settings'} /></SelectTrigger>
              <SelectContent>{managers.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* Section 2: Schedule & Targets */}
      <section>
        <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-[#7A9A87]">Schedule & Targets</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className={F.label}>Start Date *</label>
            <input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} className={F.input} />
          </div>
          <div>
            <label className={F.label}>End Date *</label>
            <input type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} className={F.input} />
          </div>
          <div>
            <label className={F.label}>Surgery Target *</label>
            <input type="number" value={form.targetSurgeries} onChange={(e) => set('targetSurgeries', Number(e.target.value))} className={F.input} />
          </div>
          <div>
            <label className={F.label}>Status</label>
            <Select value={form.status} onValueChange={(v) => { if (v) set('status', v as CampaignStatus); }}>
              <SelectTrigger className={F.select}><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* Section 3: Campaign Details */}
      <section>
        <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-[#7A9A87]">Campaign Details</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={F.label}>Campaign Name *</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Banadir Cataract Campaign 2026" className={F.input} />
          </div>
          <div>
            <label className={F.label}>Type</label>
            <Select value={form.type} onValueChange={(v) => { if (v) set('type', v as CampaignType); }}>
              <SelectTrigger className={F.select}><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className={F.label}>Donors</label>
            <input value={form.donors} onChange={(e) => set('donors', e.target.value)} placeholder="e.g. WHO, USAID" className={F.input} />
          </div>
          <div className="sm:col-span-2">
            <label className={F.label}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={2}
              className={`${F.input} resize-none`}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── Bulk Campaign Form ───────────────────────────────────────────────────────

function BulkCampaignForm({
  bulkForms, users, updateBulk, chooseBulkManager, resetBulkDefaults,
}: {
  bulkForms: BulkCampaignForm[];
  users: User[];
  updateBulk: (index: number, patch: Partial<BulkCampaignForm>) => void;
  chooseBulkManager: (index: number, id: string) => void;
  resetBulkDefaults: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#4A6455]">
          All 9 regions pre-filled with defaults. Assign a Project Manager to each, adjust dates and targets, then save.
        </p>
        <button
          type="button"
          onClick={resetBulkDefaults}
          className="flex items-center gap-1.5 rounded-md border border-[#D0E8DA] px-3 py-1.5 text-xs font-medium text-[#4A6455] transition hover:bg-[#FAFAF8]"
        >
          <RotateCcw size={13} /> Reset Defaults
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {bulkForms.map((campaign, index) => {
          const regionManagers = users.filter((u) => u.role === 'Project Manager' && u.assignedRegion === campaign.region);
          const hasPMs = regionManagers.length > 0;
          return (
            <div
              key={`${campaign.region}-${index}`}
              className={`overflow-hidden rounded-xl border transition ${campaign.enabled ? 'border-[#D0E8DA] bg-white' : 'border-[#F0EDE6] bg-[#FAFAF8] opacity-60'}`}
            >
              {/* Card header — region prominent */}
              <div className={`flex items-center justify-between gap-2 px-4 py-3 ${campaign.enabled ? 'bg-[#1C2B22]' : 'bg-[#D0E8DA]'}`}>
                <div className="min-w-0">
                  <p className={`text-[10px] font-semibold uppercase tracking-widest ${campaign.enabled ? 'text-[#7A9A87]' : 'text-[#4A6455]'}`}>
                    {campaign.region}
                  </p>
                  <p className={`text-sm font-bold leading-tight ${campaign.enabled ? 'text-white' : 'text-[#4A6455]'}`}>
                    {campaign.operationDistrict}
                  </p>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-[#7A9A87]">
                  <input
                    type="checkbox"
                    checked={campaign.enabled}
                    onChange={(e) => updateBulk(index, { enabled: e.target.checked })}
                    className="h-4 w-4 rounded border-[#8FBFA4] accent-[#1A7A46]"
                  />
                  <span className={campaign.enabled ? 'text-[#8593A5]' : 'text-[#4A6455]'}>Include</span>
                </label>
              </div>

              {/* Card body */}
              <div className="space-y-3 p-4">
                <div>
                  <label className={F.label}>Campaign Name</label>
                  <input
                    value={campaign.name}
                    onChange={(e) => updateBulk(index, { name: e.target.value })}
                    disabled={!campaign.enabled}
                    className={F.input}
                  />
                </div>

                <div>
                  <label className={F.label}>Project Manager *</label>
                  <Select
                    value={campaign.projectManagerId}
                    disabled={!campaign.enabled || !hasPMs}
                    onValueChange={(v) => { if (v) chooseBulkManager(index, v); }}
                  >
                    <SelectTrigger className={F.select}>
                      <SelectValue placeholder={hasPMs ? 'Select PM' : 'No PM in Settings'} />
                    </SelectTrigger>
                    <SelectContent>
                      {regionManagers.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {campaign.enabled && !hasPMs && (
                    <p className="mt-1 text-[11px] text-[#C47D11]">Add a PM for this region in Settings first.</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={F.label}>Start Date *</label>
                    <input
                      type="date"
                      value={campaign.startDate}
                      onChange={(e) => updateBulk(index, { startDate: e.target.value })}
                      disabled={!campaign.enabled}
                      className={F.input}
                    />
                  </div>
                  <div>
                    <label className={F.label}>End Date *</label>
                    <input
                      type="date"
                      value={campaign.endDate}
                      onChange={(e) => updateBulk(index, { endDate: e.target.value })}
                      disabled={!campaign.enabled}
                      className={F.input}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={F.label}>Surgery Target</label>
                    <input
                      type="number"
                      value={campaign.targetSurgeries}
                      onChange={(e) => updateBulk(index, { targetSurgeries: Number(e.target.value) })}
                      disabled={!campaign.enabled}
                      className={F.input}
                    />
                  </div>
                  <div>
                    <label className={F.label}>Status</label>
                    <Select
                      value={campaign.status}
                      disabled={!campaign.enabled}
                      onValueChange={(v) => { if (v) updateBulk(index, { status: v as CampaignStatus }); }}
                    >
                      <SelectTrigger className={F.select}><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createBulkDefaults(): BulkCampaignForm[] {
  const startDate = fmtDate(new Date());
  const endDate   = fmtDate(addDays(new Date(), 60));
  return REGIONAL_CAMPAIGN_AREAS.map((area) => ({
    enabled:            true,
    name:               `${area.region} Cataract Surgery Campaign`,
    type:               'Cataract',
    status:             'Planned',
    region:             area.region,
    operationDistrict:  area.defaultDistrict,
    projectManagerId:   '',
    projectManagerName: '',
    startDate,
    endDate,
    budget:             area.defaultSurgeryTarget * 35,
    donors:             '',
    targetScreenings:   area.defaultSurgeryTarget * 2,
    targetSurgeries:    area.defaultSurgeryTarget,
    targetFollowUps:    area.defaultSurgeryTarget,
    description:        '',
  }));
}

function stripEnabled({ enabled, ...c }: BulkCampaignForm): CampaignForm { void enabled; return c; }
function addDays(d: Date, n: number) { const c = new Date(d); c.setDate(c.getDate() + n); return c; }
function fmtDate(d: Date) { return d.toISOString().split('T')[0]; }
