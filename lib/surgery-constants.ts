export const REMOVAL_REASONS = [
  'Did not show up',
  'Refused the surgery',
  'Cannot be reached',
  'Patient has passed away',
  'Other reason',
] as const;

export type RemovalReason = typeof REMOVAL_REASONS[number];
