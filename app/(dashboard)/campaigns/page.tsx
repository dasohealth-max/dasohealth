'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Campaign, CampaignStatus, CampaignType, User } from '@/types';
import { actionCreateCampaign, actionCreateCampaignsBulk, actionDeleteCampaign, actionUpdateCampaign, getAllCampaigns } from '@/app/actions/campaigns';
import { actionGetAllUsers } from '@/app/actions/users';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import InlineForm from '@/components/forms/InlineForm';
import { defaultOperationDistrict, defaultSurgeryTarget, REGIONAL_CAMPAIGN_AREAS } from '@/lib/regions';
import { usePermissions } from '@/lib/auth';
import { Calendar, MapPin, Pencil, Plus, RotateCcw, Target, Trash2, UserRound, X } from 'lucide-react';

const TYPES: CampaignType[] = ['Cataract', 'School Eye Health', 'Diabetic Retinopathy', 'Glaucoma', 'General'];
const STATUSES: CampaignStatus[] = ['Planned', 'Active', 'Completed', 'Suspended'];

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

type CampaignForm = typeof BLANK;
type BulkCampaignForm = CampaignForm & { enabled: boolean };

export default function CampaignsPage() {
  const { can, role } = usePermissions();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState<CampaignForm>(BLANK);
  const [bulkForms, setBulkForms] = useState<BulkCampaignForm[]>(() => createBulkDefaults());
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const isSuperAdmin = role === 'Super Administrator';

  const managers = useMemo(
    () => users.filter((u) => u.role === 'Project Manager' && (!form.region || u.assignedRegion === form.region)),
    [form.region, users],
  );

  const enabledBulkForms = bulkForms.filter((campaign) => campaign.enabled);
  const bulkSaveDisabled = enabledBulkForms.length === 0 || enabledBulkForms.some((campaign) => (
    !campaign.name ||
    !campaign.region ||
    !campaign.operationDistrict ||
    !campaign.projectManagerId ||
    !campaign.startDate ||
    !campaign.endDate ||
    campaign.targetSurgeries < 1
  ));

  useEffect(() => {
    Promise.all([getAllCampaigns(), actionGetAllUsers()]).then(([campaignRows, userResult]) => {
      setCampaigns(campaignRows);
      if (userResult.ok) setUsers(userResult.data);
      setIsLoading(false);
    });
  }, []);

  function set<K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function chooseRegion(region: string) {
    setForm((current) => ({
      ...current,
      region,
      operationDistrict: defaultOperationDistrict(region),
      targetSurgeries: defaultSurgeryTarget(region),
      projectManagerId: '',
      projectManagerName: '',
    }));
  }

  function chooseManager(id: string) {
    const manager = users.find((u) => u.id === id);
    setForm((current) => ({
      ...current,
      projectManagerId: id,
      projectManagerName: manager?.name ?? '',
    }));
  }

  function updateBulk(index: number, patch: Partial<BulkCampaignForm>) {
    setBulkForms((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  }

  function chooseBulkRegion(index: number, region: string) {
    updateBulk(index, {
      region,
      operationDistrict: defaultOperationDistrict(region),
      targetSurgeries: defaultSurgeryTarget(region),
      targetScreenings: defaultSurgeryTarget(region) * 2,
      targetFollowUps: defaultSurgeryTarget(region),
      projectManagerId: '',
      projectManagerName: '',
      name: `${region} Cataract Surgery Campaign`,
    });
  }

  function chooseBulkManager(index: number, id: string) {
    const manager = users.find((u) => u.id === id);
    updateBulk(index, {
      projectManagerId: id,
      projectManagerName: manager?.name ?? '',
    });
  }

  function resetBulkDefaults() {
    setBulkForms(createBulkDefaults());
    setSaveError('');
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
      if (!result.ok) {
        setSaveError(result.error);
        return;
      }
      setCampaigns((rows) => [...result.data, ...rows]);
      setShowForm(false);
      return;
    }

    const result = editing
      ? await actionUpdateCampaign(editing.id, form)
      : await actionCreateCampaign(form);
    if (!result.ok) {
      setSaveError(result.error);
      return;
    }
    setCampaigns((rows) => editing
      ? rows.map((row) => row.id === editing.id ? result.data : row)
      : [result.data, ...rows]);
    setShowForm(false);
    setEditing(null);
  }

  async function remove(campaign: Campaign) {
    if (!confirm(`Delete campaign "${campaign.name}"? This will remove all associated patient records, screenings, surgeries, and follow-ups. This cannot be undone.`)) return;
    const result = await actionDeleteCampaign(campaign.id);
    if (result.ok) setCampaigns((rows) => rows.filter((row) => row.id !== campaign.id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Campaigns</h1>
          <p className="text-sm text-slate-500">Create one-region campaigns and assign accountable Project Managers</p>
        </div>
        {can('campaigns', 'create') && !showForm && (
          <Button onClick={openAdd} className="gap-2 rounded-xl bg-teal-600 text-white hover:bg-teal-700">
            <Plus size={15} /> {isSuperAdmin ? 'Create Campaigns' : 'New Campaign'}
          </Button>
        )}
        {showForm && (
          <Button variant="outline" onClick={() => setShowForm(false)} className="gap-2 rounded-xl">
            <X size={14} /> Cancel
          </Button>
        )}
      </div>

      {showForm && (
        <InlineForm
          title={editing ? `Edit ${editing.name}` : isSuperAdmin ? 'Create Campaigns for 9 Regions' : 'Create Regional Campaign'}
          onClose={() => setShowForm(false)}
          onSave={save}
          saveLabel={editing ? 'Update Campaign' : isSuperAdmin ? `Create ${enabledBulkForms.length} Campaigns` : 'Create Campaign'}
          saveDisabled={editing || !isSuperAdmin
            ? !form.name || !form.region || !form.operationDistrict || !form.projectManagerId || !form.startDate || !form.endDate
            : bulkSaveDisabled}
        >
          {saveError && <p className="mb-2 text-xs text-red-600">{saveError}</p>}
          {editing || !isSuperAdmin ? (
            <SingleCampaignForm
              form={form}
              managers={managers}
              set={set}
              chooseRegion={chooseRegion}
              chooseManager={chooseManager}
            />
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-500">All regions are ready by default. Disable a region or change city, manager, dates, targets, and status before saving.</p>
                <Button type="button" variant="outline" onClick={resetBulkDefaults} className="gap-2 rounded-xl">
                  <RotateCcw size={14} /> Reset
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                {bulkForms.map((campaign, index) => {
                  const regionManagers = users.filter((u) => u.role === 'Project Manager' && u.assignedRegion === campaign.region);
                  return (
                    <div key={`${campaign.region}-${index}`} className={`rounded-xl border p-3 ${campaign.enabled ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-70'}`}>
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{campaign.region}</p>
                          <p className="text-xs text-slate-500">{campaign.operationDistrict}</p>
                        </div>
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                          <input
                            type="checkbox"
                            checked={campaign.enabled}
                            onChange={(event) => updateBulk(index, { enabled: event.target.checked })}
                            className="h-4 w-4 rounded border-slate-300 text-teal-600"
                          />
                          Enabled
                        </label>
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <Label className="mb-1 block text-xs">Campaign Name *</Label>
                          <Input value={campaign.name} onChange={(e) => updateBulk(index, { name: e.target.value })} disabled={!campaign.enabled} className="rounded-xl" />
                        </div>
                        <div>
                          <Label className="mb-1 block text-xs">State / Region *</Label>
                          <Select value={campaign.region} disabled={!campaign.enabled} onValueChange={(value) => { if (value) chooseBulkRegion(index, value); }}>
                            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent>{REGIONAL_CAMPAIGN_AREAS.map((area) => <SelectItem key={area.region} value={area.region}>{area.region}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="mb-1 block text-xs">City / District *</Label>
                          <Input value={campaign.operationDistrict} onChange={(e) => updateBulk(index, { operationDistrict: e.target.value })} disabled={!campaign.enabled} className="rounded-xl" />
                        </div>
                        <div>
                          <Label className="mb-1 block text-xs">Project Manager *</Label>
                          <Select value={campaign.projectManagerId} disabled={!campaign.enabled || regionManagers.length === 0} onValueChange={(value) => { if (value) chooseBulkManager(index, value); }}>
                            <SelectTrigger className="rounded-xl"><SelectValue placeholder={regionManagers.length ? 'Select manager' : 'No PM'} /></SelectTrigger>
                            <SelectContent>{regionManagers.map((manager) => <SelectItem key={manager.id} value={manager.id}>{manager.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="mb-1 block text-xs">Status</Label>
                          <Select value={campaign.status} disabled={!campaign.enabled} onValueChange={(value) => { if (value) updateBulk(index, { status: value as CampaignStatus }); }}>
                            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent>{STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="mb-1 block text-xs">Start Date *</Label>
                          <Input type="date" value={campaign.startDate} onChange={(e) => updateBulk(index, { startDate: e.target.value })} disabled={!campaign.enabled} className="rounded-xl" />
                        </div>
                        <div>
                          <Label className="mb-1 block text-xs">End Date *</Label>
                          <Input type="date" value={campaign.endDate} onChange={(e) => updateBulk(index, { endDate: e.target.value })} disabled={!campaign.enabled} className="rounded-xl" />
                        </div>
                        <div>
                          <Label className="mb-1 block text-xs">Surgery Target *</Label>
                          <Input type="number" value={campaign.targetSurgeries} onChange={(e) => updateBulk(index, { targetSurgeries: Number(e.target.value) })} disabled={!campaign.enabled} className="rounded-xl" />
                        </div>
                        <div>
                          <Label className="mb-1 block text-xs">Budget</Label>
                          <Input type="number" value={campaign.budget} onChange={(e) => updateBulk(index, { budget: Number(e.target.value) })} disabled={!campaign.enabled} className="rounded-xl" />
                        </div>
                        <div className="sm:col-span-2">
                          <Label className="mb-1 block text-xs">Donors</Label>
                          <Input value={campaign.donors} onChange={(e) => updateBulk(index, { donors: e.target.value })} disabled={!campaign.enabled} className="rounded-xl" />
                        </div>
                      </div>
                      {campaign.enabled && regionManagers.length === 0 && (
                        <p className="mt-2 text-xs text-red-600">Add a Project Manager for {campaign.region} in Settings before creating this campaign.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </InlineForm>
      )}

      {isLoading ? (
        <div className="py-12 text-center text-sm text-slate-400">Loading campaigns...</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((campaign) => (
            <Card key={campaign.id} className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{campaign.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{campaign.type} | {campaign.status}</p>
                  </div>
                  <span className="rounded-full bg-teal-50 px-2 py-1 text-xs font-medium text-teal-700">{campaign.region}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-1 gap-2 text-slate-600">
                  <span className="flex items-center gap-2"><MapPin size={14} /> {campaign.operationDistrict}</span>
                  <span className="flex items-center gap-2"><Target size={14} /> {campaign.targetSurgeries.toLocaleString()} surgery target</span>
                  <span className="flex items-center gap-2"><UserRound size={14} /> {campaign.projectManagerName}</span>
                  <span className="flex items-center gap-2"><Calendar size={14} /> {campaign.startDate} to {campaign.endDate}</span>
                </div>
                <div className="flex gap-2 border-t border-slate-100 pt-3">
                  {can('campaigns', 'edit') && <Button size="sm" variant="outline" onClick={() => openEdit(campaign)} className="flex-1 gap-1 rounded-lg"><Pencil size={12} />Edit</Button>}
                  {can('campaigns', 'delete') && <Button size="sm" variant="outline" onClick={() => remove(campaign)} className="gap-1 rounded-lg text-red-600"><Trash2 size={12} /></Button>}
                </div>
              </CardContent>
            </Card>
          ))}
          {campaigns.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400 md:col-span-2 xl:col-span-3">
              No campaigns found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SingleCampaignForm({
  form,
  managers,
  set,
  chooseRegion,
  chooseManager,
}: {
  form: CampaignForm;
  managers: User[];
  set: <K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) => void;
  chooseRegion: (region: string) => void;
  chooseManager: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
      <div className="md:col-span-2">
        <Label className="mb-1 block text-xs">Campaign Name *</Label>
        <Input value={form.name} onChange={(e) => set('name', e.target.value)} className="rounded-xl" />
      </div>
      <div>
        <Label className="mb-1 block text-xs">Type</Label>
        <Select value={form.type} onValueChange={(value) => { if (value) set('type', value as CampaignType); }}>
          <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>{TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <Label className="mb-1 block text-xs">Status</Label>
        <Select value={form.status} onValueChange={(value) => { if (value) set('status', value as CampaignStatus); }}>
          <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>{STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <Label className="mb-1 block text-xs">State / Region *</Label>
        <Select value={form.region} onValueChange={(value) => { if (value) chooseRegion(value); }}>
          <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>{REGIONAL_CAMPAIGN_AREAS.map((area) => <SelectItem key={area.region} value={area.region}>{area.region}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <Label className="mb-1 block text-xs">Operation District / City *</Label>
        <Input value={form.operationDistrict} onChange={(e) => set('operationDistrict', e.target.value)} className="rounded-xl" />
      </div>
      <div>
        <Label className="mb-1 block text-xs">Target Surgeries *</Label>
        <Input type="number" value={form.targetSurgeries} onChange={(e) => set('targetSurgeries', Number(e.target.value))} className="rounded-xl" />
      </div>
      <div>
        <Label className="mb-1 block text-xs">Project Manager *</Label>
        <Select value={form.projectManagerId} onValueChange={(value) => { if (value) chooseManager(value); }}>
          <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select manager" /></SelectTrigger>
          <SelectContent>
            {managers.map((manager) => <SelectItem key={manager.id} value={manager.id}>{manager.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div><Label className="mb-1 block text-xs">Start Date *</Label><Input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} className="rounded-xl" /></div>
      <div><Label className="mb-1 block text-xs">End Date *</Label><Input type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} className="rounded-xl" /></div>
      <div><Label className="mb-1 block text-xs">Target Screenings</Label><Input type="number" value={form.targetScreenings} onChange={(e) => set('targetScreenings', Number(e.target.value))} className="rounded-xl" /></div>
      <div><Label className="mb-1 block text-xs">Target Follow-ups</Label><Input type="number" value={form.targetFollowUps} onChange={(e) => set('targetFollowUps', Number(e.target.value))} className="rounded-xl" /></div>
      <div className="md:col-span-4">
        <Label className="mb-1 block text-xs">Description</Label>
        <textarea value={form.description} onChange={(e) => set('description', e.target.value)} className="h-16 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500" />
      </div>
    </div>
  );
}

function createBulkDefaults(): BulkCampaignForm[] {
  const startDate = formatDate(new Date());
  const endDate = formatDate(addDays(new Date(), 60));
  return REGIONAL_CAMPAIGN_AREAS.map((area) => ({
    enabled: true,
    name: `${area.region} Cataract Surgery Campaign`,
    type: 'Cataract',
    status: 'Planned',
    region: area.region,
    operationDistrict: area.defaultDistrict,
    projectManagerId: '',
    projectManagerName: '',
    startDate,
    endDate,
    budget: area.defaultSurgeryTarget * 35,
    donors: '',
    targetScreenings: area.defaultSurgeryTarget * 2,
    targetSurgeries: area.defaultSurgeryTarget,
    targetFollowUps: area.defaultSurgeryTarget,
    description: '',
  }));
}

function stripEnabled({ enabled, ...campaign }: BulkCampaignForm): CampaignForm {
  void enabled;
  return campaign;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatDate(date: Date) {
  return date.toISOString().split('T')[0];
}
