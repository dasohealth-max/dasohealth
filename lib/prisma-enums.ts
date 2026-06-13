// Bidirectional maps between Prisma TypeScript enum keys and app display strings.

// ─── CampaignType ─────────────────────────────────────────────────────────────
const CT_TO_APP: Record<string, string> = {
  Cataract: 'Cataract', SchoolEyeHealth: 'School Eye Health',
  DiabeticRetinopathy: 'Diabetic Retinopathy', Glaucoma: 'Glaucoma', General: 'General',
};
const CT_FROM_APP: Record<string, string> = Object.fromEntries(Object.entries(CT_TO_APP).map(([k, v]) => [v, k]));
export const campaignTypeToApp = (k: string) => CT_TO_APP[k] ?? k;
export const campaignTypeFromApp = (v: string) => CT_FROM_APP[v] ?? v;

// ─── VaGrade ──────────────────────────────────────────────────────────────────
const VA_TO_APP: Record<string, string> = {
  V6_6: '6/6', V6_9: '6/9', V6_12: '6/12', V6_18: '6/18',
  V6_24: '6/24', V6_36: '6/36', V6_60: '6/60', LT6_60: '<6/60',
  CF: 'CF', HM: 'HM', PL: 'PL', NPL: 'NPL',
};
const VA_FROM_APP: Record<string, string> = Object.fromEntries(Object.entries(VA_TO_APP).map(([k, v]) => [v, k]));
export const vaGradeToApp = (k: string) => VA_TO_APP[k] ?? k;
export const vaGradeFromApp = (v: string) => VA_FROM_APP[v] ?? v;

// ─── ScreeningRecommendation ──────────────────────────────────────────────────
const SR_TO_APP: Record<string, string> = {
  Discharge: 'Discharge', ReferForSurgery: 'Refer for Surgery',
  FurtherInvestigation: 'Further Investigation', Glasses: 'Glasses', FollowUp: 'Follow-up',
};
const SR_FROM_APP: Record<string, string> = Object.fromEntries(Object.entries(SR_TO_APP).map(([k, v]) => [v, k]));
export const screeningRecToApp = (k: string) => SR_TO_APP[k] ?? k;
export const screeningRecFromApp = (v: string) => SR_FROM_APP[v] ?? v;

// ─── SurgeryStatus ────────────────────────────────────────────────────────────
const SS_TO_APP: Record<string, string> = {
  Scheduled: 'Scheduled', InTheatre: 'In-Theatre', Completed: 'Completed',
  Cancelled: 'Cancelled', Postponed: 'Postponed',
};
const SS_FROM_APP: Record<string, string> = Object.fromEntries(Object.entries(SS_TO_APP).map(([k, v]) => [v, k]));
export const surgeryStatusToApp = (k: string) => SS_TO_APP[k] ?? k;
export const surgeryStatusFromApp = (v: string) => SS_FROM_APP[v] ?? v;

// ─── LensType ─────────────────────────────────────────────────────────────────
const LT_TO_APP: Record<string, string> = {
  PMMA: 'PMMA', FoldableAcrylic: 'Foldable Acrylic',
  Hydrophilic: 'Hydrophilic', Hydrophobic: 'Hydrophobic',
};
const LT_FROM_APP: Record<string, string> = Object.fromEntries(Object.entries(LT_TO_APP).map(([k, v]) => [v, k]));
export const lensTypeToApp = (k: string) => LT_TO_APP[k] ?? k;
export const lensTypeFromApp = (v: string) => LT_FROM_APP[v] ?? v;

// ─── FollowUpMilestone ────────────────────────────────────────────────────────
const FM_TO_APP: Record<string, string> = {
  Day1: 'Day 1', Week1: 'Week 1',
};
const FM_FROM_APP: Record<string, string> = Object.fromEntries(Object.entries(FM_TO_APP).map(([k, v]) => [v, k]));
export const followUpMilestoneToApp = (k: string) => FM_TO_APP[k] ?? k;
export const followUpMilestoneFromApp = (v: string) => FM_FROM_APP[v] ?? v;
