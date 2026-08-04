import type { Patient } from '@/types';

/**
 * Preserve care-coordination phone numbers while hiding profile fields that a
 * Screening Officer does not need to perform screening, surgery, or follow-up.
 */
export function protectPatientForRole(patient: Patient, role: string): Patient {
  if (role !== 'Screening Officer') return patient;
  return {
    ...patient,
    email: undefined,
    occupation: undefined,
    education: undefined,
    emergencyContact: '',
    insuranceStatus: 'Restricted',
    notes: undefined,
  };
}
