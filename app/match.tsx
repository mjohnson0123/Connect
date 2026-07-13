import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import SplitFlap from '../src/components/SplitFlap';
import { Button } from '../src/components/ui';
import { color, space, type } from '../src/theme/tokens';

/** Split-flap moment #2: a new match appearing (PRD §10). */
export default function Match() {
  const { connectionId, name } = useLocalSearchParams<{ connectionId: string; name: string }>();
  const router = useRouter();

  return (
    <View style={styles.root}>
      <View style={{ gap: space(5), alignItems: 'center' }}>
        <SplitFlap text="CONNECTED" cellSize={32} />
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.body}>
          You’re both in — and this is the first time either of you sees a full name.
          A private, in-app conversation is open: text-only, and it expires 30 days
          after the last message unless you keep it going.
        </Text>
      </View>
      <View style={{ gap: space(3), width: '100%' }}>
        <Button
          label="Say hello"
          onPress={() => {
            router.back();
            if (connectionId) router.push({ pathname: '/chat/[id]', params: { id: connectionId } });
          }}
        />
        <Button label="Later" variant="quietOnInk" onPress={() => router.back()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.ink,
    paddingHorizontal: space(6),
    paddingVertical: space(14),
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: { ...type.title, color: color.chalk, textAlign: 'center' },
  body: { ...type.body, color: color.textMutedOnInk, textAlign: 'center' },
});
