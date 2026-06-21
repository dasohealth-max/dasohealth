const REGION_CODES: Record<string, string> = {
  Banaadir: 'BN',
  'Banadir / Mogadishu': 'BN',
  Banadir: 'BN',
  'Koofur Galbeed Somalia': 'KG',
  'Hiiran Region': 'HI',
  'Hirshabelle State': 'HS',
  Jubaland: 'JL',
  Galmudug: 'GM',
  Puntland: 'PL',
  'Khatumo State': 'KH',
  Somaliland: 'SL',
};

export function regionCode(region: string): string {
  const normalized = region.trim();
  const mapped = REGION_CODES[normalized];
  if (mapped) return mapped;

  const words = normalized
    .replace(/[^a-zA-Z\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  return (words[0]?.slice(0, 2) || 'XX').toUpperCase().padEnd(2, 'X');
}

export function patientCodePrefix(region: string): string {
  return `CS-${regionCode(region)}-`;
}

export function formatPatientCode(prefix: string, sequence: number): string {
  return `${prefix}${String(sequence).padStart(4, '0')}`;
}

export function patientDisplayName(name: string, code?: string): string {
  return code ? `${code} - ${name}` : name;
}
