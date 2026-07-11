import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import Screen from '../../src/components/Screen';
import { Button, Chip, Hairline, Monogram, VerifiedBadge } from '../../src/components/ui';
import { reasonLabel } from '../../src/domain/vocab';
import { useStore } from '../../src/store/useStore';
import { color, space, type } from '../../src/theme/tokens';

export default function You() {
  const router = useRouter();
  const me = useStore((s) => s.me);
  const deleteAccount = useStore((s) => s.deleteAccount);
  const signOut = useStore((s) => s.signOut);

  if (!me) return null;

  const confirmDelete = () => {
    // In-app deletion is a store requirement (Apple 5.1.1v; Play also needs a web link).
    Alert.alert(
      'Delete your account?',
      'This permanently removes your profile, trip patterns, connections, and messages. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: () => {
            void deleteAccount().then(() => router.replace('/onboarding/welcome'));
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <View style={{ gap: space(5), paddingTop: space(2) }}>
        <View style={styles.head}>
          <Monogram text={me.photo} size={56} />
          <View style={{ flex: 1, gap: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
              <Text style={styles.name}>{me.displayName}</Text>
              {me.verificationStatus === 'verified' ? <VerifiedBadge /> : null}
            </View>
            <Text style={styles.headline}>{me.headline}</Text>
          </View>
        </View>

        {me.bio ? <Text style={styles.bio}>{me.bio}</Text> : null}

        <View style={styles.chips}>
          {me.reasonTags.map((t) => (
            <Chip key={t} label={reasonLabel(t)} />
          ))}
        </View>

        <Button label="Edit profile" variant="quiet" onPress={() => router.push('/onboarding/profile')} />

        <Hairline />

        <View style={{ gap: space(2.5) }}>
          <Text style={styles.section}>SAFETY</Text>
          <Button label="Safety center" variant="ink" onPress={() => router.push('/safety')} />
          <Text style={styles.note}>
            Blocking, reporting, the no-solicitation policy, and how meetup PIN
            verification works.
          </Text>
        </View>

        <Hairline />

        <View style={{ gap: space(2.5) }}>
          <Text style={styles.section}>OPERATOR (NOT IN SHIPPING BUILD)</Text>
          <Button label="Density & review queue" variant="quiet" onPress={() => router.push('/density')} />
          <Text style={styles.note}>
            Match density by mode/route and the report review queue — the admin view
            from PRD §5.3/§5.7, surfaced here only for the demo.
          </Text>
        </View>

        <Hairline />

        <View style={{ gap: space(2.5) }}>
          <Text style={styles.section}>ACCOUNT</Text>
          <Button
            label="Sign out"
            variant="quiet"
            onPress={() => {
              void signOut().then(() => router.replace('/onboarding/signin'));
            }}
          />
          <Button label="Delete account" variant="destructive" onPress={confirmDelete} />
          <Text style={styles.note}>
            Deletion is immediate and permanent. Production also exposes a web deletion
            link for users who’ve uninstalled the app (Play policy).
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', gap: space(3.5), alignItems: 'center' },
  name: { ...type.title, color: color.textOnChalk },
  headline: { ...type.body, color: color.textMutedOnChalk },
  mono: { ...type.monoSmall, color: color.textMutedOnChalk },
  bio: { ...type.body, color: color.textOnChalk },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  section: { ...type.monoSmall, color: color.textMutedOnChalk },
  note: { ...type.caption, color: color.textMutedOnChalk },
});
