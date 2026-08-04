import { describe, expect, it } from 'vitest';
import { protectPatientForRole } from '@/lib/privacy';
import { galmudugPatient } from '../mocks/data';

describe('protectPatientForRole', () => {
  it('removes non-clinical profile details from Screening Officer views', () => {
    const protectedPatient = protectPatientForRole(galmudugPatient, 'Screening Officer');

    expect(protectedPatient).toMatchObject({
      email: undefined,
      occupation: undefined,
      education: undefined,
      emergencyContact: '',
      insuranceStatus: 'Restricted',
      notes: undefined,
    });
    expect(protectedPatient.phone).toBe(galmudugPatient.phone);
    expect(protectedPatient.emergencyPhone).toBe(galmudugPatient.emergencyPhone);
  });

  it('preserves demographic details for the registering Data Clerk', () => {
    expect(protectPatientForRole(galmudugPatient, 'Data Clerk')).toEqual(galmudugPatient);
  });
});
