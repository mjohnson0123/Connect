import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../src/components/ui';
import { color, font, space, type } from '../../src/theme/tokens';

/** Ink splash — one of the few high-emphasis Ink moments (PRD §10). */
export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top + space(12), paddingBottom: insets.bottom + space(8) }]}>
      <View style={{ gap: space(4) }}>
        <Text style={styles.wordmark}>COMMUTER{'\n'}CONNECT</Text>
        <Text style={styles.route}>BAL → WAS · 06:45 · PENN LINE</Text>
        <Text style={styles.pitch}>
          You’ve probably sat three rows from your next mentor.{'\n'}Let’s fix that.
        </Text>
      </View>

      <View style={{ gap: space(3) }}>
        <View style={styles.rules}>
          <Text style={styles.rule}>· Professional conversations, opt-in only</Text>
          <Text style={styles.rule}>· Never your live location — just a shared route</Text>
          <Text style={styles.rule}>· No pitches, no selling, no dating</Text>
        </View>
        <Button label="Get started" onPress={() => router.push('/onboarding/signup')} />
        <Button label="I already have an account" variant="quietOnInk" onPress={() => router.push('/onboarding/signin')} />
        <Text style={styles.legal}>
          18+ only. By continuing you agree to the Terms of Service, the no-solicitation
          policy, and the Privacy Policy.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.ink,
    paddingHorizontal: space(6),
    justifyContent: 'space-between',
  },
  wordmark: {
    fontFamily: font.display,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: 1,
    color: color.chalk,
  },
  route: { ...type.mono, color: color.amberOnInk },
  pitch: { ...type.body, fontSize: 17, lineHeight: 26, color: color.textMutedOnInk },
  rules: { gap: space(1.5), marginBottom: space(2) },
  rule: { ...type.caption, color: color.textMutedOnInk },
  legal: { ...type.caption, fontSize: 11, lineHeight: 15, color: color.textMutedOnInk, textAlign: 'center' },
});
