import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Screen from '../src/components/Screen';
import { Button, Chip, Field } from '../src/components/ui';
import { ReportCategory } from '../src/domain/types';
import { REPORT_CATEGORIES } from '../src/domain/vocab';
import { useStore } from '../src/store/useStore';
import { color, space, type } from '../src/theme/tokens';

/**
 * Report flow (PRD §5.7): category is required; every report enters a human
 * review queue with an SLA — 24h for safety-flagged categories, 72h otherwise.
 */
export default function Report() {
  const { reportedId } = useLocalSearchParams<{ reportedId: string }>();
  const router = useRouter();
  const users = useStore((s) => s.users);
  const fileReport = useStore((s) => s.fileReport);

  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [context, setContext] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reported = users.find((u) => u.id === reportedId);
  if (!reportedId) return null;

  const submit = () => {
    if (!category) {
      setError('Pick a category — it’s required.');
      return;
    }
    fileReport(reportedId, category, context.trim());
    setSent(true);
  };

  if (sent) {
    const safetyFlagged = REPORT_CATEGORIES.find((c) => c.value === category)?.safetyFlagged;
    return (
      <Screen>
        <View style={{ gap: space(4), paddingTop: space(6) }}>
          <Text style={styles.title}>Report received</Text>
          <Text style={styles.body}>
            A person on our team reviews every report
            {safetyFlagged ? ' — safety-flagged reports within 24 hours.' : ' within 72 hours.'} If
            the report is confirmed, violations accrue strikes: warning, then suspension,
            then a permanent ban.
          </Text>
          <Text style={styles.body}>
            If you don’t want to hear from {reported?.displayName ?? 'this person'} at all,
            blocking is instant and silent.
          </Text>
          <Button label="Done" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ gap: space(5), paddingTop: space(4) }}>
        {reported ? (
          <Text style={styles.body}>
            Reporting <Text style={styles.name}>{reported.displayName}</Text>. They won’t
            know you filed this.
          </Text>
        ) : null}

        <View style={{ gap: space(2.5) }}>
          <Text style={styles.label}>WHAT HAPPENED? (REQUIRED)</Text>
          <View style={styles.chips}>
            {REPORT_CATEGORIES.map((c) => (
              <Chip
                key={c.value}
                label={c.label}
                selected={category === c.value}
                onPress={() => setCategory(c.value)}
              />
            ))}
          </View>
        </View>

        <Field
          label="Anything else that helps review (optional)"
          value={context}
          onChangeText={setContext}
          multiline
          style={{ minHeight: 88 }}
          placeholder="What was said or done, and where."
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label="Submit report" variant="destructive" onPress={submit} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...type.title, color: color.textOnChalk },
  body: { ...type.body, color: color.textMutedOnChalk },
  name: { ...type.bodyMedium, color: color.textOnChalk },
  label: { ...type.monoSmall, color: color.textMutedOnChalk },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  error: { ...type.caption, color: color.caution },
});
