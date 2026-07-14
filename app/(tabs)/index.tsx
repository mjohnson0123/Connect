import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import BoardRow from '../../src/components/BoardRow';
import Screen from '../../src/components/Screen';
import SplitFlap from '../../src/components/SplitFlap';
import { Button } from '../../src/components/ui';
import { modeCode } from '../../src/domain/vocab';
import { formatRemaining } from '../../src/lib/time';
import { useStore } from '../../src/store/useStore';
import { color, radius, space, type } from '../../src/theme/tokens';

/**
 * THE BOARD — the app's single home for routes (PRD §5.3). Reads like a
 * departure board: each row is a route; the right-hand column is its status
 * AND its one action (CHECK IN → LIVE countdown → tap to end), the way a
 * real board shows ON TIME / BOARDING. Managing a trip (reminders, remove)
 * lives on the route's own screen — the board stays a display, not a form.
 * Split-flap moment #1 fires when a check-in goes live.
 */

function StatusChip({
  label,
  sub,
  tone,
  onPress,
  a11y,
}: {
  label: string;
  sub?: string;
  tone: 'action' | 'live' | 'muted';
  onPress?: () => void;
  a11y: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={a11y}
      hitSlop={8}
      style={({ pressed }) => [
        styles.chip,
        tone === 'action' && styles.chipAction,
        tone === 'live' && styles.chipLive,
        pressed && onPress ? { opacity: 0.7 } : null,
      ]}
    >
      {sub ? (
        <Text style={[styles.chipSub, tone === 'live' && { color: color.signal }]}>{sub}</Text>
      ) : null}
      <Text
        style={[
          styles.chipLabel,
          tone === 'action' && { color: color.amberTextOnChalk },
          tone === 'live' && { color: color.signal },
          tone === 'muted' && { color: color.textMutedOnChalk },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function Board() {
  const router = useRouter();
  const board = useStore((s) => s.board);
  const refresh = useStore((s) => s.refresh);
  const checkIn = useStore((s) => s.checkIn);
  const endCheckIn = useStore((s) => s.endCheckIn);
  const hereNow = useStore((s) => s.hereNow);
  const airportOfferDismissed = useStore((s) => s.airportOfferDismissed);
  const dismissAirportOffer = useStore((s) => s.dismissAirportOffer);
  const [justCheckedIn, setJustCheckedIn] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [offerState, setOfferState] = useState<'idle' | 'busy' | 'done'>('idle');

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  // Tick each half-minute so countdowns and expired check-ins roll over live.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();

  const goLive = (patternId: string) => {
    setBusyId(patternId);
    void checkIn(patternId).then((err) => {
      setBusyId(null);
      if (err) {
        Alert.alert('Check-in didn’t go through', err);
        return;
      }
      setOfferState('idle');
      setJustCheckedIn(patternId);
    });
  };

  // The bridge: a flight check-in means time at the departure airport — offer
  // (once per pattern, opt-in) to also be discoverable around the venue.
  // Rides the one-off machinery, so airport presence expires on its own.
  const justEntry = justCheckedIn ? board.find((b) => b.pattern.id === justCheckedIn) : undefined;
  const offerCode =
    justEntry &&
    justEntry.pattern.mode === 'flight' &&
    justEntry.pattern.stationOrCode &&
    !airportOfferDismissed.includes(justEntry.pattern.id)
      ? justEntry.pattern.stationOrCode
      : null;

  const acceptOffer = async () => {
    if (!offerCode) return;
    setOfferState('busy');
    const err = await hereNow('', offerCode);
    if (err) {
      setOfferState('idle');
      Alert.alert('Couldn’t check in at the airport', err);
      return;
    }
    setOfferState('done');
  };

  const confirmEnd = (patternId: string) => {
    Alert.alert('End this check-in?', 'You’ll stop being discoverable on this route right away.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'End check-in', style: 'destructive', onPress: () => void endCheckIn(patternId) },
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
          {offerCode ? (
            offerState === 'done' ? (
              <Text style={styles.offerDone}>
                ✓ Also on the {offerCode} board — that one clears itself later.
              </Text>
            ) : (
              <View style={styles.offer}>
                <Text style={styles.offerText}>
                  You’ll be at {offerCode} for a bit — also be discoverable around the
                  airport while you’re there?
                </Text>
                <View style={styles.offerActions}>
                  <Button
                    label={offerState === 'busy' ? 'Checking in…' : `Also check in at ${offerCode}`}
                    onPress={() => void acceptOffer()}
                    disabled={offerState === 'busy'}
                    style={{ flexGrow: 1 }}
                  />
                  <Button
                    label="Just my flight"
                    variant="quietOnInk"
                    onPress={() => dismissAirportOffer(justCheckedIn)}
                  />
                </View>
              </View>
            )
          ) : null}
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
        <View style={{ gap: space(2.5) }}>
          {board.map(({ pattern: p, liveCount, memberCount, checkedInUntil }, i) => {
            const active = !!checkedInUntil && checkedInUntil > now;
            return (
              <BoardRow
                key={p.id}
                left={modeCode(p.mode)}
                leftSub={p.oneOff ? 'TODAY' : `${p.windowStart}–${p.windowEnd}`}
                title={p.routeOrLine}
                subtitle={
                  active
                    ? `${liveCount} ${liveCount === 1 ? 'person' : 'people'} here now — tap to see who`
                    : liveCount > 0
                      ? `${liveCount} ${liveCount === 1 ? 'person' : 'people'} checked in now`
                      : memberCount > 0
                        ? `${memberCount} ${memberCount === 1 ? 'person rides' : 'people ride'} this — nobody’s live yet`
                        : p.oneOff
                          ? 'One-time — clears itself after it ends'
                          : 'You’re first on this route — it grows from here'
                }
                live={active}
                index={i}
                onPress={() => router.push({ pathname: '/pattern/[id]', params: { id: p.id } })}
                right={
                  active ? (
                    <StatusChip
                      tone="live"
                      sub="LIVE"
                      label={formatRemaining(checkedInUntil, now).toUpperCase()}
                      onPress={() => confirmEnd(p.id)}
                      a11y="Checked in — tap to end early"
                    />
                  ) : p.oneOff ? (
                    <StatusChip tone="muted" label="CLEARING" a11y="Ended — clears itself soon" />
                  ) : (
                    <StatusChip
                      tone="action"
                      label={busyId === p.id ? '…' : 'CHECK IN'}
                      onPress={busyId === p.id ? undefined : () => goLive(p.id)}
                      a11y={`Check in on ${p.routeOrLine}`}
                    />
                  )
                }
              />
            );
          })}
          <View style={{ gap: space(2.5), marginTop: space(2) }}>
            <Button label="Add a trip pattern" variant="ink" onPress={() => router.push('/add-pattern')} />
            <Button
              label="Passing through somewhere today?"
              variant="quiet"
              onPress={() => router.push('/here-now')}
            />
          </View>
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
  offer: { gap: space(3), marginTop: space(1) },
  offerText: { ...type.body, fontSize: 14, lineHeight: 20, color: color.chalk },
  offerActions: { flexDirection: 'row', gap: space(2.5), flexWrap: 'wrap' },
  offerDone: { ...type.caption, color: color.signal },
  empty: { gap: space(4), paddingTop: space(10) },
  emptyTitle: { ...type.title, color: color.textOnChalk },
  emptyBody: { ...type.body, color: color.textMutedOnChalk },
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space(2),
    paddingHorizontal: space(2.5),
    borderRadius: radius.chip,
    minWidth: 76,
  },
  chipAction: { borderWidth: 1, borderColor: color.amber },
  chipLive: { borderWidth: 1, borderColor: color.signal, backgroundColor: color.signalTintBg },
  chipLabel: { fontFamily: 'IBMPlexMono_500Medium', fontSize: 11, letterSpacing: 0.8 },
  chipSub: { ...type.monoSmall, fontSize: 8, letterSpacing: 1.2 },
});
