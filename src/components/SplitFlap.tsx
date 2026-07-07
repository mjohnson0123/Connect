import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import { color, font } from '../theme/tokens';

/**
 * The signature split-flap interaction (PRD §10) — the motion a physical
 * departure board makes when a row updates. Used at exactly three moments:
 * a check-in going active, a new match appearing, and a PIN being generated.
 * Nowhere else; the restraint is the point.
 *
 * Honors the OS reduce-motion setting by degrading to a plain crossfade.
 */

interface Props {
  text: string;
  cellSize?: number;
  /** Trigger the flip on mount (all three PRD moments are reveal moments). */
  animateOnMount?: boolean;
}

const CHARSET = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function FlapCell({
  char,
  size,
  delay,
  animate,
  reduceMotion,
}: {
  char: string;
  size: number;
  delay: number;
  animate: boolean;
  reduceMotion: boolean;
}) {
  const progress = useRef(new Animated.Value(animate ? 0 : 1)).current;
  const [shown, setShown] = useState(animate ? ' ' : char);
  const flips = useRef(0);

  useEffect(() => {
    if (!animate) return;
    if (reduceMotion) {
      setShown(char);
      Animated.timing(progress, {
        toValue: 1,
        duration: 260,
        delay,
        useNativeDriver: true,
      }).start();
      return;
    }
    // Cycle through a few intermediate characters before landing, like a real
    // board clacking past letters it isn't stopping on.
    const target = CHARSET.indexOf(char.toUpperCase()) >= 0 ? char.toUpperCase() : char;
    const steps = 3 + Math.floor(Math.random() * 3);
    flips.current = 0;

    const flipOnce = () => {
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 0.5,
          duration: 55,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 1,
          duration: 55,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        flips.current += 1;
        if (flips.current < steps) {
          setShown(CHARSET[Math.floor(Math.random() * CHARSET.length)]);
          progress.setValue(0);
          flipOnce();
        } else {
          setShown(target);
        }
      });
      // Swap the glyph at the midpoint of the first half-flip.
      setTimeout(() => {
        if (flips.current < steps - 1) {
          setShown(CHARSET[Math.floor(Math.random() * CHARSET.length)]);
        } else {
          setShown(target);
        }
      }, 55);
    };

    const t = setTimeout(flipOnce, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [char, animate, reduceMotion]);

  const rotateX = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '-88deg', '0deg'],
  });
  const opacity = reduceMotion ? progress : 1;

  return (
    <Animated.View
      style={[
        styles.cell,
        { width: size, height: size * 1.35, opacity },
        !reduceMotion && { transform: [{ perspective: 220 }, { rotateX }] },
      ]}
    >
      <Animated.Text
        allowFontScaling={false}
        style={[styles.glyph, { fontSize: size * 0.72, lineHeight: size * 1.3 }]}
      >
        {shown}
      </Animated.Text>
      <View style={styles.split} pointerEvents="none" />
    </Animated.View>
  );
}

export default function SplitFlap({ text, cellSize = 34, animateOnMount = true }: Props) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((v) => mounted && setReduceMotion(!!v));
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v) =>
      setReduceMotion(!!v),
    );
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  return (
    <View style={styles.row} accessible accessibilityLabel={text}>
      {text.split('').map((ch, i) => (
        <FlapCell
          key={`${i}-${text}`}
          char={ch}
          size={cellSize}
          delay={i * 70}
          animate={animateOnMount}
          reduceMotion={reduceMotion}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 3 },
  cell: {
    backgroundColor: color.ink,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  glyph: {
    fontFamily: font.mono,
    color: color.amberOnInk,
    textAlign: 'center',
  },
  split: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
});
