/**
 * Emergency Mesh Nürnberg — Offline Geospatial Engine
 * Pure math Haversine distance calculations against ground-truth Nürnberg landmarks.
 * Zero-network requirement (100% offline, Situation A compliant).
 */

export const NURNBERG_HAUPTMARKT = {
  lat: 49.4539,
  lon: 11.0775,
  name: 'Nürnberg Hauptmarkt'
} as const;

export const NURNBERG_BOUNDS = {
  minLat: 49.35,
  maxLat: 49.55,
  minLon: 10.95,
  maxLon: 11.25
} as const;

/**
 * Calculates great-circle distance between two geographic coordinates using the Haversine formula.
 * Returns distance in kilometers, or null if coordinates are invalid or missing.
 */
export function haversineDistanceKm(
  lat1?: number | null,
  lon1?: number | null,
  lat2: number = NURNBERG_HAUPTMARKT.lat,
  lon2: number = NURNBERG_HAUPTMARKT.lon
): number | null {
  if (
    lat1 === null ||
    lat1 === undefined ||
    lon1 === null ||
    lon1 === undefined ||
    isNaN(lat1) ||
    isNaN(lon1) ||
    (lat1 === 0 && lon1 === 0) // Null-island GPS default
  ) {
    return null;
  }

  // Latitude must be [-90, 90], Longitude must be [-180, 180]
  if (lat1 < -90 || lat1 > 90 || lon1 < -180 || lon1 > 180) {
    return null;
  }

  const R = 6371; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const radLat1 = (lat1 * Math.PI) / 180;
  const radLat2 = (lat2 * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Formats a Haversine distance in kilometers with fallback for missing GPS fix.
 */
export function calculateDistanceKm(
  lat?: number | null,
  lon?: number | null,
  refLat = NURNBERG_HAUPTMARKT.lat,
  refLon = NURNBERG_HAUPTMARKT.lon
): string {
  const d = haversineDistanceKm(lat, lon, refLat, refLon);
  if (d === null) {
    return '--- km';
  }
  return `${d.toFixed(1)} km`;
}

/**
 * Validates whether coordinates fall within the municipal metropolitan area of Nürnberg.
 */
export function isWithinNurnbergBounds(lat: number, lon: number): boolean {
  return (
    lat >= NURNBERG_BOUNDS.minLat &&
    lat <= NURNBERG_BOUNDS.maxLat &&
    lon >= NURNBERG_BOUNDS.minLon &&
    lon <= NURNBERG_BOUNDS.maxLon
  );
}
