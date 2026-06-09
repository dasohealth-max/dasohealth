import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  User, Campaign, Location, Patient, Screening,
  Surgery, Referral, FollowUp, InventoryItem,
  OutreachActivity, TransportJob, AuditLog,
} from '@/types';
import { uid } from '@/lib/utils';

// ─── Seed data ─────────────────────────────────────────────────────────────────

const NOW = new Date().toISOString();
const D = (offset: number) => {
  const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().split('T')[0];
};

const SEED_CAMPAIGNS: Campaign[] = [
  { id: 'c1', name: 'Rural Cataract Outreach 2025', type: 'Cataract', status: 'Active', startDate: '2025-01-01', endDate: '2025-12-31', budget: 150000, donors: 'WHO, Lions Club', targetScreenings: 2000, targetSurgeries: 800, targetFollowUps: 700, locationIds: ['l1','l2'], description: 'Mass cataract campaign in rural districts.', createdAt: NOW },
  { id: 'c2', name: 'School Vision 2025', type: 'School Eye Health', status: 'Active', startDate: '2025-03-01', endDate: '2025-11-30', budget: 60000, donors: 'USAID', targetScreenings: 5000, targetSurgeries: 50, targetFollowUps: 200, locationIds: ['l3'], description: 'School-based eye health programme.', createdAt: NOW },
  { id: 'c3', name: 'Diabetic Eye Q4', type: 'Diabetic Retinopathy', status: 'Planned', startDate: '2025-10-01', endDate: '2025-12-31', budget: 45000, donors: 'Private', targetScreenings: 800, targetSurgeries: 40, targetFollowUps: 150, locationIds: ['l2'], description: 'DR screening for diabetic patients.', createdAt: NOW },
];

const SEED_LOCATIONS: Location[] = [
  { id: 'l1', name: 'Mogadishu Central Eye Clinic', code: 'MOG-01', facilityType: 'Hospital', district: 'Banadir', region: 'Banadir', country: 'Somalia', lat: 2.0469, lng: 45.3182, phone: '+252 61 234 5678', createdAt: NOW },
  { id: 'l2', name: 'Hargeisa Regional Hospital', code: 'HRG-01', facilityType: 'Hospital', district: 'Hargeisa', region: 'Woqooyi Galbeed', country: 'Somalia', lat: 9.5600, lng: 44.0650, phone: '+252 63 111 2222', createdAt: NOW },
  { id: 'l3', name: 'Kismayo Mobile Unit', code: 'KIS-01', facilityType: 'Mobile Unit', district: 'Kismayo', region: 'Jubaland', country: 'Somalia', lat: -0.3582, lng: 42.5454, phone: '', createdAt: NOW },
  { id: 'l4', name: 'Bosaso Clinic', code: 'BOS-01', facilityType: 'Clinic', district: 'Bosaso', region: 'Puntland', country: 'Somalia', lat: 11.2841, lng: 49.1816, phone: '+252 90 333 4444', createdAt: NOW },
];

const SEED_PATIENTS: Patient[] = [
  { id: 'p1', patientCode: 'EC-2025-0001', fullName: 'Hodan Ali Omar', dateOfBirth: '1958-04-12', sex: 'Female', phone: '+252611234001', district: 'Banadir', region: 'Banadir', occupation: 'Farmer', education: 'Primary', disabilityStatus: 'Visual', insuranceStatus: 'None', emergencyContact: 'Ali Omar', emergencyPhone: '+252611234002', consentGiven: true, consentDate: '2025-01-15', campaignId: 'c1', locationId: 'l1', referralSource: 'CHW', notes: '', createdAt: NOW },
  { id: 'p2', patientCode: 'EC-2025-0002', fullName: 'Abdi Hassan Warsame', dateOfBirth: '1945-09-20', sex: 'Male', phone: '+252611234003', district: 'Hargeisa', region: 'Woqooyi Galbeed', occupation: 'Retired', education: 'None', disabilityStatus: 'None', insuranceStatus: 'None', emergencyContact: 'Faadumo Hassan', emergencyPhone: '+252611234004', consentGiven: true, consentDate: '2025-01-18', campaignId: 'c1', locationId: 'l2', referralSource: 'Self', notes: 'Bilateral cataracts', createdAt: NOW },
  { id: 'p3', patientCode: 'EC-2025-0003', fullName: 'Sahra Mohamud Idle', dateOfBirth: '1962-12-03', sex: 'Female', phone: '+252611234005', district: 'Kismayo', region: 'Jubaland', occupation: 'Housewife', education: 'Secondary', disabilityStatus: 'None', insuranceStatus: 'Government', emergencyContact: 'Mohamud Idle', emergencyPhone: '+252611234006', consentGiven: true, consentDate: '2025-02-01', campaignId: 'c1', locationId: 'l3', referralSource: 'Community Leader', notes: '', createdAt: NOW },
  { id: 'p4', patientCode: 'EC-2025-0004', fullName: 'Mahad Yusuf Dirie', dateOfBirth: '1978-06-15', sex: 'Male', phone: '+252611234007', district: 'Bosaso', region: 'Puntland', occupation: 'Teacher', education: 'University', disabilityStatus: 'None', insuranceStatus: 'Private', emergencyContact: 'Asho Dirie', emergencyPhone: '+252611234008', consentGiven: true, consentDate: '2025-02-10', campaignId: 'c2', locationId: 'l4', referralSource: 'School', notes: 'Myopia', createdAt: NOW },
  { id: 'p5', patientCode: 'EC-2025-0005', fullName: 'Ladan Ahmed Farah', dateOfBirth: '1950-03-22', sex: 'Female', phone: '+252611234009', district: 'Banadir', region: 'Banadir', occupation: 'Trader', education: 'None', disabilityStatus: 'Visual', insuranceStatus: 'None', emergencyContact: 'Ahmed Farah', emergencyPhone: '+252611234010', consentGiven: true, consentDate: '2025-02-20', campaignId: 'c1', locationId: 'l1', referralSource: 'CHW', notes: '', createdAt: NOW },
];

const SEED_SCREENINGS: Screening[] = [
  { id: 's1', patientId: 'p1', patientName: 'Hodan Ali Omar', campaignId: 'c1', locationId: 'l1', screenedBy: 'Dr. Sara Mohamed', screenedAt: '2025-01-16T09:00:00Z', vaRightUnaided: '6/60', vaLeftUnaided: '<6/60', iopRight: 14, iopLeft: 15, cataractSuspected: true, glaucomaSuspected: false, diabeticRetinopathy: false, otherFindings: '', medicalHistory: 'Hypertension', currentMedications: 'Amlodipine', recommendation: 'Refer for Surgery', notes: 'Mature cataract left eye', createdAt: NOW },
  { id: 's2', patientId: 'p2', patientName: 'Abdi Hassan Warsame', campaignId: 'c1', locationId: 'l2', screenedBy: 'Dr. Sara Mohamed', screenedAt: '2025-01-19T10:30:00Z', vaRightUnaided: '6/36', vaLeftUnaided: '6/24', iopRight: 12, iopLeft: 13, cataractSuspected: true, glaucomaSuspected: false, diabeticRetinopathy: false, otherFindings: '', medicalHistory: 'Diabetes', currentMedications: 'Metformin', recommendation: 'Refer for Surgery', notes: 'Bilateral early cataracts', createdAt: NOW },
  { id: 's3', patientId: 'p3', patientName: 'Sahra Mohamud Idle', campaignId: 'c1', locationId: 'l3', screenedBy: 'Fatima Abdi', screenedAt: '2025-02-02T08:00:00Z', vaRightUnaided: '6/9', vaLeftUnaided: '6/12', iopRight: 16, iopLeft: 15, cataractSuspected: false, glaucomaSuspected: false, diabeticRetinopathy: false, otherFindings: 'Mild pterygium', medicalHistory: 'None', currentMedications: 'None', recommendation: 'Glasses', notes: '', createdAt: NOW },
  { id: 's4', patientId: 'p4', patientName: 'Mahad Yusuf Dirie', campaignId: 'c2', locationId: 'l4', screenedBy: 'Fatima Abdi', screenedAt: '2025-02-11T11:00:00Z', vaRightUnaided: '6/18', vaLeftUnaided: '6/24', iopRight: 13, iopLeft: 14, cataractSuspected: false, glaucomaSuspected: false, diabeticRetinopathy: false, otherFindings: '', medicalHistory: 'None', currentMedications: 'None', recommendation: 'Glasses', notes: 'Myopia — needs correction', createdAt: NOW },
  { id: 's5', patientId: 'p5', patientName: 'Ladan Ahmed Farah', campaignId: 'c1', locationId: 'l1', screenedBy: 'Dr. Sara Mohamed', screenedAt: '2025-02-21T09:30:00Z', vaRightUnaided: '<6/60', vaLeftUnaided: '<6/60', iopRight: 22, iopLeft: 21, cataractSuspected: true, glaucomaSuspected: true, diabeticRetinopathy: false, otherFindings: 'Cup-disc ratio elevated', medicalHistory: 'None', currentMedications: 'None', recommendation: 'Refer for Surgery', notes: 'Possible glaucoma — urgent review', createdAt: NOW },
];

const SEED_SURGERIES: Surgery[] = [
  { id: 'sg1', patientId: 'p1', patientName: 'Hodan Ali Omar', campaignId: 'c1', locationId: 'l1', surgeonId: 'u2', surgeonName: 'Dr. Sara Mohamed', eye: 'Left', lensType: 'Foldable Acrylic', scheduledAt: '2025-02-01T08:00:00Z', performedAt: '2025-02-01T09:30:00Z', status: 'Completed', preOpVA: '<6/60', postOpVA: '6/12', complications: 'None', intraopNotes: 'Uncomplicated phaco', createdAt: NOW },
  { id: 'sg2', patientId: 'p2', patientName: 'Abdi Hassan Warsame', campaignId: 'c1', locationId: 'l2', surgeonId: 'u2', surgeonName: 'Dr. Sara Mohamed', eye: 'Right', lensType: 'PMMA', scheduledAt: D(3), status: 'Scheduled', preOpVA: '6/36', complications: '', intraopNotes: '', createdAt: NOW },
  { id: 'sg3', patientId: 'p5', patientName: 'Ladan Ahmed Farah', campaignId: 'c1', locationId: 'l1', surgeonId: 'u2', surgeonName: 'Dr. Sara Mohamed', eye: 'Both', lensType: 'Foldable Acrylic', scheduledAt: D(7), status: 'Scheduled', preOpVA: '<6/60', complications: '', intraopNotes: '', createdAt: NOW },
];

const SEED_REFERRALS: Referral[] = [
  { id: 'r1', patientName: 'Bile Abdi', patientPhone: '+252611001001', source: 'CHW', referredBy: 'Ahmed CHW', campaignId: 'c1', locationId: 'l1', status: 'Converted', referredAt: '2025-01-10', screenedAt: '2025-01-15', convertedAt: '2025-01-16', notes: '', createdAt: NOW },
  { id: 'r2', patientName: 'Faadumo Nur', patientPhone: '+252611001002', source: 'School', referredBy: 'Teacher Hassan', campaignId: 'c2', locationId: 'l3', status: 'Screened', referredAt: '2025-02-05', screenedAt: '2025-02-12', notes: '', createdAt: NOW },
  { id: 'r3', patientName: 'Omar Jama', patientPhone: '+252611001003', source: 'Self', referredBy: 'Self', campaignId: 'c1', locationId: 'l2', status: 'Contacted', referredAt: '2025-02-18', contactedAt: '2025-02-20', notes: 'Appointment set', createdAt: NOW },
  { id: 'r4', patientName: 'Halimo Duale', patientPhone: '+252611001004', source: 'CHW', referredBy: 'Fatima CHW', campaignId: 'c1', locationId: 'l1', status: 'Pending', referredAt: D(-1), notes: '', createdAt: NOW },
  { id: 'r5', patientName: 'Khadar Sheikh', patientPhone: '+252611001005', source: 'Facility', referredBy: 'PHC Banadir', campaignId: 'c1', locationId: 'l1', status: 'Lost', referredAt: '2025-01-20', contactedAt: '2025-01-22', notes: 'No show x3', createdAt: NOW },
];

const SEED_FOLLOWUPS: FollowUp[] = [
  { id: 'f1', patientId: 'p1', patientName: 'Hodan Ali Omar', surgeryId: 'sg1', campaignId: 'c1', milestone: 'Day 1', dueDate: '2025-02-02', completedAt: '2025-02-02T09:00:00Z', status: 'Completed', vaRightPost: '6/12', vaLeftPost: '6/18', complications: 'None', notes: 'Good recovery', smsReminderSent: true, createdAt: NOW },
  { id: 'f2', patientId: 'p1', patientName: 'Hodan Ali Omar', surgeryId: 'sg1', campaignId: 'c1', milestone: 'Week 1', dueDate: D(-2), status: 'Overdue', complications: '', notes: '', smsReminderSent: true, createdAt: NOW },
  { id: 'f3', patientId: 'p2', patientName: 'Abdi Hassan Warsame', surgeryId: 'sg2', campaignId: 'c1', milestone: 'Day 1', dueDate: D(4), status: 'Pending', complications: '', notes: '', smsReminderSent: false, createdAt: NOW },
  { id: 'f4', patientId: 'p5', patientName: 'Ladan Ahmed Farah', surgeryId: 'sg3', campaignId: 'c1', milestone: 'Day 1', dueDate: D(8), status: 'Pending', complications: '', notes: '', smsReminderSent: false, createdAt: NOW },
];

const SEED_INVENTORY: InventoryItem[] = [
  { id: 'i1', sku: 'IOL-FOLD-001', name: 'Foldable Acrylic IOL', category: 'IOL', quantity: 45, reorderLevel: 20, unit: 'pcs', expiryDate: '2026-06-30', supplier: 'Alcon', locationId: 'l1', notes: '', createdAt: NOW },
  { id: 'i2', sku: 'IOL-PMMA-001', name: 'PMMA IOL', category: 'IOL', quantity: 12, reorderLevel: 20, unit: 'pcs', expiryDate: '2026-12-31', supplier: 'Appasamy', locationId: 'l1', notes: 'LOW STOCK', createdAt: NOW },
  { id: 'i3', sku: 'MED-BSS-001', name: 'BSS (Balanced Salt Solution)', category: 'Medication', quantity: 80, reorderLevel: 30, unit: 'bottles', expiryDate: '2025-08-31', supplier: 'Alcon', locationId: 'l1', notes: '', createdAt: NOW },
  { id: 'i4', sku: 'EQP-SLIT-001', name: 'Slit Lamp', category: 'Equipment', quantity: 2, reorderLevel: 1, unit: 'units', supplier: 'Haag-Streit', locationId: 'l2', notes: '', createdAt: NOW },
  { id: 'i5', sku: 'CON-GLOV-001', name: 'Surgical Gloves (box)', category: 'Consumable', quantity: 8, reorderLevel: 10, unit: 'boxes', expiryDate: '2025-07-15', supplier: 'Local', locationId: 'l1', notes: '', createdAt: NOW },
];

const SEED_OUTREACH: OutreachActivity[] = [
  { id: 'o1', type: 'Community Meeting', title: 'Blindness Awareness — Banadir', date: '2025-01-10', locationId: 'l1', locationName: 'Mogadishu Central', campaignId: 'c1', reach: 350, conversions: 28, conductedBy: 'Ali Osman', notes: '', createdAt: NOW },
  { id: 'o2', type: 'Radio Broadcast', title: 'Eye Health Radio — Hargeisa FM', date: '2025-01-22', locationId: 'l2', locationName: 'Hargeisa Regional', campaignId: 'c1', reach: 5000, conversions: 65, conductedBy: 'Ali Osman', notes: '', createdAt: NOW },
  { id: 'o3', type: 'School Visit', title: 'Vision Screening — Primary Schools', date: '2025-02-14', locationId: 'l3', locationName: 'Kismayo Mobile Unit', campaignId: 'c2', reach: 420, conversions: 38, conductedBy: 'Fatima Abdi', notes: '', createdAt: NOW },
];

const SEED_TRANSPORT: TransportJob[] = [
  { id: 't1', patientId: 'p1', patientName: 'Hodan Ali Omar', vehicle: 'Toyota HiAce — SON 001', driver: 'Dahir Warsame', pickupLocation: 'Hodan District', dropLocation: 'Mogadishu Central Eye Clinic', scheduledAt: '2025-02-01T07:00:00Z', completedAt: '2025-02-01T08:00:00Z', cost: 15, status: 'Completed', notes: '', createdAt: NOW },
  { id: 't2', patientId: 'p2', patientName: 'Abdi Hassan Warsame', vehicle: 'Land Cruiser — SON 002', driver: 'Hassan Bile', pickupLocation: 'Sha\'ab District', dropLocation: 'Hargeisa Regional Hospital', scheduledAt: D(3) + 'T07:00:00Z', cost: 25, status: 'Scheduled', notes: '', createdAt: NOW },
];

const SEED_USERS: User[] = [
  { id: 'u1', name: 'Dr. Ahmed Hassan', email: 'admin@eyecare.org',   password: 'admin123',  role: 'Super Administrator', initials: 'AH', color: '#0d9488', active: true, createdAt: NOW },
  { id: 'u2', name: 'Dr. Sara Mohamed', email: 'dr.sara@eyecare.org', password: 'doctor123', role: 'Ophthalmologist',     initials: 'SM', color: '#6366f1', active: true, createdAt: NOW },
  { id: 'u3', name: 'Ali Osman',        email: 'pm@eyecare.org',       password: 'pm123',     role: 'Project Manager',     initials: 'AO', color: '#f59e0b', active: true, createdAt: NOW },
  { id: 'u4', name: 'Jane Smith',       email: 'donor@eyecare.org',    password: 'donor123',  role: 'Donor User',          initials: 'JS', color: '#ec4899', active: true, createdAt: NOW },
  { id: 'u5', name: 'Fatima Abdi',      email: 'nurse@eyecare.org',    password: 'nurse123',  role: 'Screening Officer',   initials: 'FA', color: '#8b5cf6', active: true, createdAt: NOW },
];

// ─── Store interface ────────────────────────────────────────────────────────────

interface AppState {
  campaigns: Campaign[];
  locations: Location[];
  patients: Patient[];
  screenings: Screening[];
  surgeries: Surgery[];
  referrals: Referral[];
  followUps: FollowUp[];
  inventory: InventoryItem[];
  outreach: OutreachActivity[];
  transport: TransportJob[];
  users: User[];
  auditLogs: AuditLog[];

  // Campaign
  addCampaign: (c: Campaign) => void;
  updateCampaign: (c: Campaign) => void;
  deleteCampaign: (id: string) => void;

  // Location
  addLocation: (l: Location) => void;
  updateLocation: (l: Location) => void;
  deleteLocation: (id: string) => void;

  // Patient
  addPatient: (p: Patient) => void;
  updatePatient: (p: Patient) => void;
  deletePatient: (id: string) => void;

  // Screening
  addScreening: (s: Screening) => void;
  updateScreening: (s: Screening) => void;
  deleteScreening: (id: string) => void;

  // Surgery
  addSurgery: (s: Surgery) => void;
  updateSurgery: (s: Surgery) => void;
  deleteSurgery: (id: string) => void;

  // Referral
  addReferral: (r: Referral) => void;
  updateReferral: (r: Referral) => void;
  deleteReferral: (id: string) => void;

  // Follow-up
  addFollowUp: (f: FollowUp) => void;
  updateFollowUp: (f: FollowUp) => void;
  deleteFollowUp: (id: string) => void;
  checkOverdueFollowUps: () => void;

  // Inventory
  addInventoryItem: (i: InventoryItem) => void;
  updateInventoryItem: (i: InventoryItem) => void;
  deleteInventoryItem: (id: string) => void;

  // Outreach
  addOutreach: (o: OutreachActivity) => void;
  updateOutreach: (o: OutreachActivity) => void;
  deleteOutreach: (id: string) => void;

  // Transport
  addTransport: (t: TransportJob) => void;
  updateTransport: (t: TransportJob) => void;
  deleteTransport: (id: string) => void;

  // Users
  addUser: (u: User) => void;
  updateUser: (u: User) => void;
  deleteUser: (id: string) => void;

  // Audit
  addAuditLog: (l: AuditLog) => void;

  // Danger Zone
  resetStore: (keepUserId: string) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      campaigns: SEED_CAMPAIGNS,
      locations: SEED_LOCATIONS,
      patients: SEED_PATIENTS,
      screenings: SEED_SCREENINGS,
      surgeries: SEED_SURGERIES,
      referrals: SEED_REFERRALS,
      followUps: SEED_FOLLOWUPS,
      inventory: SEED_INVENTORY,
      outreach: SEED_OUTREACH,
      transport: SEED_TRANSPORT,
      users: SEED_USERS,
      auditLogs: [],

      addCampaign: (c) => set((s) => ({ campaigns: [...s.campaigns, c] })),
      updateCampaign: (c) => set((s) => ({ campaigns: s.campaigns.map((x) => x.id === c.id ? c : x) })),
      deleteCampaign: (id) => set((s) => ({ campaigns: s.campaigns.filter((x) => x.id !== id) })),

      addLocation: (l) => set((s) => ({ locations: [...s.locations, l] })),
      updateLocation: (l) => set((s) => ({ locations: s.locations.map((x) => x.id === l.id ? l : x) })),
      deleteLocation: (id) => set((s) => ({ locations: s.locations.filter((x) => x.id !== id) })),

      addPatient: (p) => set((s) => ({ patients: [...s.patients, p] })),
      updatePatient: (p) => set((s) => ({ patients: s.patients.map((x) => x.id === p.id ? p : x) })),
      deletePatient: (id) => set((s) => ({ patients: s.patients.filter((x) => x.id !== id) })),

      addScreening: (sc) => set((s) => ({ screenings: [...s.screenings, sc] })),
      updateScreening: (sc) => set((s) => ({ screenings: s.screenings.map((x) => x.id === sc.id ? sc : x) })),
      deleteScreening: (id) => set((s) => ({ screenings: s.screenings.filter((x) => x.id !== id) })),

      addSurgery: (sg) => set((s) => ({ surgeries: [...s.surgeries, sg] })),
      updateSurgery: (sg) => set((s) => {
        const updatedSurgeries = s.surgeries.map((x) => x.id === sg.id ? sg : x);

        // Only auto-create follow-ups when transitioning to Completed
        if (sg.status !== 'Completed') return { surgeries: updatedSurgeries };

        // Idempotency guard — skip if follow-ups already exist for this surgery
        if (s.followUps.some((f) => f.surgeryId === sg.id)) return { surgeries: updatedSurgeries };

        const base = sg.performedAt ? new Date(sg.performedAt) : new Date();
        const addDays = (days: number) => {
          const d = new Date(base);
          d.setDate(d.getDate() + days);
          return d.toISOString().split('T')[0];
        };

        const now = new Date().toISOString();
        const milestones = [
          { milestone: 'Day 1'   as const, days: 1  },
          { milestone: 'Week 1'  as const, days: 7  },
          { milestone: 'Month 1' as const, days: 30 },
          { milestone: 'Month 3' as const, days: 90 },
        ];

        const newFollowUps: FollowUp[] = milestones.map(({ milestone, days }) => ({
          id: uid(),
          patientId: sg.patientId,
          patientName: sg.patientName,
          surgeryId: sg.id,
          campaignId: sg.campaignId,
          milestone,
          dueDate: addDays(days),
          status: 'Pending' as const,
          complications: '',
          notes: '',
          smsReminderSent: false,
          createdAt: now,
        }));

        let actor = 'System';
        try {
          if (typeof window !== 'undefined') {
            actor = JSON.parse(localStorage.getItem('ec_user') ?? 'null')?.name ?? 'System';
          }
        } catch { /* ignore */ }

        const auditEntry: AuditLog = {
          id: uid(),
          actor,
          action: 'auto-created follow-ups',
          entity: 'FollowUp',
          entityId: sg.id,
          details: `4 post-op follow-ups created for surgery ${sg.id} (${sg.patientName})`,
          createdAt: now,
        };

        return {
          surgeries: updatedSurgeries,
          followUps: [...s.followUps, ...newFollowUps],
          auditLogs: [auditEntry, ...s.auditLogs].slice(0, 500),
        };
      }),
      deleteSurgery: (id) => set((s) => ({ surgeries: s.surgeries.filter((x) => x.id !== id) })),

      addReferral: (r) => set((s) => ({ referrals: [...s.referrals, r] })),
      updateReferral: (r) => set((s) => ({ referrals: s.referrals.map((x) => x.id === r.id ? r : x) })),
      deleteReferral: (id) => set((s) => ({ referrals: s.referrals.filter((x) => x.id !== id) })),

      addFollowUp: (f) => set((s) => ({ followUps: [...s.followUps, f] })),
      updateFollowUp: (f) => set((s) => ({ followUps: s.followUps.map((x) => x.id === f.id ? f : x) })),
      deleteFollowUp: (id) => set((s) => ({ followUps: s.followUps.filter((x) => x.id !== id) })),
      checkOverdueFollowUps: () => set((s) => {
        const today = new Date().toISOString().split('T')[0];
        let changed = false;
        const followUps = s.followUps.map((f) => {
          if ((f.status === 'Pending' || f.status === 'Due') && f.dueDate < today) {
            changed = true;
            return { ...f, status: 'Overdue' as const };
          }
          return f;
        });
        return changed ? { followUps } : {};
      }),

      addInventoryItem: (i) => set((s) => ({ inventory: [...s.inventory, i] })),
      updateInventoryItem: (i) => set((s) => ({ inventory: s.inventory.map((x) => x.id === i.id ? i : x) })),
      deleteInventoryItem: (id) => set((s) => ({ inventory: s.inventory.filter((x) => x.id !== id) })),

      addOutreach: (o) => set((s) => ({ outreach: [...s.outreach, o] })),
      updateOutreach: (o) => set((s) => ({ outreach: s.outreach.map((x) => x.id === o.id ? o : x) })),
      deleteOutreach: (id) => set((s) => ({ outreach: s.outreach.filter((x) => x.id !== id) })),

      addTransport: (t) => set((s) => ({ transport: [...s.transport, t] })),
      updateTransport: (t) => set((s) => ({ transport: s.transport.map((x) => x.id === t.id ? t : x) })),
      deleteTransport: (id) => set((s) => ({ transport: s.transport.filter((x) => x.id !== id) })),

      addUser: (u) => set((s) => ({ users: [...s.users, u] })),
      updateUser: (u) => set((s) => ({ users: s.users.map((x) => x.id === u.id ? u : x) })),
      deleteUser: (id) => set((s) => ({ users: s.users.filter((x) => x.id !== id) })),

      addAuditLog: (l) => set((s) => ({ auditLogs: [l, ...s.auditLogs].slice(0, 500) })),

      resetStore: (keepUserId) => set((s) => ({
        campaigns: [],
        locations: [],
        patients: [],
        screenings: [],
        surgeries: [],
        referrals: [],
        followUps: [],
        inventory: [],
        outreach: [],
        transport: [],
        auditLogs: [],
        users: s.users.filter((u) => u.id === keepUserId),
      })),
    }),
    {
      name: 'eyecare-store-v1',
      version: 2,
      // v2 migration: backfill passwords + update old role names
      migrate: (state: unknown, version: number) => {
        const s = state as Record<string, unknown>;
        if (version < 2) {
          // Default passwords for the original seed accounts
          const DEFAULT_PASSWORDS: Record<string, string> = {
            'admin@eyecare.org':   'admin123',
            'dr.sara@eyecare.org': 'doctor123',
            'pm@eyecare.org':      'pm123',
            'donor@eyecare.org':   'donor123',
            'nurse@eyecare.org':   'nurse123',
          };
          // Old role name → new role name
          const ROLE_MAP: Record<string, string> = {
            'Super Admin':    'Super Administrator',
            'Org Admin':      'Super Administrator',
            'Screening Team': 'Screening Officer',
            'Hospital Admin': 'Hospital Coordinator',
            'CHW':            'Outreach Officer',
            'Donor':          'Donor User',
          };
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          s.users = ((s.users as any[]) || []).map((u: any) => ({
            ...u,
            password: u.password || DEFAULT_PASSWORDS[u.email] || '',
            role: ROLE_MAP[u.role] ?? u.role,
          }));
        }
        return s;
      },
    }
  )
);
