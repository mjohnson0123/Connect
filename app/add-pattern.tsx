import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Screen from '../src/components/Screen';
import { Button, Chip, Field } from '../src/components/ui';
import { flightRoute, groundRoute, IATA, placeRoute, routeKeyFor } from '../src/domain/routes';
import { TravelMode } from '../src/domain/types';
import { MODES, modeCode } from '../src/domain/vocab';
import { useStore } from '../src/store/useStore';
import { color, font, radius, space, type } from '../src/theme/tokens';

const DAY_OPTIONS = [
  { d: 1, label: 'Mo' },
  { d: 2, label: 'Tu' },
  { d: 3, label: 'We' },
  { d: 4, label: 'Th' },
  { d: 5, label: 'Fr' },
  { d: 6, label: 'Sa' },
  { d: 0, label: 'Su' },
];

const TIME = /^([01]?\d|2[0-3]):[0-5]\d$/;

/**
 * TripPattern declaration (PRD §5.3). Structured fields per mode — not free
 * text, not a maintained catalog — so any two people describing the same
 * route normalize to the same matching key anywhere in the world.
 */
export default function AddPattern() {
  const router = useRouter();
  const addPattern = useStore((s) => s.addPattern);
  const patterns = useStore((s) => s.patterns);

  const [mode, setMode] = useState<TravelMode>('train');
  const [agency, setAgency] = useState('');
  const [line, setLine] = useState('');
  const [toward, setToward] = useState('');
  const [fromCode, setFromCode] = useState('');
  const [toCode, setToCode] = useState('');
  const [venue, setVenue] = useState('');
  const [venueCode, setVenueCode] = useState('');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [start, setStart] = useState('06:45');
  const [end, setEnd] = useState('07:30');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isFlight = mode === 'flight';
  const isPlace = mode === 'place';

  const composed = isFlight
    ? IATA.test(fromCode) && IATA.test(toCode)
      ? flightRoute(fromCode, toCode)
      : null
    : isPlace
      ? venue.trim()
        ? placeRoute(venue, venueCode)
        : null
      : agency.trim() && line.trim() && toward.trim()
        ? groundRoute(agency, line, toward)
        : null;

  const toggleDay = (d: number) =>
    setDays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]));

  const submit = async () => {
    if (!composed) {
      setError(
        isFlight
          ? 'Enter both airports as 3-letter codes (e.g. BWI, BOS).'
          : isPlace
            ? 'Enter the place.'
            : 'Fill in operator, line, and direction.',
      );
      return;
    }
    if (days.length === 0) {
      setError('Pick at least one day.');
      return;
    }
    if (!TIME.test(start) || !TIME.test(end)) {
      setError('Times must be HH:MM (24-hour), e.g. 06:45.');
      return;
    }
    if (end <= start) {
      setError('The window has to end after it starts.');
      return;
    }
    const codeForKey = isFlight ? fromCode.trim() : venueCode.trim();
    const newKey = routeKeyFor(mode, undefined, composed.routeOrLine, composed.direction, codeForKey, false);
    if (patterns.some((pt) => routeKeyFor(pt.mode, pt.routeId, pt.routeOrLine, pt.direction, pt.stationOrCode, pt.oneOff) === newKey)) {
      setError('This route is already on your board.');
      return;
    }
    setBusy(true);
    const err = await addPattern({
      mode,
      routeOrLine: composed.routeOrLine,
      direction: composed.direction,
      daysOfWeek: days,
      windowStart: start,
      windowEnd: end,
      stationOrCode: isFlight ? fromCode.trim().toUpperCase() : venueCode.trim().toUpperCase(),
    });
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    router.back();
  };

  return (
    <Screen>
      <View style={{ gap: space(5), paddingTop: space(4) }}>
        <View style={{ gap: space(2.5) }}>
          <Text style={styles.label}>MODE</Text>
          <View style={styles.chips}>
            {MODES.map((m) => (
              <Chip key={m.value} label={m.label} selected={mode === m.value} onPress={() => setMode(m.value)} />
            ))}
          </View>
        </View>

        {isFlight ? (
          <View style={{ flexDirection: 'row', gap: space(3) }}>
            <View style={{ flex: 1 }}>
              <Field
                label="From (airport code)"
                value={fromCode}
                onChangeText={(t) => setFromCode(t.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase())}
                autoCapitalize="characters"
                placeholder="BWI"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="To (airport code)"
                value={toCode}
                onChangeText={(t) => setToCode(t.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase())}
                autoCapitalize="characters"
                placeholder="BOS"
              />
            </View>
          </View>
        ) : isPlace ? (
          <>
            <Field label="Place" value={venue} onChangeText={setVenue} placeholder="Gate C concourse" />
            <Field
              label="Airport / station code (optional)"
              value={venueCode}
              onChangeText={setVenueCode}
              autoCapitalize="characters"
              placeholder="BWI"
            />
          </>
        ) : (
          <>
            <Field label="Operator / agency" value={agency} onChangeText={setAgency} placeholder="MARC" />
            <Field label="Line or route number" value={line} onChangeText={setLine} placeholder="Penn" />
            <Field label="Toward (end of the line you ride to)" value={toward} onChangeText={setToward} placeholder="Washington" />
          </>
        )}

        {composed ? (
          <View style={styles.keyPreview}>
            <Text style={styles.keyLabel}>MATCHES AS</Text>
            <Text style={styles.keyText}>
              {modeCode(mode)} · {routeKeyFor(mode, undefined, composed.routeOrLine, composed.direction, isFlight ? fromCode.trim() : venueCode.trim()).split(':').slice(1).join(' · ').toUpperCase()}
            </Text>
          </View>
        ) : null}

        <View style={{ gap: space(2.5) }}>
          <Text style={styles.label}>TYPICAL DAYS</Text>
          <View style={styles.chips}>
            {DAY_OPTIONS.map(({ d, label }) => (
              <Pressable
                key={d}
                onPress={() => toggleDay(d)}
                accessibilityRole="button"
                accessibilityState={{ selected: days.includes(d) }}
                style={[styles.day, days.includes(d) && styles.daySelected]}
              >
                <Text style={[styles.dayLabel, days.includes(d) && styles.dayLabelSelected]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: space(3) }}>
          <View style={{ flex: 1 }}>
            <Field label="Window start" value={start} onChangeText={setStart} placeholder="06:45" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Window end" value={end} onChangeText={setEnd} placeholder="07:30" />
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label={busy ? 'Adding…' : 'Add to your board'} onPress={submit} disabled={busy} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { ...type.monoSmall, color: color.textMutedOnChalk },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  error: { ...type.caption, color: color.caution },
  keyPreview: {
    backgroundColor: color.ink,
    borderRadius: radius.row,
    padding: space(3.5),
    gap: space(1),
  },
  keyLabel: { ...type.monoSmall, color: color.textMutedOnInk },
  keyText: { ...type.monoBoard, color: color.amberOnInk },
  day: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: color.hairline,
    backgroundColor: color.chalkRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelected: { backgroundColor: color.ink, borderColor: color.ink },
  dayLabel: { fontFamily: font.mono, fontSize: 12, color: color.textOnChalk },
  dayLabelSelected: { color: color.textOnInk },
});
