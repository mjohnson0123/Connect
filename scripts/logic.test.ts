import assert from 'node:assert/strict';
import test from 'node:test';
import { filterMessage } from '../src/lib/contentFilter';
import { flightRoute, groundRoute, IATA, normalizeText, placeRoute, routeKeyFor } from '../src/domain/routes';
import { INDUSTRIES, INDUSTRY_GROUPS } from '../src/domain/vocab';
import { nextRoute } from '../src/lib/routeGate';
import { formatClock, formatDays, formatRemaining, HOUR, MINUTE } from '../src/lib/time';

/**
 * Unit tests for the pure business logic. Run: npm test
 * (bundled with esbuild, executed with node:test — no jest infrastructure)
 */

// ── Content filter: the anti-solicitation boundary ───────────────────────────
test('filter blocks phone numbers in common formats', () => {
  for (const msg of [
    'Call me at 410-555-0182',
    'text 4105550182',
    '+1 (410) 555 0182 anytime',
    'my number is 410.555.0182',
  ]) {
    assert.equal(filterMessage(msg).ok, false, msg);
  }
});

test('filter blocks emails including obfuscations', () => {
  for (const msg of ['reach me: bob@example.com', 'bob [at] example [dot] com', 'bob(at)gmail(dot)com']) {
    assert.equal(filterMessage(msg).ok, false, msg);
  }
});

test('filter blocks links and social handles', () => {
  for (const msg of [
    'check https://example.com',
    'www.mysite.io has details',
    'my site is coolstuff.com',
    'find me @bobsmith22',
    'add me on instagram',
    'I am on linkedin, look me up',
  ]) {
    assert.equal(filterMessage(msg).ok, false, msg);
  }
});

test('filter blocks solicitation language', () => {
  for (const msg of [
    'you should check out my new course',
    'great investment opportunity for you',
    'join my team, passive income guaranteed',
    'limited time offer on coaching',
  ]) {
    assert.equal(filterMessage(msg).ok, false, msg);
  }
});

test('filter passes normal professional conversation', () => {
  for (const msg of [
    'Great to connect — happy to chat Thursday.',
    'I usually catch the 7:12 from Penn Station.',
    'Meet at gate 12 around 8:30?',
    'I spent 5 years in fintech before switching.',
    'The Q3 numbers were rough, 15% down.',
  ]) {
    const res = filterMessage(msg);
    assert.equal(res.ok, true, `false positive on: ${msg} → ${res.violations}`);
  }
});

// ── Route keys: the matching backbone ────────────────────────────────────────
test('normalizeText strips filler words, case, punctuation', () => {
  assert.equal(normalizeText('Penn Line'), 'penn');
  assert.equal(normalizeText('MARC'), 'marc');
  assert.equal(normalizeText('Route 120'), '120');
  assert.equal(normalizeText('  The A Train!! '), 'a');
});

test('same route described differently produces the same key', () => {
  const a = groundRoute('MARC', 'Penn Line', 'Washington');
  const b = groundRoute('marc', 'penn', 'washington');
  assert.equal(
    routeKeyFor('train', undefined, a.routeOrLine, a.direction),
    routeKeyFor('train', undefined, b.routeOrLine, b.direction),
  );
});

test('direction separates the two crowds on one line', () => {
  const toDC = groundRoute('MARC', 'Penn', 'Washington');
  const toBal = groundRoute('MARC', 'Penn', 'Baltimore');
  assert.notEqual(
    routeKeyFor('train', undefined, toDC.routeOrLine, toDC.direction),
    routeKeyFor('train', undefined, toBal.routeOrLine, toBal.direction),
  );
});

test('flight and place routes compose predictably', () => {
  assert.equal(flightRoute('bwi', 'BOS').routeOrLine, 'BWI → BOS');
  assert.ok(IATA.test('BWI'));
  assert.ok(!IATA.test('BW1'));
  assert.equal(placeRoute('Gate C concourse', 'bwi').routeOrLine, 'Gate C concourse (BWI)');
});

test('demo riders key matches structured user input', () => {
  // Pending migration 0009 sets demo patterns to 'MARC Penn' / 'Toward Washington';
  // a user entering MARC / Penn / Washington must land on the same key.
  const user = groundRoute('MARC', 'Penn', 'Washington');
  assert.equal(
    routeKeyFor('train', undefined, user.routeOrLine, user.direction),
    routeKeyFor('train', undefined, 'MARC Penn', 'Toward Washington'),
  );
});

// ── Time helpers ─────────────────────────────────────────────────────────────
test('formatRemaining rounds sanely at boundaries', () => {
  const now = 1_000_000_000_000;
  assert.equal(formatRemaining(now + 3 * HOUR, now), '3h 0m');
  assert.equal(formatRemaining(now + 3 * HOUR - 1000, now), '3h 0m');
  assert.equal(formatRemaining(now + 61_000, now), '2m');
  assert.equal(formatRemaining(now - MINUTE, now), '0m');
});

test('formatDays compresses common patterns', () => {
  assert.equal(formatDays([1, 2, 3, 4, 5]), 'Weekdays');
  assert.equal(formatDays([0, 1, 2, 3, 4, 5, 6]), 'Daily');
  assert.equal(formatDays([2, 4]), 'Tu Th');
});

test('formatClock zero-pads', () => {
  const d = new Date(2026, 0, 5, 7, 5).getTime();
  assert.equal(formatClock(d), '07:05');
});

// ── Onboarding gate: order produced real field bugs — keep it pinned ─────────
test('gate: fresh signup sees the tour before verification or profile', () => {
  // Bug regression: tour used to fire AFTER profile setup.
  assert.equal(
    nextRoute({ myId: 'u1', hasProfile: true, verified: false, hasDisplayName: false, tourSeen: false }),
    '/tour',
  );
});

test('gate: after the tour, onboarding continues to verification, then profile', () => {
  assert.equal(
    nextRoute({ myId: 'u1', hasProfile: true, verified: false, hasDisplayName: false, tourSeen: true }),
    '/onboarding/verify',
  );
  assert.equal(
    nextRoute({ myId: 'u1', hasProfile: true, verified: true, hasDisplayName: false, tourSeen: true }),
    '/onboarding/profile',
  );
  // Bug regression: finishing the tour must land in the app, never back on welcome.
  assert.equal(
    nextRoute({ myId: 'u1', hasProfile: true, verified: true, hasDisplayName: true, tourSeen: true }),
    '/(tabs)',
  );
});

test('gate: signed out goes to welcome; loading state redirects nowhere', () => {
  assert.equal(
    nextRoute({ myId: null, hasProfile: false, verified: false, hasDisplayName: false, tourSeen: false }),
    '/onboarding/welcome',
  );
  assert.equal(
    nextRoute({ myId: 'u1', hasProfile: false, verified: false, hasDisplayName: false, tourSeen: false }),
    null,
  );
});

test('“Washington DC” and “Washington” converge to one route', () => {
  const dc = groundRoute('MARC', 'Camden', 'Washington DC');
  const plain = groundRoute('MARC', 'Camden', 'Washington');
  assert.equal(
    routeKeyFor('train', undefined, dc.routeOrLine, dc.direction),
    routeKeyFor('train', undefined, plain.routeOrLine, plain.direction),
  );
  assert.equal(
    routeKeyFor('train', undefined, dc.routeOrLine, dc.direction),
    'train:marc-camden:toward-washington',
  );
});

// ── Place keys (mirrors public.route_key_v3) ────────────────────────────────
// Venue-wide is ONLY for one-offs (people in motion); recurring places match
// the exact spot — a rail regular can't get through security to a gate.
test('one-off check-ins converge venue-wide; recurring places stay spot-exact', () => {
  const passing = placeRoute('Passing through', 'BWI');
  const layover = placeRoute('Layover', 'bwi');
  assert.equal(
    routeKeyFor('place', undefined, passing.routeOrLine, passing.direction, 'BWI', true),
    routeKeyFor('place', undefined, layover.routeOrLine, layover.direction, 'bwi', true),
  );
  assert.equal(
    routeKeyFor('place', undefined, passing.routeOrLine, passing.direction, 'BWI', true),
    'place:bwi:regular',
  );
  // Same airport, different spots, recurring: NOT a match.
  const bar = placeRoute('Whitmore Bar', 'BWI');
  const gate = placeRoute('Gate B12', 'BWI');
  assert.notEqual(
    routeKeyFor('place', undefined, bar.routeOrLine, bar.direction, 'BWI', false),
    routeKeyFor('place', undefined, gate.routeOrLine, gate.direction, 'BWI', false),
  );
  // Same spot text converges for regulars (filler words stripped).
  assert.equal(
    routeKeyFor('place', undefined, 'Amtrak platform (BWI)', 'Regular', 'BWI', false),
    routeKeyFor('place', undefined, 'The Amtrak Platform (BWI)', 'Regular', 'BWI', false),
  );
});

test('one-off with no code falls back to the spot text', () => {
  const noCode = placeRoute('Union Market', '');
  assert.equal(
    routeKeyFor('place', undefined, noCode.routeOrLine, noCode.direction, '', true),
    'place:union-market:regular',
  );
});

test('trains and flights keep exact-route keys regardless of stationOrCode', () => {
  const marc = groundRoute('MARC', 'Penn Line', 'Washington');
  assert.equal(
    routeKeyFor('train', undefined, marc.routeOrLine, marc.direction, 'BAL'),
    'train:marc-penn:toward-washington',
  );
  const fl = flightRoute('bwi', 'bos');
  assert.equal(
    routeKeyFor('flight', undefined, fl.routeOrLine, fl.direction, 'BWI'),
    routeKeyFor('flight', undefined, fl.routeOrLine, fl.direction, ''),
  );
});

// ── Vocabulary: tags are stored on profiles — groups must never mutate them ──
test('industry groups preserve the canonical tag set (no drops, no dupes)', () => {
  assert.equal(INDUSTRIES.length, 37);
  assert.equal(new Set(INDUSTRIES).size, 37);
  assert.equal(
    INDUSTRY_GROUPS.reduce((n, g) => n + g.fields.length, 0),
    INDUSTRIES.length,
  );
});

test('gate: returning verified user on a new device gets the tour once, then the app', () => {
  assert.equal(
    nextRoute({ myId: 'u1', hasProfile: true, verified: true, hasDisplayName: true, tourSeen: false }),
    '/tour',
  );
});
