import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Screen from '../src/components/Screen';
import { Button, Field } from '../src/components/ui';
import { useStore } from '../src/store/useStore';
import { color, space, type } from '../src/theme/tokens';

/**
 * One-off presence for transient travelers: "I'm at BWI for two hours" —
 * no recurring pattern, no typical days. Creates a self-cleaning place
 * pattern + check-in in one call (one_off_check_in). Matching is venue-wide:
 * the code puts you on the board of everyone at that airport or station.
 */
export default function HereNow() {
  const router = useRouter();
  const hereNow = useStore((s) => s.hereNow);

  const [code, setCode] = useState('');
  const [venue, setVenue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!code.trim() && !venue.trim()) {
      setError('Enter an airport or station code — or name the place.');
      return;
    }
    setBusy(true);
    const err = await hereNow(venue.trim(), code.trim());
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    router.back();
  };

  return (
    <Screen>
      <View style={{ gap: space(5), paddingTop: space(4) }}>
        <Text style={styles.lede}>
          Passing through somewhere today? Check in once and you’re discoverable to
          people there — across the whole airport or station — for up to 3 hours.
        </Text>
        <Field
          label="Airport or station code"
          value={code}
          onChangeText={(t) => setCode(t.replace(/[^A-Za-z0-9]/g, '').slice(0, 12).toUpperCase())}
          autoCapitalize="characters"
          placeholder="BWI"
        />
        <Field
          label="Spot (optional)"
          value={venue}
          onChangeText={setVenue}
          placeholder="Gate B, food court, Amtrak platform…"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label={busy ? 'Checking in…' : 'I’m here — make me discoverable'} onPress={submit} disabled={busy} />
        <Text style={styles.note}>
          One-time only: this ends on its own and clears itself from your board. Never
          your location — just this place.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lede: { ...type.body, color: color.textOnChalk },
  error: { ...type.caption, color: color.caution },
  note: { ...type.caption, color: color.textMutedOnChalk },
});
