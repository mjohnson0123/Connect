import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { color, font, radius, space, type } from '../theme/tokens';

/** Small shared primitives, styled to the token system — no component-library skin. */

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'quiet' | 'quietOnInk' | 'destructive' | 'ink';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bg =
    variant === 'primary'
      ? color.amber
      : variant === 'destructive'
        ? color.caution
        : variant === 'ink'
          ? color.ink
          : 'transparent';
  const fg =
    variant === 'primary'
      ? color.ink
      : variant === 'quiet'
        ? color.textOnChalk
        : color.textOnInk;
  const quietBorder = variant === 'quiet' || variant === 'quietOnInk';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.85 : 1 },
        quietBorder && styles.buttonQuiet,
        variant === 'quietOnInk' && { borderColor: 'rgba(237, 238, 233, 0.35)' },
        style,
      ]}
    >
      <Text style={[styles.buttonLabel, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected: !!selected }}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label?: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: space(1.5) }}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={color.textMutedOnChalk}
        style={[styles.field, style]}
        {...rest}
      />
    </View>
  );
}

export function Hairline({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.hairline, style]} />;
}

export function VerifiedBadge({ compact }: { compact?: boolean }) {
  return (
    <View style={styles.badge} accessibilityLabel="Verified profile">
      <Text style={styles.badgeText}>{compact ? '✓' : '✓ VERIFIED'}</Text>
    </View>
  );
}

export function SignalDot() {
  return <View style={styles.dot} accessibilityLabel="Checked in now" />;
}

export function Monogram({ text, size = 44 }: { text: string; size?: number }) {
  return (
    <View
      style={[
        styles.monogram,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.monogramText, { fontSize: size * 0.36 }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.button,
    paddingVertical: space(3.5),
    paddingHorizontal: space(5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonQuiet: {
    borderWidth: 1,
    borderColor: color.hairline,
  },
  buttonLabel: {
    fontFamily: font.bodySemi,
    fontSize: 15,
  },
  chip: {
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: color.hairline,
    paddingVertical: space(2),
    paddingHorizontal: space(3.5),
    backgroundColor: color.chalkRaised,
  },
  chipSelected: {
    backgroundColor: color.ink,
    borderColor: color.ink,
  },
  chipLabel: { ...type.caption, fontFamily: font.bodyMedium, color: color.textOnChalk },
  chipLabelSelected: { color: color.textOnInk },
  fieldLabel: { ...type.monoSmall, color: color.textMutedOnChalk, textTransform: 'uppercase' },
  field: {
    borderWidth: 1,
    borderColor: color.hairline,
    borderRadius: radius.row,
    backgroundColor: color.chalkRaised,
    paddingVertical: space(3),
    paddingHorizontal: space(3.5),
    ...type.body,
    color: color.textOnChalk,
  },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: color.hairline },
  badge: {
    backgroundColor: color.signal,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { fontFamily: font.mono, fontSize: 10, letterSpacing: 0.8, color: color.chalk },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: color.signal,
  },
  monogram: {
    backgroundColor: color.inkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: { fontFamily: font.displaySemi, color: color.chalk },
});
