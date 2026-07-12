import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Screen from '../../src/components/Screen';
import { Avatar, Button, Chip, Field } from '../../src/components/ui';
import { chooseProfilePhoto } from '../../src/lib/photoPicker';
import { ReasonTag } from '../../src/domain/types';
import { INDUSTRIES, LIMITS, MAX_INDUSTRIES, REASON_TAGS } from '../../src/domain/vocab';
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
  const setAvatarFromBase64 = useStore((s) => s.setAvatarFromBase64);

  const changePhoto = async () => {
    const picked = await chooseProfilePhoto();
    if (!picked) return;
    setBusy(true);
    const err = await setAvatarFromBase64(picked);
    setBusy(false);
    if (err) setError(err);
  };

  const [displayName, setDisplayName] = useState(me?.displayName ?? '');
  const [headline, setHeadline] = useState(me?.headline ?? '');
  const [bio, setBio] = useState(me?.bio ?? '');
  const [industries, setIndustries] = useState<string[]>(me?.industryTags ?? []);
  const [reasons, setReasons] = useState<ReasonTag[]>(me?.reasonTags ?? []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const editing = !!me?.displayName;

  const toggleReason = (tag: ReasonTag) =>
    setReasons((r) => (r.includes(tag) ? r.filter((t) => t !== tag) : [...r, tag]));

  const toggleIndustry = (field: string) =>
    setIndustries((cur) =>
      cur.includes(field)
        ? cur.filter((f) => f !== field)
        : cur.length >= MAX_INDUSTRIES
          ? cur
          : [...cur, field],
    );

  const submit = async () => {
    if (!displayName.trim() || !headline.trim()) {
      setError('Display name and headline are required.');
      return;
    }
    if (reasons.length === 0) {
      setError('Pick at least one connection reason.');
      return;
    }
    if (industries.length === 0) {
      setError('Pick at least one industry or field — it’s how people find you.');
      return;
    }
    const initials = displayName
      .trim()
      .split(/\s+/)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .slice(0, 2)
      .join('');
    setBusy(true);
    const err = await saveProfile({
      displayName: displayName.trim(),
      monogram: initials || '·',
      headline: headline.trim(),
      bio: bio.trim(),
      industryTags: industries,
      reasonTags: reasons,
    });
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    if (editing) router.back();
    else router.replace('/(tabs)');
  };

  return (
    <Screen>
      <View style={{ gap: space(5), paddingTop: space(4) }}>
        <View style={styles.photoRow}>
          <Pressable onPress={() => void changePhoto()} accessibilityRole="button" accessibilityLabel="Change profile photo">
            <Avatar url={me?.avatarUrl} fallback={me?.photo ?? '·'} size={56} />
          </Pressable>
          <Button label="Change photo" variant="quiet" onPress={() => void changePhoto()} />
        </View>
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
        <View style={{ gap: space(2.5) }}>
          <Text style={styles.label}>INDUSTRIES & FIELDS · {industries.length}/{MAX_INDUSTRIES}</Text>
          <View style={styles.chips}>
            {INDUSTRIES.map((f) => (
              <Chip key={f} label={f} selected={industries.includes(f)} onPress={() => toggleIndustry(f)} />
            ))}
          </View>
        </View>
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
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label={busy ? 'Saving…' : editing ? 'Save changes' : 'Finish profile'} onPress={submit} disabled={busy} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: space(4) },
  label: { ...type.monoSmall, color: color.textMutedOnChalk },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  note: { ...type.caption, color: color.textMutedOnChalk },
  error: { ...type.caption, color: color.caution },
});
