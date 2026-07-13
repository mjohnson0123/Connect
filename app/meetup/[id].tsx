import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Screen from '../../src/components/Screen';
import SplitFlap from '../../src/components/SplitFlap';
import { Button, Field } from '../../src/components/ui';
import { LIMITS } from '../../src/domain/vocab';
import { formatRemaining } from '../../src/lib/time';
import { useStore } from '../../src/store/useStore';
import { color, radius, space, type } from '../../src/theme/tokens';

/**
 * Meetup PIN verification (PRD §5.6). Codes are generated server-side
 * (CSPRNG), single-use, 15-minute expiry; the generator can't self-confirm.
 * Split-flap moment #3 fires on the PIN reveal.
 */
export default function Meetup() {
  const { id, name, otherId } = useLocalSearchParams<{ id: string; name?: string; otherId?: string }>();
  const router = useRouter();
  const createPin = useStore((s) => s.createPin);
  const confirmPin = useStore((s) => s.confirmPin);
  const pinVerified = useStore((s) => s.pinVerified);
  const submitMeetupFeedback = useStore((s) => s.submitMeetupFeedback);

  const [mode, setMode] = useState<'choose' | 'show' | 'enter'>('choose');
  const [shown, setShown] = useState<{ pin: string; expiresAt: number } | null>(null);
  const [entered, setEntered] = useState('');
  const [result, setResult] = useState<'verified' | 'expired' | 'mismatch' | null>(null);
  const [alreadyVerified, setAlreadyVerified] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<'good' | 'issue' | null>(null);
  const [busy, setBusy] = useState(false);
  const [, forceTick] = useState(0);

  const otherName = name ?? 'your connection';

  useEffect(() => {
    if (!id) return;
    void pinVerified(id).then(setAlreadyVerified);
    // The generator's screen should flip to VERIFIED when the other person
    // confirms — poll while unverified (no realtime channel on pins).
    const t = setInterval(() => {
      void pinVerified(id).then((v) => v && setAlreadyVerified(true));
    }, 5000);
    return () => clearInterval(t);
  }, [id, pinVerified]);

  useEffect(() => {
    if (mode !== 'show') return;
    const t = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [mode]);

  if (!id) return null;
  const verified = alreadyVerified || result === 'verified';

  const showCode = async () => {
    setBusy(true);
    const pin = await createPin(id);
    setBusy(false);
    if (pin) {
      setShown(pin);
      setMode('show');
    }
  };

  const submitEntered = async () => {
    setBusy(true);
    const r = await confirmPin(id, entered);
    setBusy(false);
    setResult(r);
    if (r !== 'verified') setEntered('');
  };

  const giveFeedback = async (rating: 'good' | 'issue') => {
    await submitMeetupFeedback(id, rating);
    setFeedbackGiven(rating);
    if (rating === 'issue' && otherId) {
      router.push({ pathname: '/report', params: { reportedId: otherId, name: otherName } });
    }
  };

  const verifiedView = (
    <View style={{ gap: space(4) }}>
      <View style={styles.verifiedBox}>
        <Text style={styles.verifiedTitle}>✓ MEETUP VERIFIED</Text>
        <Text style={styles.body}>
          Codes matched — you’re each meeting the person from the app. Enjoy the
          conversation.
        </Text>
      </View>
      {feedbackGiven ? (
        <Text style={styles.pulseThanks}>
          {feedbackGiven === 'good' ? 'Thanks — glad it went well.' : 'Thanks — your report is in the review queue.'}
        </Text>
      ) : (
        <View style={{ gap: space(2.5) }}>
          <Text style={styles.label}>HOW WAS IT?</Text>
          <View style={{ flexDirection: 'row', gap: space(2.5) }}>
            <Button label="👍 Went well" variant="quiet" onPress={() => void giveFeedback('good')} style={{ flex: 1 }} />
            <Button label="Report an issue" variant="destructive" onPress={() => void giveFeedback('issue')} style={{ flex: 1 }} />
          </View>
        </View>
      )}
    </View>
  );

  return (
    <Screen>
      <View style={{ gap: space(5), paddingTop: space(4) }}>
        <Text style={styles.lede}>
          Meeting {otherName} in person? Verify each other first: one of you shows a
          code, the other types it in. Codes are single-use, random, and expire in{' '}
          {LIMITS.pinMinutes} minutes.
        </Text>

        {verified ? (
          verifiedView
        ) : mode === 'choose' ? (
          <View style={{ gap: space(3) }}>
            <Button label={busy ? 'Generating…' : 'Show a code'} onPress={() => void showCode()} disabled={busy} />
            <Button label="Enter their code" variant="ink" onPress={() => setMode('enter')} />
            <Pressable
              onPress={() => router.push('/safety')}
              accessibilityRole="link"
              accessibilityLabel="Open the safety center"
              style={{ alignSelf: 'center', padding: space(2) }}
            >
              <Text style={styles.meetTip}>
                Meet somewhere public. <Text style={styles.meetTipLink}>Safety center →</Text>
              </Text>
            </Pressable>
          </View>
        ) : mode === 'show' ? (
          <View style={{ gap: space(4), alignItems: 'center' }}>
            {shown && shown.expiresAt > Date.now() ? (
              <>
                <SplitFlap text={shown.pin} cellSize={44} />
                <Text style={styles.countdown}>
                  EXPIRES IN {formatRemaining(shown.expiresAt).toUpperCase()}
                </Text>
                <Text style={styles.body}>
                  Have {otherName} type this code on their screen. It works once — and
                  only they can confirm it, not you.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.body}>That code expired.</Text>
                <Button label="Generate a new code" onPress={() => void showCode()} disabled={busy} />
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
            <Button label={busy ? 'Verifying…' : 'Verify'} onPress={() => void submitEntered()} disabled={entered.length !== 6 || busy} />
            <Button label="Back" variant="quiet" onPress={() => setMode('choose')} />
          </View>
        )}

      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lede: { ...type.body, color: color.textOnChalk },
  label: { ...type.monoSmall, color: color.textMutedOnChalk },
  pulseThanks: { ...type.caption, color: color.signal, textAlign: 'center' },
  body: { ...type.body, color: color.textMutedOnChalk, textAlign: 'center' },
  countdown: { ...type.mono, color: color.amberTextOnChalk },
  error: { ...type.caption, color: color.caution },
  note: { ...type.caption, color: color.textMutedOnChalk },
  meetTip: { ...type.caption, color: color.textMutedOnChalk, textAlign: 'center' },
  meetTipLink: { ...type.caption, color: color.amberTextOnChalk },
  pinInput:{ fontFamily: 'IBMPlexMono_500Medium', fontSize: 24, letterSpacing: 8, textAlign: 'center' },
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
