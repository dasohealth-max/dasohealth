'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode, SetStateAction } from 'react';
import type { AuditLog, Campaign, CampaignRegion, CampaignStatus, CampaignType, RegionalPlanStatus, User } from '@/types';
import {
  actionCreateCampaign,
  actionCreateCampaignRegion,
  actionDeleteCampaign,
  actionDeleteCampaignRegion,
  actionGetCampaignActivity,
  actionUpdateCampaign,
  actionUpdateCampaignRegion,
  getAllCampaigns,
} from '@/app/actions/campaigns';
import { actionGetAllUsers } from '@/app/actions/users';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ModalForm from '@/components/forms/ModalForm';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { defaultOperationDistrict, REGIONAL_CAMPAIGN_AREAS } from '@/lib/regions';
import { usePermissions } from '@/lib/auth';
import { Activity, Calendar, ChevronLeft, ChevronRight, ClipboardList, Eye, MapPin, Pencil, Plus, Target, Trash2 } from 'lucide-react';

const TYPES: CampaignType[] = ['Cataract Surgery Outreach', 'Eye Vision Outreach'];
const CAMPAIGN_STATUSES: CampaignStatus[] = ['Planned', 'Active', 'Completed', 'Suspended'];
const PLAN_STATUSES: RegionalPlanStatus[] = ['On Track', 'Behind', 'Completed', 'Suspended'];

const F = {
  label: 'block text-[11px] font-semibold uppercase tracking-wide text-[#647184] mb-1.5',
  input: 'w-full rounded-md border border-[#DDE3EA] bg-white px-3 py-2 text-sm text-[#141920] placeholder:text-[#647184] outline-none transition focus:border-[#2C9942] focus:ring-2 focus:ring-[#2C9942]/10 disabled:bg-[#EAEEF3] disabled:text-[#647184]',
  select: 'w-full min-w-0 rounded-md',
};

const BLANK_CAMPAIGN = {
  name: '',
  type: 'Cataract Surgery Outreach' as CampaignType,
  status: 'Planned' as CampaignStatus,
  region: '',
  operationDistrict: '',
  projectManagerId: '',
  projectManagerName: '',
  startDate: '',
  endDate: '',
  description: '',
  notes: '',
};

const BLANK_PLAN = {
  campaignId: '',
  type: 'Cataract Surgery Outreach' as CampaignType,
  region: '',
  operationDistrict: '',
  regionalManagerId: '',
  regionalManagerName: '',
  targetPatients: 0,
  targetScreenings: 0,
  targetSurgeries: 0,
  startDate: '',
  endDate: '',
  status: 'On Track' as RegionalPlanStatus,
  notes: '',
};

type CampaignForm = typeof BLANK_CAMPAIGN;
type PlanForm = typeof BLANK_PLAN;
type Tab = 'regions' | 'overview' | 'activity';

const STATUS_STYLE: Record<CampaignStatus | RegionalPlanStatus, string> = {
  Planned: 'bg-[#EAEEF3] text-[#002E63]',
  Active: 'bg-[#EBF7EE] text-[#2C9942]',
  Completed: 'bg-[#E7F0FB] text-[#002E63]',
  Suspended: 'bg-[#FDECEB] text-[#E53935]',
  'On Track': 'bg-[#EBF7EE] text-[#2C9942]',
  Behind: 'bg-[#FDECEB] text-[#E53935]',
};

export default function CampaignsPage() {
  const { can } = usePermissions();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [tab, setTab] = useState<Tab>('regions');
  const [campaignForm, setCampaignForm] = useState<CampaignForm>(BLANK_CAMPAIGN);
  const [planForm, setPlanForm] = useState<PlanForm>(BLANK_PLAN);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [editingPlan, setEditingPlan] = useState<CampaignRegion | null>(null);
  const [deleteCampaignTarget, setDeleteCampaignTarget] = useState<Campaign | null>(null);
  const [deletePlanTarget, setDeletePlanTarget] = useState<CampaignRegion | null>(null);
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [activity, setActivity] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    Promise.all([getAllCampaigns(), actionGetAllUsers()]).then(([rows, userResult]) => {
      setCampaigns(rows);
      if (rows[0]) setSelectedId(rows[0].id);
      if (userResult.ok) setUsers(userResult.data);
      setIsLoading(false);
    });
  }, []);

  const selected = campaigns.find((campaign) => campaign.id === selectedId) ?? campaigns[0];
  const regions = selected?.regions ?? [];
  const managers = useMemo(
    () => users.filter((user) => user.active && user.role === 'Project Manager'),
    [users],
  );
  const regionalManagers = useMemo(
    () => managers.filter((user) => planForm.region && user.assignedRegion === planForm.region),
    [managers, planForm.region],
  );

  useEffect(() => {
    if (!selected?.id || tab !== 'activity') return;
    actionGetCampaignActivity(selected.id).then(setActivity).catch(() => setActivity([]));
  }, [selected?.id, tab]);

  const summary = useMemo(() => {
    const active = campaigns.filter((campaign) => campaign.status === 'Active').length;
    const completed = campaigns.filter((campaign) => campaign.status === 'Completed').length;
    const uniqueRegions = new Set(campaigns.flatMap((campaign) => (campaign.regions ?? []).map((plan) => plan.region))).size;
    return { total: campaigns.length, active, completed, regions: uniqueRegions };
  }, [campaigns]);

  const selectedSummary = useMemo(() => summarizeCampaign(selected), [selected]);

  function refreshCampaign(updated: Campaign) {
    setCampaigns((rows) => rows.map((row) => row.id === updated.id ? updated : row));
  }

  async function reloadCampaigns(selectId?: string) {
    const rows = await getAllCampaigns();
    setCampaigns(rows);
    if (selectId) setSelectedId(selectId);
  }

  async function reloadUsers() {
    const result = await actionGetAllUsers();
    if (result.ok) setUsers(result.data);
    return result;
  }

  function onlyProjectManagerForRegion(region: string, source = managers) {
    const matchingManagers = source.filter((user) => user.active && user.role === 'Project Manager' && user.assignedRegion === region);
    return matchingManagers.length === 1 ? matchingManagers[0] : null;
  }

  function chooseRegionalManager(id: string) {
    const manager = users.find((user) => user.id === id);
    setPlanForm((prev) => ({ ...prev, regionalManagerId: id, regionalManagerName: manager?.name ?? '' }));
  }

  function choosePlanRegion(region: string) {
    const manager = onlyProjectManagerForRegion(region);
    setPlanForm((prev) => ({
      ...prev,
      region,
      operationDistrict: defaultOperationDistrict(region),
      regionalManagerId: manager?.id ?? '',
      regionalManagerName: manager?.name ?? '',
    }));
  }

  async function openNewCampaign() {
    setEditingCampaign(null);
    setCampaignForm(BLANK_CAMPAIGN);
    setSaveError('');
    await reloadUsers();
    setShowCampaignForm(true);
  }

  async function openEditCampaign(campaign: Campaign) {
    setEditingCampaign(campaign);
    setCampaignForm({
      name: campaign.name,
      type: TYPES.includes(campaign.type) ? campaign.type : 'Cataract Surgery Outreach',
      status: campaign.status,
      region: campaign.region,
      operationDistrict: campaign.operationDistrict,
      projectManagerId: campaign.projectManagerId,
      projectManagerName: campaign.projectManagerName,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      description: campaign.description,
      notes: campaign.notes,
    });
    setSaveError('');
    await reloadUsers();
    setShowCampaignForm(true);
  }

  async function openNewPlan() {
    if (!selected) return;
    setEditingPlan(null);
    setSaveError('');
    await reloadUsers();
    setPlanForm({
      ...BLANK_PLAN,
      campaignId: selected.id,
      type: selected.type,
      startDate: selected.startDate,
      endDate: selected.endDate,
    });
    setShowPlanForm(true);
  }

  async function openEditPlan(plan: CampaignRegion) {
    setEditingPlan(plan);
    setPlanForm({ ...plan });
    setSaveError('');
    await reloadUsers();
    setShowPlanForm(true);
  }

  async function saveCampaign() {
    setSaveError('');
    const result = editingCampaign
      ? await actionUpdateCampaign(editingCampaign.id, campaignForm)
      : await actionCreateCampaign(campaignForm);
    if (!result.ok) { setSaveError(result.error); return; }
    if (editingCampaign) refreshCampaign(result.data);
    else {
      setCampaigns((rows) => [result.data, ...rows]);
      setSelectedId(result.data.id);
      setTab('regions');
    }
    setShowCampaignForm(false);
    setEditingCampaign(null);
  }

  async function savePlan() {
    setSaveError('');
    const result = editingPlan
      ? await actionUpdateCampaignRegion(editingPlan.id, planForm)
      : await actionCreateCampaignRegion(planForm);
    if (!result.ok) { setSaveError(result.error); return; }
    await reloadCampaigns(result.data.campaignId);
    setShowPlanForm(false);
    setEditingPlan(null);
  }

  async function confirmDeleteCampaign() {
    if (!deleteCampaignTarget) return;
    const result = await actionDeleteCampaign(deleteCampaignTarget.id);
    if (result.ok) {
      const rows = campaigns.filter((row) => row.id !== deleteCampaignTarget.id);
      setCampaigns(rows);
      setSelectedId(rows[0]?.id ?? '');
    }
    setDeleteCampaignTarget(null);
  }

  async function confirmDeletePlan() {
    if (!deletePlanTarget) return;
    const campaignId = deletePlanTarget.campaignId;
    const result = await actionDeleteCampaignRegion(deletePlanTarget.id);
    if (result.ok) await reloadCampaigns(campaignId);
    setDeletePlanTarget(null);
  }

  const campaignInvalid = !campaignForm.name || !campaignForm.type || !campaignForm.status || !campaignForm.startDate || !campaignForm.endDate;
  const planInvalid = !planForm.campaignId || !planForm.region || !planForm.operationDistrict || !planForm.regionalManagerId || !planForm.startDate || !planForm.endDate;

  return (
    <div className="space-y-5">
      <ConfirmDialog
        open={!!deleteCampaignTarget}
        title="Delete Campaign"
        description={deleteCampaignTarget ? `This will delete "${deleteCampaignTarget.name}" and its sub-regions.` : ''}
        confirmLabel="Delete Campaign"
        onConfirm={confirmDeleteCampaign}
        onCancel={() => setDeleteCampaignTarget(null)}
      />
      <ConfirmDialog
        open={!!deletePlanTarget}
        title="Remove Sub-region"
        description={deletePlanTarget ? `Remove ${deletePlanTarget.region} from this campaign?` : ''}
        confirmLabel="Remove Sub-region"
        onConfirm={confirmDeletePlan}
        onCancel={() => setDeletePlanTarget(null)}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-[#141920]">Campaigns</h1>
              <p className="text-sm text-[#4B5666]">Create outreach campaigns first, then add sub-regions with assigned project managers</p>
        </div>
        {can('campaigns', 'create') && (
          <Button onClick={openNewCampaign} className="gap-2 rounded-md bg-[#2C9942] text-white hover:bg-[#002E63]">
            <Plus size={15} /> New Campaign
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard icon={<ClipboardList size={18} />} label="Total Campaigns" value={summary.total} />
        <SummaryCard icon={<Activity size={18} />} label="Active Campaigns" value={summary.active} color="green" />
        <SummaryCard icon={<Target size={18} />} label="Completed Campaigns" value={summary.completed} />
        <SummaryCard icon={<MapPin size={18} />} label="Regions Involved" value={summary.regions} />
      </div>

      {showCampaignForm && (
        <ModalForm
          title={editingCampaign ? 'Edit Campaign' : 'Create New Campaign'}
          onClose={() => setShowCampaignForm(false)}
          onSave={saveCampaign}
          saveLabel={editingCampaign ? 'Save Changes' : 'Save Campaign'}
          saveDisabled={campaignInvalid}
        >
          <FormError message={saveError} />
          <CampaignFields
            form={campaignForm}
            setForm={setCampaignForm}
          />
        </ModalForm>
      )}

      {showPlanForm && selected && (
        <ModalForm
          title={editingPlan ? 'Edit Sub-region' : 'Add Sub-region'}
          onClose={() => setShowPlanForm(false)}
          onSave={savePlan}
          saveLabel={editingPlan ? 'Save Sub-region' : 'Add Sub-region'}
          saveDisabled={planInvalid}
        >
          <FormError message={saveError} />
          <PlanFields
            form={planForm}
            selected={selected}
            regionalManagers={regionalManagers}
            setForm={setPlanForm}
            chooseRegion={choosePlanRegion}
            chooseRegionalManager={chooseRegionalManager}
          />
        </ModalForm>
      )}

      <CampaignsTable
        campaigns={campaigns}
        isLoading={isLoading}
        selectedId={selected?.id}
        canEdit={can('campaigns', 'edit')}
        canDelete={can('campaigns', 'delete')}
        onOpen={(campaign) => { setSelectedId(campaign.id); setTab('overview'); setDetailsOpen(true); }}
        onEdit={openEditCampaign}
        onDelete={setDeleteCampaignTarget}
      />

      {detailsOpen && selected && (
        <CampaignDetailsPanel
          campaign={selected}
          regions={regions}
          summary={selectedSummary}
          tab={tab}
          activity={activity}
          canCreate={can('campaigns', 'create')}
          canEdit={can('campaigns', 'edit')}
          canDelete={can('campaigns', 'delete')}
          setTab={setTab}
          onClose={() => setDetailsOpen(false)}
          onAddPlan={openNewPlan}
          onEditCampaign={openEditCampaign}
          onDeleteCampaign={setDeleteCampaignTarget}
          onEditPlan={openEditPlan}
          onDeletePlan={setDeletePlanTarget}
        />
      )}
    </div>
  );
}

function CampaignsTable({ campaigns, isLoading, selectedId, canEdit, canDelete, onOpen, onEdit, onDelete }: {
  campaigns: Campaign[];
  isLoading: boolean;
  selectedId?: string;
  canEdit: boolean;
  canDelete: boolean;
  onOpen: (campaign: Campaign) => void;
  onEdit: (campaign: Campaign) => void;
  onDelete: (campaign: Campaign) => void;
}) {
  const pageSize = 5;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(campaigns.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const visibleCampaigns = campaigns.slice(startIndex, startIndex + pageSize);

  return (
    <section className="rounded-md border border-[#DDE3EA] bg-white shadow-sm">
      <div className="border-b border-[#EAEEF3] px-4 py-3">
        <p className="text-sm font-bold text-[#141920]">All Campaigns</p>
      </div>
      {isLoading && <div className="py-12 text-center text-sm text-[#647184]">Loading campaigns...</div>}
      {!isLoading && campaigns.length === 0 && (
        <div className="m-4 rounded-md border border-dashed border-[#DDE3EA] p-8 text-center text-sm text-[#647184]">
          No campaigns yet.
        </div>
      )}
      {!isLoading && campaigns.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="border-b border-[#EAEEF3] bg-[#F5F7FA]">
              <tr>
                {['#', 'Campaign Name', 'Description', 'Start Date', 'End Date', 'Regions Involved', 'Status', 'Actions'].map((heading) => (
                  <th key={heading} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#647184]">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleCampaigns.map((campaign, index) => (
                <tr
                  key={campaign.id}
                  onClick={() => onOpen(campaign)}
                  className={`cursor-pointer border-b border-[#EAEEF3] transition hover:bg-[#F5F7FA] ${selectedId === campaign.id ? 'bg-[#EBF7EE]/60' : ''}`}
                >
                  <td className="px-4 py-3 text-[#647184]">{startIndex + index + 1}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[#141920]">{campaign.name}</p>
                    <p className="mt-0.5 text-xs text-[#647184]">{campaign.type}</p>
                  </td>
                  <td className="max-w-[360px] px-4 py-3 text-[#4B5666]">
                    <span className="line-clamp-2">{campaign.description || campaign.notes || '-'}</span>
                  </td>
                  <td className="px-4 py-3 text-[#4B5666]">{campaign.startDate}</td>
                  <td className="px-4 py-3 text-[#4B5666]">{campaign.endDate}</td>
                  <td className="px-4 py-3 font-semibold text-[#141920]">{campaign.regions?.length ?? 0}</td>
                  <td className="px-4 py-3"><StatusBadge status={campaign.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1" onClick={(event) => event.stopPropagation()}>
                      <IconButton label="View campaign overview" onClick={() => onOpen(campaign)} icon={<Eye size={13} />} />
                      {canEdit && <IconButton label="Edit campaign" onClick={() => onEdit(campaign)} icon={<Pencil size={13} />} />}
                      {canDelete && <IconButton label="Delete campaign" onClick={() => onDelete(campaign)} icon={<Trash2 size={13} />} danger />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EAEEF3] px-4 py-3 text-sm">
            <p className="text-xs font-medium text-[#647184]">
              Showing {startIndex + 1} to {Math.min(startIndex + pageSize, campaigns.length)} of {campaigns.length} campaigns
            </p>
            <div className="flex items-center gap-1">
              <PaginationButton
                label="Previous page"
                disabled={currentPage === 1}
                onClick={() => setPage(Math.max(1, currentPage - 1))}
              >
                <ChevronLeft size={15} />
              </PaginationButton>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((item) => (
                <PaginationButton
                  key={item}
                  label={`Page ${item}`}
                  active={item === currentPage}
                  onClick={() => setPage(item)}
                >
                  {item}
                </PaginationButton>
              ))}
              <PaginationButton
                label="Next page"
                disabled={currentPage === totalPages}
                onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
              >
                <ChevronRight size={15} />
              </PaginationButton>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function PaginationButton({ label, active = false, disabled = false, children, onClick }: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${active ? 'border-[#2C9942] bg-[#2C9942] text-white' : 'border-[#DDE3EA] bg-white text-[#647184] hover:border-[#A6DCB5] hover:bg-[#EBF7EE] hover:text-[#2C9942]'}`}
    >
      {children}
    </button>
  );
}

function CampaignDetailsPanel({
  campaign,
  regions,
  summary,
  tab,
  activity,
  canCreate,
  canEdit,
  canDelete,
  setTab,
  onClose,
  onAddPlan,
  onEditCampaign,
  onDeleteCampaign,
  onEditPlan,
  onDeletePlan,
}: {
  campaign: Campaign;
  regions: CampaignRegion[];
  summary: ReturnType<typeof summarizeCampaign>;
  tab: Tab;
  activity: AuditLog[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  setTab: (tab: Tab) => void;
  onClose: () => void;
  onAddPlan: () => void;
  onEditCampaign: (campaign: Campaign) => void;
  onDeleteCampaign: (campaign: Campaign) => void;
  onEditPlan: (plan: CampaignRegion) => void;
  onDeletePlan: (plan: CampaignRegion) => void;
}) {
  return (
      <section className="rounded-md border border-[#DDE3EA] bg-white shadow-sm">
        <div className="border-b border-[#DDE3EA] px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-[#141920]">Campaign Overview</h2>
                <StatusBadge status={campaign.status} />
              </div>
              <p className="mt-1 text-sm font-semibold text-[#141920]">{campaign.name}</p>
              <p className="mt-1 text-sm text-[#4B5666]">{campaign.type}</p>
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-[#647184]">
                <span className="flex items-center gap-1.5"><Calendar size={13} /> {campaign.startDate} - {campaign.endDate}</span>
                <span className="flex items-center gap-1.5"><MapPin size={13} /> {regions.length} sub-regions added</span>
              </div>
            </div>
            <div className="flex gap-2">
              {canEdit && (
                <IconButton label="Edit campaign" onClick={() => onEditCampaign(campaign)} icon={<Pencil size={15} />} />
              )}
              {canDelete && (
                <IconButton label="Delete campaign" onClick={() => onDeleteCampaign(campaign)} icon={<Trash2 size={15} />} danger />
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-[#DDE3EA] px-3 py-1.5 text-xs font-semibold text-[#647184] transition hover:bg-[#F5F7FA]"
              >
                Close
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAEEF3] px-4 py-3 sm:px-6">
          <div className="flex gap-1">
            {(['overview', 'regions', 'activity'] as Tab[]).map((item) => (
              <button
                key={item}
                onClick={() => setTab(item)}
                className={`rounded-md px-3 py-2 text-sm font-semibold capitalize ${tab === item ? 'bg-[#2C9942] text-white' : 'text-[#4B5666] hover:bg-[#F5F7FA]'}`}
              >
                {item === 'regions' ? 'Sub-regions' : item}
              </button>
            ))}
          </div>
          {canCreate && (
            <Button onClick={onAddPlan} className="gap-2 rounded-md bg-[#2C9942] text-white hover:bg-[#002E63]">
              <Plus size={14} /> Add Sub-region
            </Button>
          )}
        </div>

        <div>
          {tab === 'overview' && <CampaignOverview campaign={campaign} regions={regions} summary={summary} />}
          {tab === 'regions' && (
            <RegionsTab regions={regions} canEdit={canEdit} canDelete={canDelete} onEdit={onEditPlan} onDelete={onDeletePlan} />
          )}
          {tab === 'activity' && <ActivityTab activity={activity} />}
        </div>
      </section>
  );
}

function CampaignOverview({ campaign, regions, summary }: {
  campaign: Campaign;
  regions: CampaignRegion[];
  summary: ReturnType<typeof summarizeCampaign>;
}) {
  return (
    <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <section className="rounded-md border border-[#EAEEF3] bg-white p-4">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-md bg-[#EBF7EE] text-[#2C9942]">
            <ClipboardList size={24} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-[#141920]">Campaign Overview</h3>
              <StatusBadge status={campaign.status} />
            </div>
            <p className="mt-1 text-sm text-[#4B5666]">{campaign.description || 'No description provided.'}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-y border-[#EAEEF3] py-4 lg:grid-cols-4">
          <OverviewFact icon={<Calendar size={15} />} label="Start Date" value={campaign.startDate} />
          <OverviewFact icon={<Calendar size={15} />} label="End Date" value={campaign.endDate} />
          <OverviewFact icon={<MapPin size={15} />} label="Sub-regions" value={String(summary.regions)} />
          <OverviewFact icon={<ClipboardList size={15} />} label="Contract Type" value={campaign.type} />
        </div>

        <div className="pt-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-[#141920]">Campaign Progress</p>
            <p className="text-sm font-bold text-[#2C9942]">{summary.progress}%</p>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-[#EAEEF3]">
            <div className="h-full rounded-full bg-[#2C9942]" style={{ width: `${summary.progress}%` }} />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[#647184]">
            <span>{summary.completedSurgeries.toLocaleString()} surgeries completed</span>
            <span>Target: {summary.targetSurgeries.toLocaleString()}</span>
          </div>
        </div>
      </section>

      <section className="rounded-md border border-[#EAEEF3] bg-white">
        <div className="border-b border-[#EAEEF3] px-4 py-3">
          <h3 className="font-bold text-[#141920]">Sub-regions in this Campaign</h3>
        </div>
        <RegionsPreview regions={regions} />
      </section>
    </div>
  );
}

function OverviewFact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#647184]">{label}</p>
      <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-[#141920]">
        <span className="text-[#647184]">{icon}</span>
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}

function RegionsPreview({ regions }: { regions: CampaignRegion[] }) {
  if (regions.length === 0) {
    return <div className="p-10 text-center text-sm text-[#647184]">No sub-regions added yet.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-b border-[#EAEEF3] bg-[#F5F7FA]">
          <tr>
            {['#', 'Region', 'Surgeries Target', 'Completed', 'Progress', 'Status'].map((heading) => (
              <th key={heading} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#647184]">{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {regions.map((plan, index) => {
            const completed = 0;
            const progress = plan.targetSurgeries > 0 ? Math.round((completed / plan.targetSurgeries) * 100) : 0;
            return (
              <tr key={plan.id} className="border-b border-[#EAEEF3]">
                <td className="px-4 py-3 text-[#647184]">{index + 1}</td>
                <td className="px-4 py-3 font-semibold text-[#141920]">{plan.region}</td>
                <td className="px-4 py-3">{plan.targetSurgeries.toLocaleString()}</td>
                <td className="px-4 py-3">{completed.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-20 overflow-hidden rounded-full bg-[#EAEEF3]">
                      <div className="h-full rounded-full bg-[#2C9942]" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-[#4B5666]">{progress}%</span>
                  </div>
                </td>
                <td className="px-4 py-3"><StatusBadge status={plan.status} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SummaryCard({ icon, label, value, color = 'navy' }: { icon: ReactNode; label: string; value: number; color?: 'navy' | 'green' }) {
  return (
    <div className="rounded-md border border-[#DDE3EA] bg-white p-4 shadow-sm">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-md ${color === 'green' ? 'bg-[#EBF7EE] text-[#2C9942]' : 'bg-[#E7F0FB] text-[#002E63]'}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-[#141920]">{value}</p>
      <p className="text-xs font-medium text-[#647184]">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: CampaignStatus | RegionalPlanStatus }) {
  return <span className={`shrink-0 rounded px-2 py-1 text-[10px] font-bold uppercase ${STATUS_STYLE[status]}`}>{status}</span>;
}

function FormError({ message }: { message: string }) {
  if (!message) return null;
  return <div className="mb-4 rounded-md border border-[#FACDCB] bg-[#FDECEB] px-3 py-2 text-sm text-[#E53935]">{message}</div>;
}

function CampaignFields({ form, setForm }: {
  form: CampaignForm;
  setForm: (value: SetStateAction<CampaignForm>) => void;
}) {
  return (
    <div className="space-y-5">
      <section>
        <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-[#647184]">Campaign Information</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Campaign Name *" className="sm:col-span-2">
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className={F.input} />
          </Field>
          <Field label="Contract Type *">
            <Select value={form.type} onValueChange={(v) => { if (v) setForm((p) => ({ ...p, type: v as CampaignType })); }}>
              <SelectTrigger className={F.select}><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Status *">
            <Select value={form.status} onValueChange={(v) => { if (v) setForm((p) => ({ ...p, status: v as CampaignStatus })); }}>
              <SelectTrigger className={F.select}><SelectValue /></SelectTrigger>
              <SelectContent>{CAMPAIGN_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Start Date *">
            <input type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} className={F.input} />
          </Field>
          <Field label="End Date *">
            <input type="date" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} className={F.input} />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={2} className={`${F.input} resize-none`} />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={2} className={`${F.input} resize-none`} />
          </Field>
        </div>
      </section>
    </div>
  );
}

function PlanFields({ form, selected, regionalManagers, setForm, chooseRegion, chooseRegionalManager }: {
  form: PlanForm;
  selected: Campaign;
  regionalManagers: User[];
  setForm: (value: SetStateAction<PlanForm>) => void;
  chooseRegion: (region: string) => void;
  chooseRegionalManager: (id: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-md border border-[#A6DCB5] bg-[#EBF7EE] px-3 py-2 text-sm text-[#002E63]">
        Region dates must stay within {selected.startDate} - {selected.endDate}.
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Sub-region *">
          <Select value={form.region} onValueChange={(v) => { if (v) chooseRegion(v); }}>
            <SelectTrigger className={F.select}><SelectValue placeholder="Select sub-region" /></SelectTrigger>
            <SelectContent>{REGIONAL_CAMPAIGN_AREAS.map((area) => <SelectItem key={area.region} value={area.region}>{area.region}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Operation District *">
          <input value={form.operationDistrict} onChange={(e) => setForm((p) => ({ ...p, operationDistrict: e.target.value }))} className={F.input} />
        </Field>
        <Field label="Target Surgeries *">
          <input type="number" value={form.targetSurgeries} min={0} onChange={(e) => setForm((p) => ({ ...p, targetSurgeries: Number(e.target.value) }))} className={F.input} />
        </Field>
        <Field label="Status *">
          <Select value={form.status} onValueChange={(v) => { if (v) setForm((p) => ({ ...p, status: v as RegionalPlanStatus })); }}>
            <SelectTrigger className={F.select}><SelectValue /></SelectTrigger>
            <SelectContent>{PLAN_STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Start Date *">
          <input type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} className={F.input} />
        </Field>
        <Field label="End Date *">
          <input type="date" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} className={F.input} />
        </Field>
        <Field label="Project Manager *" className="sm:col-span-2">
          <Select value={form.regionalManagerId} disabled={!form.region || regionalManagers.length === 0} onValueChange={(v) => { if (v) chooseRegionalManager(v); }}>
            <SelectTrigger className={F.select}>
              <SelectValue placeholder={!form.region ? 'Select sub-region first' : regionalManagers.length ? 'Select Project Manager' : 'No Project Manager assigned to this sub-region'}>
                {form.regionalManagerName || undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>{regionalManagers.map((manager) => <SelectItem key={manager.id} value={manager.id}>{manager.name}</SelectItem>)}</SelectContent>
          </Select>
          {form.region && regionalManagers.length === 0 && (
            <p className="mt-1 text-xs text-[#E53935]">Create or assign a Project Manager to {form.region} in Settings before adding this sub-region.</p>
          )}
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={2} className={`${F.input} resize-none`} />
        </Field>
      </div>
    </div>
  );
}

function Field({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) {
  return <div className={className}><label className={F.label}>{label}</label>{children}</div>;
}

function RegionsTab({ regions, canEdit, canDelete, onEdit, onDelete }: {
  regions: CampaignRegion[];
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (plan: CampaignRegion) => void;
  onDelete: (plan: CampaignRegion) => void;
}) {
  if (regions.length === 0) {
    return (
      <div className="p-12 text-center">
        <MapPin className="mx-auto mb-3 text-[#2C9942]" size={32} />
        <p className="font-semibold text-[#141920]">No regions added yet.</p>
        <p className="text-sm text-[#647184]">Add regions to start tracking this campaign.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-[#EAEEF3] bg-[#F5F7FA]">
          <tr>
            {['Type', 'Region', 'District', 'Patients', 'Screenings', 'Surgeries', 'Start', 'End', 'Manager', 'Status', ''].map((heading) => (
              <th key={heading} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#647184]">{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {regions.map((plan) => (
            <tr key={plan.id} className="border-b border-[#EAEEF3] hover:bg-[#F5F7FA]">
              <td className="px-4 py-3 font-semibold text-[#141920]">{plan.type}</td>
              <td className="px-4 py-3 font-semibold text-[#141920]">{plan.region}</td>
              <td className="px-4 py-3 text-[#4B5666]">{plan.operationDistrict}</td>
              <td className="px-4 py-3">{plan.targetPatients.toLocaleString()}</td>
              <td className="px-4 py-3">{plan.targetScreenings.toLocaleString()}</td>
              <td className="px-4 py-3">{plan.targetSurgeries.toLocaleString()}</td>
              <td className="px-4 py-3 text-[#4B5666]">{plan.startDate}</td>
              <td className="px-4 py-3 text-[#4B5666]">{plan.endDate}</td>
              <td className="px-4 py-3 text-[#4B5666]">{plan.regionalManagerName || '-'}</td>
              <td className="px-4 py-3"><StatusBadge status={plan.status} /></td>
              <td className="px-4 py-3">
                <div className="flex gap-1">
                  {canEdit && <IconButton label="Edit sub-region" onClick={() => onEdit(plan)} icon={<Pencil size={13} />} />}
                  {canDelete && <IconButton label="Remove sub-region" onClick={() => onDelete(plan)} icon={<Trash2 size={13} />} danger />}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActivityTab({ activity }: { activity: AuditLog[] }) {
  if (activity.length === 0) return <div className="p-10 text-center text-sm text-[#647184]">No activity recorded yet.</div>;
  return (
    <div className="divide-y divide-[#EAEEF3]">
      {activity.map((item) => (
        <div key={item.id} className="flex gap-3 px-4 py-3">
          <Eye className="mt-0.5 text-[#2C9942]" size={16} />
          <div>
            <p className="text-sm font-medium text-[#141920]">{item.details || `${item.entity} ${item.action}`}</p>
            <p className="text-xs text-[#647184]">{new Date(item.createdAt).toLocaleString()} by {item.actorName || item.actor}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function IconButton({ label, icon, onClick, danger = false }: { label: string; icon: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`rounded-md p-1.5 transition ${danger ? 'text-[#E53935] hover:bg-[#FDECEB]' : 'text-[#647184] hover:bg-[#EBF7EE] hover:text-[#2C9942]'}`}
    >
      {icon}
    </button>
  );
}

function summarizeCampaign(campaign: Campaign | undefined) {
  const regions = campaign?.regions ?? [];
  const targetSurgeries = regions.reduce((sum, plan) => sum + plan.targetSurgeries, 0);
  return {
    targetPatients: regions.reduce((sum, plan) => sum + plan.targetPatients, 0),
    targetScreenings: regions.reduce((sum, plan) => sum + plan.targetScreenings, 0),
    targetSurgeries,
    regions: regions.length,
    onTrack: regions.filter((plan) => plan.status === 'On Track').length,
    behind: regions.filter((plan) => plan.status === 'Behind').length,
    completedSurgeries: 0,
    progress: targetSurgeries > 0 ? 0 : 0,
  };
}
