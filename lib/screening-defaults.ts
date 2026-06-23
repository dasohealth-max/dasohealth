import type { Screening } from '@/types';

export function defaultRecommendationForSurgeryConsent(consentGiven: boolean): Screening['recommendation'] {
  return consentGiven ? 'Refer for Surgery' : 'Discharge';
}
