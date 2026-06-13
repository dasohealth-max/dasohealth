'use client';

import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import type { Campaign, FollowUp, Patient, Screening, Surgery } from '@/types';
import { getAllCampaigns } from '@/app/actions/campaigns';
import { getAllFollowUps } from '@/app/actions/follow_ups';
import { getAllPatients } from '@/app/actions/patients';
import { getAllScreenings } from '@/app/actions/screenings';
import { getAllSurgeries } from '@/app/actions/surgeries';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { REGIONAL_CAMPAIGN_AREAS } from '@/lib/regions';
import { usePermissions } from '@/lib/auth';
import { Download } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type RegionPerformance = {
  region: string;
  campaigns: number;
  targetSurgeries: number;
  patients: number;
  screenings: number;
  scheduled: number;
  completed: number;
  postponed: number;
  cancelled: number;
  followUps: number;
  overdueFollowUps: number;
  doctorReviews: number;
  completionRate: number;
  status: 'No campaign' | 'No activity' | 'Behind' | 'Active' | 'Strong';
};

export default function ReportsPage() {
  const { user, role } = usePermissions();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [screenings, setScreenings] = useState<Screening[]>([]);
  const [surgeries, setSurgeries] = useState<Surgery[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [campaignId, setCampaignId] = useState('all');
  const [region, setRegion] = useState('all');
  const assignedRegion = user?.assignedRegion;
  const regionLocked = role !== 'Super Administrator' && !!assignedRegion;
  const effectiveRegion = regionLocked ? assignedRegion ?? 'all' : region;

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

  const availableRegions = useMemo(() => {
    const fromData = new Set(campaigns.map((campaign) => campaign.region));
    const regions = REGIONAL_CAMPAIGN_AREAS
      .map((area) => area.region)
      .filter((item) => fromData.has(item) || campaigns.length !== 0);
    return regionLocked && assignedRegion ? regions.filter((item) => item === assignedRegion) : regions;
  }, [assignedRegion, campaigns, regionLocked]);

  const scoped = useMemo(() => {
    const matchesCampaign = <T extends { campaignId?: string }>(row: T) => campaignId === 'all' || row.campaignId === campaignId;
    const matchesRegion = <T extends { region?: string }>(row: T) => effectiveRegion === 'all' || row.region === effectiveRegion;
    const filter = <T extends { campaignId?: string; region?: string }>(rows: T[]) =>
      rows.filter((row) => matchesCampaign(row) && matchesRegion(row));
    const selectedCampaigns = campaigns.filter((campaign) =>
      (campaignId === 'all' || campaign.id === campaignId) &&
      (effectiveRegion === 'all' || campaign.region === effectiveRegion)
    );

    return {
      campaigns: selectedCampaigns,
      patients: filter(patients),
      screenings: filter(screenings),
      surgeries: filter(surgeries),
      followUps: filter(followUps),
    };
  }, [campaignId, effectiveRegion, campaigns, patients, screenings, surgeries, followUps]);

  const regionPerformance = useMemo<RegionPerformance[]>(() => {
    const regions = effectiveRegion === 'all'
      ? availableRegions
      : [effectiveRegion];

    return regions.map((regionName) => {
      const regionCampaigns = campaigns.filter((campaign) => campaign.region === regionName);
      const regionPatients = patients.filter((patient) => patient.region === regionName);
      const regionScreenings = screenings.filter((screening) => screening.region === regionName);
      const regionSurgeries = surgeries.filter((surgery) => surgery.region === regionName);
      const regionFollowUps = followUps.filter((followUp) => followUp.region === regionName);
      const targetSurgeries = regionCampaigns.reduce((sum, campaign) => sum + campaign.targetSurgeries, 0);
      const completed = regionSurgeries.filter((surgery) => surgery.status === 'Completed').length;
      const completionRate = targetSurgeries ? Math.round((completed / targetSurgeries) * 100) : 0;
      const activity = regionPatients.length + regionScreenings.length + regionSurgeries.length;
      const status: RegionPerformance['status'] =
        regionCampaigns.length === 0 ? 'No campaign' :
        activity === 0 ? 'No activity' :
        completionRate >= 75 ? 'Strong' :
        completionRate >= 25 || regionScreenings.length > 0 ? 'Active' :
        'Behind';

      return {
        region: regionName,
        campaigns: regionCampaigns.length,
        targetSurgeries,
        patients: regionPatients.length,
        screenings: regionScreenings.length,
        scheduled: regionSurgeries.filter((surgery) => surgery.status === 'Scheduled').length,
        completed,
        postponed: regionSurgeries.filter((surgery) => surgery.status === 'Postponed').length,
        cancelled: regionSurgeries.filter((surgery) => surgery.status === 'Cancelled').length,
        followUps: regionFollowUps.length,
        overdueFollowUps: regionFollowUps.filter((followUp) => followUp.status === 'Overdue').length,
        doctorReviews: regionFollowUps.filter((followUp) => followUp.needsDoctorReview).length,
        completionRate,
        status,
      };
    }).sort((a, b) => {
      const statusWeight = { 'No activity': 0, Behind: 1, Active: 2, Strong: 3, 'No campaign': -1 };
      return statusWeight[a.status] - statusWeight[b.status] || a.completionRate - b.completionRate;
    });
  }, [availableRegions, effectiveRegion, campaigns, patients, screenings, surgeries, followUps]);

  const completed = scoped.surgeries.filter((item) => item.status === 'Completed').length;
  const target = scoped.campaigns.reduce((sum, campaign) => sum + campaign.targetSurgeries, 0);
  const doctorReviews = scoped.followUps.filter((item) => item.needsDoctorReview).length;
  const inactiveRegions = regionPerformance.filter((item) => item.status === 'No activity' || item.status === 'Behind').length;
  const surgeryStatusData = ['Scheduled', 'In-Theatre', 'Completed', 'Postponed', 'Cancelled'].map((status) => ({
    name: status,
    value: scoped.surgeries.filter((surgery) => surgery.status === status).length,
  })).filter((item) => item.value > 0);

  function exportWorkbook() {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(regionPerformance), 'Region Performance');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(scoped.campaigns), 'Campaigns');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(scoped.patients), 'Patients');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(scoped.screenings), 'Screenings');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(scoped.surgeries), 'Surgeries');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(scoped.followUps), 'Follow-ups');
    XLSX.writeFile(workbook, 'eyecare-regional-report.xlsx');
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500">Compare regions, find inactive areas, and filter by state or campaign</p>
        </div>
        <Button onClick={exportWorkbook} className="gap-2 rounded-xl bg-teal-600 text-white hover:bg-teal-700"><Download size={15} />Export Workbook</Button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {regionLocked ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <p className="text-xs font-medium text-slate-500">Assigned region</p>
            <p className="font-semibold">{assignedRegion}</p>
          </div>
        ) : (
          <Select value={region} onValueChange={(value) => { if (value) { setRegion(value); setCampaignId('all'); } }}>
            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Region" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All regions</SelectItem>
              {availableRegions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        <Select value={campaignId} onValueChange={(value) => { if (value) setCampaignId(value); }}>
          <SelectTrigger className="rounded-xl"><SelectValue placeholder="Campaign" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All campaigns</SelectItem>
            {campaigns
              .filter((campaign) => effectiveRegion === 'all' || campaign.region === effectiveRegion)
              .map((campaign) => <SelectItem key={campaign.id} value={campaign.id}>{campaign.name} | {campaign.region}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        <Metric title="Campaigns" value={scoped.campaigns.length} />
        <Metric title="Patients" value={scoped.patients.length} />
        <Metric title="Screened" value={scoped.screenings.length} />
        <Metric title="Completed Surgeries" value={`${completed}/${target || 0}`} />
        <Metric title="Doctor Reviews" value={doctorReviews} />
        <Metric title="Behind / No Activity" value={inactiveRegions} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="border-0 shadow-sm xl:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm text-slate-700">Campaign Performance</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regionPerformance} margin={{ left: 0, right: 8, top: 8, bottom: 28 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="region" tickFormatter={shortRegion} tick={{ fontSize: 11 }} angle={-18} textAnchor="end" height={54} interval={0} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value, name) => [formatChartValue(value), name === 'completed' ? 'Completed' : 'Target']} />
                <Bar dataKey="targetSurgeries" fill="#d1d5db" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completed" fill="#0f766e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm text-slate-700">Surgery Status</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {surgeryStatusData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={surgeryStatusData} dataKey="value" nameKey="name" outerRadius={86} label>
                    {surgeryStatusData.map((entry, index) => <Cell key={entry.name} fill={['#2563eb', '#7c3aed', '#16a34a', '#f59e0b', '#dc2626'][index % 5]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => formatChartValue(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-400">No surgery data</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm text-slate-700">Region Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>{['Region', 'Status', 'Campaigns', 'Target', 'Patients', 'Screened', 'Scheduled', 'Completed', 'Rate', 'Overdue FU', 'Doctor Review'].map((heading) => <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{heading}</th>)}</tr>
              </thead>
              <tbody>
                {regionPerformance.map((row) => (
                  <tr key={row.region} className="border-b border-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{row.region}</td>
                    <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                    <td className="px-4 py-3">{row.campaigns}</td>
                    <td className="px-4 py-3">{row.targetSurgeries}</td>
                    <td className="px-4 py-3">{row.patients}</td>
                    <td className="px-4 py-3">{row.screenings}</td>
                    <td className="px-4 py-3">{row.scheduled}</td>
                    <td className="px-4 py-3">{row.completed}</td>
                    <td className="px-4 py-3">{row.completionRate}%</td>
                    <td className="px-4 py-3">{row.overdueFollowUps}</td>
                    <td className="px-4 py-3">{row.doctorReviews}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-sm text-slate-700">Campaign Breakdown</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>{['Campaign', 'Region', 'District', 'Manager', 'Patients', 'Screenings', 'Scheduled', 'Completed', 'Target'].map((heading) => <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{heading}</th>)}</tr>
              </thead>
              <tbody>
                {scoped.campaigns.map((campaign) => (
                  <tr key={campaign.id} className="border-b border-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{campaign.name}</td>
                    <td className="px-4 py-3 text-slate-600">{campaign.region}</td>
                    <td className="px-4 py-3 text-slate-600">{campaign.operationDistrict}</td>
                    <td className="px-4 py-3 text-slate-600">{campaign.projectManagerName}</td>
                    <td className="px-4 py-3">{patients.filter((item) => item.campaignId === campaign.id).length}</td>
                    <td className="px-4 py-3">{screenings.filter((item) => item.campaignId === campaign.id).length}</td>
                    <td className="px-4 py-3">{surgeries.filter((item) => item.campaignId === campaign.id && item.status === 'Scheduled').length}</td>
                    <td className="px-4 py-3">{surgeries.filter((item) => item.campaignId === campaign.id && item.status === 'Completed').length}</td>
                    <td className="px-4 py-3">{campaign.targetSurgeries}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: number | string }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4">
        <p className="text-xs font-medium text-slate-500">{title}</p>
        <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
      </CardContent>
    </Card>
  );
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

function StatusBadge({ status }: { status: RegionPerformance['status'] }) {
  const styles: Record<RegionPerformance['status'], string> = {
    'No campaign': 'bg-slate-100 text-slate-600',
    'No activity': 'bg-red-100 text-red-700',
    Behind: 'bg-amber-100 text-amber-700',
    Active: 'bg-blue-100 text-blue-700',
    Strong: 'bg-green-100 text-green-700',
  };
  return <span className={`rounded-full px-2 py-1 text-xs font-medium ${styles[status]}`}>{status}</span>;
}
