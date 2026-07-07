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
import React, { useEffect } from 'react';
import { AppState, View } from 'react-native';
import { useStore } from '../src/store/useStore';
import { color, font } from '../src/theme/tokens';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Overpass_600SemiBold,
    Overpass_700Bold,
    PublicSans_400Regular,
    PublicSans_500Medium,
    PublicSans_600SemiBold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });
  const ensureSeeds = useStore((s) => s.ensureSeeds);
  const sweep = useStore((s) => s.sweep);

  useEffect(() => {
    // Expiry enforcement runs on launch, on foreground, and every minute the
    // app is open — stand-in for the backend's scheduled retention jobs.
    ensureSeeds();
    sweep();
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') {
        ensureSeeds();
        sweep();
      }
    });
    const interval = setInterval(sweep, 60_000);
    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, [ensureSeeds, sweep]);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: color.ink }} />;
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
