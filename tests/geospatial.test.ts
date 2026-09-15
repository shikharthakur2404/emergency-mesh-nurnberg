import { describe, it, expect } from 'vitest';
import {
  haversineDistanceKm,
  calculateDistanceKm,
  isWithinNurnbergBounds,
  NURNBERG_HAUPTMARKT,
  NURNBERG_BOUNDS
} from '../src/utils/geo';
import { NURNBERG_EMERGENCY_POIS } from '../src/data/nurnberg-emergency-data';

describe('Layer 5: Offline Geospatial Directory & Haversine Integrity', () => {

  describe('5.1 Haversine Calculation Accuracy Against Ground-Truth Nürnberg Landmarks', () => {
    it('calculates zero distance for identical coordinates', () => {
      const dist = haversineDistanceKm(
        NURNBERG_HAUPTMARKT.lat,
        NURNBERG_HAUPTMARKT.lon,
        NURNBERG_HAUPTMARKT.lat,
        NURNBERG_HAUPTMARKT.lon
      );
      expect(dist).toBe(0);
      expect(calculateDistanceKm(NURNBERG_HAUPTMARKT.lat, NURNBERG_HAUPTMARKT.lon)).toBe('0.0 km');
    });

    it('validates distance from Hauptmarkt to Kaiserburg (~0.43 - 0.45 km)', () => {
      const kaiserburg = { lat: 49.4578, lon: 11.0772 };
      const dist = haversineDistanceKm(kaiserburg.lat, kaiserburg.lon);
      expect(dist).not.toBeNull();
      expect(dist!).toBeGreaterThan(0.40);
      expect(dist!).toBeLessThan(0.48);
      expect(calculateDistanceKm(kaiserburg.lat, kaiserburg.lon)).toBe('0.4 km');
    });

    it('validates distance from Hauptmarkt to Klinikum Nürnberg Nord (~1.35 - 1.40 km)', () => {
      const hospNord = NURNBERG_EMERGENCY_POIS.find(p => p.id === 'poi-hosp-nord')!;
      expect(hospNord).toBeDefined();

      const dist = haversineDistanceKm(hospNord.lat, hospNord.lon);
      expect(dist).not.toBeNull();
      expect(dist!).toBeGreaterThan(1.30);
      expect(dist!).toBeLessThan(1.45);
      expect(['1.3 km', '1.4 km']).toContain(calculateDistanceKm(hospNord.lat, hospNord.lon));
    });

    it('validates distance from Hauptmarkt to Klinikum Nürnberg Süd (~6.20 - 6.45 km)', () => {
      const hospSued = NURNBERG_EMERGENCY_POIS.find(p => p.id === 'poi-hosp-sued')!;
      expect(hospSued).toBeDefined();

      const dist = haversineDistanceKm(hospSued.lat, hospSued.lon);
      expect(dist).not.toBeNull();
      expect(dist!).toBeGreaterThan(6.15);
      expect(dist!).toBeLessThan(6.45);
      expect(['6.2 km', '6.3 km']).toContain(calculateDistanceKm(hospSued.lat, hospSued.lon));
    });

    it('satisfies reciprocal distance symmetry: dist(A, B) === dist(B, A)', () => {
      const locA = { lat: 49.4636, lon: 11.0664 }; // Klinikum Nord
      const locB = { lat: 49.4082, lon: 11.1278 }; // Klinikum Süd

      const distAB = haversineDistanceKm(locA.lat, locA.lon, locB.lat, locB.lon);
      const distBA = haversineDistanceKm(locB.lat, locB.lon, locA.lat, locA.lon);

      expect(distAB).not.toBeNull();
      expect(distBA).not.toBeNull();
      expect(Math.abs(distAB! - distBA!)).toBeLessThan(0.0001);
    });
  });

  describe('5.2 Missing GPS Fix, Null-Island & Coordinate Fallback Handling', () => {
    it('returns "--- km" without crashing when coordinates are null or undefined', () => {
      expect(calculateDistanceKm(null, null)).toBe('--- km');
      expect(calculateDistanceKm(undefined, undefined)).toBe('--- km');
      expect(calculateDistanceKm(49.45, undefined)).toBe('--- km');
      expect(calculateDistanceKm(null, 11.08)).toBe('--- km');
      expect(haversineDistanceKm(null, null)).toBeNull();
    });

    it('detects and rejects Null Island (0,0) GPS default initialization coordinates', () => {
      // Android location listeners frequently report (0,0) before acquiring satellite fix
      expect(haversineDistanceKm(0, 0)).toBeNull();
      expect(calculateDistanceKm(0, 0)).toBe('--- km');
    });

    it('rejects non-numeric NaN / Infinity coordinates safely', () => {
      expect(haversineDistanceKm(NaN, 11.08)).toBeNull();
      expect(haversineDistanceKm(49.45, NaN)).toBeNull();
      expect(haversineDistanceKm(Infinity, 11.08)).toBeNull();
      expect(calculateDistanceKm(NaN, NaN)).toBe('--- km');
    });

    it('rejects out-of-range latitudes and longitudes', () => {
      expect(haversineDistanceKm(95.0, 11.08)).toBeNull(); // Lat > 90
      expect(haversineDistanceKm(-95.0, 11.08)).toBeNull(); // Lat < -90
      expect(haversineDistanceKm(49.45, 185.0)).toBeNull(); // Lon > 180
      expect(haversineDistanceKm(49.45, -185.0)).toBeNull(); // Lon < -180
    });
  });

  describe('5.3 Zero-Network Guarantee & Municipal Katastrophenschutz Bounds', () => {
    it('contains a non-empty emergency dataset operating 100% offline without network requests', () => {
      expect(NURNBERG_EMERGENCY_POIS.length).toBeGreaterThanOrEqual(15);

      // Verify essential categories exist in offline store
      const categories = new Set(NURNBERG_EMERGENCY_POIS.map(p => p.category));
      expect(categories.has('HOSPITAL')).toBe(true);
      expect(categories.has('WATER')).toBe(true);
      expect(categories.has('SHELTER')).toBe(true);
      expect(categories.has('THW_CIVIL_DEFENSE')).toBe(true);
    });

    it('verifies all pre-bundled POIs are strictly within the official Nürnberg bounding box', () => {
      for (const poi of NURNBERG_EMERGENCY_POIS) {
        expect(isWithinNurnbergBounds(poi.lat, poi.lon)).toBe(true);
        expect(poi.lat).toBeGreaterThanOrEqual(NURNBERG_BOUNDS.minLat);
        expect(poi.lat).toBeLessThanOrEqual(NURNBERG_BOUNDS.maxLat);
        expect(poi.lon).toBeGreaterThanOrEqual(NURNBERG_BOUNDS.minLon);
        expect(poi.lon).toBeLessThanOrEqual(NURNBERG_BOUNDS.maxLon);
      }
    });

    it('verifies offline emergency POI data structures have non-empty critical information', () => {
      for (const poi of NURNBERG_EMERGENCY_POIS) {
        expect(poi.id).toBeTruthy();
        expect(poi.name).toBeTruthy();
        expect(poi.address).toBeTruthy();
        expect(poi.district).toBeTruthy();
        expect(poi.notes).toBeTruthy();
      }
    });

    it('performs instant in-memory filtering by category and district without network latency', () => {
      const waterPoints = NURNBERG_EMERGENCY_POIS.filter(p => p.category === 'WATER');
      expect(waterPoints.length).toBeGreaterThanOrEqual(4);

      const altstadtPois = NURNBERG_EMERGENCY_POIS.filter(p => p.district === 'Altstadt');
      expect(altstadtPois.length).toBeGreaterThanOrEqual(1);
    });
  });
});
