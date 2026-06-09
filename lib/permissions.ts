// ─── Enterprise Permission Framework (A-Z) ────────────────────────────────────
// Source: Eye_Health_Enterprise_Permission_Framework_A_to_Z.pdf
// Architecture: Campaign + Location + Hospital + Role + Module + Workflow + Record

import type { Role } from '@/types';

export type AppModule =
  | 'dashboard'
  | 'campaigns'
  | 'locations'
  | 'patients'
  | 'screening'
  | 'surgeries'
  | 'referrals'
  | 'followups'
  | 'outreach'
  | 'inventory'
  | 'transport'
  | 'reports'
  | 'settings';

export type Action = 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'export';

type Matrix = Partial<Record<AppModule, Action[]>>;

const ALL: Action[] = ['view', 'create', 'edit', 'delete', 'approve', 'export'];
const VIEW_EXPORT: Action[] = ['view', 'export'];
const VIEW_ONLY: Action[] = ['view'];
const CRUD: Action[] = ['view', 'create', 'edit', 'delete'];
const CRE: Action[] = ['view', 'create', 'edit'];

const PERMISSIONS: Record<Role, Matrix> = {

  // ── Super Administrator ── full access to everything ─────────────────────────
  'Super Administrator': {
    dashboard: ALL, campaigns: ALL, locations: ALL,
    patients: ALL,  screening: ALL, surgeries: ALL,
    referrals: ALL, followups: ALL, outreach: ALL,
    inventory: ALL, transport: ALL, reports: ALL,
    settings: ALL,
  },

  // ── Project Manager ── cross-campaign visibility, no settings ────────────────
  'Project Manager': {
    dashboard: VIEW_EXPORT,
    campaigns: ['view', 'edit', 'export'],
    locations: VIEW_ONLY,
    patients:  VIEW_EXPORT,
    screening: VIEW_EXPORT,
    surgeries: VIEW_EXPORT,
    referrals: VIEW_EXPORT,
    followups: VIEW_EXPORT,
    outreach:  VIEW_EXPORT,
    inventory: VIEW_EXPORT,
    transport: VIEW_EXPORT,
    reports:   ['view', 'create', 'edit', 'export'],
  },

  // ── Campaign Manager ── manages campaigns & outreach, limited clinical view ──
  'Campaign Manager': {
    dashboard: VIEW_ONLY,
    campaigns: ['view', 'edit', 'export'],
    locations: VIEW_ONLY,
    patients:  VIEW_ONLY,
    screening: VIEW_ONLY,
    referrals: VIEW_ONLY,
    outreach:  CRE,
    reports:   VIEW_EXPORT,
  },

  // ── Hospital Coordinator ── manages site operations, no campaign admin ────────
  'Hospital Coordinator': {
    dashboard: VIEW_ONLY,
    locations: VIEW_ONLY,
    patients:  CRE,
    screening: VIEW_ONLY,
    surgeries: VIEW_ONLY,
    referrals: VIEW_ONLY,
    followups: VIEW_ONLY,
    inventory: VIEW_ONLY,
    transport: VIEW_ONLY,
  },

  // ── Data Clerk ── data entry for registration, screening, referrals ──────────
  'Data Clerk': {
    dashboard: VIEW_ONLY,
    patients:  CRE,
    screening: CRE,
    referrals: CRE,
  },

  // ── Screening Officer ── conduct screenings, view patients ───────────────────
  'Screening Officer': {
    dashboard: VIEW_ONLY,
    patients:  VIEW_ONLY,
    screening: CRE,
    referrals: VIEW_ONLY,
    followups: VIEW_ONLY,
  },

  // ── Ophthalmologist ── clinical review, referral & surgery approval ──────────
  'Ophthalmologist': {
    dashboard: VIEW_ONLY,
    patients:  VIEW_ONLY,
    screening: ['view', 'edit'],
    surgeries: ['view', 'create', 'edit', 'approve'],
    referrals: ['view', 'create', 'edit', 'approve'],
    followups: VIEW_ONLY,
  },

  // ── Surgeon ── theatres & surgical records ───────────────────────────────────
  'Surgeon': {
    dashboard: VIEW_ONLY,
    patients:  VIEW_ONLY,
    screening: VIEW_ONLY,
    surgeries: ['view', 'create', 'edit', 'approve'],
    referrals: ['view', 'approve'],
    followups: VIEW_ONLY,
  },

  // ── Follow-Up Officer ── post-surgery follow-up tracking ─────────────────────
  'Follow-Up Officer': {
    dashboard: VIEW_ONLY,
    patients:  VIEW_ONLY,
    referrals: VIEW_ONLY,
    followups: CRE,
  },

  // ── Outreach Officer ── community outreach & patient registration ─────────────
  'Outreach Officer': {
    dashboard: VIEW_ONLY,
    campaigns: VIEW_ONLY,
    patients:  ['view', 'create'],
    outreach:  CRE,
  },

  // ── Logistics Officer ── transport, location & supply management ─────────────
  'Logistics Officer': {
    dashboard: VIEW_ONLY,
    locations: VIEW_ONLY,
    inventory: ['view', 'edit'],
    transport: CRE,
  },

  // ── Inventory Officer ── full inventory management ───────────────────────────
  'Inventory Officer': {
    dashboard: VIEW_ONLY,
    locations: VIEW_ONLY,
    inventory: ['view', 'create', 'edit', 'delete', 'export'],
  },

  // ── MEAL Officer ── monitoring, evaluation, accountability, learning ──────────
  'MEAL Officer': {
    dashboard: VIEW_ONLY,
    campaigns: VIEW_ONLY,
    patients:  VIEW_ONLY,
    screening: VIEW_ONLY,
    surgeries: VIEW_ONLY,
    referrals: VIEW_ONLY,
    followups: VIEW_ONLY,
    outreach:  VIEW_ONLY,
    inventory: VIEW_ONLY,
    reports:   ['view', 'create', 'edit', 'export'],
  },

  // ── Finance Officer ── financial visibility, no clinical data ────────────────
  'Finance Officer': {
    dashboard: VIEW_ONLY,
    campaigns: VIEW_ONLY,
    surgeries: VIEW_ONLY,
    inventory: VIEW_ONLY,
    transport: VIEW_ONLY,
    reports:   VIEW_EXPORT,
  },

  // ── Donor User ── aggregate view only, patient identifiers masked ─────────────
  'Donor User': {
    dashboard: VIEW_ONLY,
    campaigns: VIEW_ONLY,
    patients:  VIEW_ONLY,   // identifiers masked – enforced in UI
    reports:   VIEW_ONLY,
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Check if a role can perform an action on a module */
export function can(role: string, module: AppModule, action: Action): boolean {
  const matrix = PERMISSIONS[role as Role];
  if (!matrix) return false;
  return matrix[module]?.includes(action) ?? false;
}

/** Check if a role can see a module at all (has view permission) */
export function canAccess(role: string, module: AppModule): boolean {
  return can(role, module, 'view');
}

/** Donor User — patient identifiers must be masked */
export function mustMaskPatient(role: string): boolean {
  return role === 'Donor User' || role === 'Finance Officer';
}

/** Roles that can access the Settings module */
export function canAccessSettings(role: string): boolean {
  return can(role, 'settings', 'view');
}
