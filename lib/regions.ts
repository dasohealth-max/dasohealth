export const REGIONAL_CAMPAIGN_AREAS = [
  { region: 'Banadir / Mogadishu', defaultDistrict: 'Mogadishu', defaultSurgeryTarget: 800 },
  { region: 'Koofur Galbeed Somalia', defaultDistrict: 'Baydhabo', defaultSurgeryTarget: 400 },
  { region: 'Hiiraan State', defaultDistrict: 'Beledweyne', defaultSurgeryTarget: 400 },
  { region: 'Hirshabelle State', defaultDistrict: 'Jowhar', defaultSurgeryTarget: 400 },
  { region: 'Jubaland', defaultDistrict: 'Kismaayo', defaultSurgeryTarget: 400 },
  { region: 'Galmudug', defaultDistrict: 'Dhuusamareeb', defaultSurgeryTarget: 400 },
  { region: 'Puntland', defaultDistrict: 'Puntland / selected city', defaultSurgeryTarget: 400 },
  { region: 'Khatumo State', defaultDistrict: 'Laascanood', defaultSurgeryTarget: 400 },
  { region: 'Somaliland', defaultDistrict: 'Boorama', defaultSurgeryTarget: 400 },
] as const;

export type CampaignRegion = (typeof REGIONAL_CAMPAIGN_AREAS)[number]['region'];

export function isCampaignRegion(value: string): value is CampaignRegion {
  return REGIONAL_CAMPAIGN_AREAS.some((area) => area.region === value);
}

export function getRegionalCampaignArea(region: string) {
  return REGIONAL_CAMPAIGN_AREAS.find((area) => area.region === region);
}

export function defaultOperationDistrict(region: string) {
  return getRegionalCampaignArea(region)?.defaultDistrict ?? '';
}

export function defaultSurgeryTarget(region: string) {
  return getRegionalCampaignArea(region)?.defaultSurgeryTarget ?? 400;
}
