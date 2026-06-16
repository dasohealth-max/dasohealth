import type { Role } from '@/types';

export type AppModule =
  | 'dashboard'
  | 'campaigns'
  | 'patients'
  | 'screening'
  | 'surgeries'
  | 'followups'
  | 'reports'
  | 'settings';

export type Action = 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'export';

type Matrix = Partial<Record<AppModule, Action[]>>;

const ALL: Action[] = ['view', 'create', 'edit', 'delete', 'approve', 'export'];
const VIEW_ONLY: Action[] = ['view'];
const CRE: Action[] = ['view', 'create', 'edit'];

const PERMISSIONS: Record<Role, Matrix> = {
  'Super Administrator': {
    dashboard: ALL,
    campaigns: ALL,
    patients: ALL,
    screening: ALL,
    surgeries: ALL,
    followups: ALL,
    reports: ALL,
    settings: ALL,
  },
  'Project Manager': {
    dashboard: VIEW_ONLY,
    campaigns: ['view', 'export'],
    patients: ['view', 'create', 'edit', 'export'],
    screening: ['view', 'create', 'edit', 'export'],
    surgeries: ['view', 'create', 'edit', 'export'],
    followups: ['view', 'create', 'edit', 'export'],
    reports: ['view', 'export'],
    settings: ['view', 'create', 'edit'],
  },
  'Data Clerk': {
    patients: CRE,
    screening: VIEW_ONLY,
  },
  'Screening Officer': {
    patients: VIEW_ONLY,
    screening: CRE,
    surgeries: ['view', 'edit'],
    followups: CRE,
  },
};

export function can(role: string, module: AppModule, action: Action): boolean {
  const matrix = PERMISSIONS[role as Role];
  if (!matrix) return false;
  return matrix[module]?.includes(action) ?? false;
}

export function canAccess(role: string, module: AppModule): boolean {
  return can(role, module, 'view');
}

export function mustMaskPatient(): boolean {
  return false;
}

export function canAccessSettings(role: string): boolean {
  return can(role, 'settings', 'view');
}

export function defaultPathForRole(role: string): string {
  if (role === 'Data Clerk') return '/patients';
  if (role === 'Screening Officer') return '/screening';
  return '/dashboard';
}

export function manageableRolesFor(role: string): Role[] {
  if (role === 'Super Administrator') return ['Super Administrator', 'Project Manager', 'Data Clerk', 'Screening Officer'];
  if (role === 'Project Manager') return ['Data Clerk', 'Screening Officer'];
  return [];
}
