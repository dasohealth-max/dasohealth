import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  User, InventoryItem, OutreachActivity, TransportJob, AuditLog,
} from '@/types';

// ─── Seed data ─────────────────────────────────────────────────────────────────

const NOW = new Date().toISOString();
const D = (offset: number) => {
  const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().split('T')[0];
};

const SEED_USERS: User[] = [
  { id: 'u1', name: 'Dr. Ahmed Hassan', email: 'admin@eyecare.org',   role: 'Super Administrator', initials: 'AH', color: '#0d9488', active: true, createdAt: NOW },
  { id: 'u2', name: 'Dr. Sara Mohamed', email: 'dr.sara@eyecare.org', role: 'Ophthalmologist',     initials: 'SM', color: '#6366f1', active: true, createdAt: NOW },
  { id: 'u3', name: 'Ali Osman',        email: 'pm@eyecare.org',       role: 'Project Manager',     initials: 'AO', color: '#f59e0b', active: true, createdAt: NOW },
  { id: 'u4', name: 'Jane Smith',       email: 'donor@eyecare.org',    role: 'Donor User',          initials: 'JS', color: '#ec4899', active: true, createdAt: NOW },
  { id: 'u5', name: 'Fatima Abdi',      email: 'nurse@eyecare.org',    role: 'Screening Officer',   initials: 'FA', color: '#8b5cf6', active: true, createdAt: NOW },
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

// ─── Store interface ────────────────────────────────────────────────────────────

interface AppState {
  inventory: InventoryItem[];
  outreach: OutreachActivity[];
  transport: TransportJob[];
  users: User[];
  auditLogs: AuditLog[];

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
      inventory: SEED_INVENTORY,
      outreach: SEED_OUTREACH,
      transport: SEED_TRANSPORT,
      users: SEED_USERS,
      auditLogs: [],

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
        inventory: [],
        outreach: [],
        transport: [],
        auditLogs: [],
        users: s.users.filter((u) => u.id === keepUserId),
      })),
    }),
    {
      name: 'eyecare-store-v1',
      version: 4,
      migrate: (state: unknown, version: number) => {
        const s = state as Record<string, unknown>;
        if (version < 2) {
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
            role: ROLE_MAP[u.role] ?? u.role,
          }));
        }
        if (version < 3) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          s.users = ((s.users as any[]) || []).map(({ password: _p, ...u }: any) => u);
        }
        if (version < 4) {
          // v3 → v4: drop migrated-to-Supabase arrays from persisted state
          delete s.campaigns;
          delete s.locations;
          delete s.patients;
          delete s.screenings;
          delete s.surgeries;
          delete s.referrals;
          delete s.followUps;
        }
        return s;
      },
    }
  )
);
