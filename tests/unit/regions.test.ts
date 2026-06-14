import { describe, it, expect } from 'vitest';
import {
  REGIONAL_CAMPAIGN_AREAS,
  isCampaignRegion,
  getRegionalCampaignArea,
  defaultOperationDistrict,
  defaultSurgeryTarget,
} from '@/lib/regions';

describe('REGIONAL_CAMPAIGN_AREAS', () => {
  it('contains exactly 9 regions', () => {
    expect(REGIONAL_CAMPAIGN_AREAS).toHaveLength(9);
  });

  it('includes all expected Somali regions', () => {
    const names = REGIONAL_CAMPAIGN_AREAS.map((a) => a.region);
    expect(names).toContain('Banadir / Mogadishu');
    expect(names).toContain('Koofur Galbeed Somalia');
    expect(names).toContain('Hiiraan State');
    expect(names).toContain('Hirshabelle State');
    expect(names).toContain('Jubaland');
    expect(names).toContain('Galmudug');
    expect(names).toContain('Puntland');
    expect(names).toContain('Khatumo State');
    expect(names).toContain('Somaliland');
  });

  it('every region has a non-empty defaultDistrict', () => {
    for (const area of REGIONAL_CAMPAIGN_AREAS) {
      expect(area.defaultDistrict.length).toBeGreaterThan(0);
    }
  });

  it('every region has a positive defaultSurgeryTarget', () => {
    for (const area of REGIONAL_CAMPAIGN_AREAS) {
      expect(area.defaultSurgeryTarget).toBeGreaterThan(0);
    }
  });
});

describe('isCampaignRegion', () => {
  it('returns true for valid regions', () => {
    expect(isCampaignRegion('Galmudug')).toBe(true);
    expect(isCampaignRegion('Banadir / Mogadishu')).toBe(true);
    expect(isCampaignRegion('Somaliland')).toBe(true);
  });

  it('returns false for invalid or empty values', () => {
    expect(isCampaignRegion('')).toBe(false);
    expect(isCampaignRegion('Kenya')).toBe(false);
    expect(isCampaignRegion('galmudug')).toBe(false); // case-sensitive
  });
});

describe('getRegionalCampaignArea', () => {
  it('returns the area object for a valid region', () => {
    const area = getRegionalCampaignArea('Galmudug');
    expect(area).toBeDefined();
    expect(area?.defaultDistrict).toBe('Dhuusamareeb');
    expect(area?.defaultSurgeryTarget).toBe(400);
  });

  it('returns undefined for an unknown region', () => {
    expect(getRegionalCampaignArea('Atlantis')).toBeUndefined();
  });

  it('Banadir has higher surgery target (800)', () => {
    const area = getRegionalCampaignArea('Banadir / Mogadishu');
    expect(area?.defaultSurgeryTarget).toBe(800);
  });
});

describe('defaultOperationDistrict', () => {
  it('returns the district name for known regions', () => {
    expect(defaultOperationDistrict('Galmudug')).toBe('Dhuusamareeb');
    expect(defaultOperationDistrict('Banadir / Mogadishu')).toBe('Mogadishu');
    expect(defaultOperationDistrict('Somaliland')).toBe('Boorama');
  });

  it('returns empty string for unknown region', () => {
    expect(defaultOperationDistrict('Nowhere')).toBe('');
  });
});

describe('defaultSurgeryTarget', () => {
  it('returns correct target for known regions', () => {
    expect(defaultSurgeryTarget('Galmudug')).toBe(400);
    expect(defaultSurgeryTarget('Banadir / Mogadishu')).toBe(800);
  });

  it('returns 400 as fallback for unknown region', () => {
    expect(defaultSurgeryTarget('Nowhere')).toBe(400);
  });
});
