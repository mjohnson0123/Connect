import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Screen from '../../src/components/Screen';
import { Button, Field } from '../../src/components/ui';
import { useStore } from '../../src/store/useStore';
import { color, space, type } from '../../src/theme/tokens';

/**
 * Real account creation (Supabase Auth) with a hard 18+ gate (PRD §5.1).
 * The DOB is checked on-device and never stored. Google + Sign in with Apple
 * arrive together later (Guideline 4.8: never ship a third-party login alone).
 */
export default function SignUp() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const signUp = useStore((s) => s.signUp);

  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const [dob, setDob] = useState(''); // MM/DD/YYYY
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState(false);

  // Auto-insert slashes while typing: 03141990 → 03/14/1990 (and deletes cleanly).
  const formatDob = (raw: string) => {
    const d = raw.replace(/\D/g, '').slice(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
    return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  };

  const parseDob = (): Date | null => {
    const m = dob.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    const date = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
    if (Number.isNaN(date.getTime()) || date.getMonth() !== Number(m[1]) - 1) return null;
    return date;
  };

  const submit = async () => {
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password needs at least 8 characters.');
      return;
    }
    const date = parseDob();
    if (!date) {
      setError('Enter your date of birth as MM/DD/YYYY.');
      return;
    }
    setBusy(true);
    const err = await signUp(email.trim(), password, date);
    setBusy(false);
    if (err === 'CONFIRM_EMAIL') {
      setConfirmEmail(true);
      return;
    }
    if (err) {
      setError(err);
      return;
    }
    // Through the index gate, not straight to verify: the gate shows the
    // first-run tour before any verification/profile asks.
    router.replace('/');
  };

  if (confirmEmail) {
    return (
      <Screen>
        <View style={{ gap: space(4), paddingTop: space(8) }}>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.lede}>
            We sent a confirmation link to {email.trim()}. Tap it, then come back and
            sign in.
          </Text>
          <Button label="Go to sign in" onPress={() => router.replace('/onboarding/signin')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ gap: space(5), paddingTop: space(4) }}>
        <Text style={styles.lede}>
          Your date of birth is used once to confirm you’re 18 or older — it’s never
          stored and never appears on your profile.
        </Text>
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
          label="Password (8+ characters)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          placeholder="••••••••"
        />
        <Field
          label="Date of birth"
          value={dob}
          onChangeText={(t) => setDob(formatDob(t))}
          keyboardType="number-pad"
          placeholder="MM/DD/YYYY"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label={busy ? 'Creating account…' : 'Continue'} onPress={submit} disabled={busy} />
        <Button
          label="Already have an account? Sign in"
          variant="quiet"
          onPress={() => router.replace('/onboarding/signin')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...type.title, color: color.textOnChalk },
  lede: { ...type.body, color: color.textMutedOnChalk },
  error: { ...type.caption, color: color.caution },
  note: { ...type.caption, fontSize: 11, color: color.textMutedOnChalk, textAlign: 'center' },
});
