import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Screen from '../src/components/Screen';
import { Button, Field } from '../src/components/ui';
import { useStore } from '../src/store/useStore';
import { color, space, type } from '../src/theme/tokens';

/**
 * Signed-in password change (You tab → Account). The active session
 * authorizes the change — no email code needed. Locked-out users use the
 * "Forgot password?" flow on the sign-in screen instead.
 */
export default function ChangePassword() {
  const router = useRouter();
  const changePassword = useStore((s) => s.changePassword);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (password.length < 8) {
      setError('Password needs at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords don’t match.');
      return;
    }
    setBusy(true);
    const err = await changePassword(password);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setDone(true);
    setTimeout(() => router.back(), 1200);
  };

  return (
    <Screen>
      <View style={{ gap: space(5), paddingTop: space(4) }}>
        {done ? (
          <Text style={styles.success}>Password updated.</Text>
        ) : (
          <>
            <Field
              label="New password (8+ characters)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              placeholder="••••••••"
            />
            <Field
              label="Confirm new password"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              autoComplete="new-password"
              placeholder="••••••••"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button label={busy ? 'Updating…' : 'Update password'} onPress={submit} disabled={busy} />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { ...type.caption, color: color.caution },
  success: { ...type.headline, color: color.signal, textAlign: 'center', paddingTop: space(8) },
});
