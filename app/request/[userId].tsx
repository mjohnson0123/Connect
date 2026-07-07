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
 * Request compose (PRD §5.4): a reason tag is required, the intro is short
 * and optional, and the store enforces the 10/day rate limit. The recipient
 * must accept before any thread opens.
 */
export default function RequestCompose() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const users = useStore((s) => s.users);
  const sendRequest = useStore((s) => s.sendRequest);

  const [reason, setReason] = useState<ReasonTag | null>(null);
  const [intro, setIntro] = useState('');
  const [error, setError] = useState<string | null>(null);

  const to = users.find((u) => u.id === userId);
  if (!to) return null;

  const submit = () => {
    if (!reason) {
      setError('Pick a reason — it’s required.');
      return;
    }
    const err = sendRequest(to.id, reason, intro.trim());
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
          To <Text style={styles.name}>{to.displayName}</Text> · they’ll see your profile,
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
        <Button label="Send request" onPress={submit} />
        <Text style={styles.note}>
          Up to {LIMITS.requestsPerDay} requests a day. Pitches, selling, and recruiting
          cold-outreach aren’t allowed and are reportable.
        </Text>
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
