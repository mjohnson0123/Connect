import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SplitFlap from '../../src/components/SplitFlap';
import { Button } from '../../src/components/ui';
import { useReduceMotion } from '../../src/lib/useReduceMotion';
import { color, space, type } from '../../src/theme/tokens';

/**
 * Ink splash — one of the few high-emphasis Ink moments (PRD §10).
 * The wordmark is a departure board: it powers on showing major-city airport
 * codes, flips through a few, then resolves to COMMUTER CONNECT.
 * Reduce-motion renders a plain crossfade to the final text.
 */

// 8-cell and 7-cell frames built from major-city airport codes.
const FRAMES_TOP = ['BWI DCA ', 'JFK LAX ', 'ORD ATL '];
const FRAMES_BOTTOM = ['SEA DEN', 'MIA DFW', 'BOS PHL'];

function Rise({ children, delay, reduceMotion }: { children: React.ReactNode; delay: number; reduceMotion: boolean }) {
  const enter = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) {
      enter.setValue(1);
      return;
    }
    Animated.timing(enter, {
      toValue: 1,
      duration: 480,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [delay, enter, reduceMotion]);
  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });
  return <Animated.View style={{ opacity: enter, transform: [{ translateY }] }}>{children}</Animated.View>;
}

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  return (
    <View style={[styles.root, { paddingTop: insets.top + space(12), paddingBottom: insets.bottom + space(8) }]}>
      <View style={{ gap: space(4) }}>
        <View style={{ gap: space(2) }}>
          <SplitFlap text="COMMUTER" frames={FRAMES_TOP} cellSize={36} />
          <SplitFlap text="CONNECT" frames={FRAMES_BOTTOM} cellSize={36} />
        </View>
        <Rise delay={2400} reduceMotion={reduceMotion}>
          <Text style={styles.pitch}>
            You’ve probably sat three rows from your next mentor.{'\n'}Let’s fix that.
          </Text>
        </Rise>
      </View>

      <View style={{ gap: space(3) }}>
        <Rise delay={2600} reduceMotion={reduceMotion}>
          <View style={styles.rules}>
            <Text style={styles.rule}>· Professional conversations, opt-in only</Text>
            <Text style={styles.rule}>· Never your live location — just a shared route</Text>
            <Text style={styles.rule}>· No pitches, no selling, no dating</Text>
          </View>
        </Rise>
        <Rise delay={2750} reduceMotion={reduceMotion}>
          <View style={{ gap: space(3) }}>
            <Button label="Get started" onPress={() => router.push('/onboarding/signup')} />
            <Button label="I already have an account" variant="quietOnInk" onPress={() => router.push('/onboarding/signin')} />
            <Text style={styles.legal}>
              18+ only. By continuing you agree to the Terms of Service, the no-solicitation
              policy, and the Privacy Policy.
            </Text>
          </View>
        </Rise>
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
  pitch: { ...type.body, fontSize: 17, lineHeight: 26, color: color.textMutedOnInk },
  rules: { gap: space(1.5), marginBottom: space(2) },
  rule: { ...type.caption, color: color.textMutedOnInk },
  legal: { ...type.caption, fontSize: 11, lineHeight: 15, color: color.textMutedOnInk, textAlign: 'center' },
});
