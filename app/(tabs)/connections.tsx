import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import BoardRow from '../../src/components/BoardRow';
import Screen from '../../src/components/Screen';
import { Button, Monogram, VerifiedBadge } from '../../src/components/ui';
import { reasonLabel } from '../../src/domain/vocab';
import { useStore } from '../../src/store/useStore';
import { color, radius, space, type } from '../../src/theme/tokens';

/**
 * Double opt-in hub (PRD §5.4): no thread exists until the recipient accepts
 * (enforced by respond_request server-side). Accepting fires split-flap
 * moment #2 via the match modal.
 */
export default function Connections() {
  const router = useRouter();
  const requestsIn = useStore((s) => s.requestsIn);
  const requestsOut = useStore((s) => s.requestsOut);
  const connections = useStore((s) => s.connections);
  const respondRequest = useStore((s) => s.respondRequest);
  const refresh = useStore((s) => s.refresh);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const accept = async (id: string, name: string) => {
    const connId = await respondRequest(id, true);
    if (connId) {
      router.push({ pathname: '/match', params: { connectionId: connId, name } });
    }
  };

  const active = connections.filter((c) => c.status === 'active');

  return (
    <Screen>
      <View style={{ gap: space(6), paddingTop: space(2) }}>
        <View style={{ gap: space(2.5) }}>
          <Text style={styles.section}>REQUESTS FOR YOU</Text>
          {requestsIn.length === 0 ? (
            <Text style={styles.emptyLine}>None right now. Requests need your accept before any chat opens.</Text>
          ) : (
            requestsIn.map((r) => (
              <View key={r.id} style={styles.requestCard}>
                <View style={styles.requestHead}>
                  <Monogram text={r.otherMonogram} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
                      <Text style={styles.name}>{r.otherName}</Text>
                      {r.otherVerified ? <VerifiedBadge compact /> : null}
                    </View>
                    <Text style={styles.headline}>{r.otherHeadline}</Text>
                  </View>
                </View>
                <Text style={styles.reason}>{reasonLabel(r.reasonTag).toUpperCase()}</Text>
                {r.introText ? <Text style={styles.intro}>“{r.introText}”</Text> : null}
                <View style={{ flexDirection: 'row', gap: space(2.5) }}>
                  <Button label="Accept" onPress={() => void accept(r.id, r.otherName)} style={{ flex: 1 }} />
                  <Button label="Decline" variant="quiet" onPress={() => void respondRequest(r.id, false)} style={{ flex: 1 }} />
                </View>
              </View>
            ))
          )}
        </View>

        <View style={{ gap: space(2.5) }}>
          <Text style={styles.section}>YOUR CONNECTIONS</Text>
          {active.length === 0 ? (
            <Text style={styles.emptyLine}>
              Accepted connections appear here and open a private, in-app conversation.
            </Text>
          ) : (
            active.map((c) => (
              <BoardRow
                key={c.id}
                left={c.otherMonogram}
                title={c.otherName}
                subtitle={c.lastMessage ?? 'Say hello — threads expire 30 days after the last message.'}
                onPress={() => router.push({ pathname: '/chat/[id]', params: { id: c.id } })}
              />
            ))
          )}
        </View>

        {requestsOut.length > 0 ? (
          <View style={{ gap: space(2.5) }}>
            <Text style={styles.section}>SENT · AWAITING THEIR ACCEPT</Text>
            {requestsOut.map((r) => (
              <Text key={r.id} style={styles.emptyLine}>
                {r.otherName} · {reasonLabel(r.reasonTag)}
              </Text>
            ))}
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
