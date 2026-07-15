# Commuter Connect — Project Reference

_A trust-first professional networking app for commuters. This document is the
complete context for the project: product, architecture, features, current
state, gaps, and the operational playbook. Written to be uploaded as Claude
Project knowledge so any session starts fully informed._

_Last updated: 2026-07-15._

---

## 1. What it is (the one-paragraph pitch)

Commuter Connect turns the routes you already travel — a train line, a flight,
a station, an airport — into a professional networking surface. You declare the
trips you take, and when you're actually traveling you tap "I'm traveling now"
to become discoverable for up to 3 hours to other verified professionals on
that same route. Everyone appears as **initials only, no photo**, until a
connection request is mutually accepted. It is deliberately **not** a dating
app and **not** a location tracker: it never uses live GPS, only the shared
route you chose to declare, and you're invisible unless you opt in. The core
promise is **trust** — real, verified humans; opt-in visibility; no
solicitation.

**Positioning — "commuters" is the seed, "travelers" is the market.** The name
says commuter, but the real user is **any professional in transit**: the daily
train rider *and* the consultant flying to a client, the conference-goer, the
person on a layover. Travel is arguably a *higher-intent* networking moment than
a commute — people on the road are away from their usual network and more open
to connecting. The one-off "I'm here now" and flight features already serve
travelers; positioning, copy, and possibly the name should grow to match. See
§11 for this and the enterprise dimension, which are the two biggest strategic
levers.

**Founder:** MJ (johnsonmalcolm0123@gmail.com), non-technical, builds and tests
phone-only on Android (no PC).

---

## 2. Product principles (the spine — every decision traces to these)

1. **Trust before liquidity.** A feature that adds users but erodes trust is
   rejected. Verified humans, opt-in presence, no pitching.
2. **Visible only when you say so.** No always-on presence, no background
   location. A check-in is an explicit tap and ends automatically within 3
   hours.
3. **Never your location — only a shared route.** Matching is on a route/place
   key you declared, never GPS. Repeated in the tour, welcome screen, and
   safety center.
4. **Anonymous until mutual.** Discovery shows initials + headline + fields +
   bio, never a name or photo, until both people accept. Names reveal at the
   match moment.
5. **No solicitation, ever.** Controlled-vocabulary connection reasons, a
   server-side content filter that blocks contact info and pitches, strikes for
   violations.
6. **The security boundary is the server, never the client.** The app is a thin
   cached RPC client. All rules live in Postgres (RLS + SECURITY DEFINER
   functions). The client cannot be trusted and isn't.
7. **Restraint in UI.** A departure-board aesthetic (split-flap animation used
   at exactly three moments: check-in, match, PIN reveal). Copy is plain and
   never "cheesy."

---

## 3. Tech stack

| Layer | Choice |
|---|---|
| App framework | Expo SDK 57, React Native 0.86, React 19.2, TypeScript (strict) |
| Navigation | expo-router (file-based, in `app/`) |
| State | zustand store (`src/store/useStore.ts`) — thin cached RPC client |
| Backend | Supabase: Postgres, Auth, Storage, Realtime, Vault, pg_cron, pg_net |
| Auth | Supabase Auth (email/password), transactional email via Resend |
| Identity verification | AWS Rekognition **Face Liveness** (real, deployed) |
| Push | Expo Push + Firebase Cloud Messaging (FCM v1) |
| Builds | EAS Build via GitHub Actions (Android APK live; iOS workflow ready) |
| Tests | `npm test` — esbuild-bundled `scripts/logic.test.ts` → node:test (22 passing) |

**Supabase project:** `voqberiubbodifcctahi` (region us-east-1).
**Repo:** `mjohnson0123/Connect`, active branch `claude/new-session-h8yh8x`.
**Committed env (`.env`, safe — all access governed server-side):**
`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
`EXPO_PUBLIC_AWS_REGION=us-east-1`,
`EXPO_PUBLIC_AWS_IDENTITY_POOL_ID=us-east-1:9e415bb9-...`.

---

## 4. Core concepts & data model

### Routes and the matching key (`rkey`)
There is **no global route catalog** (unmaintainable) and **no free text**
(never matches). Instead, structured input per mode is normalized into a
canonical key. Two people who declare the same route produce the same `rkey`
and therefore match.

- **Ground transit** (train/bus/ferry/rideshare): agency + line + toward →
  `train:marc-penn:toward-washington`
- **Flights**: origin + destination IATA → `flight:bwi → bos`
- **Places**: venue + code → keyed by the code

**Normalization** (`src/domain/routes.ts` mirrored by `public.normalize_text`)
strips case, punctuation, and filler words (`line|route|rte|train|bus|ferry|
the|station|stop|terminal|dc`) so "Penn Line" ≈ "Penn" and "Washington DC" ≈
"Washington". **The client and server normalizers must always match** — a
divergence silently splits one route into two non-matching communities (this
happened and was fixed in migration 0020).

### Place matching rule (important, hard-won)
- **One-off "I'm here now" check-ins** (and the flight→airport bridge) match
  **venue-wide** — everyone transient at code BWI meets, across terminals.
- **Recurring place regulars** match **spot-exact** — a rail-platform regular
  does NOT match a Gate C regular, because they physically can't reach each
  other through airport security. (Migration 0021.)

### Check-ins
Ephemeral. A tap creates a check-in with `active_until = now() + 3 hours`.
Visibility = an active check-in exists. Declaring a trip pattern makes you
invisible until you check in. The window times on a pattern are advisory only
(they drive the board display and reminders); you are **never auto-checked-in**.

### Anonymization
`route_people` and `discover_people` return a **monogram** (initials) in place
of the name — the real `display_name` never leaves the database before a mutual
accept. `initials()` client helper renders "D.O." The connections table reveals
the full name only after accept (surfaced at the match modal).

### One-off presence (transient travelers)
`one_off_check_in(venue, code)` creates a self-cleaning place pattern flagged
`one_off=true` and checks in atomically. The hourly retention sweep deletes
one-offs once their check-in lapses, so "discoverable" never outlives "actually
there." The board shows these as `TODAY`.

### Protected columns (guard trigger)
Sensitive profile columns (strikes, standing, is_operator, is_demo,
verification_status→verified) only change when `set_config('app.allow_protected',
'1', ...)` is set by trusted functions/seeds. A guard trigger blocks all other
writes — so a user cannot self-verify or self-promote to operator.

---

## 5. Feature inventory (what exists, screen by screen)

**Onboarding:** welcome (split-flap airport-code wordmark) → signup (email +
password + 18+ DOB gate, DOB never stored) → **face liveness verification**
(AWS Rekognition) → optional avatar from the verified frame → profile setup
(name, headline, bio, fields, reasons) → **first-run tour** (5 slides) → app.
Route order enforced by a pure, unit-tested gate (`src/lib/routeGate.ts`).

**The Board** (`app/(tabs)/index.tsx`) — the single home for routes (merged from
a former separate Trips tab). Each row is a departure entry: mode code + window,
route name, live count, and a right-hand **status column** that is both status
and action (amber `CHECK IN` → green `LIVE · countdown` chip, tap to end). Empty
state invites the first trip. Bottom: "Add a trip pattern" and "Passing through
somewhere today?" (one-off). Trip management (reminders, remove) lives on the
route's own screen so the board stays a display.

**Connect** (`app/(tabs)/connections.tsx`) — search discovery ("Find your
people"): searches every profile's fields/headline/bio, scoped to people who
share at least one of your routes/places. Results are initials-only cards with a
"shared fields" count. Also: incoming requests, active connections, sent
requests.

**You** (`app/(tabs)/you.tsx`) — profile (fields + reasons chips), edit profile,
re-open tour, Safety Center, operator view (gated), change password, sign out,
delete account.

**Other screens:** route people (`pattern/[id]`), request compose
(`request/[userId]`), match reveal (`match`), chat (`chat/[id]` — realtime,
content-filtered, 30-day expiry), meetup PIN (`meetup/[id]` — 6-digit,
single-use, 15-min), report (`report`), safety center (`safety`), add pattern
(`add-pattern`), here-now (`here-now`), change password.

**Field picker** (`src/components/FieldPicker.tsx`) — full-screen, searchable,
grouped (8 groups), max 5 fields. Replaced a 37-pill wall.

---

## 6. Safety & trust system

- **Identity:** AWS Rekognition Face Liveness confirms a live human; only a
  confidence ≥ 80 flips a profile to verified (server-only
  `apply_liveness_result`). Selfies are **deleted on completion** (migration
  0024) — the metadata row keeps only the score.
- **Anonymity:** initials-only until mutual accept.
- **Opt-in presence:** check-ins are explicit and expire in 3 hours; no
  location, no background.
- **Content filter:** server-side `msg_violations` blocks phone numbers, emails,
  links, and solicitation patterns in messages and request intros; 3 violations
  in 30 days auto-files a report.
- **Blocking:** instant, silent, mutual invisibility everywhere.
- **Reporting:** `file_report` → human review queue with SLAs (safety-flagged
  24h, else 72h). **NOTE: requires an operator to action — see Gaps.**
- **Meetup PINs:** CSPRNG 6-digit, single-use, 15-min expiry, 5-attempt cap;
  the generator can't self-confirm.
- **Strikes/standing:** warning → temporary suspension → permanent ban.
- **Trust messaging** is placed contextually (Bumble/Hinge style), not as
  footers: welcome bullets, tour, chat header, meetup screen, safety center,
  match reveal.

---

## 7. Notifications

- **Local reminders** (`src/lib/reminders.ts`): on-device weekly notifications
  15 min before a pattern's window. Android notification channel + a 5-second
  confirmation notification on enable (so a working toggle is distinguishable
  from a broken one). No server, no location.
- **Push** (`src/lib/push.ts`, migration 0022): device registers an Expo push
  token; server RPCs (`send_message`, `send_request`, `respond_request`) call
  `notify_user()`, which posts to Expo's push API via pg_net (async — a failed
  notification never breaks the user action). Lock-screen privacy: requests are
  anonymous ("someone who shares your route"), messages show first name only,
  never content. Tapping a push deep-links to the relevant screen.

---

## 8. Database migrations (source of truth: `supabase/migrations/`)

Migrations 0001–0008 were applied early via MCP and largely predate the repo
files (baseline schema: profiles, trip_patterns, check_ins, blocks,
connection_requests, connections, messages, meetup_pins, reports,
filter_violations, and the core RPCs). Files in the repo:

| File | What it does |
|---|---|
| 0006 | verifications table + private bucket |
| 0009 | demo structured routes |
| 0010 | profile content filter trigger |
| 0011 | route suggestions RPC |
| 0012 | interest discovery + anonymization |
| 0013 | expanded demo seed (20 riders) |
| 0014 | AWS liveness: `apply_liveness_result` (server-only), sim kill switch |
| 0015 | advisor hardening (RPC grants locked to authenticated/service_role) |
| 0016 | search all fields |
| 0017 | venue-wide place keys + route-scoped discovery |
| 0018 | one-off check-ins + BWI hub seed |
| 0019 | test-bed interests spread across riders |
| 0020 | unify client/server normalizer ("dc" filler); recompute all rkeys |
| 0021 | venue-wide for one-offs only; recurring places spot-exact (route_key_v3) |
| 0022 | **push notifications** (push_tokens, notify_user, pg_net) — _PENDING apply_ |
| 0023 | advisor fixes (re-lock one_off_check_in, pin search_path) |
| 0024 | **delete verification selfies on completion** — _PENDING apply_ |

**Applying migrations:** paste the file into Supabase → SQL Editor → Run (the
whole file is one transaction; a failure rolls back the batch). Files suffixed
`_PENDING` have not yet been confirmed applied to the live DB. When the Supabase
MCP connector is available, migrations can be applied directly.

**Security posture:** default-deny RLS + SECURITY DEFINER RPCs. An 11-vector
adversarial audit (`supabase/tests/security_audit.sql`) passes (last run after
0015 hardening). Most Supabase advisor "SECURITY DEFINER executable" warnings
are expected — those RPCs are meant to be callable and enforce auth internally.

---

## 9. Testing (phone-only, no PC)

- **Install:** GitHub Actions → "Build DEV/Android APK (EAS)" workflow (needs
  `EXPO_TOKEN` repo secret) → download APK from expo.dev → install on Android.
- **Backend/logic verification:** `npm test` (22 unit tests: content filter,
  route-key convergence, onboarding gate, place matching), `npx tsc --noEmit`,
  `CI=1 npx expo export -p web`, plus browser smoke tests via Playwright.
- **Solo notification testing** (can't chat with yourself): impersonate a demo
  rider in the SQL Editor to fire a real request/message at your account, or
  paste your push token into expo.dev/notifications. (Demo rider IDs:
  `11111111-1111-4111-8111-1111111111NN`, NN = 01..20.)
- **Demo data:** 20 demo riders. Hub routes for testing: **MARC Penn / MARC
  Camden toward Washington** and **BWI** (airport + rail). Fields spread across
  riders so most searches hit someone.

---

## 10. Third-party setup (accounts & credentials)

| Service | Status | Secret location |
|---|---|---|
| Supabase | Live | project `voqberiubbodifcctahi` |
| Resend (auth email) | Live (test sender `onboarding@resend.dev`) | Supabase SMTP settings |
| AWS Rekognition | Live | server keys in Supabase Edge Function secrets (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`); identity pool ID is public |
| Firebase / FCM | Config wired (`google-services.json`) | **service-account key must be uploaded to expo.dev → Credentials → Android → FCM V1** |
| Expo (EAS) | Live | `EXPO_TOKEN` GitHub secret |
| Apple Developer | Not enrolled | needed for iOS/TestFlight ($99/yr) |

**Rule:** secrets (AWS secret key, FCM service-account JSON, Resend API key,
EXPO_TOKEN) live in Supabase/Expo/GitHub secret stores — never in the repo,
never retyped, uploaded/pasted directly. Public identifiers (Supabase anon key,
AWS identity pool ID, `google-services.json`) are safe to commit.

---

## 11. Strategic direction — travelers & enterprise

_The two biggest expansion levers. Neither is built yet; both are shaped by
decisions made now, so the architecture must not foreclose them._

### 11a. From commuters to travelers (positioning)
The product is framed around daily commuters, but the addressable market is
**professionals in transit** — anyone whose work moves them through shared
travel infrastructure. A train regular and a business traveler are the same
user: predictable place, predictable time, open to a professional conversation.
Business trips, conferences, flights, and layovers are arguably *higher-intent*
than a commute — travelers are away from their normal network and more receptive.
The one-off "I'm here now," the flight mode, and the flight→airport bridge
already serve this. What should catch up: copy, marketing positioning, and a
decision on the name ("Commuter Connect" as an umbrella vs. a broader
"traveler" brand — open strategic question, not yet decided).

### 11b. Enterprise / corporate identity (the biggest expansion)
**The insight.** At any large company, employees constantly cross paths in
travel hubs without knowing it. Amazon has ~1.5M employees; on any given day
thousands are in airports, lounges, and terminals — often people in different
business units, geographies, or levels who would benefit from meeting but never
will. A verified corporate-identity layer turns "a stranger who shares my route"
into "a colleague from my own company I didn't know was here."

**The feature.** Verify a corporate email / SSO **in addition to** the face
check, unlocking a **same-company discovery dimension** layered on the existing
route/place matching. In a BWI lounge you could see fellow verified employees of
your company checked in nearby and connect across teams and levels you'd never
otherwise reach.

**Why it's powerful:**
- **Stronger trust anchor.** Shared verified employment is an even stronger
  signal than a shared route — it may justify richer within-company profiles
  (first name, team, role) while keeping the same opt-in, location-free presence.
- **Built-in liquidity.** Large orgs bring their own network density; a
  100k-person company seeds the graph instantly, sidestepping the cold-start
  problem consumer networks die from.
- **B2B wedge / monetization.** Flips a consumer app into B2B2C: enterprises pay
  for internal-networking-in-transit — valuable for large, distributed,
  remote-first, or travel-heavy orgs (consultancies, big tech, sales orgs). This
  is the revenue story a consumer trust network usually lacks.
- **Investor-shaped.** A consumer trust-first network *plus* a clear enterprise
  wedge is a stronger narrative than either alone.

**How it integrates technically (sketch, not built):**
- **Identity** — a second, orthogonal verification alongside the face check:
  "real human" (Rekognition) + "verified employee of X." Start with corporate
  **email-domain** verification (send a link to the work email via the existing
  Resend integration, extract the domain → map to a company). Graduate to
  proper enterprise **SSO** (SAML / OIDC via Okta, Microsoft Entra, Google
  Workspace) for paying customers.
- **Data model** — a `companies` table; a verified `company_id` / domain on
  profiles (a protected column, set only by the verification path).
- **Matching** — "same company" becomes a new filter dimension on
  `discover_people` / `route_people`, orthogonal to route/place. The user picks
  a visibility scope: everyone on my route, only same-company, or both.
- **Privacy** — anonymity-until-accept stays the default; within-company
  discovery *may* be configured more openly because employment is the trust
  anchor, but presence stays opt-in and location-free. The core promises don't
  bend for the enterprise tier.
- **Admin** — enterprise customers will likely want an org console (seats,
  verified domains, policy); a later, sales-driven build.

**Sequencing.** Post-beta and strategic: validate the consumer trust loop first,
then layer enterprise as the liquidity + monetization engine. But because the
route/place matching, verification pipeline, opt-in presence model, and Resend
email are already in place, the groundwork points straight at it — today's
schema and product decisions should keep it cheap to add.

---

## 12. Current state & gaps (as of 2026-07-15)

**Verified working (live-checked):** full backend migrated; real face
verification; retention sweep on pg_cron; push pipeline wired and one device
registered; auth + email; matching/discovery/chat/PIN/blocking; 22 tests green.

**Readiness verdict:** ready for a **small friends-and-family Android beta**
once the gaps below close; not yet ready for strangers or app-store launch.

**Blocking gaps for a trust-first beta:**
1. **No report reviewer.** `operators = 0`; the review-queue screen is flagged
   "NOT IN SHIPPING BUILD." The safety promise ("a person reviews every report")
   can't currently be kept. Fix: make the founder's account an operator and ship
   the queue to it.
2. **Verification-selfie deletion** — fixed in migration **0024**, needs applying
   to the live DB (was accumulating; 12 cleared by the migration).
3. **Demo riders visible to real users.** Real beta users would find 20 fake
   people who never respond. Fix: hide demo riders from non-founder accounts, or
   clear them before real users join.

**Judgment calls (fine for friends-and-family, fix before wider):**
- Simulated-verification kill switch not yet flipped (`allow_simulated_
  verification = true`) — the real face check isn't enforced yet. One line to
  flip at launch.
- Push not yet proven end-to-end (device registered; needs FCM service-account
  key uploaded to Expo + a live lock-screen test).
- No Terms/Privacy at real URLs, placeholder support email
  (`safety@commuterconnect.example`), no real domain, Android-only.
- Supabase free tier: fine for beta; move to Pro (~$25/mo) at ~50 concurrent
  active users or before launch (unlocks leaked-password protection, daily
  backups, no auto-pause). Free-tier projects pause after 7 days idle.

**Roadmap / deferred (not beta-blocking):**
- **Enterprise / corporate identity and the traveler reframe — see §11.** The
  two biggest strategic levers (same-company discovery via corporate SSO; broaden
  from commuters to all travelers). Post-beta, but architecture-shaping.
- iOS via TestFlight (needs Apple enrollment).
- Google + Apple sign-in (must ship together per Apple rules).
- Dev/prod environment split (plan written; prod DB created at launch; separate
  "CC Dev" app so builds coexist on the phone).
- Invisible AI where it strengthens trust (not as a feature): safety classifier
  behind the regex filter, semantic search via pgvector, route convergence.
  Do NOT add AI that speaks for users (ghostwritten bios/openers) — it poisons
  the trust brand.

---

## 13. Environment & workflow notes

- The build/test container's proxy blocks `supabase.co`, `api.expo.dev`, and
  similar — so backend verification is done via SQL and the Supabase MCP
  connector (which flaps; retry). The user's own phone/browser is not proxied
  and reaches everything normally.
- Development branch: `claude/new-session-h8yh8x`. Commit and push there. Do not
  open a PR unless asked. Repo has no `main` branch yet (created at launch as
  the production branch per the environments plan).
- Chromium + Playwright are preinstalled for browser verification against
  `expo export -p web`.

---

## 14. Glossary

- **rkey** — canonical route key; two identical rkeys match.
- **Check-in** — explicit, 3-hour, expiring visibility on a route.
- **One-off** — transient "I'm here now" presence that self-deletes.
- **Monogram** — the initials shown in place of a name pre-accept.
- **Operator** — a moderator account that can see the review queue and resolve
  reports.
- **The bridge** — offer, at flight check-in, to also check in at the departure
  airport (venue-wide, opt-in, expires on its own).
- **Same-company discovery** (roadmap, §11b) — a future match dimension: verified
  corporate identity lets colleagues from the same company find each other in
  travel hubs, orthogonal to route/place matching.
- **Split-flap** — the departure-board flip animation, used at check-in, match,
  and PIN reveal only.
