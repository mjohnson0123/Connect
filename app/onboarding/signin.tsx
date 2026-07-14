import { Redirect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Screen from '../../src/components/Screen';
import { Button, Field } from '../../src/components/ui';
import { useStore } from '../../src/store/useStore';
import { color, space, type } from '../../src/theme/tokens';

/** Sign-in against Supabase Auth. */
export default function SignIn() {
  const router = useRouter();
  const signIn = useStore((s) => s.signIn);
  const myId = useStore((s) => s.myId);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [failedAttempt, setFailedAttempt] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    const err = await signIn(email.trim(), password);
    setBusy(false);
    if (err) {
      // Auth deliberately doesn't reveal whether the email has an account
      // (that would let anyone probe who's a member). So instead of
      // redirecting, surface the likely next step alongside the error.
      setError(err);
      setFailedAttempt(true);
      return;
    }
    router.replace('/');
  };

  // Auth-gate guard: back-navigation must never surface sign-in to a
  // signed-in user (it reads as being logged out).
  if (myId) return <Redirect href="/" />;

  const toSignup = () =>
    router.replace({
      pathname: '/onboarding/signup',
      params: email.trim() ? { email: email.trim() } : undefined,
    });

  return (
    <Screen>
      <View style={{ gap: space(5), paddingTop: space(4) }}>
        <Text style={styles.lede}>Welcome back.</Text>
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="you@example.com"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          placeholder="••••••••"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {failedAttempt ? (
          <Text style={styles.hint}>
            Double-check the password, or — if you’ve never signed up on this email —
            create the account below.
          </Text>
        ) : null}
        <Button label={busy ? 'Signing in…' : 'Sign in'} onPress={submit} disabled={busy} />
        <Button
          label="Forgot password?"
          variant="quiet"
          onPress={() => router.push('/onboarding/forgot')}
        />
        <Button
          label={failedAttempt && email.trim() ? 'Create an account with this email' : 'New here? Create an account'}
          variant="quiet"
          onPress={toSignup}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lede: { ...type.title, color: color.textOnChalk },
  error: { ...type.caption, color: color.caution },
  hint: { ...type.caption, color: color.textMutedOnChalk },
});
