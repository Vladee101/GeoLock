export const DEFAULT_GPS_TOLERANCE_M = 20;
export const MAX_GPS_TOLERANCE_M = 50;

// Phone GPS accuracy is commonly 5-50m. Widen the zone by the client's
// reported accuracy (capped) instead of requiring exact containment.
export function gpsTolerance(accuracy?: number | string | null): number {
  const n = typeof accuracy === 'string' ? Number(accuracy) : accuracy;
  if (n == null || Number.isNaN(n) || n < 0) return DEFAULT_GPS_TOLERANCE_M;
  return Math.min(n, MAX_GPS_TOLERANCE_M);
}
