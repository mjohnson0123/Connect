import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import BoardRow from '../../src/components/BoardRow';
import Screen from '../../src/components/Screen';
import { Avatar, Button, Chip, Field, Monogram, VerifiedBadge } from '../../src/components/ui';
import { reasonLabel } from '../../src/domain/vocab';
import { useStore } from '../../src/store/useStore';
import { color, radius, space, type } from '../../src/theme/tokens';

/**
 * Connect hub. Two ways to find people, both double-opt-in (PRD §5.4) and
 * both anonymized until accept:
 *  - DISCOVER: people who share an industry/field with you (discover_people).
 *  - Incoming requests, your connections, and sent requests.
 * Identity is initials-only (no name, no photo) in discovery/search; the
 * full name is revealed once a request is accepted. Incoming requests keep
 * the sender's photo — the recipient deciding deserves the most information.
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

  const me = useStore((s) => s.me);
  const [query, setQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      void refresh();
      void loadDiscover(query);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refresh, loadDiscover]),
  );

  // Debounced interest search — the RPC filters by field/headline.
  useEffect(() => {
    const t = setTimeout(() => void loadDiscover(query), 350);
    return () => clearTimeout(t);
  }, [query, loadDiscover]);

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
        {/* DISCOVER — search people by shared field. Initials only, no photo,
            full profile info; identity reveals after mutual accept. */}
        <View style={{ gap: space(2.5) }}>
          <Text style={styles.section}>FIND PEOPLE IN YOUR FIELDS</Text>
          <Field
            value={query}
            onChangeText={setQuery}
            placeholder="Search by field or role — e.g. Finance, designer"
            autoCapitalize="none"
          />
          {discoverPeople.length === 0 ? (
            <Text style={styles.emptyLine}>
              {query
                ? 'Nobody matches that yet — try a broader field.'
                : 'Matches share at least one of your fields. Add more industries on your profile to widen this.'}
            </Text>
          ) : (
            discoverPeople.map((p) => (
              <View key={p.id} style={styles.discoverCard}>
                <View style={styles.requestHead}>
                  <Monogram text={p.monogram} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
                      <Text style={styles.name}>{p.displayName}</Text>
                      {p.verificationStatus === 'verified' ? <VerifiedBadge compact /> : null}
                    </View>
                    <Text style={styles.headline}>{p.headline}</Text>
                  </View>
                  <Text style={styles.shared}>
                    {p.sharedTags ?? 0} SHARED{'\n'}{(p.sharedTags ?? 0) === 1 ? 'FIELD' : 'FIELDS'}
                  </Text>
                </View>
                {p.bio ? <Text style={styles.bio}>{p.bio}</Text> : null}
                <View style={styles.chipRow}>
                  {p.industryTags.map((t) => (
                    <Chip key={t} label={t} selected={(me?.industryTags ?? []).includes(t)} />
                  ))}
                </View>
                <Button
                  label="Request to connect"
                  onPress={() =>
                    router.push({ pathname: '/request/[userId]', params: { userId: p.id, name: p.displayName } })
                  }
                />
              </View>
            ))
          )}
          <Text style={styles.anonNote}>
            People appear by initials only until you’re connected — accept reveals names,
            both ways.
          </Text>
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
    backgroundColor: color.chalkRaised,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.hairline,
    padding: space(4),
    gap: space(3),
  },
  shared: { ...type.monoSmall, color: color.amberTextOnChalk, textAlign: 'right' },
  bio: { ...type.body, color: color.textOnChalk },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5) },
  anonNote: { ...type.caption, color: color.textMutedOnChalk },
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
