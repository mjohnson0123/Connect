import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Screen from '../../src/components/Screen';
import SplitFlap from '../../src/components/SplitFlap';
import { Button, Field } from '../../src/components/ui';
import { LIMITS } from '../../src/domain/vocab';
import { formatRemaining } from '../../src/lib/time';
import { MY_ID, useStore } from '../../src/store/useStore';
import { color, radius, space, type } from '../../src/theme/tokens';

/**
 * Meetup PIN verification (PRD §5.6) — the rideshare-pickup pattern. One side
 * shows a 6-digit single-use code (split-flap moment #3), the other types it
 * in; a match confirms you're each meeting the person from the app.
 */
export default function Meetup() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const connections = useStore((s) => s.connections);
  const users = useStore((s) => s.users);
  const pins = useStore((s) => s.pins);
  const createPin = useStore((s) => s.createPin);
  const confirmPin = useStore((s) => s.confirmPin);

  const [mode, setMode] = useState<'choose' | 'show' | 'enter'>('choose');
  const [entered, setEntered] = useState('');
  const [result, setResult] = useState<'verified' | 'expired' | 'mismatch' | null>(null);
  const [, forceTick] = useState(0);

  const conn = connections.find((c) => c.id === id);
  const other = conn ? users.find((u) => u.id === (conn.userA === MY_ID ? conn.userB : conn.userA)) : null;
  const activePin = pins.find((p) => p.connectionId === id && !p.used && p.expiresAt > Date.now());
  const verifiedPin = pins.find((p) => p.connectionId === id && p.verifiedAt);

  // Tick the countdown while a PIN is showing.
  useEffect(() => {
    if (mode !== 'show') return;
    const t = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [mode]);

  if (!conn || !other) return null;

  const submitEntered = () => {
    const r = confirmPin(conn.id, entered);
    setResult(r);
    if (r !== 'verified') setEntered('');
  };

  const verifiedView = (
    <View style={styles.verifiedBox}>
      <Text style={styles.verifiedTitle}>✓ MEETUP VERIFIED</Text>
      <Text style={styles.body}>
        Codes matched — you’re each meeting the person from the app. Enjoy the
        conversation.
      </Text>
    </View>
  );

  return (
    <Screen>
      <View style={{ gap: space(5), paddingTop: space(4) }}>
        <Text style={styles.lede}>
          Meeting {other.displayName} in person? Verify each other first: one of you
          shows a code, the other types it in. Codes are single-use, random, and expire
          in {LIMITS.pinMinutes} minutes.
        </Text>

        {verifiedPin || result === 'verified' ? (
          verifiedView
        ) : mode === 'choose' ? (
          <View style={{ gap: space(3) }}>
            <Button
              label="Show a code"
              onPress={() => {
                if (!activePin) createPin(conn.id);
                setMode('show');
              }}
            />
            <Button label="Enter their code" variant="ink" onPress={() => setMode('enter')} />
          </View>
        ) : mode === 'show' ? (
          <View style={{ gap: space(4), alignItems: 'center' }}>
            {activePin ? (
              <>
                <SplitFlap text={activePin.pin} cellSize={44} />
                <Text style={styles.countdown}>
                  EXPIRES IN {formatRemaining(activePin.expiresAt).toUpperCase()}
                </Text>
                <Text style={styles.body}>
                  Have {other.displayName} type this code on their screen. It works once.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.body}>That code expired.</Text>
                <Button label="Generate a new code" onPress={() => createPin(conn.id)} />
              </>
            )}
            <Button label="Back" variant="quiet" onPress={() => setMode('choose')} />
          </View>
        ) : (
          <View style={{ gap: space(4) }}>
            <Field
              label="Their 6-digit code"
              value={entered}
              onChangeText={(t) => setEntered(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              placeholder="000000"
              style={styles.pinInput}
            />
            {result === 'mismatch' ? (
              <Text style={styles.error}>That code doesn’t match. Check it and try again.</Text>
            ) : null}
            {result === 'expired' ? (
              <Text style={styles.error}>
                No active code — ask them to generate a fresh one and try again.
              </Text>
            ) : null}
            <Button label="Verify" onPress={submitEntered} disabled={entered.length !== 6} />
            <Button label="Back" variant="quiet" onPress={() => setMode('choose')} />
          </View>
        )}

        <Text style={styles.note}>
          PIN verification reduces impersonation risk — it can’t guarantee the safety of
          any in-person meeting. Meet in public places and trust your judgment.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lede: { ...type.body, color: color.textOnChalk },
  body: { ...type.body, color: color.textMutedOnChalk, textAlign: 'center' },
  countdown: { ...type.mono, color: color.amberTextOnChalk },
  error: { ...type.caption, color: color.caution },
  note: { ...type.caption, color: color.textMutedOnChalk },
  pinInput: { fontFamily: 'IBMPlexMono_500Medium', fontSize: 24, letterSpacing: 8, textAlign: 'center' },
  verifiedBox: {
    backgroundColor: color.signalTintBg,
    borderWidth: 1,
    borderColor: color.signal,
    borderRadius: radius.card,
    padding: space(5),
    gap: space(2.5),
    alignItems: 'center',
  },
  verifiedTitle: { ...type.mono, color: color.signal },
});
