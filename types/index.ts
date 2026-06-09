// ─── Core domain types ────────────────────────────────────────────────────────

export type Role =
  | 'Super Administrator'
  | 'Project Manager'
  | 'Campaign Manager'
  | 'Hospital Coordinator'
  | 'Data Clerk'
  | 'Screening Officer'
  | 'Ophthalmologist'
  | 'Surgeon'
  | 'Follow-Up Officer'
  | 'Outreach Officer'
  | 'Logistics Officer'
  | 'Inventory Officer'
  | 'MEAL Officer'
  | 'Finance Officer'
  | 'Donor User';

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  initials: string;
  color: string;
  active: boolean;
  createdAt: string;
}

export interface Organisation {
  id: string;
  name: string;
  country: string;
  region: string;
  logo?: string;
  createdAt: string;
}

// ─── Campaign ─────────────────────────────────────────────────────────────────

export type CampaignType = 'Cataract' | 'School Eye Health' | 'Diabetic Retinopathy' | 'Glaucoma' | 'General';
export type CampaignStatus = 'Planned' | 'Active' | 'Completed' | 'Suspended';

export interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  startDate: string;
  endDate: string;
  budget: number;
  donors: string;
  targetScreenings: number;
  targetSurgeries: number;
  targetFollowUps: number;
  locationIds: string[];
  description: string;
  createdAt: string;
}

// ─── Location ─────────────────────────────────────────────────────────────────

export type FacilityType = 'Hospital' | 'Clinic' | 'Mobile Unit' | 'School' | 'Community Centre';

export interface Location {
  id: string;
  name: string;
  code: string;
  facilityType: FacilityType;
  district: string;
  region: string;
  country: string;
  lat: number;
  lng: number;
  phone?: string;
  createdAt: string;
}

// ─── Patient ──────────────────────────────────────────────────────────────────

export type Sex = 'Male' | 'Female' | 'Other';
export type DisabilityStatus = 'None' | 'Visual' | 'Hearing' | 'Mobility' | 'Cognitive' | 'Multiple';

export interface Patient {
  id: string;
  patientCode: string;
  fullName: string;
  dateOfBirth: string;
  sex: Sex;
  phone: string;
  email?: string;
  district: string;
  region: string;
  occupation?: string;
  education?: string;
  disabilityStatus: DisabilityStatus;
  insuranceStatus: string;
  emergencyContact: string;
  emergencyPhone: string;
  consentGiven: boolean;
  consentDate: string;
  campaignId?: string;
  locationId?: string;
  referralSource: string;
  notes?: string;
  lat?: number;
  lng?: number;
  createdAt: string;
}

// ─── Screening ────────────────────────────────────────────────────────────────

export type VAGrade = '6/6' | '6/9' | '6/12' | '6/18' | '6/24' | '6/36' | '6/60' | '<6/60' | 'CF' | 'HM' | 'PL' | 'NPL';

export interface Screening {
  id: string;
  patientId: string;
  patientName: string;
  campaignId: string;
  locationId: string;
  screenedBy: string;
  screenedAt: string;
  vaRightUnaided: VAGrade;
  vaLeftUnaided: VAGrade;
  vaRightCorrected?: VAGrade;
  vaLeftCorrected?: VAGrade;
  iopRight?: number;
  iopLeft?: number;
  cataractSuspected: boolean;
  glaucomaSuspected: boolean;
  diabeticRetinopathy: boolean;
  otherFindings: string;
  medicalHistory: string;
  currentMedications: string;
  recommendation: 'Discharge' | 'Refer for Surgery' | 'Further Investigation' | 'Glasses' | 'Follow-up';
  notes: string;
  createdAt: string;
}

// ─── Surgery ──────────────────────────────────────────────────────────────────

export type SurgeryEye = 'Right' | 'Left' | 'Both';
export type LensType = 'PMMA' | 'Foldable Acrylic' | 'Hydrophilic' | 'Hydrophobic';
export type SurgeryStatus = 'Scheduled' | 'In-Theatre' | 'Completed' | 'Cancelled' | 'Postponed';

export interface Surgery {
  id: string;
  patientId: string;
  patientName: string;
  campaignId: string;
  locationId: string;
  surgeonId: string;
  surgeonName: string;
  eye: SurgeryEye;
  lensType: LensType;
  scheduledAt: string;
  performedAt?: string;
  status: SurgeryStatus;
  preOpVA: string;
  postOpVA?: string;
  complications: string;
  intraopNotes: string;
  createdAt: string;
}

// ─── Referral ─────────────────────────────────────────────────────────────────

export type ReferralSource = 'CHW' | 'Volunteer' | 'School' | 'Facility' | 'Self' | 'Community Leader';
export type ReferralStatus = 'Pending' | 'Contacted' | 'Screened' | 'Converted' | 'Lost';

export interface Referral {
  id: string;
  screeningId?: string;       // links back to the originating Screening record
  patientName: string;
  patientPhone: string;
  source: ReferralSource;
  referredBy: string;
  campaignId: string;
  locationId: string;
  status: ReferralStatus;
  referredAt: string;
  contactedAt?: string;
  screenedAt?: string;
  convertedAt?: string;
  notes: string;
  createdAt: string;
}

// ─── Follow-up ────────────────────────────────────────────────────────────────

export type FollowUpMilestone = 'Day 1' | 'Week 1' | 'Month 1' | 'Month 3';
export type FollowUpStatus = 'Pending' | 'Due' | 'Overdue' | 'Completed' | 'Missed';

export interface FollowUp {
  id: string;
  patientId: string;
  patientName: string;
  surgeryId: string;
  campaignId: string;
  milestone: FollowUpMilestone;
  dueDate: string;
  completedAt?: string;
  status: FollowUpStatus;
  vaRightPost?: string;
  vaLeftPost?: string;
  complications: string;
  notes: string;
  smsReminderSent: boolean;
  createdAt: string;
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export type InventoryCategory = 'IOL' | 'Medication' | 'Equipment' | 'Consumable' | 'PPE';

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: InventoryCategory;
  quantity: number;
  reorderLevel: number;
  unit: string;
  expiryDate?: string;
  supplier: string;
  locationId: string;
  notes: string;
  createdAt: string;
}

// ─── Outreach ─────────────────────────────────────────────────────────────────

export type OutreachType = 'Awareness Campaign' | 'Community Meeting' | 'Radio Broadcast' | 'School Visit' | 'Health Fair' | 'CHW Training';

export interface OutreachActivity {
  id: string;
  type: OutreachType;
  title: string;
  date: string;
  locationId: string;
  locationName: string;
  campaignId: string;
  reach: number;
  conversions: number;
  conductedBy: string;
  notes: string;
  createdAt: string;
}

// ─── Transport ────────────────────────────────────────────────────────────────

export type TransportStatus = 'Scheduled' | 'In-Transit' | 'Completed' | 'Cancelled';

export interface TransportJob {
  id: string;
  patientId: string;
  patientName: string;
  vehicle: string;
  driver: string;
  pickupLocation: string;
  dropLocation: string;
  scheduledAt: string;
  completedAt?: string;
  cost: number;
  status: TransportStatus;
  notes: string;
  createdAt: string;
}

// ─── Audit log ────────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
  createdAt: string;
}
