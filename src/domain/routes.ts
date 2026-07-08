import { TravelMode } from './types';

/**
 * Canonical route catalog — the backbone of matching.
 *
 * Two people can only discover each other if their patterns produce the same
 * route key, so route identity must be canonical, not free text. Picking from
 * this catalog guarantees that. Custom entries still work (normalized text
 * key) but only match people who typed the same thing.
 *
 * MAINTENANCE: this is deliberately a plain data file. Adding a metro area is
 * appending entries; nothing else changes. In production this list is served
 * by the backend (same shape) so routes can be added without an app release.
 * Seeded for the launch geography (Baltimore–DC corridor, PRD §13 Q1).
 */

export interface CatalogRoute {
  id: string; // stable canonical id — never rename once shipped
  mode: TravelMode;
  label: string;
  region: string;
  directions: [string, string] | [string];
  /** Typical boarding code shown in the pattern form. */
  code?: string;
}

export const ROUTE_CATALOG: CatalogRoute[] = [
  // — Commuter rail, Baltimore–DC corridor
  { id: 'marc-penn', mode: 'train', label: 'MARC Penn Line', region: 'MD/DC', directions: ['Baltimore → DC', 'DC → Baltimore'], code: 'BAL' },
  { id: 'marc-camden', mode: 'train', label: 'MARC Camden Line', region: 'MD/DC', directions: ['Baltimore → DC', 'DC → Baltimore'], code: 'CDN' },
  { id: 'marc-brunswick', mode: 'train', label: 'MARC Brunswick Line', region: 'MD/DC', directions: ['Brunswick → DC', 'DC → Brunswick'], code: 'BRW' },
  { id: 'vre-fredericksburg', mode: 'train', label: 'VRE Fredericksburg Line', region: 'VA/DC', directions: ['Fredericksburg → DC', 'DC → Fredericksburg'], code: 'FBG' },
  { id: 'vre-manassas', mode: 'train', label: 'VRE Manassas Line', region: 'VA/DC', directions: ['Manassas → DC', 'DC → Manassas'], code: 'MSS' },
  { id: 'amtrak-ne-regional', mode: 'train', label: 'Amtrak Northeast Regional', region: 'NE Corridor', directions: ['Northbound', 'Southbound'], code: 'NER' },
  { id: 'amtrak-acela', mode: 'train', label: 'Amtrak Acela', region: 'NE Corridor', directions: ['Northbound', 'Southbound'], code: 'ACL' },

  // — Metro / subway
  { id: 'wmata-red', mode: 'train', label: 'WMATA Red Line', region: 'DC', directions: ['Toward Shady Grove', 'Toward Glenmont'], code: 'RED' },
  { id: 'balt-light-rail', mode: 'train', label: 'Baltimore Light Rail', region: 'MD', directions: ['Northbound', 'Southbound'], code: 'LRL' },

  // — Bus
  { id: 'mta-icc-201', mode: 'bus', label: 'MTA ICC Bus 201', region: 'MD', directions: ['Gaithersburg → BWI', 'BWI → Gaithersburg'], code: '201' },
  { id: 'loudoun-metro-bus', mode: 'bus', label: 'Loudoun County Metro Connection', region: 'VA/DC', directions: ['Inbound', 'Outbound'], code: 'LCT' },

  // — Ferry
  { id: 'potomac-water-taxi', mode: 'boat', label: 'Potomac Water Taxi (Alexandria ↔ Wharf)', region: 'VA/DC', directions: ['Alexandria → Wharf', 'Wharf → Alexandria'], code: 'PWT' },

  // — Flights: common BWI/DCA business pairs. Flights match on airport pair.
  { id: 'fly-bwi-bos', mode: 'flight', label: 'BWI → BOS', region: 'Flights', directions: ['Northbound', 'Southbound'], code: 'BWI' },
  { id: 'fly-bwi-atl', mode: 'flight', label: 'BWI → ATL', region: 'Flights', directions: ['Southbound', 'Northbound'], code: 'BWI' },
  { id: 'fly-dca-nyc', mode: 'flight', label: 'DCA → NYC (LGA/JFK)', region: 'Flights', directions: ['Northbound', 'Southbound'], code: 'DCA' },

  // — Recurring places
  { id: 'place-bwi-gate-c', mode: 'place', label: 'Gate C concourse, BWI', region: 'BWI', directions: ['Regular'], code: 'BWI' },
  { id: 'place-union-station', mode: 'place', label: 'Union Station main hall, DC', region: 'DC', directions: ['Regular'], code: 'WAS' },
];

/** Normalize free text so trivially-different custom entries still match. */
export function normalizeText(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9→]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * The canonical matching key. Catalog patterns use the stable route id;
 * custom patterns fall back to normalized text. Direction is part of the key:
 * the morning DC-bound crowd and the evening Baltimore-bound crowd are
 * different rooms.
 */
export function routeKeyFor(mode: TravelMode, routeId: string | undefined, routeText: string, direction: string): string {
  const route = routeId ?? normalizeText(routeText);
  return `${mode}:${route}:${normalizeText(direction)}`;
}

export function searchCatalog(mode: TravelMode, query: string): CatalogRoute[] {
  const q = query.trim().toLowerCase();
  return ROUTE_CATALOG.filter(
    (r) => r.mode === mode && (q === '' || r.label.toLowerCase().includes(q) || r.region.toLowerCase().includes(q)),
  );
}
