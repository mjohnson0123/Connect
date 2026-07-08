import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Screen from '../src/components/Screen';
import { Button, Chip, Field, Hairline } from '../src/components/ui';
import { CatalogRoute, searchCatalog } from '../src/domain/routes';
import { TravelMode } from '../src/domain/types';
import { MODES } from '../src/domain/vocab';
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
 * TripPattern declaration (PRD §5.3), catalog-first: picking a route from the
 * catalog gives it a canonical id so everyone on that route lands on the same
 * matching key. Custom routes still work — they just only match people who
 * entered the same thing.
 */
export default function AddPattern() {
  const router = useRouter();
  const addPattern = useStore((s) => s.addPattern);

  const [mode, setMode] = useState<TravelMode>('train');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<CatalogRoute | null>(null);
  const [custom, setCustom] = useState(false);
  const [route, setRoute] = useState('');
  const [direction, setDirection] = useState('');
  const [station, setStation] = useState('');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [start, setStart] = useState('06:45');
  const [end, setEnd] = useState('07:30');
  const [error, setError] = useState<string | null>(null);

  const matches = useMemo(() => searchCatalog(mode, query), [mode, query]);

  const pickRoute = (r: CatalogRoute) => {
    setPicked(r);
    setCustom(false);
    setRoute(r.label);
    setDirection(r.directions[0]);
    if (r.code) setStation(r.code);
  };

  const resetRoute = () => {
    setPicked(null);
    setCustom(false);
    setRoute('');
    setDirection('');
    setQuery('');
  };

  const toggleDay = (d: number) =>
    setDays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]));

  const submit = () => {
    if (!route.trim() || !direction.trim()) {
      setError('Pick a route and direction.');
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
      routeId: picked?.id,
      routeOrLine: route.trim(),
      direction: direction.trim(),
      daysOfWeek: days,
      windowStart: start,
      windowEnd: end,
      stationOrCode: station.trim().toUpperCase(),
    });
    router.back();
  };

  const routeChosen = !!picked || custom;

  return (
    <Screen>
      <View style={{ gap: space(5), paddingTop: space(4) }}>
        <View style={{ gap: space(2.5) }}>
          <Text style={styles.label}>MODE</Text>
          <View style={styles.chips}>
            {MODES.map((m) => (
              <Chip
                key={m.value}
                label={m.label}
                selected={mode === m.value}
                onPress={() => {
                  setMode(m.value);
                  resetRoute();
                }}
              />
            ))}
          </View>
        </View>

        {!routeChosen ? (
          <View style={{ gap: space(2.5) }}>
            <Field
              label="Find your route"
              value={query}
              onChangeText={setQuery}
              placeholder="Search lines, airports, places…"
            />
            <View style={{ gap: space(1.5) }}>
              {matches.slice(0, 6).map((r) => (
                <Pressable key={r.id} onPress={() => pickRoute(r)} style={styles.routeRow} accessibilityRole="button">
                  <Text style={styles.routeCode}>{r.code ?? '—'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.routeLabel}>{r.label}</Text>
                    <Text style={styles.routeRegion}>{r.region}</Text>
                  </View>
                </Pressable>
              ))}
              {matches.length === 0 ? (
                <Text style={styles.note}>Nothing in the catalog for that yet.</Text>
              ) : null}
            </View>
            <Hairline />
            <Button label="My route isn’t listed — enter it manually" variant="quiet" onPress={() => setCustom(true)} />
            <Text style={styles.note}>
              Catalog routes match you with everyone on the same line automatically.
              Manual routes only match people who typed the same thing.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.pickedBox}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{picked ? 'ROUTE (CATALOG)' : 'CUSTOM ROUTE'}</Text>
                {picked ? <Text style={styles.routeLabel}>{picked.label}</Text> : null}
              </View>
              <Button label="Change" variant="quiet" onPress={resetRoute} />
            </View>

            {custom ? (
              <>
                <Field
                  label={mode === 'place' ? 'Place' : 'Route or line'}
                  value={route}
                  onChangeText={setRoute}
                  placeholder={mode === 'place' ? 'Gate C concourse, BWI' : 'MARC Penn Line'}
                />
                <Field label="Direction" value={direction} onChangeText={setDirection} placeholder="Baltimore → DC" />
              </>
            ) : picked && picked.directions.length > 1 ? (
              <View style={{ gap: space(2.5) }}>
                <Text style={styles.label}>DIRECTION</Text>
                <View style={styles.chips}>
                  {picked.directions.map((d) => (
                    <Chip key={d} label={d} selected={direction === d} onPress={() => setDirection(d)} />
                  ))}
                </View>
              </View>
            ) : null}

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
          </>
        )}

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
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    padding: space(3),
    backgroundColor: color.chalkRaised,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  routeCode: { ...type.monoBoard, color: color.textOnChalk, width: 44 },
  routeLabel: { ...type.headline, color: color.textOnChalk },
  routeRegion: { ...type.caption, color: color.textMutedOnChalk },
  pickedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    padding: space(3.5),
    backgroundColor: color.chalkRaised,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: color.hairline,
  },
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
