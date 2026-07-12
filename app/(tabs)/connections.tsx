import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import BoardRow from '../../src/components/BoardRow';
import Screen from '../../src/components/Screen';
import { Avatar, Button, Chip, VerifiedBadge } from '../../src/components/ui';
import { reasonLabel } from '../../src/domain/vocab';
import { useStore } from '../../src/store/useStore';
import { color, radius, space, type } from '../../src/theme/tokens';

/**
 * Connect hub. Two ways to find people, both double-opt-in (PRD §5.4) and
 * both anonymized until accept:
 *  - DISCOVER: people who share an industry/field with you (discover_people).
 *  - Incoming requests, your connections, and sent requests.
 * Names are first-name-only everywhere here; the full name is revealed only
 * once a request is accepted and the pair becomes a connection.
 */
export default function Connections() {
  const router = useRouter();
  const requestsIn = useStore((s) => s.requestsIn);
  const requestsOut = useStore((s) => s.requestsOut);
  const connections = useStore((s) => s.connections);
  const discoverPeople = useStore((s) => s.discoverPeople);
  const respondRequest = useStore((s) => s.respondRequest);
  const refresh = useStore((s) => s.refresh);
  const loadDiscover = useStore((s) => s.loadDiscover);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      void loadDiscover();
    }, [refresh, loadDiscover]),
  );

  const accept = async (id: string) => {
    const connId = await respondRequest(id, true);
    if (connId) {
      // respondRequest refreshed state; the connection now carries the FULL
      // name — the match modal is where the reveal lands.
      const conn = useStore.getState().connections.find((c) => c.id === connId);
      router.push({ pathname: '/match', params: { connectionId: connId, name: conn?.otherName ?? '' } });
    }
  };

  const active = connections.filter((c) => c.status === 'active');

  return (
    <Screen>
      <View style={{ gap: space(6), paddingTop: space(2) }}>
        {/* DISCOVER — interest-based, anonymized cards, horizontal browse */}
        <View style={{ gap: space(2.5) }}>
          <Text style={styles.section}>DISCOVER · SHARED FIELDS</Text>
          {discoverPeople.length === 0 ? (
            <Text style={styles.emptyLine}>
              No matches yet. Add industries to your profile so people in your field can
              find you — and you them.
            </Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: space(3), paddingRight: space(4) }}
            >
              {discoverPeople.map((p) => (
                <View key={p.id} style={styles.discoverCard}>
                  <View style={{ alignItems: 'center', gap: space(2) }}>
                    <Avatar url={p.avatarUrl} fallback={p.monogram} size={64} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(1.5) }}>
                      <Text style={styles.discoverName}>{p.displayName}</Text>
                      {p.verificationStatus === 'verified' ? <VerifiedBadge compact /> : null}
                    </View>
                    <Text style={styles.discoverHeadline} numberOfLines={2}>
                      {p.headline}
                    </Text>
                  </View>
                  <View style={styles.discoverChips}>
                    {p.industryTags.slice(0, 2).map((t) => (
                      <Chip key={t} label={t} />
                    ))}
                  </View>
                  <Button
                    label="Request to connect"
                    onPress={() =>
                      router.push({ pathname: '/request/[userId]', params: { userId: p.id, name: p.displayName } })
                    }
                  />
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={{ gap: space(2.5) }}>
          <Text style={styles.section}>REQUESTS FOR YOU</Text>
          {requestsIn.length === 0 ? (
            <Text style={styles.emptyLine}>None right now. Requests need your accept before any chat opens.</Text>
          ) : (
            requestsIn.map((r) => (
              <View key={r.id} style={styles.requestCard}>
                <View style={styles.requestHead}>
                  <Avatar url={r.otherAvatarUrl} fallback={r.otherMonogram} />
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
                  <Button label="Accept" onPress={() => void accept(r.id)} style={{ flex: 1 }} />
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
            active.map((c, i) => (
              <BoardRow
                key={c.id}
                left={c.otherMonogram}
                title={c.otherName}
                subtitle={c.lastMessage ?? 'Say hello — threads expire 30 days after the last message.'}
                index={i}
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
  discoverCard: {
    width: 220,
    backgroundColor: color.chalkRaised,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.hairline,
    padding: space(4),
    gap: space(3),
  },
  discoverName: { ...type.headline, color: color.textOnChalk },
  discoverHeadline: { ...type.caption, color: color.textMutedOnChalk, textAlign: 'center', minHeight: 34 },
  discoverChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5), justifyContent: 'center', minHeight: 30 },
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
