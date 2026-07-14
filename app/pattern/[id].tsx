import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import Screen from '../../src/components/Screen';
import { Button, Chip, Monogram, VerifiedBadge } from '../../src/components/ui';
import { modeCode, reasonLabel } from '../../src/domain/vocab';
import {
  cancelReminders,
  ensurePermission,
  remindersSupported,
  schedulePatternReminders,
} from '../../src/lib/reminders';
import { useStore } from '../../src/store/useStore';
import { color, radius, space, type } from '../../src/theme/tokens';

/**
 * Identities behind the aggregate count (PRD §5.3). The route_people RPC only
 * returns people with an active check-in on this shared route — no positions,
 * no browsing beyond the shared pattern.
 */
export default function PatternPeople() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const board = useStore((s) => s.board);
  const people = useStore((s) => s.people);
  const loadPeople = useStore((s) => s.loadPeople);
  const blockUser = useStore((s) => s.blockUser);
  const removePattern = useStore((s) => s.removePattern);
  const reminders = useStore((s) => s.reminders);
  const setReminder = useStore((s) => s.setReminder);

  useFocusEffect(
    useCallback(() => {
      if (id) void loadPeople(id);
    }, [id, loadPeople]),
  );

  const entry = board.find((b) => b.pattern.id === id);
  if (!entry) return null;
  const pattern = entry.pattern;
  const cards = people[id ?? ''] ?? [];

  const toggleReminder = async () => {
    if (!remindersSupported()) {
      Alert.alert('Not available here', 'Reminders work in the installed app, not the web preview.');
      return;
    }
    const existing = reminders[pattern.id];
    if (existing) {
      await cancelReminders(existing);
      setReminder(pattern.id, null);
      return;
    }
    const ok = await ensurePermission();
    if (!ok) {
      Alert.alert('Notifications are off', 'Allow notifications for Commuter Connect in system settings to get window reminders.');
      return;
    }
    const ids = await schedulePatternReminders(pattern);
    setReminder(pattern.id, ids);
  };

  const confirmRemoveTrip = () => {
    Alert.alert('Remove trip pattern?', `“${pattern.routeOrLine}” and any active check-in on it will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void removePattern(pattern.id).then(() => router.back());
        },
      },
    ]);
  };

  const confirmBlock = (userId: string, name: string) => {
    Alert.alert(
      `Block ${name}?`,
      'They won’t be notified. You’ll disappear from each other everywhere — discovery, requests, and conversations.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: () => void blockUser(userId) },
      ],
    );
  };

  return (
    <Screen>
      <View style={{ gap: space(4), paddingTop: space(2) }}>
        <View style={styles.routeHead}>
          <Text style={styles.routeCode}>
            {modeCode(pattern.mode)} · {pattern.oneOff ? 'TODAY' : `${pattern.windowStart}–${pattern.windowEnd}`}
          </Text>
          <Text style={styles.routeName}>{pattern.routeOrLine}</Text>
          <Text style={styles.routeSub}>{pattern.direction}</Text>
        </View>

        {/* Trip management lives here, off the board — the board is a display. */}
        <View style={styles.manageRow}>
          {!pattern.oneOff ? (
            <Button
              label={reminders[pattern.id] ? '🔔 Reminding' : 'Remind me'}
              variant="quiet"
              onPress={() => void toggleReminder()}
            />
          ) : null}
          <Button label="Remove trip" variant="quiet" onPress={confirmRemoveTrip} />
        </View>

        {cards.length === 0 ? (
          <Text style={styles.emptyLine}>
            Nobody who shares this route is checked in right now. Check in yourself so
            others can find you when they look.
          </Text>
        ) : (
          cards.map((u) => (
            <View key={u.id} style={styles.card}>
              <View style={styles.cardHead}>
                <Monogram text={u.monogram} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
                    <Text style={styles.name}>{u.displayName}</Text>
                    {u.verificationStatus === 'verified' ? <VerifiedBadge compact /> : null}
                  </View>
                  <Text style={styles.headline}>{u.headline}</Text>
                </View>
              </View>
              <Text style={styles.bio}>{u.bio}</Text>
              <View style={styles.chips}>
                {u.reasonTags.map((t) => (
                  <Chip key={t} label={reasonLabel(t)} />
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: space(2.5) }}>
                <Button
                  label="Request to connect"
                  onPress={() =>
                    router.push({
                      pathname: '/request/[userId]',
                      params: { userId: u.id, name: u.displayName },
                    })
                  }
                  style={{ flex: 1 }}
                />
                <Button label="Block" variant="quiet" onPress={() => confirmBlock(u.id, u.displayName)} />
                <Button
                  label="Report"
                  variant="quiet"
                  onPress={() => router.push({ pathname: '/report', params: { reportedId: u.id, name: u.displayName } })}
                />
              </View>
            </View>
          ))
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  routeHead: { gap: 3 },
  manageRow: { flexDirection: 'row', gap: space(2.5), flexWrap: 'wrap' },
  routeCode: { ...type.mono, color: color.amberTextOnChalk },
  routeName: { ...type.title, color: color.textOnChalk },
  routeSub: { ...type.caption, color: color.textMutedOnChalk },
  emptyLine: { ...type.body, color: color.textMutedOnChalk },
  card: {
    backgroundColor: color.chalkRaised,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.hairline,
    padding: space(4),
    gap: space(3),
  },
  cardHead: { flexDirection: 'row', gap: space(3), alignItems: 'center' },
  name: { ...type.headline, color: color.textOnChalk },
  headline: { ...type.caption, color: color.textMutedOnChalk },
  bio: { ...type.body, color: color.textOnChalk },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
});
