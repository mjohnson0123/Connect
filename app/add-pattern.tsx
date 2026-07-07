import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Screen from '../src/components/Screen';
import { Button, Chip, Field } from '../src/components/ui';
import { TravelMode } from '../src/domain/types';
import { MODES } from '../src/domain/vocab';
import { useStore } from '../src/store/useStore';
import { color, font, space, type } from '../src/theme/tokens';

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
 * TripPattern declaration (PRD §5.3): mode-agnostic — the same form covers a
 * train line, a flight route, a ferry, or a recurring place. Low-frequency,
 * declared data; no location permission involved.
 */
export default function AddPattern() {
  const router = useRouter();
  const addPattern = useStore((s) => s.addPattern);

  const [mode, setMode] = useState<TravelMode>('train');
  const [route, setRoute] = useState('');
  const [direction, setDirection] = useState('');
  const [station, setStation] = useState('');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [start, setStart] = useState('06:45');
  const [end, setEnd] = useState('07:30');
  const [error, setError] = useState<string | null>(null);

  const toggleDay = (d: number) =>
    setDays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]));

  const submit = () => {
    if (!route.trim() || !direction.trim()) {
      setError('Route and direction are required.');
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
    addPattern({
      mode,
      routeOrLine: route.trim(),
      direction: direction.trim(),
      daysOfWeek: days,
      windowStart: start,
      windowEnd: end,
      stationOrCode: station.trim().toUpperCase(),
    });
    router.back();
  };

  const placeholders: Record<TravelMode, { route: string; direction: string }> = {
    train: { route: 'MARC Penn Line', direction: 'Baltimore → DC' },
    flight: { route: 'BWI → BOS', direction: 'Northbound' },
    bus: { route: 'MTA 120 Commuter', direction: 'Inbound' },
    boat: { route: 'Wall St ↔ Hoboken Ferry', direction: 'Westbound' },
    rideshare: { route: 'I-95 vanpool', direction: 'Southbound' },
    place: { route: 'Gate C concourse, BWI', direction: 'Regular' },
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

        <Field
          label={mode === 'place' ? 'Place' : 'Route or line'}
          value={route}
          onChangeText={setRoute}
          placeholder={placeholders[mode].route}
        />
        <Field
          label="Direction"
          value={direction}
          onChangeText={setDirection}
          placeholder={placeholders[mode].direction}
        />
        <Field
          label="Station / airport code (optional)"
          value={station}
          onChangeText={setStation}
          autoCapitalize="characters"
          placeholder="BAL"
        />

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
        <Button label="Add to your board" onPress={submit} />
        <Text style={styles.note}>
          A pattern only says “I’m often here around this time.” You stay invisible
          until you actively check in, and check-ins end on their own within 3 hours.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { ...type.monoSmall, color: color.textMutedOnChalk },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  error: { ...type.caption, color: color.caution },
  note: { ...type.caption, color: color.textMutedOnChalk },
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
