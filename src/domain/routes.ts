import { TravelMode } from './types';

/**
 * Route identity without a global route database.
 *
 * Matching quality depends on two people producing the same route key, so
 * instead of a maintained catalog (unscalable) or free text (never matches),
 * the pattern form forces STRUCTURED input per mode and normalizes it:
 *
 * - Ground transit (train/bus/boat/rideshare): agency + line + toward
 *     "MARC" + "Penn Line" + "Washington"  →  train:marc|penn:washington
 * - Flights: origin + destination IATA codes → flight:bwi-bos
 * - Places: venue + location code           → place:gate-c|bwi
 *
 * Normalization strips punctuation, case, and filler words ("line", "route",
 * "station"…) so "Penn Line" and "penn" converge. The long-term convergence
 * play is server-side suggestions from existing patterns (planned RPC), which
 * turns every first entry into the guardrail for the next person.
 */

// Mirrored by public.normalize_text server-side — change BOTH together.
// "dc" is filler because "Washington DC" and "Washington" must be one route.
const FILLER = /\b(line|route|rte|train|bus|ferry|the|station|stop|terminal|dc)\b/g;

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(FILLER, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function routeKeyFor(
  mode: TravelMode,
  routeId: string | undefined,
  routeText: string,
  direction: string,
  stationOrCode = '',
  oneOff = false,
): string {
  // Venue-wide matching is only for people in motion: ONE-OFF place
  // check-ins (including the flight→airport bridge) key on the code alone,
  // so travelers passing through BWI today all meet. RECURRING places key
  // on the exact spot — a rail-platform regular can't get through security
  // to Gate C, so cross-checkpoint matches would be unmeetable. Trains,
  // buses, and flights stay route-exact. Mirrors public.route_key_v3.
  if (mode === 'place' && oneOff && stationOrCode.trim()) {
    return `place:${normalizeText(stationOrCode)}:regular`;
  }
  const route = routeId ?? normalizeText(routeText);
  return `${mode}:${route}:${normalizeText(direction)}`;
}

export const IATA = /^[A-Za-z]{3}$/;

/** Compose the stored route/direction fields from structured ground-transit input. */
export function groundRoute(agency: string, line: string, toward: string) {
  return {
    routeOrLine: `${agency.trim()} ${line.trim()}`.trim(),
    direction: `Toward ${toward.trim()}`,
  };
}

export function flightRoute(from: string, to: string) {
  return {
    routeOrLine: `${from.trim().toUpperCase()} → ${to.trim().toUpperCase()}`,
    direction: 'One way',
  };
}

export function placeRoute(venue: string, code: string) {
  return {
    routeOrLine: `${venue.trim()}${code.trim() ? ` (${code.trim().toUpperCase()})` : ''}`,
    direction: 'Regular',
  };
}
