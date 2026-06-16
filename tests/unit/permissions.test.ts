import { describe, expect, it } from 'vitest';
import { can, canAccess, canAccessSettings, defaultPathForRole, manageableRolesFor } from '@/lib/permissions';

const modules = ['dashboard', 'campaigns', 'patients', 'screening', 'surgeries', 'followups', 'reports', 'settings'] as const;
const actions = ['view', 'create', 'edit', 'delete', 'approve', 'export'] as const;

describe('permissions - Super Administrator', () => {
  it('has all actions on every module', () => {
    for (const moduleName of modules) {
      for (const action of actions) {
        expect(can('Super Administrator', moduleName, action)).toBe(true);
      }
    }
  });

  it('starts at dashboard and can manage administrator and operational roles', () => {
    expect(defaultPathForRole('Super Administrator')).toBe('/dashboard');
    expect(canAccessSettings('Super Administrator')).toBe(true);
    expect(manageableRolesFor('Super Administrator')).toEqual([
      'Super Administrator',
      'Project Manager',
      'Data Clerk',
      'Screening Officer',
    ]);
  });
});

describe('permissions - Project Manager', () => {
  it('can view/export campaigns but cannot mutate campaign setup', () => {
    expect(can('Project Manager', 'campaigns', 'view')).toBe(true);
    expect(can('Project Manager', 'campaigns', 'export')).toBe(true);
    expect(can('Project Manager', 'campaigns', 'create')).toBe(false);
    expect(can('Project Manager', 'campaigns', 'edit')).toBe(false);
    expect(can('Project Manager', 'campaigns', 'delete')).toBe(false);
  });

  it('can access dashboard and reports', () => {
    expect(canAccess('Project Manager', 'dashboard')).toBe(true);
    expect(canAccess('Project Manager', 'reports')).toBe(true);
    expect(defaultPathForRole('Project Manager')).toBe('/dashboard');
  });

  it('can manage only clerk and screener users', () => {
    expect(canAccessSettings('Project Manager')).toBe(true);
    expect(can('Project Manager', 'settings', 'delete')).toBe(false);
    expect(manageableRolesFor('Project Manager')).toEqual(['Data Clerk', 'Screening Officer']);
  });
});

describe('permissions - Data Clerk', () => {
  it('can create and edit patients', () => {
    expect(can('Data Clerk', 'patients', 'view')).toBe(true);
    expect(can('Data Clerk', 'patients', 'create')).toBe(true);
    expect(can('Data Clerk', 'patients', 'edit')).toBe(true);
    expect(can('Data Clerk', 'patients', 'delete')).toBe(false);
  });

  it('can only view screening from the clinical flow', () => {
    expect(can('Data Clerk', 'screening', 'view')).toBe(true);
    expect(can('Data Clerk', 'screening', 'create')).toBe(false);
    expect(can('Data Clerk', 'surgeries', 'view')).toBe(false);
    expect(can('Data Clerk', 'followups', 'view')).toBe(false);
  });

  it('cannot access dashboard, reports, settings, or role management', () => {
    expect(canAccess('Data Clerk', 'dashboard')).toBe(false);
    expect(canAccess('Data Clerk', 'reports')).toBe(false);
    expect(canAccessSettings('Data Clerk')).toBe(false);
    expect(manageableRolesFor('Data Clerk')).toHaveLength(0);
    expect(defaultPathForRole('Data Clerk')).toBe('/patients');
  });
});

describe('permissions - Screening Officer', () => {
  it('can manage screening, surgery completion, and follow-ups', () => {
    expect(can('Screening Officer', 'screening', 'view')).toBe(true);
    expect(can('Screening Officer', 'screening', 'create')).toBe(true);
    expect(can('Screening Officer', 'screening', 'edit')).toBe(true);
    expect(can('Screening Officer', 'screening', 'delete')).toBe(false);
    expect(can('Screening Officer', 'surgeries', 'view')).toBe(true);
    expect(can('Screening Officer', 'surgeries', 'edit')).toBe(true);
    expect(can('Screening Officer', 'surgeries', 'create')).toBe(false);
    expect(can('Screening Officer', 'followups', 'create')).toBe(true);
    expect(can('Screening Officer', 'followups', 'edit')).toBe(true);
  });

  it('cannot access dashboard, reports, settings, or role management', () => {
    expect(canAccess('Screening Officer', 'dashboard')).toBe(false);
    expect(canAccess('Screening Officer', 'reports')).toBe(false);
    expect(canAccessSettings('Screening Officer')).toBe(false);
    expect(manageableRolesFor('Screening Officer')).toHaveLength(0);
    expect(defaultPathForRole('Screening Officer')).toBe('/screening');
  });
});

describe('permissions - unknown role', () => {
  it('denies everything and falls back to dashboard path', () => {
    expect(can('Unknown', 'dashboard', 'view')).toBe(false);
    expect(canAccess('Unknown', 'patients')).toBe(false);
    expect(canAccessSettings('Unknown')).toBe(false);
    expect(defaultPathForRole('Unknown')).toBe('/dashboard');
  });
});
