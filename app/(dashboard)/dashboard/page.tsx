'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Campaign, FollowUp, Patient, Screening, Surgery } from '@/types';
import { getAllCampaigns } from '@/app/actions/campaigns';
import { getAllFollowUps } from '@/app/actions/follow_ups';
import { getAllPatients } from '@/app/actions/patients';
import { getAllScreenings } from '@/app/actions/screenings';
import { getAllSurgeries } from '@/app/actions/surgeries';
import { usePermissions } from '@/lib/auth';
import { REGIONAL_CAMPAIGN_AREAS } from '@/lib/regions';
import { CardSkeleton, Skeleton } from '@/components/ui/skeleton';
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
  Eye,
  MapPin,
  Microscope,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

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
  followUpsDue: number;
  overdue: number;
  doctorReview: number;
  pct: number;
  status: RegionStatus;
};

// ─── Status config ────────────────────────────────────────────────────────────

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
      district:       primaryPlan?.operationDistrict ?? area.defaultDistrict,
      manager:        primaryPlan?.regionalManagerName ?? '',
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
      followUpsDue:   rFollowUps.filter((f) => f.status === 'Pending' || f.status === 'Due').length,
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
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#141920]">Dashboard</h1>
        <p className="text-sm text-[#4B5666]">
          {isSuperAdmin
            ? 'National overview across all 9 regions'
            : `${currentStats?.region ?? 'Regional'} performance`}
        </p>
      </div>

      {isSuperAdmin ? (
        <AllRegionsView
          stats={allStats}
        />
      ) : effectiveSelectedRegion === 'all' ? (
        <AllRegionsView
          stats={allStats}
        />
      ) : (
        <SingleRegionView
          stats={currentStats}
          showBack={isSuperAdmin}
          onBack={() => undefined}
        />
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div>
        <Skeleton className="h-6 w-36" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="rounded-xl border border-[#DDE3EA] bg-white p-5 shadow-sm">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="mt-3 h-8 w-72" />
          <Skeleton className="mt-2 h-4 w-96 max-w-full" />
          <Skeleton className="mt-6 h-4 w-full rounded-full" />
        </div>
        <div className="rounded-xl border border-[#DDE3EA] bg-white p-4 shadow-sm">
          <Skeleton className="h-4 w-32" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        </div>
      </section>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => <CardSkeleton key={index} />)}
      </div>
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </section>
    </div>
  );
}

// ─── All Regions View ─────────────────────────────────────────────────────────

function AllRegionsView({ stats }: { stats: RegionStats[] }) {
  const totalCompleted  = stats.reduce((s, r) => s + r.completed, 0);
  const totalTarget     = stats.reduce((s, r) => s + r.target, 0);
  const totalPct        = totalTarget ? Math.round((totalCompleted / totalTarget) * 100) : 0;
  const totalPatients   = stats.reduce((s, r) => s + r.patients, 0);
  const totalScreened   = stats.reduce((s, r) => s + r.screened, 0);
  const totalScheduled  = stats.reduce((s, r) => s + r.scheduled, 0);
  const followUpsDone   = stats.reduce((s, r) => s + r.followUpsDone, 0);
  const followUpsDue    = stats.reduce((s, r) => s + r.followUpsDue, 0);
  const overdueFollowUps = stats.reduce((s, r) => s + r.overdue, 0);
  const doctorReview    = stats.reduce((s, r) => s + r.doctorReview, 0);
  const behindCount     = stats.filter((r) => r.status === 'Behind' || r.status === 'No Activity').length;
  const alertCount      = overdueFollowUps + doctorReview;
  const noCampaignCount = stats.filter((r) => r.status === 'No Campaign').length;

  const regionalChart = [...stats]
    .sort((a, b) => b.target - a.target || b.completed - a.completed)
    .map((r) => ({
      region: shortName(r.region),
      completed: r.completed,
      remaining: Math.max(0, r.target - r.completed),
      target: r.target,
      pct: r.pct,
      status: r.status,
    }));
  const funnelData = [
    { step: 'Registered', count: totalPatients, fill: 'var(--chart-2)' },
    { step: 'Screened', count: totalScreened, fill: '#2473B5' },
    { step: 'Scheduled', count: totalScheduled, fill: 'var(--chart-3)' },
    { step: 'Surgeries', count: totalCompleted, fill: 'var(--chart-1)' },
    { step: 'Follow-ups', count: followUpsDone, fill: '#45B066' },
  ];
  const surgeryGap = Math.max(0, totalTarget - totalCompleted);

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="rounded-xl border border-[#DDE3EA] bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0E1726] dark:shadow-none">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#647184]">National Command View</p>
              <h2 className="mt-2 text-2xl font-bold text-[#141920]">{totalPct}% surgery target reached</h2>
              <p className="mt-1 text-sm text-[#4B5666]">
                {totalCompleted.toLocaleString()} completed of {totalTarget.toLocaleString()} targeted surgeries across {stats.length} regions.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <ExecutiveMetric label="Behind Regions" value={behindCount} tone={behindCount ? 'red' : 'green'} />
              <ExecutiveMetric label="Overdue Follow-ups" value={overdueFollowUps} tone={overdueFollowUps ? 'red' : 'green'} />
              <ExecutiveMetric label="Doctor Review" value={doctorReview} tone={doctorReview ? 'amber' : 'green'} />
            </div>
          </div>

          <div className="mt-5 h-4 overflow-hidden rounded-full bg-[#EAEEF3] dark:bg-[#1B2A3F]">
            <div className="h-full rounded-full bg-[#2C9942] dark:bg-[#6FC587]" style={{ width: `${Math.min(totalPct, 100)}%` }} />
          </div>

          <p className="mt-4 text-xs text-[#647184]">
            Patient movement and follow-up counts are summarized in the Clinical Workflow section below.
          </p>
        </div>

        <ActionRequiredPanel
          attentionRegions={behindCount}
          alertCount={alertCount}
          noCampaignCount={noCampaignCount}
          surgeryGap={surgeryGap}
        />
      </section>

      <WorkflowProgress
        registered={totalPatients}
        screened={totalScreened}
        surgeries={totalCompleted}
        followUpsDue={followUpsDue + overdueFollowUps}
        followUpsDone={followUpsDone}
      />

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <ChartCard title="Regional Surgery Progress" subtitle="Completed surgeries against remaining target">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={regionalChart} layout="vertical" margin={{ left: 8, right: 28, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-default)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border-default)' }} tickLine={{ stroke: 'var(--border-default)' }} />
              <YAxis type="category" dataKey="region" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} width={92} axisLine={{ stroke: 'var(--border-default)' }} tickLine={{ stroke: 'var(--border-default)' }} />
              <Tooltip
                formatter={(value, name) => [Number(value).toLocaleString(), name === 'completed' ? 'Completed' : 'Target remaining']}
                labelFormatter={(label) => `${label}`}
              />
              <Bar dataKey="completed" stackId="surgeries" fill="#238038" radius={[0, 0, 0, 0]} />
              <Bar dataKey="remaining" stackId="surgeries" fill="var(--dashboard-remaining-bar)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Patient Workflow" subtitle="Registered to follow-up conversion">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={funnelData} margin={{ left: 0, right: 8, top: 8, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-default)" />
              <XAxis dataKey="step" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval={0} angle={-15} textAnchor="end" height={42} axisLine={{ stroke: 'var(--border-default)' }} tickLine={{ stroke: 'var(--border-default)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border-default)' }} tickLine={{ stroke: 'var(--border-default)' }} />
              <Tooltip formatter={(value) => [Number(value).toLocaleString(), 'Patients']} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {funnelData.map((entry) => <Cell key={entry.step} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

    </div>
  );
}

function ExecutiveMetric({ label, value, tone }: { label: string; value: number; tone: 'green' | 'red' | 'amber' }) {
  const toneClass = {
    green: 'bg-[#EBF7EE] text-[#2C9942] dark:bg-[#173523] dark:text-[#6FC587]',
    red: 'bg-[#FDECEB] text-[#E53935] dark:bg-[#3A171A] dark:text-[#F87171]',
    amber: 'bg-[#FFF5E6] text-[#F59E0B] dark:bg-[#3B2A12] dark:text-[#FBBF24]',
  }[tone];

  return (
    <div className={`rounded-lg px-3 py-2 ${toneClass}`}>
      <p className="text-xl font-bold">{value.toLocaleString()}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wide">{label}</p>
    </div>
  );
}

function ActionRequiredPanel({
  attentionRegions,
  alertCount,
  noCampaignCount,
  surgeryGap,
}: {
  attentionRegions: number;
  alertCount: number;
  noCampaignCount: number;
  surgeryGap: number;
}) {
  const items = [
    {
      label: 'Regions behind or inactive',
      value: attentionRegions,
      detail: 'Review managers and field activity today.',
      tone: attentionRegions > 0 ? 'red' : 'green',
    },
    {
      label: 'Clinical alerts open',
      value: alertCount,
      detail: 'Overdue follow-ups and doctor reviews.',
      tone: alertCount > 0 ? 'red' : 'green',
    },
    {
      label: 'Regions without campaigns',
      value: noCampaignCount,
      detail: 'Assign campaign coverage before reporting closes.',
      tone: noCampaignCount > 0 ? 'amber' : 'green',
    },
    {
      label: 'Surgeries remaining',
      value: surgeryGap,
      detail: 'National target gap still to be delivered.',
      tone: surgeryGap > 0 ? 'navy' : 'green',
    },
  ] as const;

  return (
    <div className="rounded-xl border border-[#DDE3EA] bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#0E1726] dark:shadow-none">
      <div className="mb-4">
        <p className="text-sm font-bold text-[#141920]">Action Required</p>
        <p className="text-xs text-[#647184]">The operational items super admins should check first.</p>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-start justify-between gap-3 rounded-lg border border-[#EAEEF3] bg-[#F8FAFC] p-3 dark:border-white/10 dark:bg-[#111C2D]">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#141920]">{item.label}</p>
              <p className="mt-1 text-xs text-[#647184]">{item.detail}</p>
            </div>
            <span className={`shrink-0 rounded-lg px-2.5 py-1 text-sm font-bold ${ACTION_TONE[item.tone]}`}>
              {item.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const ACTION_TONE = {
  green: 'bg-[#EBF7EE] text-[#2C9942] dark:bg-[#173523] dark:text-[#6FC587]',
  red: 'bg-[#FDECEB] text-[#E53935] dark:bg-[#3A171A] dark:text-[#F87171]',
  amber: 'bg-[#FFF5E6] text-[#F59E0B] dark:bg-[#3B2A12] dark:text-[#FBBF24]',
  navy: 'bg-[#E7F0FB] text-[#002E63] dark:bg-[#0A1423] dark:text-[#C2D2E6]',
};

function WorkflowProgress({
  registered,
  screened,
  surgeries,
  followUpsDue,
  followUpsDone,
}: {
  registered: number;
  screened: number;
  surgeries: number;
  followUpsDue: number;
  followUpsDone: number;
}) {
  const steps = [
    { label: 'Registered', value: registered, Icon: Users },
    { label: 'Screened', value: screened, Icon: Microscope },
    { label: 'Surgery Completed', value: surgeries, Icon: CheckCircle },
    { label: 'Follow-ups Due', value: followUpsDue, Icon: Calendar },
    { label: 'Follow-up Completed', value: followUpsDone, Icon: CalendarCheck },
  ];

  return (
    <div className="rounded-xl border border-[#DDE3EA] bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#0E1726] dark:shadow-none">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-[#141920]">Clinical Workflow</p>
          <p className="text-xs text-[#647184]">Current patient movement from registration to completed follow-up.</p>
        </div>
        <span className="rounded-full bg-[#E7F0FB] px-2.5 py-1 text-xs font-semibold text-[#002E63]">
          Pilot flow
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        {steps.map(({ label, value, Icon }, index) => (
          <div key={label} className="rounded-lg border border-[#EAEEF3] bg-[#F8FAFC] p-3 dark:border-white/10 dark:bg-[#111C2D]">
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EBF7EE] text-[#2C9942]">
                <Icon size={16} />
              </div>
              <span className="text-[11px] font-semibold text-[#647184]">Step {index + 1}</span>
            </div>
            <p className="mt-3 text-xl font-bold text-[#141920]">{value.toLocaleString()}</p>
            <p className="mt-1 text-xs font-semibold text-[#4B5666]">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-[#DDE3EA] bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#0E1726] dark:shadow-none">
      <div className="mb-3">
        <p className="text-sm font-bold text-[#141920]">{title}</p>
        <p className="text-xs text-[#647184]">{subtitle}</p>
      </div>
      <div className="h-72 min-w-0">{children}</div>
    </div>
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

      <WorkflowProgress
        registered={stats.patients}
        screened={stats.screened}
        surgeries={stats.completed}
        followUpsDue={stats.followUpsDue + stats.overdue}
        followUpsDone={stats.followUpsDone}
      />

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
