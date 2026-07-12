import assert from 'node:assert/strict';
import test from 'node:test';
import { filterMessage } from '../src/lib/contentFilter';
import { flightRoute, groundRoute, IATA, normalizeText, placeRoute, routeKeyFor } from '../src/domain/routes';
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
