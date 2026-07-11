import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Screen from '../src/components/Screen';
import { Hairline } from '../src/components/ui';
import { supabase } from '../src/lib/supabase';
import { useStore } from '../src/store/useStore';
import { color, radius, space, type } from '../src/theme/tokens';

type Overview = NonNullable<Awaited<ReturnType<ReturnType<typeof useStore.getState>['operatorOverview']>>>;

/**
 * Operator view (PRD §5.3, §5.7, §13 Q2). Data comes from operator_overview()
 * which is restricted server-side to profiles with is_operator = true.
 * Production moves this behind separate admin auth with an audit trail.
 */
export default function Density() {
  const operatorOverview = useStore((s) => s.operatorOverview);
  const [data, setData] = useState<Overview | null>(null);
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    const res = await operatorOverview();
    if (res === null) setDenied(true);
    else {
      setDenied(false);
      setData(res);
    }
  }, [operatorOverview]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const resolve = async (reportId: string, confirmed: boolean) => {
    await supabase.rpc('resolve_report', { p_report_id: reportId, p_confirmed: confirmed });
    await load();
  };

  if (denied) {
    return (
      <Screen>
        <View style={{ gap: space(3), paddingTop: space(8) }}>
          <Text style={styles.heading}>Operator access required</Text>
          <Text style={styles.sub}>
            This view is restricted to operator accounts. Flip is_operator on your
            profile row in Supabase to grant it (production: separate admin surface
            with audit trail).
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ gap: space(5), paddingTop: space(4) }}>
        <Text style={styles.banner}>
          OPERATOR VIEW · SERVER-GATED (is_operator) — PRODUCTION MOVES THIS BEHIND
          ADMIN AUTH WITH AN AUDIT TRAIL.
        </Text>

        <View style={{ gap: space(2.5) }}>
          <Text style={styles.heading}>Density by route</Text>
          <Text style={styles.sub}>
            Members with a declared pattern vs. checked in right now. Density — not raw
            signups — is the number that says whether matching works.
          </Text>
          {(data?.density ?? []).map((r) => (
            <View key={r.rkey} style={styles.row}>
              <Text style={styles.route} numberOfLines={1}>
                {r.route}
              </Text>
              <Text style={styles.mono}>
                {r.live}/{r.members} LIVE
              </Text>
            </View>
          ))}
        </View>

        <Hairline />

        <View style={{ gap: space(2.5) }}>
          <Text style={styles.heading}>Meetup pulse</Text>
          {(data?.feedback ?? []).length === 0 ? (
            <Text style={styles.sub}>No verified meetups with feedback yet.</Text>
          ) : (
            data!.feedback.map((f, i) => (
              <View key={i} style={styles.row}>
                <Text style={styles.mono}>{f.rating === 'good' ? '👍 GOOD' : '⚠ ISSUE'}</Text>
                <Text style={styles.route} numberOfLines={1}>
                  about {f.aboutName}
                </Text>
                <Text style={styles.mono}>{new Date(f.createdAt).toLocaleDateString()}</Text>
              </View>
            ))
          )}
        </View>

        <Hairline />

        <View style={{ gap: space(2.5) }}>
          <Text style={styles.heading}>Review queue ({data?.openReports.length ?? 0} open)</Text>
          <Text style={styles.sub}>
            Human review with an SLA: 24h safety-flagged, 72h otherwise. Confirming adds
            a strike (warn → suspend → ban).
          </Text>
          {(data?.openReports ?? []).map((r) => (
            <View key={r.id} style={styles.reportCard}>
              <Text style={styles.mono}>
                {r.category.toUpperCase()} · SLA {r.slaHours}H · {r.reportedName} ({r.strikes} strikes, {r.standing})
              </Text>
              {r.context ? <Text style={styles.context}>{r.context}</Text> : null}
              <View style={{ flexDirection: 'row', gap: space(2.5) }}>
                <Text style={styles.action} onPress={() => void resolve(r.id, true)}>
                  CONFIRM + STRIKE
                </Text>
                <Text style={[styles.action, { color: color.textMutedOnChalk }]} onPress={() => void resolve(r.id, false)}>
                  DISMISS
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: { ...type.monoSmall, color: color.caution },
  heading: { ...type.headline, color: color.textOnChalk },
  sub: { ...type.caption, color: color.textMutedOnChalk },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingVertical: space(2.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.hairline,
  },
  mono: { ...type.monoSmall, color: color.textOnChalk },
  route: { ...type.bodyMedium, color: color.textOnChalk, flex: 1 },
  context: { ...type.caption, color: color.textMutedOnChalk },
  action: { ...type.monoSmall, color: color.caution, paddingVertical: space(1) },
  reportCard: {
    backgroundColor: color.chalkRaised,
    borderWidth: 1,
    borderColor: color.hairline,
    borderRadius: radius.row,
    padding: space(3.5),
    gap: space(2.5),
  },
});
