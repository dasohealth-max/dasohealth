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
  'No Campaign': { border: 'border-l-[#D0E8DA]',  badge: 'bg-[#F0EDE6] text-[#7A9A87]',  bar: 'bg-[#D0E8DA]'  },
  'No Activity': { border: 'border-l-[#C47D11]', badge: 'bg-[#FEF3DC] text-[#C47D11]', bar: 'bg-[#C47D11]' },
  Behind:        { border: 'border-l-[#B52A2A]', badge: 'bg-[#FCE8E8] text-[#B52A2A]', bar: 'bg-[#B52A2A]' },
  Active:        { border: 'border-l-[#2B9E5C]', badge: 'bg-[#E8F5EE] text-[#0F4D2A]', bar: 'bg-[#2B9E5C]' },
  Strong:        { border: 'border-l-[#1A7A46]', badge: 'bg-[#E8F5EE] text-[#0F4D2A]', bar: 'bg-[#1A7A46]' },
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
    const regionCampaigns = campaigns.filter((c) => c.region === area.region);
    const primary = regionCampaigns.find((c) => c.status === 'Active') ?? regionCampaigns[0] ?? null;

    const rSurgeries = surgeries.filter((s) => s.region === area.region);
    const rFollowUps = followUps.filter((f) => f.region === area.region);

    const completed = rSurgeries.filter((s) => s.status === 'Completed').length;
    const scheduled = rSurgeries.filter((s) => s.status === 'Scheduled').length;
    const target    = primary?.targetSurgeries ?? area.defaultSurgeryTarget;
    const pct       = target ? Math.round((completed / target) * 100) : 0;

    return {
      region:         area.region,
      district:       primary?.operationDistrict ?? area.defaultDistrict,
      manager:        primary?.projectManagerName ?? '',
      campaignName:   primary?.name ?? '',
      campaignStatus: primary?.status ?? null,
      campaignStart:  primary?.startDate ?? '',
      campaignEnd:    primary?.endDate ?? '',
      target,
      patients:       patients.filter((p) => p.region === area.region).length,
      screened:       screenings.filter((s) => s.region === area.region).length,
      scheduled,
      completed,
      followUpsDone:  rFollowUps.filter((f) => f.status === 'Completed').length,
      overdue:        rFollowUps.filter((f) => f.status === 'Overdue').length,
      doctorReview:   rFollowUps.filter((f) => f.needsDoctorReview).length,
      pct,
      status: computeStatus(regionCampaigns.length, patients.filter((p) => p.region === area.region).length, pct),
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

  const effectiveSelectedRegion = isSuperAdmin ? selectedRegion : (user?.assignedRegion ?? 'all');

  const currentStats = effectiveSelectedRegion === 'all'
    ? null
    : (allStats.find((r) => r.region === effectiveSelectedRegion) ?? null);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-[#7A9A87]">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#1C2B22]">Dashboard</h1>
        <p className="text-sm text-[#4A6455]">
          {isSuperAdmin
            ? 'National overview across all 9 regions — select a region to drill down'
            : `${currentStats?.region ?? 'Regional'} performance`}
        </p>
      </div>

      {isSuperAdmin && (
        <RegionTabBar selected={selectedRegion} onChange={setSelectedRegion} stats={allStats} />
      )}

      {effectiveSelectedRegion === 'all' ? (
        <AllRegionsView stats={allStats} onDrillDown={setSelectedRegion} />
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
    <div className="flex gap-1 overflow-x-auto rounded-xl border border-[#E2DDD5] bg-white p-1 shadow-sm">
      {tabs.map((tab) => {
        const active = selected === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`relative flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
              active ? 'bg-[#1A7A46] text-white shadow-sm' : 'text-[#4A6455] hover:bg-[#E8F5EE] hover:text-[#0F4D2A]'
            }`}
          >
            {tab.label}
            {tab.alerts > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${active ? 'bg-white/30 text-white' : 'bg-[#B52A2A] text-white'}`}>
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

function AllRegionsView({ stats, onDrillDown }: { stats: RegionStats[]; onDrillDown: (r: string) => void }) {
  const totalCompleted  = stats.reduce((s, r) => s + r.completed, 0);
  const totalTarget     = stats.reduce((s, r) => s + r.target, 0);
  const totalPct        = totalTarget ? Math.round((totalCompleted / totalTarget) * 100) : 0;
  const behindCount     = stats.filter((r) => r.status === 'Behind' || r.status === 'No Activity').length;
  const alertCount      = stats.reduce((s, r) => s + r.overdue + r.doctorReview, 0);

  const sorted = [...stats].sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]);

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

      {/* 9 region cards sorted by urgency */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {sorted.map((r) => (
          <RegionCard key={r.region} stats={r} onDrillDown={onDrillDown} />
        ))}
      </div>
    </div>
  );
}

// ─── Region Card ──────────────────────────────────────────────────────────────

function RegionCard({ stats: r, onDrillDown }: { stats: RegionStats; onDrillDown: (region: string) => void }) {
  const style     = STATUS_STYLES[r.status];
  const hasAlerts = r.overdue > 0 || r.doctorReview > 0;

  return (
    <button
      onClick={() => onDrillDown(r.region)}
      className={`group w-full rounded-xl border border-[#E2DDD5] border-l-4 ${style.border} bg-white p-4 text-left shadow-sm transition-all hover:shadow-md`}
    >
      {/* Header row */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-[#1C2B22]">{shortName(r.region)}</p>
          <p className="mt-0.5 text-xs text-[#4A6455]">{r.district}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {hasAlerts && (
            <span className="flex items-center gap-1 rounded-full bg-[#FCE8E8] px-2 py-0.5 text-[10px] font-bold text-[#B52A2A]">
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
      <p className="mb-3 text-xs text-[#4A6455]">
        PM: <span className="font-medium text-[#1C2B22]">{r.manager || 'Unassigned'}</span>
      </p>

      {/* Progress bar */}
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-[#4A6455]">{r.completed.toLocaleString()} / {r.target.toLocaleString()} surgeries</span>
        <span className="font-bold text-[#1C2B22]">{r.pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E2DDD5]">
        <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${Math.min(r.pct, 100)}%` }} />
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between text-xs text-[#7A9A87]">
        <span>{r.patients.toLocaleString()} patients · {r.screened.toLocaleString()} screened</span>
        <ChevronRight size={14} className="transition-colors group-hover:text-[#1C2B22]" />
      </div>
    </button>
  );
}

// ─── Single Region View ───────────────────────────────────────────────────────

function SingleRegionView({
  stats,
  showBack,
  onBack,
}: {
  stats: RegionStats | null;
  showBack: boolean;
  onBack: () => void;
}) {
  if (!stats) {
    return (
      <div className="rounded-xl border border-dashed border-[#D0E8DA] py-20 text-center text-sm text-[#7A9A87]">
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
    <div className="space-y-4">
      {/* Back */}
      {showBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-medium text-[#4A6455] transition-colors hover:text-[#1A7A46]"
        >
          <ArrowLeft size={15} /> All Regions
        </button>
      )}

      {/* Region header */}
      <div className={`rounded-xl border border-[#E2DDD5] border-l-4 ${style.border} bg-white p-5 shadow-sm`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-[#1C2B22]">{stats.region}</h2>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.badge}`}>{stats.status}</span>
            </div>
            <p className="mt-1 flex items-center gap-1 text-sm text-[#4A6455]">
              <MapPin size={12} />{stats.district}
            </p>
          </div>
          {stats.manager && (
            <div className="text-sm">
              <p className="text-xs text-[#7A9A87]">Project Manager</p>
              <p className="font-semibold text-[#1C2B22]">{stats.manager}</p>
            </div>
          )}
        </div>

        {stats.campaignName && (
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#E2DDD5] pt-3 text-xs">
            <span className="font-medium text-[#1C2B22]">{stats.campaignName}</span>
            {stats.campaignStatus && (
              <span className="rounded-full bg-[#E8F5EE] px-2 py-0.5 text-[#4A6455]">{stats.campaignStatus}</span>
            )}
            {stats.campaignStart && stats.campaignEnd && (
              <span className="text-[#7A9A87]">{stats.campaignStart} → {stats.campaignEnd}</span>
            )}
          </div>
        )}
      </div>

      {/* Pipeline */}
      <div className="rounded-xl border border-[#E2DDD5] bg-white p-5 shadow-sm">
        <p className="mb-5 text-xs font-semibold uppercase tracking-wider text-[#7A9A87]">Patient Pipeline</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {pipeline.map(({ label, value, Icon }) => (
            <div key={label} className="text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#E8F5EE]">
                <Icon size={17} className="text-[#1A7A46]" />
              </div>
              <p className="text-2xl font-bold text-[#1C2B22]">{value.toLocaleString()}</p>
              <p className="mt-0.5 text-[11px] text-[#7A9A87]">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Surgery target */}
      <div className="rounded-xl border border-[#E2DDD5] bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#7A9A87]">Surgery Target</p>
          <span className={`text-3xl font-bold ${stats.pct >= 75 ? 'text-[#1A7A46]' : stats.pct >= 25 ? 'text-[#2B9E5C]' : 'text-[#B52A2A]'}`}>
            {stats.pct}%
          </span>
        </div>
        <div className="mb-3 h-5 w-full overflow-hidden rounded-full bg-[#E2DDD5]">
          <div
            className={`h-full rounded-full transition-all ${style.bar}`}
            style={{ width: `${Math.min(stats.pct, 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#4A6455]">
            <strong>{stats.completed.toLocaleString()}</strong> surgeries completed
          </span>
          <span className="text-[#4A6455]">Target: <strong>{stats.target.toLocaleString()}</strong></span>
        </div>
        {remaining > 0 && (
          <p className="mt-2 text-xs text-[#7A9A87]">{remaining.toLocaleString()} more needed to reach target</p>
        )}
      </div>

      {/* Alerts */}
      {hasAlerts ? (
        <div className="rounded-xl border border-[#F0C0C0] bg-[#FCE8E8] p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#B52A2A]">Risk Alerts</p>
          <div className="flex flex-wrap gap-6">
            {stats.overdue > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FCE8E8]/80 border border-[#F0C0C0]">
                  <AlertTriangle size={16} className="text-[#B52A2A]" />
                </div>
                <div>
                  <p className="text-lg font-bold text-[#B52A2A]">{stats.overdue}</p>
                  <p className="text-xs text-[#B52A2A]/80">overdue follow-up{stats.overdue !== 1 ? 's' : ''}</p>
                </div>
              </div>
            )}
            {stats.doctorReview > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FCE8E8]/80 border border-[#F0C0C0]">
                  <Eye size={16} className="text-[#B52A2A]" />
                </div>
                <div>
                  <p className="text-lg font-bold text-[#B52A2A]">{stats.doctorReview}</p>
                  <p className="text-xs text-[#B52A2A]/80">need{stats.doctorReview === 1 ? 's' : ''} doctor review</p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 rounded-xl border border-[#D0E8DA] bg-[#E8F5EE] px-5 py-3.5 text-sm text-[#0F4D2A]">
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
  const accentClass = { primary: 'text-[#1A7A46]', red: 'text-[#B52A2A]', amber: 'text-[#C47D11]' }[accent];
  return (
    <div className="rounded-xl border border-[#E2DDD5] bg-white p-5 shadow-sm">
      <p className="text-xs font-medium text-[#4A6455]">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accentClass}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      <p className="mt-0.5 text-xs text-[#7A9A87]">{sub}</p>
    </div>
  );
}
