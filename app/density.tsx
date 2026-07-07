import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Screen from '../src/components/Screen';
import { Button, Hairline } from '../src/components/ui';
import { modeCode, REPORT_CATEGORIES } from '../src/domain/vocab';
import { useStore } from '../src/store/useStore';
import { color, radius, space, type } from '../src/theme/tokens';

/**
 * Operator view (PRD §5.3, §5.7, §13 Q2) — not shipped to end users at MVP.
 * Density by mode/route shows where matching is actually working; the review
 * queue is the human step that turns reports into strikes. In production this
 * is a separate, least-privilege admin surface with a full audit trail.
 */
export default function Density() {
  const patterns = useStore((s) => s.patterns);
  const checkIns = useStore((s) => s.checkIns);
  const users = useStore((s) => s.users);
  const reports = useStore((s) => s.reports);
  const resolveReport = useStore((s) => s.resolveReport);

  const now = Date.now();
  const active = checkIns.filter((c) => c.activeUntil > now);

  const byRoute = new Map<string, { mode: string; route: string; members: number; live: number }>();
  for (const p of patterns) {
    const key = `${p.mode}|${p.routeOrLine.toLowerCase()}|${p.direction.toLowerCase()}`;
    const entry = byRoute.get(key) ?? { mode: p.mode, route: `${p.routeOrLine} · ${p.direction}`, members: 0, live: 0 };
    entry.members += 1;
    entry.live += active.some((c) => c.tripPatternId === p.id) ? 1 : 0;
    byRoute.set(key, entry);
  }
  const routes = [...byRoute.values()].sort((a, b) => b.live - a.live || b.members - a.members);

  const open = reports.filter((r) => r.status === 'open');
  const closed = reports.filter((r) => r.status !== 'open');

  return (
    <Screen>
      <View style={{ gap: space(5), paddingTop: space(4) }}>
        <Text style={styles.banner}>
          OPERATOR VIEW · DEMO ONLY — IN PRODUCTION THIS LIVES BEHIND ADMIN AUTH WITH AN
          AUDIT TRAIL, NOT IN THE APP.
        </Text>

        <View style={{ gap: space(2.5) }}>
          <Text style={styles.heading}>Density by route</Text>
          <Text style={styles.sub}>
            Members with a declared pattern vs. checked in right now. Density — not raw
            signups — is the number that says whether matching works.
          </Text>
          {routes.map((r) => (
            <View key={r.route} style={styles.row}>
              <Text style={styles.mono}>{modeCode(r.mode as never)}</Text>
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
          <Text style={styles.heading}>Review queue ({open.length} open)</Text>
          <Text style={styles.sub}>
            Human review with an SLA: 24h safety-flagged, 72h otherwise. Confirming a
            report adds a strike (warn → suspend → ban).
          </Text>
          {open.length === 0 ? (
            <Text style={styles.sub}>Queue is clear.</Text>
          ) : (
            open.map((r) => {
              const reported = users.find((u) => u.id === r.reportedId);
              const cat = REPORT_CATEGORIES.find((c) => c.value === r.category);
              return (
                <View key={r.id} style={styles.reportCard}>
                  <Text style={styles.mono}>
                    {cat?.label.toUpperCase()} · SLA {r.slaHours}H ·{' '}
                    {reported ? `${reported.displayName} (${reported.strikes} strikes, ${reported.standing})` : r.reportedId}
                  </Text>
                  {r.context ? <Text style={styles.context}>{r.context}</Text> : null}
                  <View style={{ flexDirection: 'row', gap: space(2.5) }}>
                    <Button label="Confirm + strike" variant="destructive" onPress={() => resolveReport(r.id, true)} style={{ flex: 1 }} />
                    <Button label="Dismiss" variant="quiet" onPress={() => resolveReport(r.id, false)} style={{ flex: 1 }} />
                  </View>
                </View>
              );
            })
          )}
          {closed.length > 0 ? (
            <Text style={styles.sub}>
              {closed.length} resolved/dismissed — every action here is audit-logged in
              production.
            </Text>
          ) : null}
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
  reportCard: {
    backgroundColor: color.chalkRaised,
    borderWidth: 1,
    borderColor: color.hairline,
    borderRadius: radius.row,
    padding: space(3.5),
    gap: space(2.5),
  },
});
