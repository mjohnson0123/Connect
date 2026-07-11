import { useRouter } from 'expo-router';
import React, { useState } from 'react';
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
import { formatDays, formatRemaining } from '../../src/lib/time';
import { useStore } from '../../src/store/useStore';
import { color, radius, space, type } from '../../src/theme/tokens';

/**
 * Trip patterns + ephemeral check-in (PRD §5.3). The 3-hour window and
 * standing checks are enforced by the check_in RPC. Split-flap moment #1
 * fires when a check-in goes live.
 */
export default function Trips() {
  const router = useRouter();
  const board = useStore((s) => s.board);
  const checkIn = useStore((s) => s.checkIn);
  const endCheckIn = useStore((s) => s.endCheckIn);
  const removePattern = useStore((s) => s.removePattern);
  const reminders = useStore((s) => s.reminders);
  const setReminder = useStore((s) => s.setReminder);
  const [justCheckedIn, setJustCheckedIn] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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
      {justCheckedIn ? (
        <View style={styles.flapBanner}>
          <SplitFlap text="ON BOARD" cellSize={30} />
          <Text style={styles.flapCaption}>
            You’re discoverable to people on this route for the next 3 hours — end it
            anytime. Nothing about your position is shared, only the shared route.
          </Text>
        </View>
      ) : null}

      <View style={{ gap: space(2.5), paddingTop: space(2) }}>
        {board.length === 0 ? (
          <View style={{ gap: space(4), paddingTop: space(8) }}>
            <Text style={styles.emptyTitle}>Declare a recurring trip</Text>
            <Text style={styles.emptyBody}>
              “MARC Penn Line, Baltimore → DC, weekday mornings.” A pattern is just a
              declaration — you stay invisible until you check in.
            </Text>
          </View>
        ) : (
          board.map(({ pattern: p, checkedInUntil }) => {
            const active = !!checkedInUntil && checkedInUntil > now;
            return (
              <View key={p.id} style={styles.card}>
                <BoardRow
                  left={modeCode(p.mode)}
                  leftSub={`${p.windowStart}–${p.windowEnd}`}
                  title={p.routeOrLine}
                  subtitle={[p.direction, formatDays(p.daysOfWeek), p.stationOrCode].filter(Boolean).join(' · ')}
                  live={active}
                />
                <View style={styles.cardActions}>
                  {active ? (
                    <>
                      <Text style={styles.window}>
                        LIVE · {formatRemaining(checkedInUntil, now)} REMAINING
                      </Text>
                      <Button label="End check-in" variant="quiet" onPress={() => void endCheckIn(p.id)} />
                    </>
                  ) : (
                    <>
                      <Button
                        label={busyId === p.id ? 'Checking in…' : 'I’m traveling now'}
                        disabled={busyId === p.id}
                        onPress={() => {
                          setBusyId(p.id);
                          void checkIn(p.id).then(() => {
                            setBusyId(null);
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
          })
        )}
        <Button label="Add a trip pattern" variant="ink" onPress={() => router.push('/add-pattern')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flapBanner: {
    backgroundColor: color.ink,
    borderRadius: radius.card,
    padding: space(4),
    gap: space(3),
    marginTop: space(2),
    marginBottom: space(2),
  },
  flapCaption: { ...type.caption, color: color.textMutedOnInk },
  emptyTitle: { ...type.title, color: color.textOnChalk },
  emptyBody: { ...type.body, color: color.textMutedOnChalk },
  card: { gap: space(2.5) },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: space(2.5), flexWrap: 'wrap' },
  window: { ...type.mono, color: color.signal, flexGrow: 1 },
});
