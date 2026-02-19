// Date utilities
export function formatDateTime(date: Date | string, locale = 'pt-BR'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(date: Date | string, locale = 'pt-BR'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(date: Date | string, locale = 'pt-BR'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Geo utilities
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

export function isPointInRadius(
  pointLat: number,
  pointLon: number,
  centerLat: number,
  centerLon: number,
  radiusKm: number
): boolean {
  return calculateDistance(pointLat, pointLon, centerLat, centerLon) <= radiusKm;
}

// Radar utilities
export function dbzToRainRate(dbz: number): number {
  // Z-R relationship: Z = 200 * R^1.6 (Marshall-Palmer)
  // R = (Z / 200)^(1/1.6)
  const Z = Math.pow(10, dbz / 10);
  return Math.pow(Z / 200, 1 / 1.6);
}

export function rainRateToDbz(rainRateMmH: number): number {
  // Z = 200 * R^1.6
  const Z = 200 * Math.pow(rainRateMmH, 1.6);
  return 10 * Math.log10(Z);
}

export function getDbzColor(dbz: number): string {
  if (dbz < 5) return 'transparent';
  if (dbz < 10) return '#00FFFF';
  if (dbz < 15) return '#00C8FF';
  if (dbz < 20) return '#0096FF';
  if (dbz < 25) return '#00FF00';
  if (dbz < 30) return '#00C800';
  if (dbz < 35) return '#009600';
  if (dbz < 40) return '#FFFF00';
  if (dbz < 45) return '#FFC800';
  if (dbz < 50) return '#FF9600';
  if (dbz < 55) return '#FF0000';
  if (dbz < 60) return '#C80000';
  if (dbz < 65) return '#FF00FF';
  return '#FFFFFF';
}

// Severity utilities
export const SEVERITY_ORDER: Record<string, number> = {
  observation: 1,
  attention: 2,
  alert: 3,
  max_alert: 4,
};

export const SEVERITY_LABELS: Record<string, string> = {
  observation: 'Observação',
  attention: 'Atenção',
  alert: 'Alerta',
  max_alert: 'Alerta Máximo',
};

export const SEVERITY_COLORS: Record<string, string> = {
  observation: '#4CAF50',
  attention: '#FFD600',
  alert: '#FF9800',
  max_alert: '#FF1744',
};

export function compareSeverity(a: string, b: string): number {
  return (SEVERITY_ORDER[a] || 0) - (SEVERITY_ORDER[b] || 0);
}

// Validation utilities
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidIbgeCode(code: string): boolean {
  return /^\d{7}$/.test(code);
}

export function isValidUuid(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// Number formatting
export function formatNumber(value: number, decimals = 2, locale = 'pt-BR'): string {
  return value.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPrecipitation(mm: number): string {
  return `${formatNumber(mm, 1)} mm`;
}

export function formatPercentage(value: number): string {
  return `${formatNumber(value * 100, 0)}%`;
}

// Array utilities
export function groupBy<T, K extends string | number>(
  array: T[],
  keyFn: (item: T) => K
): Record<K, T[]> {
  return array.reduce((result, item) => {
    const key = keyFn(item);
    (result[key] = result[key] || []).push(item);
    return result;
  }, {} as Record<K, T[]>);
}

export function uniqueBy<T, K>(array: T[], keyFn: (item: T) => K): T[] {
  const seen = new Set<K>();
  return array.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
