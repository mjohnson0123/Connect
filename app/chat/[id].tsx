import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LIMITS } from '../../src/domain/vocab';
import { formatClock } from '../../src/lib/time';
import { Message, useStore } from '../../src/store/useStore';
import { color, font, radius, space, type } from '../../src/theme/tokens';

/**
 * In-app messaging (PRD §5.5): text-only, filtered client-side for instant
 * feedback and server-side as the real boundary. New messages arrive live via
 * Supabase Realtime. Threads expire 30 days after the last message.
 */

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const myId = useStore((s) => s.myId);
  const connections = useStore((s) => s.connections);
  const messages = useStore((s) => s.messages);
  const loadMessages = useStore((s) => s.loadMessages);
  const subscribeMessages = useStore((s) => s.subscribeMessages);
  const sendMessage = useStore((s) => s.sendMessage);
  const blockUser = useStore((s) => s.blockUser);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    if (!id) return;
    void loadMessages(id);
    const unsubscribe = subscribeMessages(id);
    return unsubscribe;
  }, [id, loadMessages, subscribeMessages]);

  const conn = connections.find((c) => c.id === id);
  const thread = messages[id ?? ''] ?? [];

  if (!conn) {
    return (
      <View style={styles.gone}>
        <Text style={type.body}>This conversation is no longer available.</Text>
      </View>
    );
  }

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return; // double-tap on SEND must not send twice
    setSending(true);
    const result = await sendMessage(conn.id, text);
    setSending(false);
    if (!result.ok) {
      setWarning(result.message ?? 'Message blocked.');
      return;
    }
    setWarning(null);
    setDraft('');
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  };

  const confirmBlock = () => {
    Alert.alert(
      `Block ${conn.otherName}?`,
      'They won’t be notified. This conversation closes and you disappear from each other everywhere.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => {
            void blockUser(conn.otherId).then(() => router.back());
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <Stack.Screen
        options={{
          title: conn.otherName,
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: space(4) }}>
              <Pressable
                onPress={() => router.push({ pathname: '/meetup/[id]', params: { id: conn.id, name: conn.otherName, otherId: conn.otherId } })}
                accessibilityLabel="Meetup PIN verification"
              >
                <Text style={styles.headerAction}>PIN</Text>
              </Pressable>
              <Pressable onPress={confirmBlock} accessibilityLabel={`Block ${conn.otherName}`}>
                <Text style={[styles.headerAction, { color: color.caution }]}>BLOCK</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push({ pathname: '/report', params: { reportedId: conn.otherId, name: conn.otherName } })}
                accessibilityLabel={`Report ${conn.otherName}`}
              >
                <Text style={[styles.headerAction, { color: color.caution }]}>REPORT</Text>
              </Pressable>
            </View>
          ),
        }}
      />

      <FlatList
        ref={listRef}
        data={thread}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: space(4), gap: space(2) }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListHeaderComponent={
          <View style={styles.threadNote}>
            <Text style={styles.expiryNote}>
              Text-only and in-app. This thread auto-expires {LIMITS.chatExpiryDays} days
              after the last message. Meeting up? Verify each other with a PIN first.
            </Text>
            <Pressable
              onPress={() => router.push('/safety')}
              accessibilityRole="link"
              accessibilityLabel="Open the safety center"
            >
              <Text style={styles.safetyLink}>HOW WE KEEP THIS SAFE →</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => {
          const mine = item.senderId === myId;
          return (
            <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
              <Text style={mine ? styles.msgMine : styles.msgTheirs}>{item.content}</Text>
              <Text style={[styles.stamp, mine ? styles.stampMine : null]}>{formatClock(item.createdAt)}</Text>
            </View>
          );
        }}
      />

      {warning ? (
        <View style={styles.warning}>
          <Text style={styles.warningText}>{warning}</Text>
        </View>
      ) : null}

      <View style={[styles.composer, { paddingBottom: insets.bottom + space(2) }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Write a message"
          placeholderTextColor={color.textMutedOnChalk}
          style={styles.input}
          multiline
        />
        <Pressable onPress={() => void send()} accessibilityRole="button" accessibilityLabel="Send" style={styles.send}>
          <Text style={styles.sendLabel}>SEND</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.chalk },
  gone: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: color.chalk },
  headerAction: { fontFamily: font.mono, fontSize: 12, letterSpacing: 0.6, color: color.ink },
  threadNote: { marginBottom: space(3), gap: space(2), alignItems: 'center' },
  expiryNote: { ...type.caption, color: color.textMutedOnChalk, textAlign: 'center' },
  safetyLink: { ...type.monoSmall, color: color.amberTextOnChalk, padding: space(1) },
  bubble: {
    maxWidth: '82%',
    borderRadius: radius.card,
    paddingVertical: space(2.5),
    paddingHorizontal: space(3.5),
    gap: 2,
  },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: color.ink },
  bubbleTheirs: {
    alignSelf: 'flex-start',
    backgroundColor: color.chalkRaised,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  msgMine: { ...type.body, color: color.textOnInk },
  msgTheirs: { ...type.body, color: color.textOnChalk },
  stamp: { ...type.monoSmall, fontSize: 9, color: color.textMutedOnChalk, alignSelf: 'flex-end' },
  stampMine: { color: color.textMutedOnInk },
  warning: {
    marginHorizontal: space(4),
    marginBottom: space(2),
    backgroundColor: color.cautionTintBg,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: color.caution,
    padding: space(3),
  },
  warningText: { ...type.caption, color: color.caution },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space(2.5),
    paddingHorizontal: space(4),
    paddingTop: space(2),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.hairline,
    backgroundColor: color.chalk,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: color.hairline,
    borderRadius: radius.row,
    backgroundColor: color.chalkRaised,
    paddingHorizontal: space(3.5),
    paddingVertical: space(2.5),
    maxHeight: 120,
    ...type.body,
    color: color.textOnChalk,
  },
  send: {
    backgroundColor: color.amber,
    borderRadius: radius.row,
    paddingVertical: space(3),
    paddingHorizontal: space(3.5),
  },
  sendLabel: { fontFamily: font.mono, fontSize: 12, letterSpacing: 0.8, color: color.ink },
});
