import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import BoardRow from '../../src/components/BoardRow';
import Screen from '../../src/components/Screen';
import { Button } from '../../src/components/ui';
import { modeCode } from '../../src/domain/vocab';
import { formatRemaining } from '../../src/lib/time';
import { useStore } from '../../src/store/useStore';
import { color, space, type } from '../../src/theme/tokens';

/**
 * Discovery board (PRD §5.3): aggregate counts before identities, computed
 * server-side (board_summary RPC) so nothing about who is on a route reaches
 * the client until the user drills in.
 */
export default function Board() {
  const router = useRouter();
  const board = useStore((s) => s.board);
  const refresh = useStore((s) => s.refresh);

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

  return (
    <Screen>
      <Text style={styles.boardDate}>
        {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}
      </Text>

      {board.length === 0 ? (
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
          {board.map(({ pattern, liveCount, memberCount, checkedInUntil }, i) => {
            const checkedIn = !!checkedInUntil && checkedInUntil > now;
            return (
              <BoardRow
                key={pattern.id}
                left={modeCode(pattern.mode)}
                leftSub={pattern.oneOff ? 'TODAY' : `${pattern.windowStart}–${pattern.windowEnd}`}
                title={pattern.routeOrLine}
                subtitle={
                  checkedIn
                    ? `You’re checked in · ${formatRemaining(checkedInUntil, now)} left · ${liveCount} ${liveCount === 1 ? 'person' : 'people'} here now`
                    : liveCount > 0
                      ? `${liveCount} ${liveCount === 1 ? 'person who shares' : 'people who share'} this ${pattern.mode === 'place' ? 'spot' : 'commute'} checked in now`
                      : memberCount > 0
                        ? `${memberCount} ${memberCount === 1 ? 'person rides' : 'people ride'} this route · nobody’s checked in yet — be the flip`
                        : 'You’re first on this route — it grows from here'
                }
                live={checkedIn}
                index={i}
                onPress={() => router.push({ pathname: '/pattern/[id]', params: { id: pattern.id } })}
              />
            );
          })}
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
