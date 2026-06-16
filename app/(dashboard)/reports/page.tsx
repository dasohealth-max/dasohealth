'use client';

import { useEffect, useState } from 'react';
import { actionAuditReportExport, getReportAggregation, getReportRawData, type ReportAggregation } from '@/app/actions/reports';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePermissions } from '@/lib/auth';
import { completionRate, type RegionStatus } from '@/lib/reporting';
import { CalendarDays, Download, MapPin, UserCheck } from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

const MILESTONES = ['Day 1', 'Week 1', 'Month 1', 'Month 3'] as const;

export default function ReportsPage() {
  const { user, role } = usePermissions();
  const [agg, setAgg] = useState<ReportAggregation | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportError, setExportError] = useState('');
  const [campaignId, setCampaignId] = useState('all');
  const [region, setRegion] = useState('all');

  const assignedRegion = user?.assignedRegion;
  const regionLocked = role !== 'Super Administrator' && !!assignedRegion;
  const effectiveRegion = regionLocked ? (assignedRegion ?? 'all') : region;

  useEffect(() => {
    let cancelled = false;
    getReportAggregation({ filterRegion: effectiveRegion, filterCampaignId: campaignId })
      .then((data) => { if (!cancelled) { setAgg(data); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [effectiveRegion, campaignId]);

  const availableRegions = agg?.availableRegions ?? [];
  const availableCampaigns = (agg?.allCampaigns ?? []).filter(
    (c) => effectiveRegion === 'all' || c.region === effectiveRegion,
  );
  const scoped = agg?.scoped;
  const regionPerformance = agg?.regionPerformance ?? [];

  const selectedCampaignName =
    campaignId === 'all'
      ? 'All campaigns'
      : ((agg?.allCampaigns ?? []).find((c) => c.id === campaignId)?.name ?? 'All campaigns');

  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  // ── Excel export ──────────────────────────────────────────────────────────
  async function exportWorkbook() {
    setExporting(true);
    setExportError('');
    try {
      const auditResult = await actionAuditReportExport({
        region: effectiveRegion,
        campaign: selectedCampaignName,
        format: 'xlsx',
      });
      if (!auditResult.ok) throw new Error(auditResult.error);

      const rawData = await getReportRawData({ filterRegion: effectiveRegion, filterCampaignId: campaignId });
      const { campaigns, patients, screenings, surgeries, followUps, medications, regionPerformance: rp } = rawData;

      const surgeryTarget = campaigns.reduce((sum, c) => sum + c.targetSurgeries, 0);
      const surgeriesScheduled = surgeries.filter((s) => s.status === 'Scheduled').length;
      const surgeriesInTheatre = surgeries.filter((s) => s.status === 'In-Theatre').length;
      const surgeriesCompleted = surgeries.filter((s) => s.status === 'Completed').length;
      const surgeriesPostponed = surgeries.filter((s) => s.status === 'Postponed').length;
      const surgeriesCancelled = surgeries.filter((s) => s.status === 'Cancelled').length;
      const surgeryCompletionRate = completionRate(surgeriesCompleted, surgeryTarget);
      const completedFollowUps = followUps.filter((fu) => fu.status === 'Completed').length;
      const overdueFollowUps = followUps.filter((fu) => fu.status === 'Overdue').length;
      const doctorReviewPending = followUps.filter((fu) => fu.doctorReviewStatus === 'Pending').length;
      const doctorReviewCompleted = followUps.filter((fu) => fu.doctorReviewStatus === 'Completed').length;
      const hasMedications = medications.length > 0;
      const registered = patients.length;
      const totalSurgeries = surgeries.length;

      const funnelExport = [
        { step: 'Registered', count: registered },
        { step: 'Screened', count: screenings.length },
        { step: 'Surgery Booked', count: surgeriesScheduled + surgeriesInTheatre + surgeriesCompleted },
        { step: 'Surg. Completed', count: surgeriesCompleted },
        { step: 'Follow-up Done', count: completedFollowUps },
      ];

      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      // 1. Executive Summary
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
        { Metric: 'Report Date', Value: today },
        { Metric: 'Region', Value: effectiveRegion === 'all' ? 'All regions' : effectiveRegion },
        { Metric: 'Campaign', Value: selectedCampaignName },
        { Metric: 'Prepared By', Value: user?.name ?? '' },
        { Metric: 'Role', Value: role ?? '' },
        { Metric: '', Value: '' },
        { Metric: 'Campaigns', Value: campaigns.length },
        { Metric: 'Patients Registered', Value: registered },
        { Metric: 'Screenings Completed', Value: screenings.length },
        { Metric: 'Surgery Target', Value: surgeryTarget },
        { Metric: 'Surgeries Scheduled', Value: surgeriesScheduled },
        { Metric: 'Surgeries In-Theatre', Value: surgeriesInTheatre },
        { Metric: 'Surgeries Completed', Value: surgeriesCompleted },
        { Metric: 'Surgeries Postponed', Value: surgeriesPostponed },
        { Metric: 'Surgeries Cancelled', Value: surgeriesCancelled },
        { Metric: 'Surgery Completion Rate', Value: `${surgeryCompletionRate}%` },
        { Metric: 'Follow-ups Total', Value: followUps.length },
        { Metric: 'Follow-ups Completed', Value: completedFollowUps },
        { Metric: 'Follow-ups Overdue', Value: overdueFollowUps },
        { Metric: 'Doctor Review Pending', Value: doctorReviewPending },
        { Metric: 'Doctor Review Completed', Value: doctorReviewCompleted },
        ...(hasMedications ? [{ Metric: 'Medications Prescribed', Value: medications.length }] : []),
      ]), 'Executive Summary');

      // 2. Region Performance
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rp.map((r) => ({
        Region: r.region,
        Status: r.status,
        Campaigns: r.campaigns,
        'Surgery Target': r.targetSurgeries,
        'Patients Registered': r.patients,
        Screenings: r.screenings,
        'Surgeries Scheduled': r.scheduled,
        'In-Theatre': r.inTheatre,
        Completed: r.completed,
        Postponed: r.postponed,
        Cancelled: r.cancelled,
        'Completion Rate %': r.completionRate,
        'Follow-ups': r.followUps,
        'Follow-ups Completed': r.completedFollowUps,
        'Follow-ups Overdue': r.overdueFollowUps,
        'Dr. Review Pending': r.doctorReviewPending,
        'Dr. Review Completed': r.doctorReviewCompleted,
      }))), 'Region Performance');

      // 3. Campaign Performance
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(campaigns.map((c) => {
        const cSurgeries = surgeries.filter((s) => s.campaignId === c.id);
        const cFollowUps = followUps.filter((fu) => fu.campaignId === c.id);
        const cDone = cSurgeries.filter((s) => s.status === 'Completed').length;
        return {
          Campaign: c.name,
          Type: c.type,
          Status: c.status,
          Region: c.region,
          District: c.operationDistrict,
          Manager: c.projectManagerName,
          'Start Date': c.startDate,
          'End Date': c.endDate,
          'Target Screenings': c.targetScreenings,
          'Target Surgeries': c.targetSurgeries,
          'Target Follow-ups': c.targetFollowUps,
          'Patients Registered': patients.filter((p) => p.campaignId === c.id).length,
          Screenings: screenings.filter((s) => s.campaignId === c.id).length,
          'Surgeries Scheduled': cSurgeries.filter((s) => s.status === 'Scheduled').length,
          'Surgeries Completed': cDone,
          'Surgeries Postponed': cSurgeries.filter((s) => s.status === 'Postponed').length,
          'Surgeries Cancelled': cSurgeries.filter((s) => s.status === 'Cancelled').length,
          'Completion Rate %': completionRate(cDone, c.targetSurgeries),
          'Follow-ups': cFollowUps.length,
          'Follow-ups Completed': cFollowUps.filter((fu) => fu.status === 'Completed').length,
          'Follow-ups Overdue': cFollowUps.filter((fu) => fu.status === 'Overdue').length,
        };
      })), 'Campaign Performance');

      // 4. Workflow Funnel
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(funnelExport.map((f) => ({
        Step: f.step,
        Count: f.count,
        '% of Registered': registered ? `${Math.round((f.count / registered) * 100)}%` : '0%',
      }))), 'Workflow Funnel');

      // 5. Surgery Status
      const surgeryStatusExport = [
        { name: 'Scheduled', value: surgeriesScheduled },
        { name: 'In-Theatre', value: surgeriesInTheatre },
        { name: 'Completed', value: surgeriesCompleted },
        { name: 'Postponed', value: surgeriesPostponed },
        { name: 'Cancelled', value: surgeriesCancelled },
      ].filter((s) => s.value > 0);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
        ...surgeryStatusExport.map((s) => ({
          Status: s.name,
          Count: s.value,
          '% of Total': totalSurgeries ? `${Math.round((s.value / totalSurgeries) * 100)}%` : '0%',
        })),
        { Status: 'Total', Count: totalSurgeries, '% of Total': '100%' },
      ]), 'Surgery Status');

      // 6. Follow-up Review
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
        ...MILESTONES.map((m) => {
          const mFu = followUps.filter((fu) => fu.milestone === m);
          return {
            Milestone: m,
            Total: mFu.length,
            Completed: mFu.filter((fu) => fu.status === 'Completed').length,
            Overdue: mFu.filter((fu) => fu.status === 'Overdue').length,
            'Dr. Review Pending': mFu.filter((fu) => fu.doctorReviewStatus === 'Pending').length,
            'Dr. Review Completed': mFu.filter((fu) => fu.doctorReviewStatus === 'Completed').length,
          };
        }),
        {
          Milestone: 'Total',
          Total: followUps.length,
          Completed: completedFollowUps,
          Overdue: overdueFollowUps,
          'Dr. Review Pending': doctorReviewPending,
          'Dr. Review Completed': doctorReviewCompleted,
        },
      ]), 'Follow-up Review');

      // 7. Medications
      if (hasMedications) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(medications.map((m) => {
          const fu = followUps.find((f) => f.id === m.followUpId);
          return {
            Patient: fu?.patientName ?? '',
            Region: fu?.region ?? '',
            'Follow-up Milestone': fu?.milestone ?? '',
            Drug: m.drugName,
            Dosage: m.dosage,
            Frequency: m.frequency,
            Duration: m.duration,
            Instructions: m.instructions,
            Status: m.status,
            Notes: m.notes,
            'Prescribed At': m.createdAt.split('T')[0],
          };
        })), 'Medications');
      }

      // 8. Patients
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(patients.map((p) => ({
        'Patient Code': p.patientCode,
        'Full Name': p.fullName,
        'Date of Birth': p.dateOfBirth,
        Sex: p.sex,
        District: p.district,
        Region: p.region,
        Phone: p.phone,
        'Disability Status': p.disabilityStatus,
        'Insurance Status': p.insuranceStatus,
        'Screening Status': p.screeningStatus,
        'Referral Source': p.referralSource,
        'Consent Given': p.consentGiven ? 'Yes' : 'No',
        'Registered By': p.registeredByName,
        'Registered At': p.createdAt.split('T')[0],
      }))), 'Patients');

      // 9. Screenings
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(screenings.map((s) => ({
        Patient: s.patientName,
        Region: s.region,
        'Screened At': s.screenedAt.split('T')[0],
        'Screened By': s.screenedByName,
        'VA Right Unaided': s.vaRightUnaided,
        'VA Left Unaided': s.vaLeftUnaided,
        'VA Right Corrected': s.vaRightCorrected ?? '',
        'VA Left Corrected': s.vaLeftCorrected ?? '',
        'IOP Right': s.iopRight ?? '',
        'IOP Left': s.iopLeft ?? '',
        'Cataract Suspected': s.cataractSuspected ? 'Yes' : 'No',
        'Glaucoma Suspected': s.glaucomaSuspected ? 'Yes' : 'No',
        'Diabetic Retinopathy': s.diabeticRetinopathy ? 'Yes' : 'No',
        Recommendation: s.recommendation,
        'Other Findings': s.otherFindings,
        Notes: s.notes,
      }))), 'Screenings');

      // 10. Surgeries
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(surgeries.map((s) => ({
        Patient: s.patientName,
        Region: s.region,
        Status: s.status,
        Eye: s.eye,
        'Lens Type': s.lensType,
        Surgeon: s.surgeonName,
        'Scheduled At': s.scheduledAt.split('T')[0],
        'Performed At': s.performedAt ? s.performedAt.split('T')[0] : '',
        'Pre-Op VA': s.preOpVA,
        'Post-Op VA': s.postOpVA ?? '',
        Complications: s.complications,
        Notes: s.intraopNotes,
        'Completed By': s.completedByName,
      }))), 'Surgeries');

      // 11. Follow-ups
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(followUps.map((fu) => ({
        Patient: fu.patientName,
        Region: fu.region,
        Milestone: fu.milestone,
        Status: fu.status,
        'Due Date': fu.dueDate,
        'Completed At': fu.completedAt ? fu.completedAt.split('T')[0] : '',
        'VA Right Post': fu.vaRightPost ?? '',
        'VA Left Post': fu.vaLeftPost ?? '',
        Complications: fu.complications,
        'Needs Dr. Review': fu.needsDoctorReview ? 'Yes' : 'No',
        'Dr. Review Status': fu.doctorReviewStatus,
        'Doctor Name': fu.doctorName,
        'Doctor Diagnosis': fu.doctorDiagnosis,
        'Treatment Plan': fu.doctorTreatmentPlan,
        'Next Appointment': fu.nextAppointmentDate ?? '',
        Notes: fu.notes,
      }))), 'Follow-ups');

      const slug = effectiveRegion === 'all' ? 'all-regions' : effectiveRegion.toLowerCase().replace(/\s+/g, '-');
      XLSX.writeFile(wb, `eyecare-report-${slug}-${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Could not export report');
    } finally {
      setExporting(false);
    }
  }

  async function exportPdf() {
    setExportingPdf(true);
    setExportError('');
    try {
      const auditResult = await actionAuditReportExport({
        region: effectiveRegion,
        campaign: selectedCampaignName,
        format: 'pdf',
      });
      if (!auditResult.ok) throw new Error(auditResult.error);

      const rawData = await getReportRawData({ filterRegion: effectiveRegion, filterCampaignId: campaignId });
      const { campaigns, patients, screenings, surgeries, followUps, regionPerformance: rp } = rawData;
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const surgeryTarget = campaigns.reduce((sum, c) => sum + c.targetSurgeries, 0);
      const surgeriesCompleted = surgeries.filter((s) => s.status === 'Completed').length;
      const surgeriesScheduled = surgeries.filter((s) => s.status === 'Scheduled').length;
      const surgeriesInTheatre = surgeries.filter((s) => s.status === 'In-Theatre').length;
      const surgeriesPostponed = surgeries.filter((s) => s.status === 'Postponed').length;
      const surgeriesCancelled = surgeries.filter((s) => s.status === 'Cancelled').length;
      const completedFollowUps = followUps.filter((fu) => fu.status === 'Completed').length;
      const overdueFollowUps = followUps.filter((fu) => fu.status === 'Overdue').length;
      const doctorReviewPending = followUps.filter((fu) => fu.doctorReviewStatus === 'Pending').length;
      const doctorReviewCompleted = followUps.filter((fu) => fu.doctorReviewStatus === 'Completed').length;
      const registered = patients.length;

      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 36;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(0, 46, 99);
      doc.text('DAS Health Eye Care Report', margin, 42);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(75, 86, 102);
      doc.text(`Region: ${effectiveRegion === 'all' ? 'All regions' : effectiveRegion}`, margin, 60);
      doc.text(`Campaign: ${selectedCampaignName}`, margin, 74);
      doc.text(`Prepared by: ${user?.name ?? ''} (${role ?? ''})`, margin, 88);
      doc.text(`Report date: ${today}`, pageWidth - margin, 60, { align: 'right' });

      autoTable(doc, {
        startY: 112,
        head: [['Metric', 'Value', 'Metric', 'Value']],
        body: [
          ['Campaigns', campaigns.length, 'Patients Registered', registered],
          ['Screenings', screenings.length, 'Surgery Target', surgeryTarget],
          ['Surgeries Scheduled', surgeriesScheduled, 'Surgeries In-Theatre', surgeriesInTheatre],
          ['Surgeries Completed', surgeriesCompleted, 'Completion Rate', `${completionRate(surgeriesCompleted, surgeryTarget)}%`],
          ['Surgeries Postponed', surgeriesPostponed, 'Surgeries Cancelled', surgeriesCancelled],
          ['Follow-ups Completed', completedFollowUps, 'Follow-ups Overdue', overdueFollowUps],
          ['Dr. Review Pending', doctorReviewPending, 'Dr. Review Completed', doctorReviewCompleted],
        ],
        theme: 'grid',
        headStyles: { fillColor: [0, 46, 99], textColor: 255 },
        styles: { fontSize: 8, cellPadding: 5 },
        columnStyles: { 0: { fontStyle: 'bold' }, 2: { fontStyle: 'bold' } },
        margin: { left: margin, right: margin },
      });

      autoTable(doc, {
        startY: (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY
          ? (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20
          : 220,
        head: [['Region', 'Status', 'Campaigns', 'Patients', 'Screenings', 'Target', 'Completed', 'Rate %', 'FU Done', 'FU Overdue']],
        body: rp.map((r) => [
          r.region,
          r.status,
          r.campaigns,
          r.patients,
          r.screenings,
          r.targetSurgeries,
          r.completed,
          r.completionRate,
          r.completedFollowUps,
          r.overdueFollowUps,
        ]),
        theme: 'striped',
        headStyles: { fillColor: [44, 153, 66], textColor: 255 },
        styles: { fontSize: 7, cellPadding: 4 },
        margin: { left: margin, right: margin },
      });

      doc.addPage();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(0, 46, 99);
      doc.text('Campaign Performance', margin, 42);

      autoTable(doc, {
        startY: 58,
        head: [['Campaign', 'Type', 'Region', 'Manager', 'Patients', 'Screenings', 'Target', 'Completed', 'Rate %', 'FU Done', 'FU Overdue']],
        body: campaigns.map((c) => {
          const cSurgeries = surgeries.filter((s) => s.campaignId === c.id);
          const cFollowUps = followUps.filter((fu) => fu.campaignId === c.id);
          const cDone = cSurgeries.filter((s) => s.status === 'Completed').length;
          return [
            c.name,
            c.type,
            c.region,
            c.projectManagerName,
            patients.filter((p) => p.campaignId === c.id).length,
            screenings.filter((s) => s.campaignId === c.id).length,
            c.targetSurgeries,
            cDone,
            completionRate(cDone, c.targetSurgeries),
            cFollowUps.filter((fu) => fu.status === 'Completed').length,
            cFollowUps.filter((fu) => fu.status === 'Overdue').length,
          ];
        }),
        theme: 'grid',
        headStyles: { fillColor: [0, 46, 99], textColor: 255 },
        styles: { fontSize: 7, cellPadding: 4, overflow: 'linebreak' },
        columnStyles: { 0: { cellWidth: 120 }, 1: { cellWidth: 80 }, 3: { cellWidth: 70 } },
        margin: { left: margin, right: margin },
      });

      autoTable(doc, {
        startY: (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY
          ? (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20
          : 300,
        head: [['Workflow Step', 'Count', '% of Registered']],
        body: [
          ['Registered', registered, registered ? '100%' : '0%'],
          ['Screened', screenings.length, registered ? `${Math.round((screenings.length / registered) * 100)}%` : '0%'],
          ['Surgery Booked', surgeriesScheduled + surgeriesInTheatre + surgeriesCompleted, registered ? `${Math.round(((surgeriesScheduled + surgeriesInTheatre + surgeriesCompleted) / registered) * 100)}%` : '0%'],
          ['Surgery Completed', surgeriesCompleted, registered ? `${Math.round((surgeriesCompleted / registered) * 100)}%` : '0%'],
          ['Follow-up Done', completedFollowUps, registered ? `${Math.round((completedFollowUps / registered) * 100)}%` : '0%'],
        ],
        theme: 'striped',
        headStyles: { fillColor: [44, 153, 66], textColor: 255 },
        styles: { fontSize: 8, cellPadding: 5 },
        margin: { left: margin, right: margin },
      });

      const pageCount = doc.getNumberOfPages();
      for (let page = 1; page <= pageCount; page += 1) {
        doc.setPage(page);
        doc.setFontSize(8);
        doc.setTextColor(100, 113, 132);
        doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 20, { align: 'right' });
      }

      const slug = effectiveRegion === 'all' ? 'all-regions' : effectiveRegion.toLowerCase().replace(/\s+/g, '-');
      doc.save(`eyecare-report-${slug}-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Could not export PDF report');
    } finally {
      setExportingPdf(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-[#647184]">Loading report data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Report header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#141920]">Reports</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#4B5666]">
            <span className="flex items-center gap-1">
              <MapPin size={11} />
              {effectiveRegion === 'all' ? 'All regions' : effectiveRegion}
            </span>
            <span>·</span>
            <span>{selectedCampaignName}</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <CalendarDays size={11} />
              {today}
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <UserCheck size={11} />
              {role}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={exportPdf}
            disabled={exportingPdf}
            variant="outline"
            className="gap-2 rounded-xl"
          >
            <Download size={15} />
            {exportingPdf ? 'Preparing...' : 'Download PDF'}
          </Button>
          <Button
            onClick={exportWorkbook}
            disabled={exporting}
            className="gap-2 rounded-xl bg-[#2C9942] text-white hover:bg-[#002E63]"
          >
            <Download size={15} />
            {exporting ? 'Preparing...' : 'Export Workbook'}
          </Button>
        </div>
      </div>

      {exportError && (
        <div className="rounded-xl border border-[#FACDCB] bg-[#FDECEB] px-4 py-2.5 text-sm text-[#E53935]">
          {exportError}
        </div>
      )}

      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {regionLocked ? (
          <div className="rounded-xl border border-[#DDE3EA] bg-[#F5F7FA] px-3 py-2.5">
            <p className="text-xs font-medium text-[#647184]">Assigned region (locked)</p>
            <p className="text-sm font-semibold text-[#141920]">{assignedRegion}</p>
          </div>
        ) : (
          <Select
            value={region}
            onValueChange={(v) => {
              if (v) { setRegion(v); setCampaignId('all'); }
            }}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="All regions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All regions</SelectItem>
              {availableRegions.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select
          value={campaignId}
          onValueChange={(v) => { if (v) setCampaignId(v); }}
        >
          <SelectTrigger className="rounded-xl">
            <SelectValue placeholder="All campaigns" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All campaigns</SelectItem>
            {availableCampaigns.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name} · {c.region}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Section: Executive Summary ─────────────────────────────────── */}
      <Section title="Executive Summary">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <KPI title="Campaigns" value={scoped?.campaignCount ?? 0} />
          <KPI title="Patients Registered" value={scoped?.patientCount ?? 0} />
          <KPI title="Screenings" value={scoped?.screeningCount ?? 0} />
          <KPI title="Surgery Target" value={scoped?.surgeryTarget ?? 0} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <KPI title="Surg. Scheduled" value={scoped?.surgeriesScheduled ?? 0} color="sage" />
          <KPI title="Surg. Completed" value={scoped?.surgeriesCompleted ?? 0} color="green" />
          <KPI
            title="Completion Rate"
            value={`${scoped?.surgeryCompletionRate ?? 0}%`}
            color={(scoped?.surgeryCompletionRate ?? 0) >= 75 ? 'green' : (scoped?.surgeryCompletionRate ?? 0) >= 25 ? 'amber' : 'red'}
          />
          <KPI
            title="Inactive Regions"
            value={agg?.inactiveRegions ?? 0}
            color={(agg?.inactiveRegions ?? 0) > 0 ? 'red' : 'green'}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <KPI title="Follow-ups Completed" value={scoped?.completedFollowUps ?? 0} color="green" />
          <KPI
            title="Follow-ups Overdue"
            value={scoped?.overdueFollowUps ?? 0}
            color={(scoped?.overdueFollowUps ?? 0) > 0 ? 'amber' : 'green'}
          />
          <KPI
            title="Dr. Review Pending"
            value={scoped?.doctorReviewPending ?? 0}
            color={(scoped?.doctorReviewPending ?? 0) > 0 ? 'amber' : 'green'}
          />
          <KPI title="Dr. Review Completed" value={scoped?.doctorReviewCompleted ?? 0} />
        </div>
        {scoped?.hasMedications && (
          <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <KPI title="Medications Prescribed" value={scoped.medications} />
          </div>
        )}
      </Section>

      {/* ── Section: Campaign Performance + Surgery Status ────────────── */}
      <Section title="Campaign Performance">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <Card className="border-0 shadow-sm xl:col-span-3">
            <CardHeader>
              <CardTitle className="text-sm text-[#141920]">
                Target vs Completed Surgeries by Region
              </CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              {regionPerformance.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={regionPerformance}
                    margin={{ left: 0, right: 8, top: 8, bottom: 40 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="region"
                      tickFormatter={shortRegion}
                      tick={{ fontSize: 10 }}
                      angle={-20}
                      textAnchor="end"
                      height={60}
                      interval={0}
                    />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v, name) => [
                        Number(v).toLocaleString(),
                        name === 'targetSurgeries' ? 'Target' : 'Completed',
                      ]}
                    />
                    <Legend
                      formatter={(v) => (v === 'targetSurgeries' ? 'Target' : 'Completed')}
                      iconType="square"
                    />
                    <Bar dataKey="targetSurgeries" fill="#A6DCB5" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="completed" fill="#2C9942" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart message="No campaign data" />
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm xl:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm text-[#141920]">Surgery Status</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              {(agg?.surgeryStatusData ?? []).length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={agg?.surgeryStatusData}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={80}
                      innerRadius={36}
                      paddingAngle={2}
                    >
                      {(agg?.surgeryStatusData ?? []).map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => [Number(v).toLocaleString(), 'Count']} />
                    <Legend iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart message="No surgery data" />
              )}
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* ── Section: Patient Workflow Funnel ──────────────────────────── */}
      <Section title="Patient Workflow Funnel">
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm text-[#141920]">
              Registered → Screened → Surgery → Follow-up
            </CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={agg?.funnelData ?? []}
                layout="vertical"
                margin={{ left: 8, right: 32, top: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="step" tick={{ fontSize: 11 }} width={116} />
                <Tooltip formatter={(v) => [Number(v).toLocaleString(), 'Patients']} />
                <Bar dataKey="count" fill="#2C9942" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Section>

      {/* ── Section: Follow-up & Doctor Review ───────────────────────── */}
      <Section title="Follow-up and Doctor Review">
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm text-[#141920]">Outcomes by Milestone</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {(scoped?.followUpCount ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={agg?.followUpByMilestone ?? []}
                  margin={{ left: 0, right: 8, top: 8, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="milestone" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend iconType="square" />
                  <Bar dataKey="Completed" fill="#2C9942" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Overdue" fill="#E53935" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Dr. Pending" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Dr. Completed" fill="#45B066" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="No follow-up data" />
            )}
          </CardContent>
        </Card>
      </Section>

      {/* ── Section: Region Comparison ────────────────────────────────── */}
      <Section title="Region Comparison">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-[#DDE3EA] bg-[#F5F7FA]">
                  <tr>
                    {[
                      'Region', 'Status', 'Campaigns', 'Target', 'Patients', 'Screened',
                      'Scheduled', 'In-Theatre', 'Completed', 'Rate',
                      'FU Done', 'FU Overdue', 'Dr. Pending', 'Dr. Done',
                    ].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#647184]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {regionPerformance.map((row) => (
                    <tr key={row.region} className="border-b border-[#EAEEF3] hover:bg-[#F5F7FA]">
                      <td className="px-4 py-3 font-medium text-[#141920]">{row.region}</td>
                      <td className="px-4 py-3"><StatusBadge status={row.status as RegionStatus} /></td>
                      <td className="px-4 py-3 text-[#4B5666]">{row.campaigns}</td>
                      <td className="px-4 py-3 text-[#4B5666]">{row.targetSurgeries}</td>
                      <td className="px-4 py-3 text-[#4B5666]">{row.patients}</td>
                      <td className="px-4 py-3 text-[#4B5666]">{row.screenings}</td>
                      <td className="px-4 py-3 text-[#4B5666]">{row.scheduled}</td>
                      <td className="px-4 py-3 text-[#4B5666]">{row.inTheatre}</td>
                      <td className="px-4 py-3 text-[#4B5666]">{row.completed}</td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${
                          row.completionRate >= 75 ? 'text-[#2C9942]' :
                          row.completionRate >= 25 ? 'text-[#F59E0B]' : 'text-[#E53935]'
                        }`}>{row.completionRate}%</span>
                      </td>
                      <td className="px-4 py-3 text-[#4B5666]">{row.completedFollowUps}</td>
                      <td className="px-4 py-3">
                        <span className={row.overdueFollowUps > 0 ? 'font-semibold text-[#E53935]' : 'text-[#4B5666]'}>
                          {row.overdueFollowUps}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={row.doctorReviewPending > 0 ? 'font-semibold text-[#F59E0B]' : 'text-[#4B5666]'}>
                          {row.doctorReviewPending}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#4B5666]">{row.doctorReviewCompleted}</td>
                    </tr>
                  ))}
                  {regionPerformance.length === 0 && (
                    <tr>
                      <td colSpan={14} className="px-4 py-8 text-center text-sm text-[#647184]">No region data</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* ── Section: Campaign Breakdown ───────────────────────────────── */}
      <Section title="Campaign Breakdown">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-[#DDE3EA] bg-[#F5F7FA]">
                  <tr>
                    {[
                      'Campaign', 'Type', 'Region', 'District', 'Manager', 'Status',
                      'Patients', 'Screened', 'Scheduled', 'Completed', 'Target', 'Rate',
                    ].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#647184]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(scoped?.campaigns ?? []).map((c) => {
                    const stats = agg?.campaignStats.find((cs) => cs.id === c.id);
                    const cRate = completionRate(stats?.completed ?? 0, c.targetSurgeries);
                    return (
                      <tr key={c.id} className="border-b border-[#EAEEF3] hover:bg-[#F5F7FA]">
                        <td className="px-4 py-3 font-medium text-[#141920]">{c.name}</td>
                        <td className="px-4 py-3 text-[#4B5666]">{c.type}</td>
                        <td className="px-4 py-3 text-[#4B5666]">{c.region}</td>
                        <td className="px-4 py-3 text-[#4B5666]">{c.operationDistrict}</td>
                        <td className="px-4 py-3 text-[#4B5666]">{c.projectManagerName}</td>
                        <td className="px-4 py-3"><CampaignStatusBadge status={c.status} /></td>
                        <td className="px-4 py-3 text-[#4B5666]">{stats?.patients ?? 0}</td>
                        <td className="px-4 py-3 text-[#4B5666]">{stats?.screenings ?? 0}</td>
                        <td className="px-4 py-3 text-[#4B5666]">{stats?.scheduled ?? 0}</td>
                        <td className="px-4 py-3 text-[#4B5666]">{stats?.completed ?? 0}</td>
                        <td className="px-4 py-3 text-[#4B5666]">{c.targetSurgeries}</td>
                        <td className="px-4 py-3">
                          <span className={`font-semibold ${
                            cRate >= 75 ? 'text-[#2C9942]' : cRate >= 25 ? 'text-[#F59E0B]' : 'text-[#E53935]'
                          }`}>{cRate}%</span>
                        </td>
                      </tr>
                    );
                  })}
                  {(scoped?.campaigns ?? []).length === 0 && (
                    <tr>
                      <td colSpan={12} className="px-4 py-8 text-center text-sm text-[#647184]">No campaigns</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </Section>
    </div>
  );
}

// ── Helper components ─────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#647184]">{title}</p>
      {children}
    </div>
  );
}

type KPIColor = 'default' | 'green' | 'red' | 'amber' | 'sage';

function KPI({ title, value, color = 'default' }: { title: string; value: number | string; color?: KPIColor }) {
  const valueColor: Record<KPIColor, string> = {
    default: 'text-[#141920]',
    green: 'text-[#2C9942]',
    red: 'text-[#E53935]',
    amber: 'text-[#F59E0B]',
    sage: 'text-[#4B5666]',
  };
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4">
        <p className="text-xs font-medium text-[#4B5666]">{title}</p>
        <p className={`mt-1 text-2xl font-bold ${valueColor[color]}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-xl bg-[#F5F7FA] text-sm text-[#647184]">
      {message}
    </div>
  );
}

function StatusBadge({ status }: { status: RegionStatus }) {
  const styles: Record<RegionStatus, string> = {
    'No campaign': 'bg-[#EAEEF3] text-[#4B5666]',
    'No activity': 'bg-[#FFF5E6] text-[#F59E0B]',
    Behind: 'bg-[#FDECEB] text-[#E53935]',
    Active: 'bg-[#EBF7EE] text-[#002E63]',
    Strong: 'bg-[#EBF7EE] text-[#2C9942]',
  };
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  );
}

function CampaignStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Planned: 'bg-[#EAEEF3] text-[#4B5666]',
    Active: 'bg-[#EBF7EE] text-[#2C9942]',
    Completed: 'bg-[#A6DCB5] text-[#002E63]',
    Suspended: 'bg-[#FDECEB] text-[#E53935]',
  };
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-medium ${styles[status] ?? 'bg-[#EAEEF3] text-[#4B5666]'}`}>
      {status}
    </span>
  );
}

function shortRegion(region: string) {
  return region.replace(' / Mogadishu', '').replace(' Somalia', '').replace(' State', '');
}

