import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Screen from '../../src/components/Screen';
import { Button, Field } from '../../src/components/ui';
import { useStore } from '../../src/store/useStore';
import { color, space, type } from '../../src/theme/tokens';

/**
 * Password reset without deep links: Supabase emails a 6-digit recovery code
 * (via Resend SMTP), the user types it here with a new password. The reset
 * email template must include {{ .Token }} — see README backend notes.
 */
export default function Forgot() {
  const router = useRouter();
  const requestPasswordReset = useStore((s) => s.requestPasswordReset);
  const confirmPasswordReset = useStore((s) => s.confirmPasswordReset);

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    const err = await requestPasswordReset(email);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setStep('code');
  };

  const submit = async () => {
    setError(null);
    if (code.trim().length < 6) {
      setError('Enter the 6-digit code from the email.');
      return;
    }
    setBusy(true);
    const err = await confirmPasswordReset(email, code, password);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    router.replace('/');
  };

  return (
    <Screen>
      <View style={{ gap: space(5), paddingTop: space(4) }}>
        {step === 'email' ? (
          <>
            <Text style={styles.lede}>
              Enter your account email and we’ll send a 6-digit reset code.
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
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button label={busy ? 'Sending…' : 'Send reset code'} onPress={sendCode} disabled={busy} />
          </>
        ) : (
          <>
            <Text style={styles.lede}>
              We sent a code to {email.trim()}. Enter it below with your new password.
            </Text>
            <Field
              label="6-digit code"
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              placeholder="000000"
            />
            <Field
              label="New password (8+ characters)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              placeholder="••••••••"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button label={busy ? 'Resetting…' : 'Reset password'} onPress={submit} disabled={busy} />
            <Button label="Send a new code" variant="quiet" onPress={sendCode} disabled={busy} />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lede: { ...type.body, color: color.textMutedOnChalk },
  error: { ...type.caption, color: color.caution },
});
