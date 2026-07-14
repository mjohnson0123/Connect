/**
 * The onboarding gate: given session/progress state, where does the app send
 * you? Pure and unit-tested (scripts/logic.test.ts) because mis-ordering
 * these checks produced real field bugs: the tour firing AFTER profile setup,
 * and a back()-based tour exit dumping fresh accounts on the welcome screen.
 *
 * Order: session → (loading) → tour → verification → profile → app.
 * The tour deliberately precedes verification: a brand-new account should see
 * what the app is before being asked for a selfie.
 */
export type GateState = {
  myId: string | null;
  hasProfile: boolean; // `me` loaded from the server
  verified: boolean;
  hasDisplayName: boolean;
  tourSeen: boolean;
};

export function nextRoute(s: GateState): string | null {
  if (!s.myId) return '/onboarding/welcome';
  if (!s.hasProfile) return null; // loading / offline-retry UI, no redirect
  if (!s.tourSeen) return '/tour';
  if (!s.verified) return '/onboarding/verify';
  if (!s.hasDisplayName) return '/onboarding/profile';
  return '/(tabs)';
}
