import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { INDUSTRIES, INDUSTRY_GROUPS, MAX_INDUSTRIES } from '../domain/vocab';
import { color, space, type } from '../theme/tokens';
import { Chip, Field } from './ui';

/**
 * Full-screen field picker (LinkedIn-skills pattern): search-as-you-type,
 * selections pinned on top, options in scannable groups instead of a
 * 37-pill wall. The parent owns the selection state and its max-5 cap.
 */
export default function FieldPicker({
  visible,
  selected,
  onToggle,
  onClose,
}: {
  visible: boolean;
  selected: string[];
  onToggle: (field: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const atCap = selected.length >= MAX_INDUSTRIES;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return INDUSTRIES.filter((f) => f.toLowerCase().includes(q));
  }, [query]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top + space(3), paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.title}>Your fields</Text>
            <Text style={[styles.count, atCap && { color: color.amberTextOnChalk }]}>
              {selected.length} OF {MAX_INDUSTRIES} SELECTED
            </Text>
          </View>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Done picking fields" hitSlop={10}>
            <Text style={styles.done}>DONE</Text>
          </Pressable>
        </View>

        <Field
          value={query}
          onChangeText={setQuery}
          placeholder="Search fields — “fin”, “design”, “law”…"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: space(5), paddingVertical: space(4) }}
          keyboardShouldPersistTaps="handled"
        >
          {matches ? (
            <View style={{ gap: space(2.5) }}>
              <Text style={styles.group}>
                {matches.length === 0 ? 'NO FIELD MATCHES THAT' : `MATCHES · ${matches.length}`}
              </Text>
              <View style={styles.chips}>
                {matches.map((f) => (
                  <Chip key={f} label={f} selected={selected.includes(f)} onPress={() => onToggle(f)} />
                ))}
              </View>
            </View>
          ) : (
            <>
              {selected.length > 0 ? (
                <View style={{ gap: space(2.5) }}>
                  <Text style={styles.group}>SELECTED · TAP TO REMOVE</Text>
                  <View style={styles.chips}>
                    {selected.map((f) => (
                      <Chip key={f} label={f} selected onPress={() => onToggle(f)} />
                    ))}
                  </View>
                </View>
              ) : null}
              {INDUSTRY_GROUPS.map((g) => (
                <View key={g.label} style={{ gap: space(2.5) }}>
                  <Text style={styles.group}>{g.label.toUpperCase()}</Text>
                  <View style={styles.chips}>
                    {g.fields.map((f) => (
                      <Chip key={f} label={f} selected={selected.includes(f)} onPress={() => onToggle(f)} />
                    ))}
                  </View>
                </View>
              ))}
            </>
          )}
          {atCap ? (
            <Text style={styles.capNote}>
              That’s the full {MAX_INDUSTRIES} — remove one to swap in another. A tight
              set keeps your matches sharp.
            </Text>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.chalk, paddingHorizontal: space(5), gap: space(4) },
  header: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  title: { ...type.title, color: color.textOnChalk },
  count: { ...type.monoSmall, color: color.textMutedOnChalk },
  done: { ...type.monoSmall, fontSize: 13, color: color.amberTextOnChalk, padding: space(2) },
  group: { ...type.monoSmall, color: color.textMutedOnChalk },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  capNote: { ...type.caption, color: color.textMutedOnChalk },
});
