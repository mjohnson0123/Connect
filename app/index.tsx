import { Redirect } from 'expo-router';
import React from 'react';
import { useStore } from '../src/store/useStore';

/** Route by onboarding progress: account → verification → profile → app. */
export default function Index() {
  const me = useStore((s) => s.me);

  if (!me) return <Redirect href="/onboarding/welcome" />;
  if (me.verificationStatus !== 'verified') return <Redirect href="/onboarding/verify" />;
  if (!me.displayName) return <Redirect href="/onboarding/profile" />;
  return <Redirect href="/(tabs)" />;
}
