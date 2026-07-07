import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Screen from '../../src/components/Screen';
import { Button, Field, Hairline } from '../../src/components/ui';
import { hashPassword, signInWithGoogle } from '../../src/lib/auth';
import { useStore } from '../../src/store/useStore';
import { color, space, type } from '../../src/theme/tokens';

/**
 * Account creation with a hard 18+ gate (PRD §5.1). Two paths, both local
 * while the database is disconnected: direct email/password, or Google via
 * the simulated provider seam (src/lib/auth.ts). The DOB gate applies to
 * both — OAuth doesn't skip it. Production adds Sign in with Apple next to
 * Google (Guideline 4.8: never ship a third-party login alone).
 */
export default function SignUp() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; googleEmail?: string }>();
  const signUp = useStore((s) => s.signUp);

  const [googleEmail, setGoogleEmail] = useState<string | null>(params.googleEmail ?? null);
  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const [dob, setDob] = useState(''); // MM/DD/YYYY
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const parseDob = (): Date | null => {
    const m = dob.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    const date = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
    if (Number.isNaN(date.getTime()) || date.getMonth() !== Number(m[1]) - 1) return null;
    return date;
  };

  const submit = async () => {
    setError(null);
    const effectiveEmail = googleEmail ?? email.trim();
    if (!googleEmail) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(effectiveEmail)) {
        setError('Enter a valid email address.');
        return;
      }
      if (password.length < 8) {
        setError('Password needs at least 8 characters.');
        return;
      }
    }
    const date = parseDob();
    if (!date) {
      setError('Enter your date of birth as MM/DD/YYYY.');
      return;
    }
    setBusy(true);
    const passwordHash = googleEmail ? null : await hashPassword(effectiveEmail, password);
    setBusy(false);
    const err = signUp(effectiveEmail, date, {
      passwordHash,
      provider: googleEmail ? 'google' : 'password',
    });
    if (err) {
      setError(err);
      return;
    }
    router.replace('/onboarding/verify');
  };

  const startGoogle = async () => {
    setError(null);
    setBusy(true);
    const profile = await signInWithGoogle();
    setBusy(false);
    setGoogleEmail(profile.email);
  };

  return (
    <Screen>
      <View style={{ gap: space(5), paddingTop: space(4) }}>
        <Text style={styles.lede}>
          Your date of birth is used once to confirm you’re 18 or older — it never
          appears on your profile.
        </Text>

        {googleEmail ? (
          <View style={styles.googleBox}>
            <Text style={styles.googleLabel}>SIGNING UP WITH GOOGLE</Text>
            <Text style={styles.googleEmail}>{googleEmail}</Text>
            <Button label="Use a different method" variant="quiet" onPress={() => setGoogleEmail(null)} />
          </View>
        ) : (
          <>
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
          </>
        )}

        <Field
          label="Date of birth"
          value={dob}
          onChangeText={setDob}
          keyboardType="numbers-and-punctuation"
          placeholder="MM/DD/YYYY"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label={busy ? 'One moment…' : 'Continue'} onPress={submit} disabled={busy} />

        {!googleEmail ? (
          <>
            <Hairline />
            <Button label="Continue with Google" variant="ink" onPress={startGoogle} disabled={busy} />
            <Button
              label="Already have an account? Sign in"
              variant="quiet"
              onPress={() => router.replace('/onboarding/signin')}
            />
          </>
        ) : null}

        <Text style={styles.note}>
          Demo build: accounts live on this device only — no server, no database. Google
          sign-in is simulated; production pairs it with Sign in with Apple (required
          once any third-party login ships).
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lede: { ...type.body, color: color.textMutedOnChalk },
  error: { ...type.caption, color: color.caution },
  note: { ...type.caption, fontSize: 11, color: color.textMutedOnChalk, textAlign: 'center' },
  googleBox: {
    backgroundColor: color.chalkRaised,
    borderWidth: 1,
    borderColor: color.hairline,
    borderRadius: 12,
    padding: space(4),
    gap: space(2.5),
  },
  googleLabel: { ...type.monoSmall, color: color.textMutedOnChalk },
  googleEmail: { ...type.bodyMedium, color: color.textOnChalk },
});
