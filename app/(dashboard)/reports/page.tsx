'use client';
import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { getAllPatients } from '@/app/actions/patients';
import { getAllScreenings } from '@/app/actions/screenings';
import { getAllSurgeries } from '@/app/actions/surgeries';
import { getAllFollowUps } from '@/app/actions/follow_ups';
import { getAllCampaigns } from '@/app/actions/campaigns';
import { getAllReferrals } from '@/app/actions/referrals';
import type { Patient, Screening, Surgery, FollowUp, Campaign, Referral } from '@/types';
import { usePermissions } from '@/lib/auth';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileBarChart, Download, Printer, FileSpreadsheet } from 'lucide-react';

const COLORS = ['#0d9488','#6366f1','#f59e0b','#ec4899','#8b5cf6'];

type ReportType = 'Campaign Summary' | 'Patient Statistics' | 'Surgery Outcomes' | 'Referral Conversion' | 'Donor Brief';

export default function ReportsPage() {
  const { can } = usePermissions();
  const [type, setType]           = useState<ReportType>('Campaign Summary');
  const [patients, setPatients]     = useState<Patient[]>([]);
  const [screenings, setScreenings] = useState<Screening[]>([]);
  const [surgeries, setSurgeries]   = useState<Surgery[]>([]);
  const [followUps, setFollowUps]   = useState<FollowUp[]>([]);
  const [campaigns, setCampaigns]   = useState<Campaign[]>([]);
  const [referrals, setReferrals]   = useState<Referral[]>([]);

  useEffect(() => {
    Promise.all([
      getAllPatients(), getAllScreenings(), getAllSurgeries(),
      getAllFollowUps(), getAllCampaigns(), getAllReferrals(),
    ]).then(([p, sc, sg, f, c, r]) => {
      setPatients(p); setScreenings(sc); setSurgeries(sg);
      setFollowUps(f); setCampaigns(c); setReferrals(r);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const teal: [number, number, number] = [13, 148, 136];

  function exportPDF() {
    const today = new Date().toISOString().split('T')[0];
    const doc = new jsPDF({ orientation: 'landscape' });

    // Page 1 — summary KPIs
    doc.setFontSize(18);
    doc.setTextColor(13, 148, 136);
    doc.text('EyeCare Pro — Programme Report', 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Generated: ' + today, 14, 28);

    autoTable(doc, {
      startY: 35,
      head: [['Metric', 'Value']],
      body: [
        ['Total Patients', patients.length],
        ['Total Screenings', screenings.length],
        ['Surgeries Completed', surgeries.filter((s) => s.status === 'Completed').length],
        ['Follow-ups Completed', followUps.filter((f) => f.status === 'Completed').length],
        ['Total Referrals', referrals.length],
      ],
      headStyles: { fillColor: teal },
      theme: 'striped',
    });

    // Page 2 — Patients
    doc.addPage();
    doc.setFontSize(14);
    doc.setTextColor(13, 148, 136);
    doc.text('Patients', 14, 15);

    autoTable(doc, {
      startY: 22,
      head: [['Code', 'Name', 'Sex', 'District', 'Campaign']],
      body: patients.map((p) => {
        const camp = campaigns.find((c) => c.id === p.campaignId);
        return [p.patientCode, p.fullName, p.sex, p.district, camp?.name ?? '-'];
      }),
      headStyles: { fillColor: teal },
      theme: 'striped',
    });

    // Page 3 — Surgeries
    doc.addPage();
    doc.setFontSize(14);
    doc.setTextColor(13, 148, 136);
    doc.text('Surgeries', 14, 15);

    autoTable(doc, {
      startY: 22,
      head: [['Patient', 'Date', 'Eye', 'Lens', 'Status', 'Surgeon']],
      body: surgeries.map((s) => [
        s.patientName,
        (s.performedAt ?? s.scheduledAt).split('T')[0],
        s.eye,
        s.lensType,
        s.status,
        s.surgeonName ?? '-',
      ]),
      headStyles: { fillColor: teal },
      theme: 'striped',
    });

    doc.save('eyecare-report-' + today + '.pdf');
  }

  function exportExcel() {
    const today = new Date().toISOString().split('T')[0];
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb,
      XLSX.utils.json_to_sheet(patients.map((p) => {
        const camp = campaigns.find((c) => c.id === p.campaignId);
        return { ID: p.id, Code: p.patientCode, Name: p.fullName, Sex: p.sex, DOB: p.dateOfBirth, District: p.district, Region: p.region, Campaign: camp?.name ?? '' };
      })),
      'Patients'
    );

    XLSX.utils.book_append_sheet(wb,
      XLSX.utils.json_to_sheet(screenings.map((s) => ({
        ID: s.id, Patient: s.patientName, Date: s.screenedAt.split('T')[0],
        'VA Right': s.vaRightUnaided, 'VA Left': s.vaLeftUnaided, Recommendation: s.recommendation,
      }))),
      'Screenings'
    );

    XLSX.utils.book_append_sheet(wb,
      XLSX.utils.json_to_sheet(surgeries.map((s) => ({
        ID: s.id, Patient: s.patientName,
        Date: (s.performedAt ?? s.scheduledAt).split('T')[0],
        Eye: s.eye, Lens: s.lensType, Status: s.status, Surgeon: s.surgeonName ?? '',
      }))),
      'Surgeries'
    );

    XLSX.utils.book_append_sheet(wb,
      XLSX.utils.json_to_sheet(followUps.map((f) => ({
        ID: f.id, Patient: f.patientName, Milestone: f.milestone, 'Due Date': f.dueDate, Status: f.status,
      }))),
      'Follow-Ups'
    );

    XLSX.utils.book_append_sheet(wb,
      XLSX.utils.json_to_sheet(referrals.map((r) => ({
        ID: r.id, Patient: r.patientName, Source: r.source, Status: r.status, 'Referred Date': r.referredAt,
      }))),
      'Referrals'
    );

    XLSX.writeFile(wb, 'eyecare-report-' + today + '.xlsx');
  }

  function exportCSV() {
    let rows: string[][] = [];
    let filename = 'report.csv';
    if (type === 'Patient Statistics') {
      filename = 'patients.csv';
      rows = [['Code','Name','Sex','DOB','Phone','District','Disability','Consent'],
        ...patients.map((p) => [p.patientCode, p.fullName, p.sex, p.dateOfBirth, p.phone, p.district, p.disabilityStatus, p.consentGiven ? 'Yes' : 'No'])];
    } else if (type === 'Surgery Outcomes') {
      filename = 'surgeries.csv';
      rows = [['Patient','Eye','Lens','Surgeon','Status','Pre-op VA','Post-op VA','Complications'],
        ...surgeries.map((s) => [s.patientName, s.eye, s.lensType, s.surgeonName, s.status, s.preOpVA, s.postOpVA || '', s.complications])];
    } else if (type === 'Referral Conversion') {
      filename = 'referrals.csv';
      rows = [['Patient','Source','Referred By','Status','Date'],
        ...referrals.map((r) => [r.patientName, r.source, r.referredBy, r.status, r.referredAt])];
    } else {
      filename = 'campaigns.csv';
      rows = [['Campaign','Type','Status','Start','End','Budget','Target Screenings','Target Surgeries'],
        ...campaigns.map((c) => [c.name, c.type, c.status, c.startDate, c.endDate, String(c.budget), String(c.targetScreenings), String(c.targetSurgeries)])];
    }
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = filename; a.click();
  }

  // Campaign summary data
  const campData = campaigns.map((c) => ({
    name: c.name.length > 20 ? c.name.slice(0, 18) + '…' : c.name,
    screenings: screenings.filter((s) => s.campaignId === c.id).length,
    surgeries: surgeries.filter((s) => s.campaignId === c.id).length,
    target: c.targetScreenings,
  }));

  const genderData = [
    { name: 'Female', value: patients.filter((p) => p.sex === 'Female').length },
    { name: 'Male',   value: patients.filter((p) => p.sex === 'Male').length },
    { name: 'Other',  value: patients.filter((p) => p.sex === 'Other').length },
  ].filter((d) => d.value > 0);

  const surgStatusData = [
    { name: 'Completed', value: surgeries.filter((s) => s.status === 'Completed').length },
    { name: 'Scheduled', value: surgeries.filter((s) => s.status === 'Scheduled').length },
    { name: 'In-Theatre',value: surgeries.filter((s) => s.status === 'In-Theatre').length },
    { name: 'Cancelled', value: surgeries.filter((s) => s.status === 'Cancelled').length },
  ].filter((d) => d.value > 0);

  const refData = ['CHW','Volunteer','School','Facility','Self','Community Leader'].map((src) => ({
    source: src, converted: referrals.filter((r) => r.source === src && r.status === 'Converted').length,
    total: referrals.filter((r) => r.source === src).length,
  })).filter((d) => d.total > 0);

  const REPORT_TYPES: ReportType[] = ['Campaign Summary', 'Patient Statistics', 'Surgery Outcomes', 'Referral Conversion', 'Donor Brief'];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500">Generate summaries and export data</p></div>
        <div className="flex gap-2 flex-wrap">
          {can('reports', 'export') && (
            <Button onClick={exportPDF} className="bg-rose-600 hover:bg-rose-700 text-white gap-2 rounded-xl"><Download size={15} />Export PDF</Button>
          )}
          {can('reports', 'export') && (
            <Button onClick={exportExcel} className="bg-green-600 hover:bg-green-700 text-white gap-2 rounded-xl"><FileSpreadsheet size={15} />Export Excel</Button>
          )}
          <Button variant="outline" onClick={() => window.print()} className="gap-2 rounded-xl border-slate-200"><Printer size={15} />Print</Button>
          <Button onClick={exportCSV} className="bg-teal-600 hover:bg-teal-700 text-white gap-2 rounded-xl"><Download size={15} />Export CSV</Button>
        </div>
      </div>

      {/* Report type selector */}
      <div className="flex flex-wrap gap-2">
        {REPORT_TYPES.map((t) => (
          <button key={t} onClick={() => setType(t)}
            className={`text-sm font-medium px-4 py-2 rounded-xl border transition-all ${type === t ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Patients',  value: patients.length },
          { label: 'Screenings',      value: screenings.length },
          { label: 'Surgeries Done',  value: surgeries.filter((s) => s.status === 'Completed').length },
          { label: 'Follow-ups',      value: followUps.filter((f) => f.status === 'Completed').length },
        ].map(({ label, value }) => (
          <Card key={label} className="border-0 shadow-sm"><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-xs text-slate-500 mt-1">{label}</p>
          </CardContent></Card>
        ))}
      </div>

      {/* Campaign Summary */}
      {type === 'Campaign Summary' && (
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-sm font-semibold text-slate-700">Campaign Performance</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={campData} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                <Bar dataKey="screenings" name="Screenings" fill="#0d9488" radius={[4,4,0,0]} />
                <Bar dataKey="surgeries"  name="Surgeries"  fill="#6366f1" radius={[4,4,0,0]} />
                <Bar dataKey="target"     name="Target"     fill="#e2e8f0" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
            <table className="w-full text-sm mt-4">
              <thead><tr className="border-b border-slate-100">{['Campaign','Type','Status','Budget','Screenings','Surgeries'].map((h) => <th key={h} className="text-left pb-2 text-xs font-semibold text-slate-400 pr-4">{h}</th>)}</tr></thead>
              <tbody>{campaigns.map((c) => <tr key={c.id} className="border-b border-slate-50">
                <td className="py-2 pr-4 font-medium text-slate-700">{c.name}</td>
                <td className="py-2 pr-4 text-slate-500">{c.type}</td>
                <td className="py-2 pr-4"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.status==='Active'?'bg-green-100 text-green-700':'bg-slate-100 text-slate-600'}`}>{c.status}</span></td>
                <td className="py-2 pr-4 text-slate-500">${c.budget.toLocaleString()}</td>
                <td className="py-2 pr-4">{screenings.filter((s)=>s.campaignId===c.id).length} / {c.targetScreenings}</td>
                <td className="py-2">{surgeries.filter((s)=>s.campaignId===c.id).length} / {c.targetSurgeries}</td>
              </tr>)}</tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Patient Statistics */}
      {type === 'Patient Statistics' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="text-sm font-semibold text-slate-700">Gender Distribution</CardTitle></CardHeader>
            <CardContent className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart><Pie data={genderData} dataKey="value" cx="50%" cy="50%" outerRadius={80} innerRadius={50} paddingAngle={3}>
                  {genderData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie><Tooltip contentStyle={{ borderRadius: 10, fontSize: 12 }} /></PieChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2">{genderData.map((g, i) => <div key={g.name} className="flex items-center gap-1.5 text-xs"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i] }}/>{g.name}: {g.value}</div>)}</div>
            </CardContent></Card>
          <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="text-sm font-semibold text-slate-700">Disability Status</CardTitle></CardHeader>
            <CardContent>
              {['None','Visual','Hearing','Mobility','Cognitive','Multiple'].map((d) => {
                const count = patients.filter((p) => p.disabilityStatus === d).length;
                const pct = patients.length ? Math.round((count / patients.length) * 100) : 0;
                return count > 0 ? <div key={d} className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-slate-600 w-20">{d}</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-teal-500 rounded-full" style={{ width: `${pct}%` }}/></div>
                  <span className="text-xs text-slate-400 w-8 text-right">{count}</span>
                </div> : null;
              })}
            </CardContent></Card>
        </div>
      )}

      {/* Surgery Outcomes */}
      {type === 'Surgery Outcomes' && (
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-sm font-semibold text-slate-700">Surgery Status Breakdown</CardTitle></CardHeader>
          <CardContent className="flex flex-col md:flex-row items-center gap-6">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart><Pie data={surgStatusData} dataKey="value" cx="50%" cy="50%" outerRadius={90} innerRadius={55} paddingAngle={3}>
                {surgStatusData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie><Tooltip contentStyle={{ borderRadius: 10, fontSize: 12 }} /></PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 min-w-[160px]">{surgStatusData.map((s, i) => (
              <div key={s.name} className="flex items-center gap-2 text-sm">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: COLORS[i] }}/>
                <span className="text-slate-600">{s.name}</span>
                <span className="ml-auto font-semibold text-slate-800">{s.value}</span>
              </div>
            ))}</div>
          </CardContent>
        </Card>
      )}

      {/* Referral Conversion */}
      {type === 'Referral Conversion' && (
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-sm font-semibold text-slate-700">Conversion by Source</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100">{['Source','Total','Converted','Rate'].map((h) => <th key={h} className="text-left pb-2 text-xs font-semibold text-slate-400 pr-4">{h}</th>)}</tr></thead>
              <tbody>{refData.map((r) => (
                <tr key={r.source} className="border-b border-slate-50">
                  <td className="py-2.5 pr-4 font-medium text-slate-700">{r.source}</td>
                  <td className="py-2.5 pr-4 text-slate-600">{r.total}</td>
                  <td className="py-2.5 pr-4 text-green-600 font-semibold">{r.converted}</td>
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden max-w-[100px]"><div className="h-full bg-teal-500 rounded-full" style={{ width: `${r.total ? Math.round((r.converted/r.total)*100) : 0}%` }}/></div>
                      <span className="text-xs text-slate-500">{r.total ? Math.round((r.converted/r.total)*100) : 0}%</span>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Donor Brief */}
      {type === 'Donor Brief' && (
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-sm font-semibold text-slate-700">Donor Summary Report</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-teal-800 mb-2">EyeCare Somalia — Programme Impact Summary</p>
              <p className="text-xs text-teal-700 leading-relaxed">
                Through {campaigns.filter((c)=>c.status==='Active').length} active campaigns, our programme has reached{' '}
                <strong>{patients.length} beneficiaries</strong>, conducted{' '}
                <strong>{screenings.length} eye screenings</strong>, and performed{' '}
                <strong>{surgeries.filter((s)=>s.status==='Completed').length} sight-restoring surgeries</strong>.
                Follow-up completion rate: <strong>{followUps.length ? Math.round((followUps.filter((f)=>f.status==='Completed').length/followUps.length)*100) : 0}%</strong>.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Patients Reached', value: patients.length, color: 'text-teal-600' },
                { label: 'Surgeries Completed', value: surgeries.filter((s)=>s.status==='Completed').length, color: 'text-indigo-600' },
                { label: 'Total Budget', value: `$${campaigns.reduce((a,c)=>a+c.budget,0).toLocaleString()}`, color: 'text-amber-600' },
                { label: 'Active Campaigns', value: campaigns.filter((c)=>c.status==='Active').length, color: 'text-emerald-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white border border-slate-100 rounded-xl p-3 text-center shadow-sm">
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-slate-500 mt-1">{label}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 italic">* Aggregate data only. No patient PII included in donor reports.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
