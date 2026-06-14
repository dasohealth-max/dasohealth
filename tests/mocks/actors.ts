import type { ServerActor } from '@/lib/auth-server';

export const superAdmin: ServerActor = {
  id: 'actor-super-1',
  email: 'super@demo.eyecare.org',
  name: 'Super Admin',
  role: 'Super Administrator',
};

export const galmudugPM: ServerActor = {
  id: 'actor-pm-1',
  email: 'pm.galmudug@demo.eyecare.org',
  name: 'PM Galmudug',
  role: 'Project Manager',
  assignedRegion: 'Galmudug',
};

export const banadiPM: ServerActor = {
  id: 'actor-pm-2',
  email: 'pm.banadir@demo.eyecare.org',
  name: 'PM Banadir',
  role: 'Project Manager',
  assignedRegion: 'Banadir / Mogadishu',
};

export const galmudugClerk: ServerActor = {
  id: 'actor-clerk-1',
  email: 'clerk@demo.eyecare.org',
  name: 'Clerk Galmudug',
  role: 'Data Clerk',
  assignedRegion: 'Galmudug',
};

export const galmudugScreener: ServerActor = {
  id: 'actor-screener-1',
  email: 'screener@demo.eyecare.org',
  name: 'Screener Galmudug',
  role: 'Screening Officer',
  assignedRegion: 'Galmudug',
};
