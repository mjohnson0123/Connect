import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import BoardRow from '../../src/components/BoardRow';
import Screen from '../../src/components/Screen';
import { Button } from '../../src/components/ui';
import { modeCode } from '../../src/domain/vocab';
import { formatRemaining } from '../../src/lib/time';
import { isBlockedEitherWay, MY_ID, patternsMatch, useStore } from '../../src/store/useStore';
import { color, space, type } from '../../src/theme/tokens';

/**
 * Discovery board (PRD §5.3): aggregate counts before identities. Each of my
 * patterns shows how many people who share that route are checked in right
 * now — never a map, never a coordinate. Tapping opens the people list.
 */
export default function Board() {
  const router = useRouter();
  const patterns = useStore((s) => s.patterns);
  const checkIns = useStore((s) => s.checkIns);
  const users = useStore((s) => s.users);
  const blocks = useStore((s) => s.blocks);

  const now = Date.now();
  const myPatterns = patterns.filter((p) => p.userId === MY_ID);
  const active = checkIns.filter((c) => c.activeUntil > now);
  const myActive = active.filter((c) => c.userId === MY_ID);

  const rows = myPatterns.map((p) => {
    const overlapping = active.filter((c) => {
      if (c.userId === MY_ID) return false;
      const theirPattern = patterns.find((tp) => tp.id === c.tripPatternId);
      if (!theirPattern || !patternsMatch(p, theirPattern)) return false;
      if (isBlockedEitherWay(blocks, MY_ID, c.userId)) return false;
      const u = users.find((x) => x.id === c.userId);
      return !!u && u.standing !== 'banned' && u.standing !== 'suspended';
    });
    const mine = myActive.find((c) => c.tripPatternId === p.id);
    return { pattern: p, count: overlapping.length, checkedIn: !!mine, until: mine?.activeUntil };
  });

  return (
    <Screen>
      <Text style={styles.boardDate}>
        {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}
      </Text>

      {rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No routes on your board yet</Text>
          <Text style={styles.emptyBody}>
            Declare a trip you take regularly — a train line, a flight route, a place —
            and this board shows who else on it is open to a professional conversation.
          </Text>
          <Button label="Add your first trip" onPress={() => router.push('/add-pattern')} />
        </View>
      ) : (
        <View style={{ gap: space(2.5) }}>
          {rows.map(({ pattern, count, checkedIn, until }) => (
            <BoardRow
              key={pattern.id}
              left={modeCode(pattern.mode)}
              leftSub={`${pattern.windowStart}–${pattern.windowEnd}`}
              title={pattern.routeOrLine}
              subtitle={
                checkedIn
                  ? `You’re checked in · ${formatRemaining(until!, now)} left · ${count} ${count === 1 ? 'person' : 'people'} here now`
                  : count > 0
                    ? `${count} ${count === 1 ? 'person who shares' : 'people who share'} this ${pattern.mode === 'place' ? 'spot' : 'commute'} checked in now`
                    : 'Nobody checked in right now'
              }
              live={checkedIn}
              onPress={() => router.push({ pathname: '/pattern/[id]', params: { id: pattern.id } })}
            />
          ))}
          <Text style={styles.privacyNote}>
            Discovery shows shared route and time window only — never anyone’s position.
            People appear here only while they’ve actively checked in.
          </Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  boardDate: { ...type.monoSmall, color: color.textMutedOnChalk, marginBottom: space(3), marginTop: space(1) },
  empty: { gap: space(4), paddingTop: space(10) },
  emptyTitle: { ...type.title, color: color.textOnChalk },
  emptyBody: { ...type.body, color: color.textMutedOnChalk },
  privacyNote: { ...type.caption, color: color.textMutedOnChalk, marginTop: space(3) },
});
