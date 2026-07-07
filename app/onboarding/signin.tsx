import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Screen from '../../src/components/Screen';
import { Button, Field, Hairline } from '../../src/components/ui';
import { hashPassword, signInWithGoogle } from '../../src/lib/auth';
import { useStore } from '../../src/store/useStore';
import { color, space, type } from '../../src/theme/tokens';

/**
 * Sign-in for returning users. Local-only while the database is disconnected:
 * credentials are checked against the on-device account record. Google is a
 * simulated provider behind the seam in src/lib/auth.ts.
 */
export default function SignIn() {
  const router = useRouter();
  const signIn = useStore((s) => s.signIn);
  const account = useStore((s) => s.account);

  const [email, setEmail] = useState(account?.email ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const finish = (err: string | null, googleEmail?: string) => {
    if (err === 'NO_ACCOUNT') {
      // No local account for this email — send them to sign-up, keeping context.
      router.replace({
        pathname: '/onboarding/signup',
        params: googleEmail ? { googleEmail } : { email },
      });
      return;
    }
    if (err) {
      setError(err);
      return;
    }
    router.replace('/');
  };

  const submitPassword = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    const hash = await hashPassword(email, password);
    setBusy(false);
    finish(signIn(email, hash, 'password'));
  };

  const submitGoogle = async () => {
    setError(null);
    setBusy(true);
    const profile = await signInWithGoogle();
    setBusy(false);
    finish(signIn(profile.email, null, 'google'), profile.email);
  };

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
        <Button label={busy ? 'Signing in…' : 'Sign in'} onPress={submitPassword} disabled={busy} />
        <Hairline />
        <Button label="Continue with Google" variant="ink" onPress={submitGoogle} disabled={busy} />
        <Button
          label="New here? Create an account"
          variant="quiet"
          onPress={() => router.replace('/onboarding/signup')}
        />
        <Text style={styles.note}>
          Demo build: accounts live on this device only — no server, no database. Google
          sign-in is simulated until OAuth credentials and a backend exist.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lede: { ...type.title, color: color.textOnChalk },
  error: { ...type.caption, color: color.caution },
  note: { ...type.caption, fontSize: 11, color: color.textMutedOnChalk, textAlign: 'center' },
});
