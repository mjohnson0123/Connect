import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
} from '@expo-google-fonts/ibm-plex-mono';
import { Overpass_600SemiBold, Overpass_700Bold } from '@expo-google-fonts/overpass';
import {
  PublicSans_400Regular,
  PublicSans_500Medium,
  PublicSans_600SemiBold,
} from '@expo-google-fonts/public-sans';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Text, View } from 'react-native';
import { useStore } from '../src/store/useStore';
import { color, font } from '../src/theme/tokens';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Overpass_600SemiBold,
    Overpass_700Bold,
    PublicSans_400Regular,
    PublicSans_500Medium,
    PublicSans_600SemiBold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });
  const boot = useStore((s) => s.boot);
  const refresh = useStore((s) => s.refresh);
  const booted = useStore((s) => s.booted);

  // Never block the app on font loading forever: some environments fail or
  // stall the fetch. After the grace period, render with system fallbacks.
  const [fontTimeout, setFontTimeout] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFontTimeout(true), 6000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    void boot();
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') void refresh();
    });
    return () => sub.remove();
  }, [boot, refresh]);

  if ((!fontsLoaded && !fontError && !fontTimeout) || !booted) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: color.ink,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
        }}
      >
        <Text style={{ color: color.chalk, fontSize: 22, fontWeight: '700', letterSpacing: 2 }}>
          COMMUTER CONNECT
        </Text>
        <ActivityIndicator color={color.amber} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: color.chalk },
          headerTintColor: color.ink,
          headerTitleStyle: { fontFamily: font.displaySemi, fontSize: 17 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: color.chalk },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding/welcome" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding/signup" options={{ title: 'Create account' }} />
        <Stack.Screen name="onboarding/signin" options={{ title: 'Sign in' }} />
        <Stack.Screen name="onboarding/verify" options={{ title: 'Verify it’s you' }} />
        <Stack.Screen name="onboarding/profile" options={{ title: 'Your profile' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="pattern/[id]" options={{ title: 'On this route' }} />
        <Stack.Screen name="request/[userId]" options={{ presentation: 'modal', title: 'Request to connect' }} />
        <Stack.Screen name="match" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="chat/[id]" options={{ title: 'Conversation' }} />
        <Stack.Screen name="meetup/[id]" options={{ title: 'Meetup verification' }} />
        <Stack.Screen name="add-pattern" options={{ presentation: 'modal', title: 'Add a trip pattern' }} />
        <Stack.Screen name="report" options={{ presentation: 'modal', title: 'Report' }} />
        <Stack.Screen name="safety" options={{ title: 'Safety center' }} />
        <Stack.Screen name="density" options={{ title: 'Operator: density & reports' }} />
      </Stack>
    </>
  );
}
