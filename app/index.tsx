import { Redirect } from 'expo-router';
import React from 'react';
import { useStore } from '../src/store/useStore';

/** Route by auth + onboarding progress: account → session → verification → profile → app. */
export default function Index() {
  const me = useStore((s) => s.me);
  const account = useStore((s) => s.account);
  const signedIn = useStore((s) => s.signedIn);

  if (!account || !me) return <Redirect href="/onboarding/welcome" />;
  if (!signedIn) return <Redirect href="/onboarding/signin" />;
  if (me.verificationStatus !== 'verified') return <Redirect href="/onboarding/verify" />;
  if (!me.displayName) return <Redirect href="/onboarding/profile" />;
  return <Redirect href="/(tabs)" />;
}
