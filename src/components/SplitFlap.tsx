import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useReduceMotion } from '../lib/useReduceMotion';
import { color, font } from '../theme/tokens';

/**
 * The signature split-flap interaction (PRD §10) — the motion a physical
 * departure board makes when a row updates.
 *
 * Two modes:
 * - Random shuffle (default): cells clack through random characters before
 *   landing. Used at the three signature moments (check-in, match, PIN).
 * - Scripted frames: cells flip through given intermediate texts — e.g. the
 *   welcome board cycling airport codes before resolving to the wordmark.
 *
 * Honors the OS reduce-motion setting by degrading to a plain crossfade.
 */

interface Props {
  text: string;
  cellSize?: number;
  /** Trigger the flip on mount (all uses are reveal moments). */
  animateOnMount?: boolean;
  /**
   * Intermediate texts to flip through before landing on `text`. Each is
   * padded/truncated to text.length. When set, frames are held long enough
   * to read (departure-board style) instead of clacking randomly.
   */
  frames?: string[];
}

const CHARSET = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function randomSteps(target: string): string[] {
  const count = 3 + Math.floor(Math.random() * 3);
  const steps: string[] = [];
  for (let i = 0; i < count; i++) steps.push(CHARSET[Math.floor(Math.random() * CHARSET.length)]);
  steps.push(target);
  return steps;
}

function FlapCell({
  steps,
  size,
  delay,
  holdMs,
  animate,
  reduceMotion,
}: {
  /** Characters to display in order; the last is the resting character. */
  steps: string[];
  size: number;
  delay: number;
  holdMs: number;
  animate: boolean;
  reduceMotion: boolean;
}) {
  const target = steps[steps.length - 1];
  const progress = useRef(new Animated.Value(animate ? 0 : 1)).current;
  const [shown, setShown] = useState(animate ? ' ' : target);

  useEffect(() => {
    if (!animate) return;
    if (reduceMotion) {
      setShown(target);
      Animated.timing(progress, { toValue: 1, duration: 260, delay, useNativeDriver: true }).start();
      return;
    }
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const flipTo = (index: number) => {
      if (cancelled || index >= steps.length) return;
      progress.setValue(0);
      Animated.sequence([
        Animated.timing(progress, { toValue: 0.5, duration: 55, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.timing(progress, { toValue: 1, duration: 55, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start(() => {
        if (cancelled) return;
        if (index < steps.length - 1) {
          timers.push(setTimeout(() => flipTo(index + 1), holdMs));
        }
      });
      // Swap the glyph at the midpoint of the flip.
      timers.push(setTimeout(() => !cancelled && setShown(steps[index]), 55));
    };

    timers.push(setTimeout(() => flipTo(0), delay));
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate, reduceMotion]);

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

export default function SplitFlap({ text, cellSize = 34, animateOnMount = true, frames }: Props) {
  const reduceMotion = useReduceMotion();

  const cells = text.split('').map((ch, i) => {
    const target = CHARSET.includes(ch.toUpperCase()) ? ch.toUpperCase() : ch;
    if (frames && frames.length > 0) {
      const seq = frames.map((f) => (f[i] ?? ' ').toUpperCase());
      return { steps: [...seq, target], holdMs: 420 };
    }
    return { steps: randomSteps(target), holdMs: 0 };
  });

  return (
    <View style={styles.row} accessible accessibilityLabel={text}>
      {cells.map((cell, i) => (
        <FlapCell
          key={`${i}-${text}`}
          steps={cell.steps}
          size={cellSize}
          delay={i * 70}
          holdMs={cell.holdMs}
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
