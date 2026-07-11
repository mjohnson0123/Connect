import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Screen from '../src/components/Screen';
import { Button, Hairline } from '../src/components/ui';
import { useStore } from '../src/store/useStore';
import { color, space, type } from '../src/theme/tokens';

/** Safety center (PRD §5.7): policy, how the controls work, block management. */
export default function Safety() {
  const blocked = useStore((s) => s.blocked);
  const unblockUser = useStore((s) => s.unblockUser);

  return (
    <Screen>
      <View style={{ gap: space(5), paddingTop: space(4) }}>
        <View style={{ gap: space(2.5) }}>
          <Text style={styles.heading}>No solicitation. Ever.</Text>
          <Text style={styles.body}>
            Commuter Connect is for professional conversation — mentorship, career talk,
            industry peers. Pitching products or services, MLM, fundraising, and
            recruiting cold-outreach are policy violations. Confirmed violations accrue
            strikes: a warning, then a temporary suspension, then a permanent ban.
          </Text>
        </View>

        <Hairline />

        <View style={{ gap: space(2.5) }}>
          <Text style={styles.heading}>How the controls work</Text>
          <Text style={styles.body}>
            <Text style={styles.term}>Your visibility.</Text> Nobody sees you unless you
            actively check in, and a check-in ends on its own within 3 hours. Discovery
            only ever shows a shared route and time window — never your position.
          </Text>
          <Text style={styles.body}>
            <Text style={styles.term}>Blocking</Text> is instant and silent — no
            notification is sent, and you disappear from each other everywhere.
          </Text>
          <Text style={styles.body}>
            <Text style={styles.term}>Reporting</Text> goes to a human review queue:
            safety-flagged reports within 24 hours, everything else within 72.
          </Text>
          <Text style={styles.body}>
            <Text style={styles.term}>Meetup PINs</Text> confirm you’re each meeting the
            person from the app — single-use codes that expire in 15 minutes. They reduce
            impersonation risk; they can’t guarantee any meeting’s safety. Meet in public
            places.
          </Text>
          <Text style={styles.body}>
            <Text style={styles.term}>Your contact info</Text> has no home here by design:
            profiles have no phone/email/social fields, and messages that contain them are
            blocked before they send.
          </Text>
        </View>

        <Hairline />

        <View style={{ gap: space(2.5) }}>
          <Text style={styles.heading}>Blocked users</Text>
          {blocked.length === 0 ? (
            <Text style={styles.body}>You haven’t blocked anyone.</Text>
          ) : (
            blocked.map((b) => (
              <View key={b.id} style={styles.blockRow}>
                <Text style={styles.blockName}>{b.displayName || 'Member'}</Text>
                <Button label="Unblock" variant="quiet" onPress={() => void unblockUser(b.id)} />
              </View>
            ))
          )}
        </View>

        <Hairline />

        <Text style={styles.support}>
          Support: safety@commuterconnect.example · reports are acknowledged within 24
          hours.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { ...type.headline, color: color.textOnChalk },
  body: { ...type.body, color: color.textMutedOnChalk },
  term: { ...type.bodyMedium, color: color.textOnChalk },
  blockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  blockName: { ...type.bodyMedium, color: color.textOnChalk },
  support: { ...type.caption, color: color.textMutedOnChalk },
});
