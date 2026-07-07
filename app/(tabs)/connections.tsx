import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import BoardRow from '../../src/components/BoardRow';
import Screen from '../../src/components/Screen';
import { Button, Monogram, VerifiedBadge } from '../../src/components/ui';
import { reasonLabel } from '../../src/domain/vocab';
import { MY_ID, useStore } from '../../src/store/useStore';
import { color, radius, space, type } from '../../src/theme/tokens';

/**
 * Double opt-in hub (PRD §5.4): no thread exists until the recipient accepts.
 * Accepting fires split-flap moment #2 (new match) via the match modal.
 */
export default function Connections() {
  const router = useRouter();
  const users = useStore((s) => s.users);
  const requests = useStore((s) => s.requests);
  const connections = useStore((s) => s.connections);
  const messages = useStore((s) => s.messages);
  const respondRequest = useStore((s) => s.respondRequest);
  const ensureDemoInbound = useStore((s) => s.ensureDemoInbound);

  useEffect(() => {
    ensureDemoInbound();
  }, [ensureDemoInbound]);

  const userById = (id: string) => users.find((u) => u.id === id);
  const inbound = requests.filter((r) => r.toUserId === MY_ID && r.status === 'pending');
  const outbound = requests.filter((r) => r.fromUserId === MY_ID && r.status === 'pending');
  const active = connections.filter((c) => c.status === 'active');

  const accept = (id: string) => {
    const conn = respondRequest(id, true);
    if (conn) {
      const other = userById(conn.userA === MY_ID ? conn.userB : conn.userA);
      router.push({
        pathname: '/match',
        params: { connectionId: conn.id, name: other?.displayName ?? 'Your match' },
      });
    }
  };

  return (
    <Screen>
      <View style={{ gap: space(6), paddingTop: space(2) }}>
        <View style={{ gap: space(2.5) }}>
          <Text style={styles.section}>REQUESTS FOR YOU</Text>
          {inbound.length === 0 ? (
            <Text style={styles.emptyLine}>None right now. Requests need your accept before any chat opens.</Text>
          ) : (
            inbound.map((r) => {
              const from = userById(r.fromUserId);
              if (!from) return null;
              return (
                <View key={r.id} style={styles.requestCard}>
                  <View style={styles.requestHead}>
                    <Monogram text={from.photo} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
                        <Text style={styles.name}>{from.displayName}</Text>
                        {from.verificationStatus === 'verified' ? <VerifiedBadge compact /> : null}
                      </View>
                      <Text style={styles.headline}>{from.headline}</Text>
                    </View>
                  </View>
                  <Text style={styles.reason}>{reasonLabel(r.reasonTag).toUpperCase()}</Text>
                  {r.introText ? <Text style={styles.intro}>“{r.introText}”</Text> : null}
                  <View style={{ flexDirection: 'row', gap: space(2.5) }}>
                    <Button label="Accept" onPress={() => accept(r.id)} style={{ flex: 1 }} />
                    <Button label="Decline" variant="quiet" onPress={() => respondRequest(r.id, false)} style={{ flex: 1 }} />
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={{ gap: space(2.5) }}>
          <Text style={styles.section}>YOUR CONNECTIONS</Text>
          {active.length === 0 ? (
            <Text style={styles.emptyLine}>
              Accepted connections appear here and open a private, in-app conversation.
            </Text>
          ) : (
            active.map((c) => {
              const other = userById(c.userA === MY_ID ? c.userB : c.userA);
              if (!other) return null;
              const thread = messages.filter((m) => m.connectionId === c.id);
              const last = thread[thread.length - 1];
              return (
                <BoardRow
                  key={c.id}
                  left={other.photo}
                  title={other.displayName}
                  subtitle={last ? last.content : 'Say hello — threads expire 30 days after the last message.'}
                  onPress={() => router.push({ pathname: '/chat/[id]', params: { id: c.id } })}
                />
              );
            })
          )}
        </View>

        {outbound.length > 0 ? (
          <View style={{ gap: space(2.5) }}>
            <Text style={styles.section}>SENT · AWAITING THEIR ACCEPT</Text>
            {outbound.map((r) => {
              const to = userById(r.toUserId);
              return (
                <Text key={r.id} style={styles.emptyLine}>
                  {to?.displayName ?? 'Someone'} · {reasonLabel(r.reasonTag)}
                </Text>
              );
            })}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { ...type.monoSmall, color: color.textMutedOnChalk },
  emptyLine: { ...type.caption, color: color.textMutedOnChalk },
  requestCard: {
    backgroundColor: color.chalkRaised,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.hairline,
    padding: space(4),
    gap: space(3),
  },
  requestHead: { flexDirection: 'row', gap: space(3), alignItems: 'center' },
  name: { ...type.headline, color: color.textOnChalk },
  headline: { ...type.caption, color: color.textMutedOnChalk },
  reason: { ...type.monoSmall, color: color.amberTextOnChalk },
  intro: { ...type.body, color: color.textOnChalk },
});
