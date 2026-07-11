import { Redirect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useStore } from '../src/store/useStore';
import { color } from '../src/theme/tokens';

/** Route by auth + onboarding progress: session → verification → profile → app. */
export default function Index() {
  const myId = useStore((s) => s.myId);
  const me = useStore((s) => s.me);

  if (!myId) return <Redirect href="/onboarding/welcome" />;
  if (!me) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: color.chalk }}>
        <ActivityIndicator color={color.ink} />
      </View>
    );
  }
  if (me.verificationStatus !== 'verified') return <Redirect href="/onboarding/verify" />;
  if (!me.displayName) return <Redirect href="/onboarding/profile" />;
  return <Redirect href="/(tabs)" />;
}
