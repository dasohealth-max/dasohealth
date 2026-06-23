import { describe, expect, it } from 'vitest';
import { defaultRecommendationForSurgeryConsent } from '@/lib/screening-defaults';
import { vaGradeFromApp, vaGradeToApp } from '@/lib/prisma-enums';

describe('defaultRecommendationForSurgeryConsent', () => {
  it('defaults consented patients to surgery referral', () => {
    expect(defaultRecommendationForSurgeryConsent(true)).toBe('Refer for Surgery');
  });

  it('defaults patients without consent to discharge', () => {
    expect(defaultRecommendationForSurgeryConsent(false)).toBe('Discharge');
  });
});

describe('va grade mappings', () => {
  it('maps measured count-fingers grades to Prisma enum keys', () => {
    expect(vaGradeFromApp('CF 1M')).toBe('CF1M');
    expect(vaGradeFromApp('CF 2M')).toBe('CF2M');
    expect(vaGradeFromApp('CF 3M')).toBe('CF3M');
  });

  it('keeps legacy plain CF displayable', () => {
    expect(vaGradeFromApp('CF')).toBe('CF');
    expect(vaGradeToApp('CF')).toBe('CF');
  });
});
