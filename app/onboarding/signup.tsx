import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Screen from '../../src/components/Screen';
import { Button, Field, Hairline } from '../../src/components/ui';
import { useStore } from '../../src/store/useStore';
import { color, space, type } from '../../src/theme/tokens';

/**
 * Account creation with a hard 18+ gate (PRD §5.1). Production adds real
 * auth: email/password plus Sign in with Apple (Guideline 4.8) — never a
 * single third-party login alone. The buttons below stub that layout.
 */
export default function SignUp() {
  const router = useRouter();
  const signUp = useStore((s) => s.signUp);
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState(''); // MM/DD/YYYY
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    const m = dob.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) {
      setError('Enter your date of birth as MM/DD/YYYY.');
      return;
    }
    const date = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
    if (Number.isNaN(date.getTime()) || date.getMonth() !== Number(m[1]) - 1) {
      setError('That date doesn’t look right.');
      return;
    }
    const err = signUp(email.trim(), date);
    if (err) {
      setError(err);
      return;
    }
    router.replace('/onboarding/verify');
  };

  return (
    <Screen>
      <View style={{ gap: space(5), paddingTop: space(4) }}>
        <Text style={styles.lede}>
          Your date of birth is used once to confirm you’re 18 or older — it never
          appears on your profile.
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
          label="Date of birth"
          value={dob}
          onChangeText={setDob}
          keyboardType="numbers-and-punctuation"
          placeholder="MM/DD/YYYY"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label="Continue" onPress={submit} />
        <Hairline />
        <Button label=" Sign in with Apple" variant="ink" onPress={submit} />
        <Text style={styles.note}>
          Demo build: authentication is simulated. Production ships email/password and
          Sign in with Apple with private-relay email.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lede: { ...type.body, color: color.textMutedOnChalk },
  error: { ...type.caption, color: color.caution },
  note: { ...type.caption, fontSize: 11, color: color.textMutedOnChalk, textAlign: 'center' },
});
