export type Role =
  | 'Super Administrator'
  | 'Project Manager'
  | 'Data Clerk'
  | 'Screening Officer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  assignedRegion?: string;
  initials: string;
  color: string;
  active: boolean;
  createdAt: string;
}

export type CampaignType =
  | 'Cataract Surgery Outreach'
  | 'Eye Vision Outreach'
  | 'General Eye Screening'
  | 'Mixed Outreach'
  | 'Cataract'
  | 'School Eye Health'
  | 'Diabetic Retinopathy'
  | 'Glaucoma'
  | 'General';
export type CampaignStatus = 'Planned' | 'Active' | 'Completed' | 'Suspended';
export type RegionalPlanStatus = 'On Track' | 'Behind' | 'Completed' | 'Suspended';

export interface CampaignRegion {
  id: string;
  campaignId: string;
  type: CampaignType;
  region: string;
  operationDistrict: string;
  regionalManagerId: string;
  regionalManagerName: string;
  targetPatients: number;
  targetScreenings: number;
  targetSurgeries: number;
  startDate: string;
  endDate: string;
  status: RegionalPlanStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  region: string;
  operationDistrict: string;
  projectManagerId: string;
  projectManagerName: string;
  startDate: string;
  endDate: string;
  budget: number;
  donors: string;
  targetScreenings: number;
  targetSurgeries: number;
  targetFollowUps: number;
  description: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  regions?: CampaignRegion[];
}

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
  operationDistrict: string;
  occupation?: string;
  education?: string;
  disabilityStatus: DisabilityStatus;
  insuranceStatus: string;
  emergencyContact: string;
  emergencyPhone: string;
  consentGiven: boolean;
  consentDate: string;
  campaignId?: string;
  campaignRegionId?: string;
  referralSource: string;
  notes?: string;
  registeredById: string;
  registeredByName: string;
  screeningStatus: 'Awaiting Screening' | 'Screened';
  createdAt: string;
}

export type VAGrade = '6/6' | '6/9' | '6/12' | '6/18' | '6/24' | '6/36' | '6/60' | '<6/60' | 'CF' | 'HM' | 'PL' | 'NPL';

export interface Screening {
  id: string;
  patientId: string;
  patientName: string;
  campaignId: string;
  campaignRegionId?: string;
  region: string;
  operationDistrict: string;
  screenedBy: string;
  screenedById: string;
  screenedByName: string;
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
  recommendation: 'Discharge' | 'Refer for Surgery' | 'Positive' | 'Further Investigation' | 'Glasses' | 'Follow-up';
  notes: string;
  createdAt: string;
}

export type SurgeryEye = 'Right' | 'Left' | 'Both';
export type LensType = 'PMMA' | 'Foldable Acrylic' | 'Hydrophilic' | 'Hydrophobic';
export type SurgeryStatus = 'Scheduled' | 'Completed' | 'Cancelled' | 'Postponed';

export interface Surgery {
  id: string;
  patientId: string;
  patientName: string;
  campaignId: string;
  campaignRegionId?: string;
  region: string;
  operationDistrict: string;
  createdFromScreeningId?: string;
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
  completedById: string;
  completedByName: string;
  createdAt: string;
}

export type FollowUpMilestone = 'Day 1' | 'Week 1' | 'Month 1' | 'Month 3';
export type FollowUpStatus = 'Pending' | 'Due' | 'Overdue' | 'Completed' | 'Missed';
export type DoctorReviewStatus = 'Not Needed' | 'Pending' | 'Completed';
export type MedicationStatus = 'Prescribed' | 'Taking' | 'Completed' | 'Stopped';

export interface FollowUp {
  id: string;
  patientId: string;
  patientName: string;
  surgeryId: string;
  campaignId: string;
  campaignRegionId?: string;
  region: string;
  milestone: FollowUpMilestone;
  dueDate: string;
  completedAt?: string;
  status: FollowUpStatus;
  vaRightPost?: string;
  vaLeftPost?: string;
  complications: string;
  notes: string;
  needsDoctorReview: boolean;
  doctorReviewStatus: DoctorReviewStatus;
  doctorReviewedAt?: string;
  doctorName: string;
  doctorDiagnosis: string;
  doctorTreatmentPlan: string;
  doctorNotes: string;
  nextAppointmentDate?: string;
  completedById: string;
  completedByName: string;
  createdAt: string;
}

export interface FollowUpMedication {
  id: string;
  followUpId: string;
  drugName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  status: MedicationStatus;
  notes: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actor: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  entity: string;
  entityId: string;
  region?: string;
  campaignId?: string;
  details: string;
  before?: unknown;
  after?: unknown;
  createdAt: string;
}
