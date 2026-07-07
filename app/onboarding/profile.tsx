import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Screen from '../../src/components/Screen';
import { Button, Chip, Field } from '../../src/components/ui';
import { ReasonTag } from '../../src/domain/types';
import { LIMITS, REASON_TAGS } from '../../src/domain/vocab';
import { useStore } from '../../src/store/useStore';
import { color, space, type } from '../../src/theme/tokens';

/**
 * Profile setup (PRD §5.2). Connection reasons are a controlled vocabulary —
 * no free-text "what I'm looking for" — and there are deliberately no fields
 * for phone, email, or social handles anywhere.
 */
export default function ProfileSetup() {
  const router = useRouter();
  const me = useStore((s) => s.me);
  const saveProfile = useStore((s) => s.saveProfile);

  const [displayName, setDisplayName] = useState(me?.displayName ?? '');
  const [headline, setHeadline] = useState(me?.headline ?? '');
  const [bio, setBio] = useState(me?.bio ?? '');
  const [industry, setIndustry] = useState((me?.industryTags ?? []).join(', '));
  const [reasons, setReasons] = useState<ReasonTag[]>(me?.reasonTags ?? []);
  const [error, setError] = useState<string | null>(null);

  const editing = !!me?.displayName;

  const toggleReason = (tag: ReasonTag) =>
    setReasons((r) => (r.includes(tag) ? r.filter((t) => t !== tag) : [...r, tag]));

  const submit = () => {
    if (!displayName.trim() || !headline.trim()) {
      setError('Display name and headline are required.');
      return;
    }
    if (reasons.length === 0) {
      setError('Pick at least one connection reason.');
      return;
    }
    const initials = displayName
      .trim()
      .split(/\s+/)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .slice(0, 2)
      .join('');
    saveProfile({
      displayName: displayName.trim(),
      photo: initials || '·',
      headline: headline.trim(),
      bio: bio.trim(),
      industryTags: industry
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 3),
      reasonTags: reasons,
    });
    if (editing) router.back();
    else router.replace('/(tabs)');
  };

  return (
    <Screen>
      <View style={{ gap: space(5), paddingTop: space(4) }}>
        <Field label="Display name" value={displayName} onChangeText={setDisplayName} placeholder="Alex Rivera" />
        <Field
          label="Professional headline"
          value={headline}
          onChangeText={setHeadline}
          placeholder="Transit planner, MDOT"
        />
        <View style={{ gap: space(1.5) }}>
          <Field
            label={`Short bio · ${bio.length}/${LIMITS.bioMaxChars}`}
            value={bio}
            onChangeText={(t) => setBio(t.slice(0, LIMITS.bioMaxChars))}
            placeholder="A couple of sentences about your work."
            multiline
            style={{ minHeight: 88 }}
          />
        </View>
        <Field
          label="Industry tags (comma-separated, up to 3)"
          value={industry}
          onChangeText={setIndustry}
          placeholder="Transit, Public sector"
        />
        <View style={{ gap: space(2.5) }}>
          <Text style={styles.label}>WHY YOU’RE HERE</Text>
          <View style={styles.chips}>
            {REASON_TAGS.map((t) => (
              <Chip
                key={t.value}
                label={t.label}
                selected={reasons.includes(t.value)}
                onPress={() => toggleReason(t.value)}
              />
            ))}
          </View>
          <Text style={styles.note}>
            Reasons are fixed choices on purpose — it keeps the platform pitch-free.
            There’s nowhere on a profile for phone numbers, emails, or social handles.
          </Text>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label={editing ? 'Save changes' : 'Finish profile'} onPress={submit} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { ...type.monoSmall, color: color.textMutedOnChalk },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  note: { ...type.caption, color: color.textMutedOnChalk },
  error: { ...type.caption, color: color.caution },
});
