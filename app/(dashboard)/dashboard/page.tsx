'use client';
import { useStore } from '@/lib/store';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Users, Microscope, Scissors, CalendarCheck,
  TrendingUp, TrendingDown, Activity, AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';

const COLORS = ['#0d9488', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6'];

function StatCard({
  label, value, sub, icon: Icon, color, trend,
}: {
  label: string; value: string | number; sub: string;
  icon: React.ElementType; color: string; trend?: number;
}) {
  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{label}</p>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-xs text-slate-400 mt-1">{sub}</p>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
            <Icon size={20} className="text-white" />
          </div>
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 mt-3 text-xs font-medium ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {trend >= 0 ? '+' : ''}{trend}% vs last month
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { patients, screenings, surgeries, followUps, campaigns, referrals, outreach } = useStore();

  // ── Computed KPI ─────────────────────────────────────────────────────────────
  const overdue        = followUps.filter((f) => f.status === 'Overdue').length;
  const activeCampaigns = campaigns.filter((c) => c.status === 'Active').length;
  const pendingReferrals = referrals.filter((r) => r.status === 'Pending').length;
  const completedSurgeries = surgeries.filter((s) => s.status === 'Completed').length;

  // ── Real gender distribution from store ──────────────────────────────────────
  const genderData = [
    { name: 'Female', value: patients.filter((p) => p.sex === 'Female').length },
    { name: 'Male',   value: patients.filter((p) => p.sex === 'Male').length },
    { name: 'Other',  value: patients.filter((p) => p.sex === 'Other').length },
  ].filter((d) => d.value > 0);

  // ── Real referral source counts from store ────────────────────────────────────
  const srcMap: Record<string, number> = {};
  referrals.forEach((r) => { srcMap[r.source] = (srcMap[r.source] ?? 0) + 1; });
  const referralSrc = Object.entries(srcMap)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  // ── Monthly activity from screening dates (last 6 months) ────────────────────
  const now = new Date();
  const monthlyData = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const monthLabel = d.toLocaleString('default', { month: 'short' });
    const y = d.getFullYear();
    const m = d.getMonth();

    const inMonth = (iso: string) => {
      const dd = new Date(iso);
      return dd.getFullYear() === y && dd.getMonth() === m;
    };

    return {
      month: monthLabel,
      screenings: screenings.filter((s) => inMonth(s.screenedAt)).length,
      surgeries:  surgeries.filter((s) => inMonth(s.scheduledAt)).length,
      followUps:  followUps.filter((f) => inMonth(f.dueDate)).length,
    };
  });

  // ── Disability breakdown ──────────────────────────────────────────────────────
  const disabilityMap: Record<string, number> = {};
  patients.forEach((p) => {
    disabilityMap[p.disabilityStatus] = (disabilityMap[p.disabilityStatus] ?? 0) + 1;
  });
  const disabilityData = Object.entries(disabilityMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // ── Recent patients ───────────────────────────────────────────────────────────
  const recentPatients = [...patients]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.patientCode.localeCompare(a.patientCode))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Executive Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">EyeCare Somalia · All campaigns overview</p>
        </div>
        <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse inline-block" />
          {activeCampaigns} Active Campaign{activeCampaigns !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Alert banners */}
      {(overdue > 0 || pendingReferrals > 0) && (
        <div className="flex flex-wrap gap-3">
          {overdue > 0 && (
            <Link href="/followups">
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-700 font-medium cursor-pointer hover:bg-red-100 transition-colors">
                <AlertTriangle size={15} /> {overdue} overdue follow-up{overdue !== 1 ? 's' : ''}
              </div>
            </Link>
          )}
          {pendingReferrals > 0 && (
            <Link href="/referrals">
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-amber-700 font-medium cursor-pointer hover:bg-amber-100 transition-colors">
                <Activity size={15} /> {pendingReferrals} referral{pendingReferrals !== 1 ? 's' : ''} awaiting contact
              </div>
            </Link>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Patients"  value={patients.length.toLocaleString()}    sub="Registered beneficiaries"  icon={Users}        color="bg-teal-500"   trend={12} />
        <StatCard label="Screenings"      value={screenings.length.toLocaleString()}  sub="Eye assessments done"      icon={Microscope}   color="bg-indigo-500" trend={8}  />
        <StatCard label="Surgeries"       value={surgeries.length.toLocaleString()}   sub={`${completedSurgeries} completed`} icon={Scissors} color="bg-amber-500" trend={15} />
        <StatCard label="Follow-ups"      value={followUps.length.toLocaleString()}   sub={`${overdue} overdue`}      icon={CalendarCheck} color="bg-purple-500" trend={-3} />
      </div>

      {/* Monthly trend + Gender */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Monthly Activity (Last 6 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData} barSize={12} barGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)', fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="screenings" name="Screenings" fill="#0d9488" radius={[4, 4, 0, 0]} />
                <Bar dataKey="surgeries"  name="Surgeries"  fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="followUps"  name="Follow-ups" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Patient Gender</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            {genderData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={genderData} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3}>
                      {genderData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12 }} formatter={(v) => [`${v} patients`]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-3 mt-1">
                  {genderData.map((g, i) => {
                    const pct = patients.length ? Math.round((g.value / patients.length) * 100) : 0;
                    return (
                      <div key={g.name} className="flex items-center gap-1.5 text-xs text-slate-600">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i] }} />
                        {g.name} — {g.value} ({pct}%)
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-slate-400 text-sm py-10">No patients yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Referral sources + Campaign progress */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Referral Sources</CardTitle>
          </CardHeader>
          <CardContent>
            {referralSrc.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={referralSrc} layout="vertical" barSize={12}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis dataKey="source" type="category" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={70} />
                  <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                  <Bar dataKey="count" name="Referrals" fill="#0d9488" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-400 text-sm py-10 text-center">No referrals yet</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Campaign Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {campaigns.length === 0 && (
              <p className="text-slate-400 text-sm text-center py-6">No campaigns yet</p>
            )}
            {campaigns.map((c) => {
              const cs  = screenings.filter((s) => s.campaignId === c.id).length;
              const csg = surgeries.filter((s)  => s.campaignId === c.id).length;
              const pct = c.targetScreenings
                ? Math.min(100, Math.round((cs / c.targetScreenings) * 100))
                : 0;
              return (
                <div key={c.id}>
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{c.name}</p>
                      <p className="text-xs text-slate-400">{cs} / {c.targetScreenings} screenings · {csg} surgeries</p>
                    </div>
                    <Badge variant="outline" className={
                      c.status === 'Active'    ? 'border-emerald-200 text-emerald-700 bg-emerald-50 shrink-0' :
                      c.status === 'Planned'   ? 'border-amber-200 text-amber-700 bg-amber-50 shrink-0' :
                      'border-slate-200 text-slate-600 bg-slate-50 shrink-0'
                    }>{c.status}</Badge>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-teal-400 to-teal-600 rounded-full transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">{pct}% of screening target</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Disability + Outreach summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Disability distribution */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Disability Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {disabilityData.length === 0 && <p className="text-slate-400 text-sm py-6 text-center">No data</p>}
            {disabilityData.map((d, i) => {
              const pct = patients.length ? Math.round((d.value / patients.length) * 100) : 0;
              return (
                <div key={d.name} className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 w-20 shrink-0">{d.name}</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                  </div>
                  <span className="text-xs text-slate-500 w-12 text-right shrink-0">{d.value} ({pct}%)</span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Outreach summary */}
        <Card className="lg:col-span-2 border-0 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-700">Recent Outreach Activities</CardTitle>
            <Link href="/outreach" className="text-xs text-teal-600 font-medium hover:underline">View all →</Link>
          </CardHeader>
          <CardContent>
            {outreach.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-6">No outreach activities logged</p>
            ) : (
              <div className="space-y-2">
                {[...outreach].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4).map((o) => (
                  <div key={o.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-slate-700">{o.title}</p>
                      <p className="text-xs text-slate-400">{o.type} · {o.locationName} · {formatDate(o.date)}</p>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-sm font-bold text-teal-600">{o.reach.toLocaleString()}</p>
                      <p className="text-[10px] text-slate-400">reached</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent patients table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-700">Recently Registered Patients</CardTitle>
          <Link href="/patients" className="text-xs text-teal-600 font-medium hover:underline">View all →</Link>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Patient Code', 'Name', 'Sex', 'Phone', 'Campaign', 'Registered'].map((h) => (
                    <th key={h} className="text-left pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wide pr-4 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentPatients.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-400 text-sm">No patients registered yet.</td></tr>
                )}
                {recentPatients.map((p) => {
                  const camp = campaigns.find((c) => c.id === p.campaignId);
                  return (
                    <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="py-3 pr-4 font-mono text-xs text-teal-700 font-semibold whitespace-nowrap">{p.patientCode}</td>
                      <td className="py-3 pr-4 font-medium text-slate-800 whitespace-nowrap">{p.fullName}</td>
                      <td className="py-3 pr-4 text-slate-600">{p.sex}</td>
                      <td className="py-3 pr-4 text-slate-600 whitespace-nowrap">{p.phone}</td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        {camp ? (
                          <Badge variant="outline" className="text-xs border-indigo-200 text-indigo-700 bg-indigo-50">{camp.type}</Badge>
                        ) : '—'}
                      </td>
                      <td className="py-3 text-slate-400 text-xs whitespace-nowrap">{formatDate(p.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
