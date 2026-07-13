import { Redirect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useStore } from '../src/store/useStore';
import { Button } from '../src/components/ui';
import { color, space, type } from '../src/theme/tokens';

/** Route by auth + onboarding progress: session → verification → profile → app. */
export default function Index() {
  const myId = useStore((s) => s.myId);
  const me = useStore((s) => s.me);
  const refreshError = useStore((s) => s.refreshError);
  const refresh = useStore((s) => s.refresh);
  const tourSeen = useStore((s) => s.tourSeen);

  if (!myId) return <Redirect href="/onboarding/welcome" />;
  if (!me) {
    // Offline at boot (tunnels are this app's natural habitat): never hang
    // on a spinner — say what's wrong and offer retry.
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: color.chalk, padding: space(8), gap: space(4) }}>
        {refreshError ? (
          <>
            <Text style={{ ...type.title, color: color.textOnChalk, textAlign: 'center' }}>Can’t reach the network</Text>
            <Text style={{ ...type.body, color: color.textMutedOnChalk, textAlign: 'center' }}>
              Signal comes and goes on the rails. We’ll pick up where you left off.
            </Text>
            <Button label="Try again" onPress={() => void refresh()} />
          </>
        ) : (
          <ActivityIndicator color={color.ink} />
        )}
      </View>
    );
  }
  if (me.verificationStatus !== 'verified') return <Redirect href="/onboarding/verify" />;
  if (!me.displayName) return <Redirect href="/onboarding/profile" />;
  if (!tourSeen) return <Redirect href="/tour" />;
  return <Redirect href="/(tabs)" />;
}
