'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Campaign, FollowUp, Patient, Screening, Surgery, SurgeryStatus } from '@/types';
import { getAllCampaigns } from '@/app/actions/campaigns';
import { getAllFollowUps } from '@/app/actions/follow_ups';
import { getAllPatients } from '@/app/actions/patients';
import { getAllScreenings } from '@/app/actions/screenings';
import { getAllSurgeries } from '@/app/actions/surgeries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { REGIONAL_CAMPAIGN_AREAS } from '@/lib/regions';
import {
  AlertTriangle,
  Activity,
  CheckCircle,
  ClipboardList,
  Eye,
  Stethoscope,
  Target,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Funnel,
  FunnelChart,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type RegionStatus = 'No Campaign' | 'No Activity' | 'Behind' | 'Active' | 'Strong';

const SURGERY_STATUSES: SurgeryStatus[] = ['Scheduled', 'In-Theatre', 'Completed', 'Postponed', 'Cancelled'];
const STATUS_COLORS = ['#0f766e', '#2563eb', '#16a34a', '#f59e0b', '#dc2626'];
const FUNNEL_COLORS = ['#0f766e', '#2563eb', '#7c3aed', '#16a34a', '#f59e0b'];

export default function DashboardPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [screenings, setScreenings] = useState<Screening[]>([]);
  const [surgeries, setSurgeries] = useState<Surgery[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);

  useEffect(() => {
    Promise.all([getAllCampaigns(), getAllPatients(), getAllScreenings(), getAllSurgeries(), getAllFollowUps()])
      .then(([campaignRows, patientRows, screeningRows, surgeryRows, followUpRows]) => {
        setCampaigns(campaignRows);
        setPatients(patientRows);
        setScreenings(screeningRows);
        setSurgeries(surgeryRows);
        setFollowUps(followUpRows);
      });
  }, []);

  const completed = surgeries.filter((item) => item.status === 'Completed').length;
  const scheduled = surgeries.filter((item) => item.status === 'Scheduled').length;
  const overdue = followUps.filter((item) => item.status === 'Overdue').length;
  const doctorReview = followUps.filter((item) => item.needsDoctorReview).length;
  const target = campaigns.reduce((sum, campaign) => sum + campaign.targetSurgeries, 0);
  const completionRate = target ? Math.round((completed / target) * 100) : 0;

  const regionRows = useMemo(() => REGIONAL_CAMPAIGN_AREAS.map((area) => {
    const regionCampaigns = campaigns.filter((campaign) => campaign.region === area.region);
    const primaryCampaign = regionCampaigns[0];
    const campaignIds = new Set(regionCampaigns.map((campaign) => campaign.id));
    const regionPatients = patients.filter((patient) => patient.region === area.region || (patient.campaignId && campaignIds.has(patient.campaignId)));
    const regionScreenings = screenings.filter((screening) => screening.region === area.region || campaignIds.has(screening.campaignId));
    const regionSurgeries = surgeries.filter((surgery) => surgery.region === area.region || campaignIds.has(surgery.campaignId));
    const regionFollowUps = followUps.filter((followUp) => followUp.region === area.region || campaignIds.has(followUp.campaignId));
    const regionCompleted = regionSurgeries.filter((surgery) => surgery.status === 'Completed').length;
    const regionTarget = regionCampaigns.reduce((sum, campaign) => sum + campaign.targetSurgeries, 0) || area.defaultSurgeryTarget;
    const pct = regionTarget ? Math.round((regionCompleted / regionTarget) * 100) : 0;
    const riskFollowUps = regionFollowUps.filter((followUp) => followUp.status === 'Overdue').length;
    const reviewCount = regionFollowUps.filter((followUp) => followUp.needsDoctorReview).length;
    const status = getRegionStatus(regionCampaigns.length, regionPatients.length, pct);

    return {
      region: area.region,
      district: primaryCampaign?.operationDistrict ?? area.defaultDistrict,
      manager: primaryCampaign?.projectManagerName ?? 'Unassigned',
      target: regionTarget,
      patients: regionPatients.length,
      screenings: regionScreenings.length,
      completed: regionCompleted,
      pct,
      overdue: riskFollowUps,
      doctorReview: reviewCount,
      status,
    };
  }), [campaigns, followUps, patients, screenings, surgeries]);

  const funnelData = [
    { name: 'Registered', value: patients.length },
    { name: 'Screened', value: screenings.length },
    { name: 'Scheduled', value: scheduled },
    { name: 'Completed Surgery', value: completed },
    { name: 'Follow-up Done', value: followUps.filter((item) => item.status === 'Completed').length },
  ];

  const surgeryStatusData = SURGERY_STATUSES.map((status) => ({
    name: status,
    value: surgeries.filter((surgery) => surgery.status === status).length,
  })).filter((item) => item.value > 0);

  const riskData = regionRows
    .map((row) => ({ region: shortRegion(row.region), overdue: row.overdue, review: row.doctorReview }))
    .filter((row) => row.overdue || row.review);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Regional performance, workflow volume, and follow-up risk</p>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        <Metric title="Campaigns" value={campaigns.length} icon={Target} />
        <Metric title="Patients" value={patients.length} icon={ClipboardList} />
        <Metric title="Screened" value={screenings.length} icon={Eye} />
        <Metric title="Scheduled" value={scheduled} icon={Stethoscope} />
        <Metric title="Completed" value={completed} icon={CheckCircle} />
        <Metric title="Target Done" value={`${completionRate}%`} icon={TrendingUp} />
      </div>

      {(overdue > 0 || doctorReview > 0) && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          <AlertTriangle size={16} />
          <span>{overdue} overdue follow-up{overdue === 1 ? '' : 's'}</span>
          <span className="text-amber-400">|</span>
          <span>{doctorReview} need doctor review</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="border-0 shadow-sm xl:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-700">Region Surgery Performance</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regionRows} margin={{ left: 0, right: 8, top: 8, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="region" tickFormatter={shortRegion} tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={56} interval={0} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value, name) => [formatChartValue(value), name === 'completed' ? 'Completed' : 'Target']} labelFormatter={(value) => String(value)} />
                <Bar dataKey="target" fill="#d1d5db" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completed" fill="#0f766e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-700">Patient Workflow Funnel</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <FunnelChart>
                <Tooltip formatter={(value) => formatChartValue(value)} />
                <Funnel dataKey="value" data={funnelData} isAnimationActive={false}>
                  <LabelList position="right" fill="#334155" stroke="none" dataKey="name" fontSize={12} />
                  {funnelData.map((entry, index) => <Cell key={entry.name} fill={FUNNEL_COLORS[index % FUNNEL_COLORS.length]} />)}
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-700">Surgery Status</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {surgeryStatusData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={surgeryStatusData} dataKey="value" nameKey="name" outerRadius={82} label>
                    {surgeryStatusData.map((entry, index) => <Cell key={entry.name} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => formatChartValue(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart>No surgeries yet</EmptyChart>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm xl:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-700">Follow-up Risk by Region</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {riskData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={riskData} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="region" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={(value, name) => [formatChartValue(value), name === 'overdue' ? 'Overdue' : 'Doctor review']} />
                  <Bar dataKey="overdue" stackId="risk" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="review" stackId="risk" fill="#dc2626" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart>No follow-up risk</EmptyChart>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm text-slate-700">Region Accountability</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-slate-100 text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-3">Region</th>
                <th className="py-2 pr-3">District</th>
                <th className="py-2 pr-3">Project Manager</th>
                <th className="py-2 pr-3">Patients</th>
                <th className="py-2 pr-3">Screened</th>
                <th className="py-2 pr-3">Completed</th>
                <th className="py-2 pr-3">Progress</th>
                <th className="py-2 pr-3">Risk</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {regionRows.map((row) => (
                <tr key={row.region} className="text-slate-700">
                  <td className="py-3 pr-3 font-medium text-slate-900">{row.region}</td>
                  <td className="py-3 pr-3">{row.district}</td>
                  <td className="py-3 pr-3">{row.manager}</td>
                  <td className="py-3 pr-3">{row.patients.toLocaleString()}</td>
                  <td className="py-3 pr-3">{row.screenings.toLocaleString()}</td>
                  <td className="py-3 pr-3">{row.completed.toLocaleString()} / {row.target.toLocaleString()}</td>
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-teal-600" style={{ width: `${Math.min(row.pct, 100)}%` }} />
                      </div>
                      <span className="w-10 text-xs text-slate-500">{row.pct}%</span>
                    </div>
                  </td>
                  <td className="py-3 pr-3 text-xs text-slate-500">{row.overdue} overdue, {row.doctorReview} review</td>
                  <td className="py-3"><StatusBadge status={row.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function getRegionStatus(campaignCount: number, patientCount: number, pct: number): RegionStatus {
  if (!campaignCount) return 'No Campaign';
  if (!patientCount) return 'No Activity';
  if (pct >= 75) return 'Strong';
  if (pct >= 25) return 'Active';
  return 'Behind';
}

function shortRegion(region: string) {
  return region
    .replace(' / Mogadishu', '')
    .replace(' Somalia', '')
    .replace(' State', '');
}

function formatChartValue(value: unknown) {
  return Number(value ?? 0).toLocaleString();
}

function Metric({ title, value, icon: Icon }: { title: string; value: number | string; icon: typeof Activity }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-xl bg-teal-50 p-2 text-teal-700"><Icon size={18} /></div>
        <div>
          <p className="text-xs font-medium text-slate-500">{title}</p>
          <p className="text-lg font-bold text-slate-900">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyChart({ children }: { children: string }) {
  return <div className="flex h-full items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-400">{children}</div>;
}

function StatusBadge({ status }: { status: RegionStatus }) {
  const classes: Record<RegionStatus, string> = {
    'No Campaign': 'bg-slate-100 text-slate-600',
    'No Activity': 'bg-red-50 text-red-700',
    Behind: 'bg-amber-50 text-amber-700',
    Active: 'bg-blue-50 text-blue-700',
    Strong: 'bg-emerald-50 text-emerald-700',
  };
  return <span className={`rounded-full px-2 py-1 text-xs font-medium ${classes[status]}`}>{status}</span>;
}
