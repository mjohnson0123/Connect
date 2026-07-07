import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { color, font, radius, space, type } from '../theme/tokens';
import { SignalDot } from './ui';

/**
 * Discovery reads like a timetable, not a social feed (PRD §10): rows, not a
 * card grid. Monospace route/window metadata on the left, Overpass name and
 * headline on the right, a Platform Signal dot for "checked in now."
 */
export default function BoardRow({
  left,
  leftSub,
  title,
  subtitle,
  live,
  onPress,
  right,
}: {
  left: string;
  leftSub?: string;
  title: string;
  subtitle?: string;
  live?: boolean;
  onPress?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.row, pressed && onPress ? styles.pressed : null]}
    >
      <View style={styles.meta}>
        <Text style={styles.metaMain} numberOfLines={1}>
          {left}
        </Text>
        {leftSub ? (
          <Text style={styles.metaSub} numberOfLines={1}>
            {leftSub}
          </Text>
        ) : null}
      </View>
      <View style={styles.body}>
        <View style={styles.titleLine}>
          {live ? <SignalDot /> : null}
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3.5),
    paddingVertical: space(3.5),
    paddingHorizontal: space(3.5),
    backgroundColor: color.chalkRaised,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  pressed: { opacity: 0.8 },
  meta: { width: 88 },
  metaMain: { ...type.monoBoard, color: color.textOnChalk },
  metaSub: { ...type.monoSmall, color: color.textMutedOnChalk, marginTop: 2 },
  body: { flex: 1, gap: 2 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  title: { ...type.headline, color: color.textOnChalk, flexShrink: 1 },
  subtitle: { ...type.caption, color: color.textMutedOnChalk },
  right: { marginLeft: 'auto' },
});
