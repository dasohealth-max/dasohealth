// Bidirectional maps between Prisma TypeScript enum keys and app display strings.
// Prisma uses camelCase keys; the DB (and app types) use display strings with spaces/hyphens.

// ─── CampaignType ─────────────────────────────────────────────────────────────
const CT_TO_APP: Record<string, string> = {
  Cataract: 'Cataract', SchoolEyeHealth: 'School Eye Health',
  DiabeticRetinopathy: 'Diabetic Retinopathy', Glaucoma: 'Glaucoma', General: 'General',
};
const CT_FROM_APP: Record<string, string> = Object.fromEntries(Object.entries(CT_TO_APP).map(([k, v]) => [v, k]));
export const campaignTypeToApp = (k: string) => CT_TO_APP[k] ?? k;
export const campaignTypeFromApp = (v: string) => CT_FROM_APP[v] ?? v;

// ─── FacilityType ─────────────────────────────────────────────────────────────
const FT_TO_APP: Record<string, string> = {
  Hospital: 'Hospital', Clinic: 'Clinic', MobileUnit: 'Mobile Unit',
  School: 'School', CommunityCentre: 'Community Centre',
};
const FT_FROM_APP: Record<string, string> = Object.fromEntries(Object.entries(FT_TO_APP).map(([k, v]) => [v, k]));
export const facilityTypeToApp = (k: string) => FT_TO_APP[k] ?? k;
export const facilityTypeFromApp = (v: string) => FT_FROM_APP[v] ?? v;

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
  Day1: 'Day 1', Week1: 'Week 1', Month1: 'Month 1', Month3: 'Month 3',
};
const FM_FROM_APP: Record<string, string> = Object.fromEntries(Object.entries(FM_TO_APP).map(([k, v]) => [v, k]));
export const followUpMilestoneToApp = (k: string) => FM_TO_APP[k] ?? k;
export const followUpMilestoneFromApp = (v: string) => FM_FROM_APP[v] ?? v;

// ─── ReferralSource ───────────────────────────────────────────────────────────
const RS_TO_APP: Record<string, string> = {
  CHW: 'CHW', Volunteer: 'Volunteer', School: 'School',
  Facility: 'Facility', Self: 'Self', CommunityLeader: 'Community Leader',
};
const RS_FROM_APP: Record<string, string> = Object.fromEntries(Object.entries(RS_TO_APP).map(([k, v]) => [v, k]));
export const referralSourceToApp = (k: string) => RS_TO_APP[k] ?? k;
export const referralSourceFromApp = (v: string) => RS_FROM_APP[v] ?? v;

// ─── OutreachType ─────────────────────────────────────────────────────────────
const OT_TO_APP: Record<string, string> = {
  AwarenessCampaign: 'Awareness Campaign', CommunityMeeting: 'Community Meeting',
  RadioBroadcast: 'Radio Broadcast', SchoolVisit: 'School Visit',
  HealthFair: 'Health Fair', CHWTraining: 'CHW Training',
};
const OT_FROM_APP: Record<string, string> = Object.fromEntries(Object.entries(OT_TO_APP).map(([k, v]) => [v, k]));
export const outreachTypeToApp = (k: string) => OT_TO_APP[k] ?? k;
export const outreachTypeFromApp = (v: string) => OT_FROM_APP[v] ?? v;

// ─── TransportStatus ──────────────────────────────────────────────────────────
const TS_TO_APP: Record<string, string> = {
  Scheduled: 'Scheduled', InTransit: 'In-Transit', Completed: 'Completed', Cancelled: 'Cancelled',
};
const TS_FROM_APP: Record<string, string> = Object.fromEntries(Object.entries(TS_TO_APP).map(([k, v]) => [v, k]));
export const transportStatusToApp = (k: string) => TS_TO_APP[k] ?? k;
export const transportStatusFromApp = (v: string) => TS_FROM_APP[v] ?? v;
