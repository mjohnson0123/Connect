# Commuter Connect — Mobile MVP

Opt-in professional networking for people who share the same train, flight, ferry, bus,
or terminal on a recurring basis. *"You've probably sat three rows from your next
mentor. Let's fix that."*

Cross-platform native app built with **Expo (React Native) + TypeScript + expo-router**,
per the PRD's platform recommendation (§8). One codebase for iOS and Android; the web
export exists only as a development preview.

## Run it

```bash
npm install
npm start          # Expo dev server → run on iOS/Android simulator or Expo Go
npm run typecheck  # tsc --noEmit
npx expo export -p web   # static web preview build (dist/)
```

The build ships with **demo seed data**: five seeded riders on the MARC Penn Line /
BWI routes, live check-ins that refresh between launches, and one inbound connection
request so the double-opt-in flow can be exercised end to end. Walk the whole loop:
sign up → selfie verification (simulated) → profile → add "MARC Penn Line / Baltimore →
DC" → check in → open the route → request/accept → chat → meetup PIN.

## What's implemented (PRD §11 must-haves)

| Feature | Where | Notes |
|---|---|---|
| Onboarding + 18+ gate + selfie verification | `app/onboarding/*` | Camera permission requested contextually at the verification step (§9.3); liveness service is simulated; capture is discarded — only the status persists (§5.1) |
| Profile with controlled reason tags | `app/onboarding/profile.tsx` | 280-char bio cap; no phone/email/social fields exist anywhere (§5.2) |
| TripPattern declaration, mode-agnostic | `app/add-pattern.tsx` | `mode` is an extensible enum: train/flight/boat/bus/rideshare/place (§5.3) |
| Ephemeral opt-in check-in | `app/(tabs)/trips.tsx` | 3h max, auto-expires, end-early; nothing visible without one (§5.3) |
| Discovery: aggregate counts → cards | `app/(tabs)/index.tsx`, `app/pattern/[id].tsx` | Count first, identities on tap; shared route/window only, never a position (§5.3) |
| Double-opt-in connection requests | `app/request/[userId].tsx`, `app/(tabs)/connections.tsx` | Reason tag required, 200-char intro, 10/day rate limit (§5.4) |
| In-app messaging + content filter | `app/chat/[id].tsx`, `src/lib/contentFilter.ts` | Blocks phone/email/handles/links/solicitation before send; 3 blocked attempts escalate to the review queue; threads expire 30 days after last activity (§5.5) |
| Meetup PIN verification | `app/meetup/[id].tsx`, `src/lib/pin.ts` | 6-digit, CSPRNG (rejection-sampled, never ID-derived), single-use, 15-min expiry (§5.6, §7) |
| Block / Report / strikes | `app/report.tsx`, `app/safety.tsx`, store | Block is instant + silent + mutual invisibility; reports carry 24h/72h SLA; strikes: warn → suspend → ban (§5.7) |
| Operator density + review queue | `app/density.tsx` | Density by mode/route and the human review step (§5.3, §13 Q2) — demo surface; production puts this behind admin auth with an audit trail |

## Design system (PRD §10)

Tokens live in `src/theme/tokens.ts` — Platform Ink `#12161C`, Chalk `#EDEEE9`,
Departure Amber `#E8A33D`, Platform Signal `#2F6E5C` (trust states only), Caution Rail
`#B4483A` (destructive only), Rail Steel hairlines. Type: **Overpass** (display),
**Public Sans** (body), **IBM Plex Mono** (route codes, windows, PINs) — all OFL/Apache,
bundled via `@expo-google-fonts/*`.

Discovery reads as a **timetable, not a feed** (`src/components/BoardRow.tsx`). The
**split-flap** signature interaction (`src/components/SplitFlap.tsx`) fires at exactly
three moments — check-in going live, new match, PIN reveal — and degrades to a crossfade
when the OS reduce-motion setting is on. Amber text on Chalk uses a darkened AA-passing
shade (`amberTextOnChalk`); pure amber appears as text only on Ink.

## Architecture

```
app/                    expo-router screens (file-based routing)
src/domain/             types.ts (PRD §4 entities) · vocab.ts (controlled vocabularies, limits)
src/lib/                contentFilter.ts · pin.ts · time.ts   — pure, unit-testable rules
src/store/useStore.ts   zustand + AsyncStorage — the mock data layer
src/store/seed.ts       demo users/patterns/check-ins
src/components/         SplitFlap · BoardRow · Screen · ui primitives
src/theme/tokens.ts     design tokens
```

**The store is the backend seam.** Screens only ever call store actions
(`checkIn`, `sendRequest`, `sendMessage`, `createPin`, `blockUser`, …), each of which
maps 1:1 to a future API endpoint. Business rules the PRD pins down — rate limits,
double opt-in, expiry windows, strike thresholds — live in the store and `src/lib`,
not in screens. Expiry (check-ins, 30-day chat, PINs) is enforced by a sweep on
launch/foreground/every minute, standing in for the backend's scheduled retention jobs (§7).

## What's simulated vs. production work

This MVP is intentionally client-complete with a mocked data layer. A production
release replaces/adds:

- **Backend + real auth** — email/password *and* Sign in with Apple (Guideline 4.8);
  server-side enforcement of every rule the client enforces (filtering, rate limits,
  visibility), since the client alone is never a security boundary.
- **Real selfie liveness service** with encrypted image storage scoped to the
  verification pipeline and deletion after verification (§5.1, §7).
- **Push notifications** (request/accept/message/check-in-ending) — copy stays at the
  "shared commute" abstraction, never location (§5.8).
- **Moderation tooling** behind admin auth with least-privilege access and an audit
  trail of every ban/unblock/resolution (§7); Play expects moderation to be an
  *ongoing demonstrable process* (§9.2).
- **Compliance artifacts before store submission** (§9): public privacy policy URL that
  matches actual retention behavior, ToS with the no-solicitation policy and meetup
  safety disclaimer, App Privacy / Data Safety declarations, account deletion **web
  link** (Play), Child Safety contact + CSAE self-certification (Play), 17+ age rating,
  review-notes demo credentials.
- **Never add background location.** The check-in model is foreground-only by design;
  both stores' 2026 location policies make background tracking a rejection risk, not
  just a privacy regression (§9.2).

## Open questions carried from the PRD (§13)

Pilot route/geography for launch marketing (build is mode-agnostic; seeds use MARC Penn
Line), final strike thresholds and reviewer staffing, exact retention windows (30-day
chat default must match the privacy policy verbatim), any restrictions beyond 18+, and
the named Child Safety contact for Play Console.
