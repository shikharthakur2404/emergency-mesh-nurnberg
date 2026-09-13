/**
 * Emergency Mesh Nürnberg — Static Katastrophenschutz Dataset
 * Pre-bundled offline emergency points of interest (Nürnberg, Germany).
 * Zero-cloud access during total cellular / ISP blackout (Situation A).
 */

import { NurnbergEmergencyPoi } from '../core/types.js';

export const NURNBERG_EMERGENCY_POIS: NurnbergEmergencyPoi[] = [
  // ── KLINIKEN & NOTAUFNAHMEN (Hospitals & Trauma Centers) ──
  {
    id: 'poi-hosp-nord',
    name: 'Klinikum Nürnberg Nord (Notaufnahme / Trauma Center)',
    category: 'HOSPITAL',
    address: 'Prof.-Ernst-Nathan-Str. 1, 90419 Nürnberg',
    district: 'St. Johannis',
    lat: 49.4636,
    lon: 11.0664,
    notes: 'Maximalversorgung, Notstromdiesel aggregatfähig, Hubschrauberlandeplatz',
    capacity: '1200+ Betten',
    radioFrequency: 'BOS 4m Band / Notfallfunk Kanal 412'
  },
  {
    id: 'poi-hosp-sued',
    name: 'Klinikum Nürnberg Süd (Zentrale Notaufnahme)',
    category: 'HOSPITAL',
    address: 'Breslauer Str. 201, 90471 Nürnberg',
    district: 'Langwasser',
    lat: 49.4082,
    lon: 11.1278,
    notes: 'Schwerbrandverletzte, Notstromversorgt, Großschadenslage Zentrum',
    capacity: '1100+ Betten'
  },
  {
    id: 'poi-hosp-erler',
    name: 'Kliniken Dr. Erler (Notfallambulanz)',
    category: 'HOSPITAL',
    address: 'Kontumazgarten 4-18, 90429 Nürnberg',
    district: 'Gostenhof / Pegnitz',
    lat: 49.4526,
    lon: 11.0658,
    notes: 'Orthopädisch-traumatologischer Notfallstützpunkt'
  },
  {
    id: 'poi-hosp-theresien',
    name: 'Theresien-Krankenhaus Nürnberg',
    category: 'HOSPITAL',
    address: 'Mommsenstraße 24, 90491 Nürnberg',
    district: 'Oststadt',
    lat: 49.4674,
    lon: 11.1072,
    notes: 'Regionale Notfallversorgung'
  },

  // ── TRINKWASSERNOTBRUNNEN (Public Emergency Groundwater Wells) ──
  {
    id: 'poi-water-hauptmarkt',
    name: 'Nottrinkwasserbrunnen Hauptmarkt / Sebald',
    category: 'WATER',
    address: 'Hauptmarkt 1, 90403 Nürnberg',
    district: 'Altstadt',
    lat: 49.4539,
    lon: 11.0775,
    notes: 'Manuell pumpbarer Grundwasser-Notbrunnen. Kein Netzstrom erforderlich.'
  },
  {
    id: 'poi-water-gostenhof',
    name: 'Nottrinkwasserbrunnen Bärenschanze',
    category: 'WATER',
    address: 'Bärenschanzstraße 8, 90429 Nürnberg',
    district: 'Gostenhof',
    lat: 49.4508,
    lon: 11.0542,
    notes: 'Katastrophenschutz-Brunnen des Bundes (Wasserschutzgesetz).'
  },
  {
    id: 'poi-water-langwasser',
    name: 'Notwasserbrunnen Heinrich-Böll-Platz',
    category: 'WATER',
    address: 'Glogauer Str. 12, 90473 Nürnberg',
    district: 'Langwasser',
    lat: 49.4055,
    lon: 11.1312,
    notes: 'Notfall-Trinkwasserabgabestelle für Nürnberg-Süd.'
  },
  {
    id: 'poi-water-suedstadt',
    name: 'Nottrinkwasserbrunnen Aufseßplatz',
    category: 'WATER',
    address: 'Wölckernstraße 25, 90459 Nürnberg',
    district: 'Südstadt',
    lat: 49.4398,
    lon: 11.0821,
    notes: 'Öffentliche Entnahmestelle bei Netzausfall.'
  },

  // ── THW & KATASTROPHENSCHUTZ NOTFALLTREFFPUNKTE (Shelters & Civil Defense) ──
  {
    id: 'poi-thw-nuernberg',
    name: 'THW Ortsverband Nürnberg (Technisches Hilfswerk)',
    category: 'THW_CIVIL_DEFENSE',
    address: 'Kronacher Str. 100, 90427 Nürnberg',
    district: 'Schniegling',
    lat: 49.4795,
    lon: 11.0252,
    notes: 'Logistikstützpunkt, Bergungsgruppen, mobile Stromerzeuger',
    radioFrequency: 'BOS 2m Band / THW Notfallkanal 23'
  },
  {
    id: 'poi-fire-wache1',
    name: 'Berufsfeuerwehr Nürnberg Feuerwache 1',
    category: 'THW_CIVIL_DEFENSE',
    address: 'Riedstraße 18, 90408 Nürnberg',
    district: 'St. Johannis',
    lat: 49.4612,
    lon: 11.0628,
    notes: 'Zentrale Leitstelle Nürnberg / Fürth / Schwabach'
  },
  {
    id: 'poi-shelter-langwasser',
    name: 'Notfalltreffpunkt Gemeinschaftshaus Langwasser',
    category: 'SHELTER',
    address: 'Glogauer Str. 50, 90473 Nürnberg',
    district: 'Langwasser',
    lat: 49.4038,
    lon: 11.1345,
    notes: 'Bürger-Anlaufstelle bei Strom- & Kommunikationsausfall, Erste Hilfe',
    capacity: '500+ Personen'
  },
  {
    id: 'poi-shelter-willstaetter',
    name: 'Notfalltreffpunkt Willstätter-Gymnasium',
    category: 'SHELTER',
    address: 'Innerer Kleinweidenmühle 2, 90419 Nürnberg',
    district: 'Mitte / Kleinweidenmühle',
    lat: 49.4542,
    lon: 11.0671,
    notes: 'Wärmestube & Notunterkunft für Altstadt / Johannis',
    capacity: '400 Personen'
  }
];

export function getPoisByCategory(category: string): NurnbergEmergencyPoi[] {
  return NURNBERG_EMERGENCY_POIS.filter((poi) => poi.category === category);
}

export function searchPois(query: string): NurnbergEmergencyPoi[] {
  const q = query.toLowerCase().trim();
  if (!q) return NURNBERG_EMERGENCY_POIS;
  return NURNBERG_EMERGENCY_POIS.filter(
    (poi) =>
      poi.name.toLowerCase().includes(q) ||
      poi.district.toLowerCase().includes(q) ||
      poi.notes.toLowerCase().includes(q) ||
      poi.address.toLowerCase().includes(q)
  );
}
