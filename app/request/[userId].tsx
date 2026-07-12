import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Screen from '../../src/components/Screen';
import { Button, Chip, Field } from '../../src/components/ui';
import { ReasonTag } from '../../src/domain/types';
import { LIMITS, REASON_TAGS } from '../../src/domain/vocab';
import { useStore } from '../../src/store/useStore';
import { color, space, type } from '../../src/theme/tokens';

/**
 * Request compose (PRD §5.4). The send_request RPC enforces the reason tag,
 * the 10/day rate limit, the intro content filter, and double opt-in.
 */
export default function RequestCompose() {
  const { userId, name } = useLocalSearchParams<{ userId: string; name?: string }>();
  const router = useRouter();
  const sendRequest = useStore((s) => s.sendRequest);

  const [reason, setReason] = useState<ReasonTag | null>(null);
  const [intro, setIntro] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!userId) return null;
  const displayName = name ?? 'this person';

  const submit = async () => {
    if (!reason) {
      setError('Pick a reason — it’s required.');
      return;
    }
    setBusy(true);
    const err = await sendRequest(userId, reason, intro.trim());
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
          To <Text style={styles.name}>{displayName}</Text> · they’ll see your profile,
          your reason, and your note. Nothing more happens unless they accept.
        </Text>

        <View style={{ gap: space(2.5) }}>
          <Text style={styles.label}>REASON (REQUIRED)</Text>
          <View style={styles.chips}>
            {REASON_TAGS.map((t) => (
              <Chip
                key={t.value}
                label={t.label}
                selected={reason === t.value}
                onPress={() => setReason(t.value)}
              />
            ))}
          </View>
        </View>

        <Field
          label={`Short intro (optional) · ${intro.length}/${LIMITS.introMaxChars}`}
          value={intro}
          onChangeText={(t) => setIntro(t.slice(0, LIMITS.introMaxChars))}
          placeholder="One or two sentences on why you’d like to connect."
          multiline
          style={{ minHeight: 72 }}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label={busy ? 'Sending…' : 'Send request'} onPress={submit} disabled={busy} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lede: { ...type.body, color: color.textMutedOnChalk },
  name: { ...type.bodyMedium, color: color.textOnChalk },
  label: { ...type.monoSmall, color: color.textMutedOnChalk },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  error: { ...type.caption, color: color.caution },
  note: { ...type.caption, color: color.textMutedOnChalk },
});
