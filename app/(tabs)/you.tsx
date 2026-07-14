import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Screen from '../../src/components/Screen';
import { Avatar, Button, Chip, Hairline, VerifiedBadge } from '../../src/components/ui';
import { reasonLabel } from '../../src/domain/vocab';
import { chooseProfilePhoto } from '../../src/lib/photoPicker';
import { useStore } from '../../src/store/useStore';
import { color, space, type } from '../../src/theme/tokens';

export default function You() {
  const router = useRouter();
  const me = useStore((s) => s.me);
  const deleteAccount = useStore((s) => s.deleteAccount);
  const setAvatarFromBase64 = useStore((s) => s.setAvatarFromBase64);

  const changePhoto = async () => {
    const picked = await chooseProfilePhoto();
    if (picked) await setAvatarFromBase64(picked);
  };
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
          <Pressable onPress={() => void changePhoto()} accessibilityRole="button" accessibilityLabel="Change profile photo">
            <Avatar url={me.avatarUrl} fallback={me.photo} size={56} />
          </Pressable>
          <View style={{ flex: 1, gap: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
              <Text style={styles.name}>{me.displayName}</Text>
              {me.verificationStatus === 'verified' ? <VerifiedBadge /> : null}
            </View>
            <Text style={styles.headline}>{me.headline}</Text>
          </View>
        </View>

        {me.bio ? <Text style={styles.bio}>{me.bio}</Text> : null}

        {me.industryTags.length > 0 ? (
          <View style={{ gap: space(2) }}>
            <Text style={styles.section}>YOUR FIELDS</Text>
            <View style={styles.chips}>
              {me.industryTags.map((t) => (
                <Chip key={t} label={t} selected />
              ))}
            </View>
          </View>
        ) : null}

        <View style={{ gap: space(2) }}>
          <Text style={styles.section}>LOOKING FOR</Text>
          <View style={styles.chips}>
            {me.reasonTags.map((t) => (
              <Chip key={t} label={reasonLabel(t)} />
            ))}
          </View>
        </View>

        <Button label="Edit profile" variant="quiet" onPress={() => router.push('/onboarding/profile')} />
        <Button
          label="How Commuter Connect works"
          variant="quiet"
          onPress={() => router.push({ pathname: '/tour', params: { from: 'you' } })}
        />

        <Hairline />

        <View style={{ gap: space(2.5) }}>
          <Text style={styles.section}>SAFETY</Text>
          <Button label="Safety center" variant="ink" onPress={() => router.push('/safety')} />
        </View>

        <Hairline />

        <View style={{ gap: space(2.5) }}>
          <Text style={styles.section}>OPERATOR (NOT IN SHIPPING BUILD)</Text>
          <Button label="Density & review queue" variant="quiet" onPress={() => router.push('/density')} />
        </View>

        <Hairline />

        <View style={{ gap: space(2.5) }}>
          <Text style={styles.section}>ACCOUNT</Text>
          <Button label="Change password" variant="quiet" onPress={() => router.push('/change-password')} />
          <Button
            label="Sign out"
            variant="quiet"
            onPress={() => {
              void signOut().then(() => router.replace('/onboarding/signin'));
            }}
          />
          <Button label="Delete account" variant="destructive" onPress={confirmDelete} />
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
