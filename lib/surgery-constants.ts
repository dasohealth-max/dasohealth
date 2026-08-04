export const CANCELLATION_REASONS = [
  'Did not show up',
  'Refused the surgery',
  'Cannot be reached',
  'Medically deferred',
  'Rescheduled',
  'Other reason',
] as const;

export type CancellationReason = typeof CANCELLATION_REASONS[number];

// Temporary compatibility export for callers migrated in the same release.
export const REMOVAL_REASONS = CANCELLATION_REASONS;
