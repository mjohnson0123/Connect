import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, space } from '../theme/tokens';

/** Chalk-surface screen shell with safe-area handling. */
export default function Screen({
  children,
  scroll = true,
  padded = true,
  topInset = false,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  /** Apply top safe-area padding (screens without a native header). */
  topInset?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const pad = padded ? { paddingHorizontal: space(5) } : null;
  const top = topInset ? { paddingTop: insets.top + space(3) } : null;

  if (!scroll) {
    return <View style={[styles.root, pad, top]}>{children}</View>;
  }
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[pad, top, { paddingBottom: insets.bottom + space(10) }]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.chalk },
});
