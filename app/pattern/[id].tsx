import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import Screen from '../../src/components/Screen';
import { Button, Chip, Monogram, VerifiedBadge } from '../../src/components/ui';
import { modeCode, reasonLabel } from '../../src/domain/vocab';
import { isBlockedEitherWay, MY_ID, patternsMatch, useStore } from '../../src/store/useStore';
import { color, radius, space, type } from '../../src/theme/tokens';

/**
 * Identities behind the aggregate count (PRD §5.3): profile cards for people
 * checked in on this shared route/window. No positions, no map — membership
 * in a shared pattern is the only thing revealed.
 */
export default function PatternPeople() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const patterns = useStore((s) => s.patterns);
  const checkIns = useStore((s) => s.checkIns);
  const users = useStore((s) => s.users);
  const blocks = useStore((s) => s.blocks);
  const blockUser = useStore((s) => s.blockUser);

  const pattern = patterns.find((p) => p.id === id);
  if (!pattern) return null;

  const now = Date.now();
  const people = checkIns
    .filter((c) => c.activeUntil > now && c.userId !== MY_ID)
    .filter((c) => {
      const tp = patterns.find((p) => p.id === c.tripPatternId);
      return !!tp && patternsMatch(pattern, tp);
    })
    .filter((c) => !isBlockedEitherWay(blocks, MY_ID, c.userId))
    .map((c) => users.find((u) => u.id === c.userId))
    .filter((u): u is NonNullable<typeof u> => !!u && u.standing !== 'banned' && u.standing !== 'suspended');

  const confirmBlock = (userId: string, name: string) => {
    Alert.alert(
      `Block ${name}?`,
      'They won’t be notified. You’ll disappear from each other everywhere — discovery, requests, and conversations.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: () => blockUser(userId) },
      ],
    );
  };

  return (
    <Screen>
      <View style={{ gap: space(4), paddingTop: space(2) }}>
        <View style={styles.routeHead}>
          <Text style={styles.routeCode}>
            {modeCode(pattern.mode)} · {pattern.windowStart}–{pattern.windowEnd}
          </Text>
          <Text style={styles.routeName}>{pattern.routeOrLine}</Text>
          <Text style={styles.routeSub}>{pattern.direction}</Text>
        </View>

        {people.length === 0 ? (
          <Text style={styles.emptyLine}>
            Nobody who shares this route is checked in right now. Check in yourself so
            others can find you when they look.
          </Text>
        ) : (
          people.map((u) => (
            <View key={u.id} style={styles.card}>
              <View style={styles.cardHead}>
                <Monogram text={u.photo} />
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
                  onPress={() => router.push({ pathname: '/request/[userId]', params: { userId: u.id } })}
                  style={{ flex: 1 }}
                />
                <Button
                  label="Block"
                  variant="quiet"
                  onPress={() => confirmBlock(u.id, u.displayName)}
                />
                <Button
                  label="Report"
                  variant="quiet"
                  onPress={() => router.push({ pathname: '/report', params: { reportedId: u.id } })}
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
