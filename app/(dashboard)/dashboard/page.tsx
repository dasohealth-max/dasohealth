'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Campaign, FollowUp, Patient, Screening, Surgery } from '@/types';
import { getAllCampaigns } from '@/app/actions/campaigns';
import { getAllFollowUps } from '@/app/actions/follow_ups';
import { getAllPatients } from '@/app/actions/patients';
import { getAllScreenings } from '@/app/actions/screenings';
import { getAllSurgeries } from '@/app/actions/surgeries';
import { usePermissions } from '@/lib/auth';
import { REGIONAL_CAMPAIGN_AREAS } from '@/lib/regions';
import {
  campaignTargetSurgeriesForRegion,
  campaignsForRegion,
  filterRowsByRegisteredCampaign,
  registeredCampaignIds,
} from '@/lib/reporting';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CalendarCheck,
  CheckCircle,
  ChevronRight,
  Eye,
  MapPin,
  Microscope,
  Users,
  X,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type RegionStatus = 'No Campaign' | 'No Activity' | 'Behind' | 'Active' | 'Strong';

type RegionStats = {
  region: string;
  district: string;
  manager: string;
  campaignName: string;
  campaignStatus: string | null;
  campaignStart: string;
  campaignEnd: string;
  target: number;
  patients: number;
  screened: number;
  scheduled: number;
  completed: number;
  followUpsDone: number;
  overdue: number;
  doctorReview: number;
  pct: number;
  status: RegionStatus;
};

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_PRIORITY: Record<RegionStatus, number> = {
  Behind: 0, 'No Activity': 1, Active: 2, Strong: 3, 'No Campaign': 4,
};

const STATUS_STYLES: Record<RegionStatus, { border: string; badge: string; bar: string }> = {
  'No Campaign': { border: 'border-l-[#A6DCB5]',  badge: 'bg-[#EAEEF3] text-[#647184]',  bar: 'bg-[#A6DCB5]'  },
  'No Activity': { border: 'border-l-[#F59E0B]', badge: 'bg-[#FFF5E6] text-[#F59E0B]', bar: 'bg-[#F59E0B]' },
  Behind:        { border: 'border-l-[#E53935]', badge: 'bg-[#FDECEB] text-[#E53935]', bar: 'bg-[#E53935]' },
  Active:        { border: 'border-l-[#45B066]', badge: 'bg-[#EBF7EE] text-[#002E63]', bar: 'bg-[#45B066]' },
  Strong:        { border: 'border-l-[#2C9942]', badge: 'bg-[#EBF7EE] text-[#002E63]', bar: 'bg-[#2C9942]' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeStatus(campaignCount: number, patientCount: number, pct: number): RegionStatus {
  if (!campaignCount) return 'No Campaign';
  if (!patientCount) return 'No Activity';
  if (pct >= 75) return 'Strong';
  if (pct >= 25) return 'Active';
  return 'Behind';
}

function shortName(region: string) {
  return region.replace(' / Mogadishu', '').replace(' Somalia', '').replace(' State', '');
}

function computeRegionStats(
  campaigns: Campaign[],
  patients: Patient[],
  screenings: Screening[],
  surgeries: Surgery[],
  followUps: FollowUp[],
): RegionStats[] {
  return REGIONAL_CAMPAIGN_AREAS.map((area) => {
    const regionCampaigns = campaignsForRegion(campaigns, area.region);
    const primary = regionCampaigns.find((c) => c.status === 'Active') ?? regionCampaigns[0] ?? null;
    const primaryPlan = primary?.regions?.find((plan) => plan.region === area.region) ?? null;
    const campaignIds = registeredCampaignIds(regionCampaigns);

    const rPatients = filterRowsByRegisteredCampaign(
      patients.filter((p) => p.region === area.region),
      campaignIds,
    );
    const rScreenings = filterRowsByRegisteredCampaign(
      screenings.filter((s) => s.region === area.region),
      campaignIds,
    );
    const rSurgeries = filterRowsByRegisteredCampaign(
      surgeries.filter((s) => s.region === area.region),
      campaignIds,
    );
    const rFollowUps = filterRowsByRegisteredCampaign(
      followUps.filter((f) => f.region === area.region),
      campaignIds,
    );

    const completed = rSurgeries.filter((s) => s.status === 'Completed').length;
    const scheduled = rSurgeries.filter((s) => s.status === 'Scheduled').length;
    const target    = campaignTargetSurgeriesForRegion(regionCampaigns, area.region);
    const pct       = target ? Math.round((completed / target) * 100) : 0;

    return {
      region:         area.region,
      district:       primaryPlan?.operationDistrict ?? primary?.operationDistrict ?? area.defaultDistrict,
      manager:        primaryPlan?.regionalManagerName ?? primary?.projectManagerName ?? '',
      campaignName:   primary?.name ?? '',
      campaignStatus: primary?.status ?? null,
      campaignStart:  primary?.startDate ?? '',
      campaignEnd:    primary?.endDate ?? '',
      target,
      patients:       rPatients.length,
      screened:       rScreenings.length,
      scheduled,
      completed,
      followUpsDone:  rFollowUps.filter((f) => f.status === 'Completed').length,
      overdue:        rFollowUps.filter((f) => f.status === 'Overdue').length,
      doctorReview:   rFollowUps.filter((f) => f.needsDoctorReview).length,
      pct,
      status: computeStatus(regionCampaigns.length, rPatients.length, pct),
    };
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { role, user } = usePermissions();
  const isSuperAdmin = role === 'Super Administrator';

  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [campaigns,  setCampaigns]  = useState<Campaign[]>([]);
  const [patients,   setPatients]   = useState<Patient[]>([]);
  const [screenings, setScreenings] = useState<Screening[]>([]);
  const [surgeries,  setSurgeries]  = useState<Surgery[]>([]);
  const [followUps,  setFollowUps]  = useState<FollowUp[]>([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    Promise.all([
      getAllCampaigns(),
      getAllPatients(),
      getAllScreenings(),
      getAllSurgeries(),
      getAllFollowUps(),
    ]).then(([c, p, s, sur, f]) => {
      setCampaigns(c); setPatients(p); setScreenings(s); setSurgeries(sur); setFollowUps(f);
      setLoading(false);
    });
  }, []);

  const allStats = useMemo(
    () => computeRegionStats(campaigns, patients, screenings, surgeries, followUps),
    [campaigns, followUps, patients, screenings, surgeries],
  );

  const effectiveSelectedRegion = isSuperAdmin ? 'all' : (user?.assignedRegion ?? 'all');

  const currentStats = effectiveSelectedRegion === 'all'
    ? null
    : (allStats.find((r) => r.region === effectiveSelectedRegion) ?? null);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-[#647184]">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#141920]">Dashboard</h1>
        <p className="text-sm text-[#4B5666]">
          {isSuperAdmin
            ? 'National overview across all 9 regions — select a region to view details'
            : `${currentStats?.region ?? 'Regional'} performance`}
        </p>
      </div>

      {isSuperAdmin && (
        <RegionTabBar selected={selectedRegion} onChange={setSelectedRegion} stats={allStats} />
      )}

      {isSuperAdmin ? (
        <AllRegionsView
          stats={allStats}
          selectedRegion={selectedRegion === 'all' ? null : selectedRegion}
          onRegionSelect={setSelectedRegion}
          onPanelClose={() => setSelectedRegion('all')}
        />
      ) : effectiveSelectedRegion === 'all' ? (
        <AllRegionsView
          stats={allStats}
          selectedRegion={null}
          onRegionSelect={() => undefined}
          onPanelClose={() => undefined}
        />
      ) : (
        <SingleRegionView
          stats={currentStats}
          showBack={isSuperAdmin}
          onBack={() => setSelectedRegion('all')}
        />
      )}
    </div>
  );
}

// ─── Region Tab Bar ───────────────────────────────────────────────────────────

function RegionTabBar({
  selected,
  onChange,
  stats,
}: {
  selected: string;
  onChange: (region: string) => void;
  stats: RegionStats[];
}) {
  const tabs = [
    { key: 'all', label: 'All Regions', alerts: 0 },
    ...REGIONAL_CAMPAIGN_AREAS.map((area) => {
      const s = stats.find((r) => r.region === area.region);
      return { key: area.region, label: shortName(area.region), alerts: (s?.overdue ?? 0) + (s?.doctorReview ?? 0) };
    }),
  ];

  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl border border-[#DDE3EA] bg-white p-1 shadow-sm">
      {tabs.map((tab) => {
        const active = selected === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`relative flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
              active ? 'bg-[#2C9942] text-white shadow-sm' : 'text-[#4B5666] hover:bg-[#EBF7EE] hover:text-[#002E63]'
            }`}
          >
            {tab.label}
            {tab.alerts > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${active ? 'bg-white/30 text-white' : 'bg-[#E53935] text-white'}`}>
                {tab.alerts}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── All Regions View ─────────────────────────────────────────────────────────

function AllRegionsView({
  stats,
  selectedRegion,
  onRegionSelect,
  onPanelClose,
}: {
  stats: RegionStats[];
  selectedRegion: string | null;
  onRegionSelect: (region: string) => void;
  onPanelClose: () => void;
}) {
  const totalCompleted  = stats.reduce((s, r) => s + r.completed, 0);
  const totalTarget     = stats.reduce((s, r) => s + r.target, 0);
  const totalPct        = totalTarget ? Math.round((totalCompleted / totalTarget) * 100) : 0;
  const behindCount     = stats.filter((r) => r.status === 'Behind' || r.status === 'No Activity').length;
  const alertCount      = stats.reduce((s, r) => s + r.overdue + r.doctorReview, 0);

  const sorted = [...stats].sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]);
  const panelStats = selectedRegion ? (stats.find((r) => r.region === selectedRegion) ?? null) : null;

  return (
    <div className="space-y-4">
      {/* 3 national KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KPICard
          label="National Surgery Progress"
          value={`${totalCompleted.toLocaleString()} / ${totalTarget.toLocaleString()}`}
          sub={`${totalPct}% of national target reached`}
          accent="primary"
        />
        <KPICard
          label="Regions Needing Attention"
          value={behindCount}
          sub={`${9 - behindCount} of 9 regions on track`}
          accent={behindCount >= 4 ? 'red' : behindCount > 1 ? 'amber' : 'primary'}
        />
        <KPICard
          label="Active Alerts"
          value={alertCount}
          sub="Overdue follow-ups + pending doctor reviews"
          accent={alertCount > 0 ? 'red' : 'primary'}
        />
      </div>

      <div className={panelStats ? 'grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]' : ''}>
        {/* 9 region cards sorted by urgency */}
        <div className={`grid grid-cols-1 gap-3 md:grid-cols-2 ${panelStats ? '2xl:grid-cols-3' : 'xl:grid-cols-3'}`}>
          {sorted.map((r) => (
            <RegionCard
              key={r.region}
              stats={r}
              selected={selectedRegion === r.region}
              onSelect={onRegionSelect}
            />
          ))}
        </div>

        {panelStats && (
          <RegionDetailsPanel stats={panelStats} onClose={onPanelClose} />
        )}
      </div>
    </div>
  );
}

// ─── Region Card ──────────────────────────────────────────────────────────────

function RegionCard({
  stats: r,
  selected,
  onSelect,
}: {
  stats: RegionStats;
  selected: boolean;
  onSelect: (region: string) => void;
}) {
  const style     = STATUS_STYLES[r.status];
  const hasAlerts = r.overdue > 0 || r.doctorReview > 0;

  return (
    <button
      onClick={() => onSelect(r.region)}
      aria-pressed={selected}
      className={`group w-full rounded-xl border bg-white p-4 text-left shadow-sm transition-all hover:border-[#A6DCB5] hover:shadow-md ${
        selected ? 'border-[#2C9942] ring-2 ring-[#2C9942]/25' : 'border-[#DDE3EA]'
      }`}
    >
      {/* Header row */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-[#141920]">{shortName(r.region)}</p>
          <p className="mt-0.5 text-xs text-[#4B5666]">{r.district}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {hasAlerts && (
            <span className="flex items-center gap-1 rounded-full bg-[#FDECEB] px-2 py-0.5 text-[10px] font-bold text-[#E53935]">
              <AlertTriangle size={9} />
              {r.overdue + r.doctorReview}
            </span>
          )}
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.badge}`}>
            {r.status}
          </span>
        </div>
      </div>

      {/* PM */}
      <p className="mb-3 text-xs text-[#4B5666]">
        PM: <span className="font-medium text-[#141920]">{r.manager || 'Unassigned'}</span>
      </p>

      {/* Progress bar */}
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-[#4B5666]">{r.completed.toLocaleString()} / {r.target.toLocaleString()} surgeries</span>
        <span className="font-bold text-[#141920]">{r.pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#DDE3EA]">
        <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${Math.min(r.pct, 100)}%` }} />
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between text-xs text-[#647184]">
        <span>{r.patients.toLocaleString()} patients · {r.screened.toLocaleString()} screened</span>
        <ChevronRight size={14} className="transition-colors group-hover:text-[#141920]" />
      </div>
    </button>
  );
}

// ─── Region Details Panel ────────────────────────────────────────────────────

function RegionDetailsPanel({ stats, onClose }: { stats: RegionStats; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-[#000D1D]/35 backdrop-blur-[1px] xl:hidden" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-[420px] overflow-y-auto border-l border-[#DDE3EA] bg-[#F5F7FA] shadow-[var(--shadow-lg)] xl:sticky xl:top-4 xl:z-auto xl:max-h-[calc(100vh-7rem)] xl:w-auto xl:rounded-xl xl:border xl:shadow-sm">
        <div className="sticky top-0 z-10 overflow-hidden bg-[#002E63] px-5 py-4 text-white">
          <div className="absolute inset-x-0 bottom-0 h-1 bg-[#2C9942]" />
          <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#A6DCB5]">Region details</p>
            <h2 className="mt-1 text-lg font-bold text-white">{shortName(stats.region)}</h2>
            <p className="mt-1 text-xs text-[#C2D2E6]">{stats.district}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-white/75 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close region details"
          >
            <X size={16} />
          </button>
          </div>
        </div>
        <div className="p-4">
          <SingleRegionView stats={stats} showBack={false} onBack={onClose} compact />
        </div>
      </aside>
    </>
  );
}

// ─── Single Region View ───────────────────────────────────────────────────────

function SingleRegionView({
  stats,
  showBack,
  onBack,
  compact = false,
}: {
  stats: RegionStats | null;
  showBack: boolean;
  onBack: () => void;
  compact?: boolean;
}) {
  if (!stats) {
    return (
      <div className="rounded-xl border border-dashed border-[#A6DCB5] py-20 text-center text-sm text-[#647184]">
        No data available for this region yet.
      </div>
    );
  }

  const style     = STATUS_STYLES[stats.status];
  const hasAlerts = stats.overdue > 0 || stats.doctorReview > 0;
  const remaining = Math.max(0, stats.target - stats.completed);

  const pipeline = [
    { label: 'Registered',  value: stats.patients,      Icon: Users        },
    { label: 'Screened',    value: stats.screened,      Icon: Microscope   },
    { label: 'Scheduled',   value: stats.scheduled,     Icon: Calendar     },
    { label: 'Completed',   value: stats.completed,     Icon: CheckCircle  },
    { label: 'Follow-ups',  value: stats.followUpsDone, Icon: CalendarCheck },
  ];

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {/* Back */}
      {showBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-medium text-[#4B5666] transition-colors hover:text-[#2C9942]"
        >
          <ArrowLeft size={15} /> All Regions
        </button>
      )}

      {/* Region header */}
      <div className={`rounded-xl border ${compact ? 'border-[#A6DCB5] bg-white p-4 shadow-sm ring-1 ring-[#EBF7EE]' : `border-[#DDE3EA] border-l-4 p-5 ${style.border} bg-white shadow-sm`}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className={compact ? 'text-base font-bold text-[#002E63]' : 'text-xl font-bold text-[#141920]'}>{stats.region}</h2>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.badge}`}>{stats.status}</span>
            </div>
            <p className={`mt-1 flex items-center gap-1 text-sm ${compact ? 'text-[#238038]' : 'text-[#4B5666]'}`}>
              <MapPin size={12} />{stats.district}
            </p>
          </div>
          {stats.manager && (
            <div className={compact ? 'rounded-lg bg-[#F5F7FA] px-3 py-2 text-sm' : 'text-sm'}>
              <p className="text-xs text-[#647184]">Project Manager</p>
              <p className={`font-semibold ${compact ? 'text-[#002E63]' : 'text-[#141920]'}`}>{stats.manager}</p>
            </div>
          )}
        </div>

        {stats.campaignName && (
          <div className={`mt-4 flex flex-wrap items-center gap-3 border-t pt-3 text-xs ${compact ? 'border-[#A6DCB5]' : 'border-[#DDE3EA]'}`}>
            <span className={`font-medium ${compact ? 'text-[#002E63]' : 'text-[#141920]'}`}>{stats.campaignName}</span>
            {stats.campaignStatus && (
              <span className="rounded-full bg-[#EBF7EE] px-2 py-0.5 text-[#238038]">{stats.campaignStatus}</span>
            )}
            {stats.campaignStart && stats.campaignEnd && (
              <span className="text-[#647184]">{stats.campaignStart} → {stats.campaignEnd}</span>
            )}
          </div>
        )}
      </div>

      {/* Pipeline */}
      <div className={`rounded-xl border ${compact ? 'border-[#DDE3EA] bg-[#002E63] p-4 text-white' : 'border-[#DDE3EA] bg-white p-5'} shadow-sm`}>
        <p className={`mb-5 text-xs font-semibold uppercase tracking-wider ${compact ? 'text-[#A6DCB5]' : 'text-[#647184]'}`}>Patient Pipeline</p>
        <div className={`grid grid-cols-2 gap-4 ${compact ? 'sm:grid-cols-3' : 'sm:grid-cols-3 md:grid-cols-5'}`}>
          {pipeline.map(({ label, value, Icon }) => (
            <div key={label} className="text-center">
              <div className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full ${compact ? 'bg-white/10 ring-1 ring-white/15' : 'bg-[#EBF7EE]'}`}>
                <Icon size={17} className={compact ? 'text-[#6FC587]' : 'text-[#2C9942]'} />
              </div>
              <p className={compact ? 'text-lg font-bold text-white' : 'text-2xl font-bold text-[#141920]'}>{value.toLocaleString()}</p>
              <p className={`mt-0.5 text-[11px] ${compact ? 'text-[#C2D2E6]' : 'text-[#647184]'}`}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Surgery target */}
      <div className={`rounded-xl border ${compact ? 'border-[#A6DCB5] bg-[#EBF7EE] p-4' : 'border-[#DDE3EA] bg-white p-5'} shadow-sm`}>
        <div className="mb-4 flex items-center justify-between">
          <p className={`text-xs font-semibold uppercase tracking-wider ${compact ? 'text-[#002E63]' : 'text-[#647184]'}`}>Surgery Target</p>
          <span className={`${compact ? 'text-2xl' : 'text-3xl'} font-bold ${stats.pct >= 75 ? 'text-[#2C9942]' : stats.pct >= 25 ? 'text-[#45B066]' : 'text-[#E53935]'}`}>
            {stats.pct}%
          </span>
        </div>
        <div className={`mb-3 h-5 w-full overflow-hidden rounded-full ${compact ? 'bg-white' : 'bg-[#DDE3EA]'}`}>
          <div
            className={`h-full rounded-full transition-all ${style.bar}`}
            style={{ width: `${Math.min(stats.pct, 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className={compact ? 'text-[#002E63]' : 'text-[#4B5666]'}>
            <strong>{stats.completed.toLocaleString()}</strong> surgeries completed
          </span>
          <span className={compact ? 'text-[#002E63]' : 'text-[#4B5666]'}>Target: <strong>{stats.target.toLocaleString()}</strong></span>
        </div>
        {remaining > 0 && (
          <p className={`mt-2 text-xs ${compact ? 'text-[#238038]' : 'text-[#647184]'}`}>{remaining.toLocaleString()} more needed to reach target</p>
        )}
      </div>

      {/* Alerts */}
      {hasAlerts ? (
        <div className={`rounded-xl border border-[#FACDCB] bg-[#FDECEB] ${compact ? 'p-4 shadow-sm' : 'p-5'}`}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#E53935]">Risk Alerts</p>
          <div className="flex flex-wrap gap-6">
            {stats.overdue > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FDECEB]/80 border border-[#FACDCB]">
                  <AlertTriangle size={16} className="text-[#E53935]" />
                </div>
                <div>
                  <p className="text-lg font-bold text-[#E53935]">{stats.overdue}</p>
                  <p className="text-xs text-[#E53935]/80">overdue follow-up{stats.overdue !== 1 ? 's' : ''}</p>
                </div>
              </div>
            )}
            {stats.doctorReview > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FDECEB]/80 border border-[#FACDCB]">
                  <Eye size={16} className="text-[#E53935]" />
                </div>
                <div>
                  <p className="text-lg font-bold text-[#E53935]">{stats.doctorReview}</p>
                  <p className="text-xs text-[#E53935]/80">need{stats.doctorReview === 1 ? 's' : ''} doctor review</p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 rounded-xl border border-[#A6DCB5] bg-[#EBF7EE] px-5 py-3.5 text-sm font-medium text-[#002E63]">
          <CheckCircle size={16} />
          No active alerts for this region
        </div>
      )}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub: string;
  accent: 'primary' | 'red' | 'amber';
}) {
  const accentClass = { primary: 'text-[#2C9942]', red: 'text-[#E53935]', amber: 'text-[#F59E0B]' }[accent];
  return (
    <div className="rounded-xl border border-[#DDE3EA] bg-white p-5 shadow-sm">
      <p className="text-xs font-medium text-[#4B5666]">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accentClass}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      <p className="mt-0.5 text-xs text-[#647184]">{sub}</p>
    </div>
  );
}

