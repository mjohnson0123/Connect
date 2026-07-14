import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import BoardRow from '../../src/components/BoardRow';
import Screen from '../../src/components/Screen';
import SplitFlap from '../../src/components/SplitFlap';
import { Button } from '../../src/components/ui';
import { modeCode } from '../../src/domain/vocab';
import {
  cancelReminders,
  ensurePermission,
  remindersSupported,
  schedulePatternReminders,
} from '../../src/lib/reminders';
import { formatRemaining } from '../../src/lib/time';
import { useStore } from '../../src/store/useStore';
import { color, radius, space, type } from '../../src/theme/tokens';

/**
 * THE BOARD — the app's single home for routes (PRD §5.3). One departure
 * board carries it all: declare trips, check in ("I'm traveling now"),
 * see live counts, and drill into who's on a route. Counts come from the
 * board_summary RPC (aggregates before identities). Split-flap moment #1
 * fires when a check-in goes live. This absorbed the former Trips tab —
 * two tabs were rendering the same list with different buttons.
 */
export default function Board() {
  const router = useRouter();
  const board = useStore((s) => s.board);
  const refresh = useStore((s) => s.refresh);
  const checkIn = useStore((s) => s.checkIn);
  const endCheckIn = useStore((s) => s.endCheckIn);
  const removePattern = useStore((s) => s.removePattern);
  const reminders = useStore((s) => s.reminders);
  const setReminder = useStore((s) => s.setReminder);
  const [justCheckedIn, setJustCheckedIn] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  // Tick each half-minute so "Xm left" and expired check-ins roll over live.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();

  const toggleReminder = async (patternId: string) => {
    const entry = board.find((b) => b.pattern.id === patternId);
    if (!entry) return;
    if (!remindersSupported()) {
      Alert.alert('Not available here', 'Reminders work in the installed app, not the web preview.');
      return;
    }
    const existing = reminders[patternId];
    if (existing) {
      await cancelReminders(existing);
      setReminder(patternId, null);
      return;
    }
    const ok = await ensurePermission();
    if (!ok) {
      Alert.alert('Notifications are off', 'Allow notifications for Commuter Connect in system settings to get window reminders.');
      return;
    }
    const ids = await schedulePatternReminders(entry.pattern);
    setReminder(patternId, ids);
  };

  const confirmRemove = (id: string, label: string) => {
    Alert.alert('Remove trip pattern?', `“${label}” and any active check-in on it will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void removePattern(id) },
    ]);
  };

  return (
    <Screen>
      <Text style={styles.boardDate}>
        {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}
      </Text>

      {justCheckedIn ? (
        <View style={styles.flapBanner}>
          <SplitFlap text="ON BOARD" cellSize={30} />
          <Text style={styles.flapCaption}>
            You’re discoverable to people on this route for the next 3 hours — end it
            anytime. Nothing about your position is shared, only the shared route.
          </Text>
        </View>
      ) : null}

      {board.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No routes on your board yet</Text>
          <Text style={styles.emptyBody}>
            Declare a trip you take regularly — a train line, a flight route, a place —
            and this board shows who else on it is open to a professional conversation.
          </Text>
          <Button label="Add your first trip" onPress={() => router.push('/add-pattern')} />
          <Button
            label="Passing through somewhere today?"
            variant="quiet"
            onPress={() => router.push('/here-now')}
          />
        </View>
      ) : (
        <View style={{ gap: space(4) }}>
          {board.map(({ pattern: p, liveCount, memberCount, checkedInUntil }, i) => {
            const active = !!checkedInUntil && checkedInUntil > now;
            return (
              <View key={p.id} style={styles.card}>
                <BoardRow
                  left={modeCode(p.mode)}
                  leftSub={p.oneOff ? 'TODAY' : `${p.windowStart}–${p.windowEnd}`}
                  title={p.routeOrLine}
                  subtitle={
                    active
                      ? `${liveCount} ${liveCount === 1 ? 'person' : 'people'} here now — tap to see who`
                      : liveCount > 0
                        ? `${liveCount} ${liveCount === 1 ? 'person who shares' : 'people who share'} this ${p.mode === 'place' ? 'spot' : 'commute'} checked in now`
                        : memberCount > 0
                          ? `${memberCount} ${memberCount === 1 ? 'person rides' : 'people ride'} this route · nobody’s checked in yet — be the flip`
                          : 'You’re first on this route — it grows from here'
                  }
                  live={active}
                  index={i}
                  onPress={() => router.push({ pathname: '/pattern/[id]', params: { id: p.id } })}
                />
                <View style={styles.cardActions}>
                  {active ? (
                    <>
                      <Text style={styles.window}>
                        LIVE · {formatRemaining(checkedInUntil, now)} REMAINING
                      </Text>
                      <Button label="End check-in" variant="quiet" onPress={() => void endCheckIn(p.id)} />
                    </>
                  ) : p.oneOff ? (
                    <Text style={styles.emptyBody}>Ended — this clears off your board within the hour.</Text>
                  ) : (
                    <>
                      <Button
                        label={busyId === p.id ? 'Checking in…' : 'I’m traveling now'}
                        disabled={busyId === p.id}
                        onPress={() => {
                          setBusyId(p.id);
                          void checkIn(p.id).then((err) => {
                            setBusyId(null);
                            if (err) {
                              Alert.alert('Check-in didn’t go through', err);
                              return;
                            }
                            setJustCheckedIn(p.id);
                          });
                        }}
                        style={{ flexGrow: 1 }}
                      />
                      <Button
                        label={reminders[p.id] ? '🔔 Reminding' : 'Remind me'}
                        variant="quiet"
                        onPress={() => void toggleReminder(p.id)}
                      />
                      <Button label="Remove" variant="quiet" onPress={() => confirmRemove(p.id, p.routeOrLine)} />
                    </>
                  )}
                </View>
              </View>
            );
          })}
          <Button label="Add a trip pattern" variant="ink" onPress={() => router.push('/add-pattern')} />
          <Button
            label="Passing through somewhere today?"
            variant="quiet"
            onPress={() => router.push('/here-now')}
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  boardDate: { ...type.monoSmall, color: color.textMutedOnChalk, marginBottom: space(3), marginTop: space(1) },
  flapBanner: {
    backgroundColor: color.ink,
    borderRadius: radius.card,
    padding: space(4),
    gap: space(3),
    marginBottom: space(3),
  },
  flapCaption: { ...type.caption, color: color.textMutedOnInk },
  empty: { gap: space(4), paddingTop: space(10) },
  emptyTitle: { ...type.title, color: color.textOnChalk },
  emptyBody: { ...type.body, color: color.textMutedOnChalk },
  card: { gap: space(2.5) },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: space(2.5), flexWrap: 'wrap' },
  window: { ...type.mono, color: color.signal, flexGrow: 1 },
});
