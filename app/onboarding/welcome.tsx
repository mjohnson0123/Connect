import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../src/components/ui';
import { useReduceMotion } from '../../src/lib/useReduceMotion';
import { color, font, space, type } from '../../src/theme/tokens';

/**
 * Ink splash — one of the few high-emphasis Ink moments (PRD §10).
 * Motion: the wordmark and copy rise in like a board powering on, and the
 * route line ticks through destinations the way a real departure board cycles.
 * Reduce-motion renders everything static.
 */

const ROUTES = [
  'BAL → WAS · 06:45 · PENN LINE',
  'BWI → BOS · 08:10 · GATE C4',
  'FBG → WAS · 07:05 · VRE',
  'NYP → WAS · 09:00 · ACELA',
  'ALX ↔ WHF · 08:20 · WATER TAXI',
];

function RouteTicker({ reduceMotion }: { reduceMotion: boolean }) {
  const [idx, setIdx] = useState(0);
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) return;
    const interval = setInterval(() => {
      // Old line slides up and out; the next slides in from below.
      Animated.timing(slide, {
        toValue: 1,
        duration: 260,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setIdx((i) => (i + 1) % ROUTES.length);
        slide.setValue(-1);
        Animated.timing(slide, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });
    }, 2800);
    return () => clearInterval(interval);
  }, [reduceMotion, slide]);

  const translateY = slide.interpolate({ inputRange: [-1, 0, 1], outputRange: [14, 0, -14] });
  const opacity = slide.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 1, 0] });

  return (
    <View style={styles.tickerClip}>
      <Animated.Text style={[styles.route, !reduceMotion && { transform: [{ translateY }], opacity }]}>
        {ROUTES[idx]}
      </Animated.Text>
    </View>
  );
}

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
        <Rise delay={0} reduceMotion={reduceMotion}>
          <Text style={styles.wordmark}>COMMUTER{'\n'}CONNECT</Text>
        </Rise>
        <Rise delay={180} reduceMotion={reduceMotion}>
          <RouteTicker reduceMotion={reduceMotion} />
        </Rise>
        <Rise delay={320} reduceMotion={reduceMotion}>
          <Text style={styles.pitch}>
            You’ve probably sat three rows from your next mentor.{'\n'}Let’s fix that.
          </Text>
        </Rise>
      </View>

      <View style={{ gap: space(3) }}>
        <Rise delay={480} reduceMotion={reduceMotion}>
          <View style={styles.rules}>
            <Text style={styles.rule}>· Professional conversations, opt-in only</Text>
            <Text style={styles.rule}>· Never your live location — just a shared route</Text>
            <Text style={styles.rule}>· No pitches, no selling, no dating</Text>
          </View>
        </Rise>
        <Rise delay={600} reduceMotion={reduceMotion}>
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
  wordmark: {
    fontFamily: font.display,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: 1,
    color: color.chalk,
  },
  tickerClip: { height: 22, overflow: 'hidden', justifyContent: 'center' },
  route: { ...type.mono, color: color.amberOnInk },
  pitch: { ...type.body, fontSize: 17, lineHeight: 26, color: color.textMutedOnInk },
  rules: { gap: space(1.5), marginBottom: space(2) },
  rule: { ...type.caption, color: color.textMutedOnInk },
  legal: { ...type.caption, fontSize: 11, lineHeight: 15, color: color.textMutedOnInk, textAlign: 'center' },
});
