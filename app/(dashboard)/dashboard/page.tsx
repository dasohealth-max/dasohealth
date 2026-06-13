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
  'No Campaign': { border: 'border-l-slate-300',  badge: 'bg-slate-100 text-slate-600',  bar: 'bg-slate-300'  },
  'No Activity': { border: 'border-l-orange-400', badge: 'bg-orange-50 text-orange-700', bar: 'bg-orange-400' },
  Behind:        { border: 'border-l-red-500',    badge: 'bg-red-50 text-red-700',       bar: 'bg-red-500'    },
  Active:        { border: 'border-l-blue-500',   badge: 'bg-blue-50 text-blue-700',     bar: 'bg-blue-500'   },
  Strong:        { border: 'border-l-teal-500',   badge: 'bg-teal-50 text-teal-700',     bar: 'bg-teal-500'   },
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

  // Non-super-admin: lock to their assigned region
  useEffect(() => {
    if (role && role !== 'Super Administrator') {
      setSelectedRegion(user?.assignedRegion ?? 'all');
    }
  }, [role, user?.assignedRegion]);

  const allStats = useMemo(
    () => computeRegionStats(campaigns, patients, screenings, surgeries, followUps),
    [campaigns, followUps, patients, screenings, surgeries],
  );

  const currentStats = selectedRegion === 'all'
    ? null
    : (allStats.find((r) => r.region === selectedRegion) ?? null);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-400">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">
          {isSuperAdmin
            ? 'National overview across all 9 regions — select a region to drill down'
            : `${currentStats?.region ?? 'Regional'} performance`}
        </p>
      </div>

      {isSuperAdmin && (
        <RegionTabBar selected={selectedRegion} onChange={setSelectedRegion} stats={allStats} />
      )}

      {selectedRegion === 'all' ? (
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
    <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-100 bg-white p-1 shadow-sm">
      {tabs.map((tab) => {
        const active = selected === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`relative flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
              active ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            {tab.label}
            {tab.alerts > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${active ? 'bg-white/30 text-white' : 'bg-red-500 text-white'}`}>
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
          accent="teal"
        />
        <KPICard
          label="Regions Needing Attention"
          value={behindCount}
          sub={`${9 - behindCount} of 9 regions on track`}
          accent={behindCount >= 4 ? 'red' : behindCount > 1 ? 'amber' : 'teal'}
        />
        <KPICard
          label="Active Alerts"
          value={alertCount}
          sub="Overdue follow-ups + pending doctor reviews"
          accent={alertCount > 0 ? 'red' : 'teal'}
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
      className={`group w-full rounded-xl border border-slate-100 border-l-4 ${style.border} bg-white p-4 text-left shadow-sm transition-all hover:shadow-md`}
    >
      {/* Header row */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{shortName(r.region)}</p>
          <p className="mt-0.5 text-xs text-slate-500">{r.district}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {hasAlerts && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
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
      <p className="mb-3 text-xs text-slate-500">
        PM: <span className="font-medium text-slate-700">{r.manager || 'Unassigned'}</span>
      </p>

      {/* Progress bar */}
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-slate-500">{r.completed.toLocaleString()} / {r.target.toLocaleString()} surgeries</span>
        <span className="font-bold text-slate-700">{r.pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${Math.min(r.pct, 100)}%` }} />
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
        <span>{r.patients.toLocaleString()} patients · {r.screened.toLocaleString()} screened</span>
        <ChevronRight size={14} className="transition-colors group-hover:text-slate-600" />
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
      <div className="rounded-xl border border-dashed border-slate-200 py-20 text-center text-sm text-slate-400">
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
          className="flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-teal-600"
        >
          <ArrowLeft size={15} /> All Regions
        </button>
      )}

      {/* Region header */}
      <div className={`rounded-xl border border-slate-100 border-l-4 ${style.border} bg-white p-5 shadow-sm`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">{stats.region}</h2>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.badge}`}>{stats.status}</span>
            </div>
            <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
              <MapPin size={12} />{stats.district}
            </p>
          </div>
          {stats.manager && (
            <div className="text-sm">
              <p className="text-xs text-slate-400">Project Manager</p>
              <p className="font-semibold text-slate-800">{stats.manager}</p>
            </div>
          )}
        </div>

        {stats.campaignName && (
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 text-xs">
            <span className="font-medium text-slate-700">{stats.campaignName}</span>
            {stats.campaignStatus && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{stats.campaignStatus}</span>
            )}
            {stats.campaignStart && stats.campaignEnd && (
              <span className="text-slate-400">{stats.campaignStart} → {stats.campaignEnd}</span>
            )}
          </div>
        )}
      </div>

      {/* Pipeline */}
      <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <p className="mb-5 text-xs font-semibold uppercase tracking-wider text-slate-400">Patient Pipeline</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {pipeline.map(({ label, value, Icon }) => (
            <div key={label} className="text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-teal-50">
                <Icon size={17} className="text-teal-700" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{value.toLocaleString()}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Surgery target */}
      <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Surgery Target</p>
          <span className={`text-3xl font-bold ${stats.pct >= 75 ? 'text-teal-600' : stats.pct >= 25 ? 'text-blue-600' : 'text-red-600'}`}>
            {stats.pct}%
          </span>
        </div>
        <div className="mb-3 h-5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all ${style.bar}`}
            style={{ width: `${Math.min(stats.pct, 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">
            <strong>{stats.completed.toLocaleString()}</strong> surgeries completed
          </span>
          <span className="text-slate-500">Target: <strong>{stats.target.toLocaleString()}</strong></span>
        </div>
        {remaining > 0 && (
          <p className="mt-2 text-xs text-slate-400">{remaining.toLocaleString()} more needed to reach target</p>
        )}
      </div>

      {/* Alerts */}
      {hasAlerts ? (
        <div className="rounded-xl border border-red-100 bg-red-50 p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-red-500">Risk Alerts</p>
          <div className="flex flex-wrap gap-6">
            {stats.overdue > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100">
                  <AlertTriangle size={16} className="text-red-600" />
                </div>
                <div>
                  <p className="text-lg font-bold text-red-700">{stats.overdue}</p>
                  <p className="text-xs text-red-500">overdue follow-up{stats.overdue !== 1 ? 's' : ''}</p>
                </div>
              </div>
            )}
            {stats.doctorReview > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100">
                  <Eye size={16} className="text-red-600" />
                </div>
                <div>
                  <p className="text-lg font-bold text-red-700">{stats.doctorReview}</p>
                  <p className="text-xs text-red-500">need{stats.doctorReview === 1 ? 's' : ''} doctor review</p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 rounded-xl border border-teal-100 bg-teal-50 px-5 py-3.5 text-sm text-teal-700">
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
  accent: 'teal' | 'red' | 'amber';
}) {
  const accentClass = { teal: 'text-teal-600', red: 'text-red-600', amber: 'text-amber-600' }[accent];
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accentClass}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
    </div>
  );
}
