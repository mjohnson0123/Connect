import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  Block,
  ChatMessage,
  Connection,
  ConnectionRequest,
  MeetupVerification,
  ReasonTag,
  Report,
  ReportCategory,
  TripCheckIn,
  TripPattern,
  User,
} from '../domain/types';
import { LIMITS, REPORT_CATEGORIES } from '../domain/vocab';
import { FilterResult, filterMessage } from '../lib/contentFilter';
import { generatePin, newId } from '../lib/pin';
import { DAY, HOUR, MINUTE } from '../lib/time';
import { SEED_PATTERNS, SEED_USERS, seedCheckIns } from './seed';

/**
 * Local mock data layer. Every action here maps 1:1 to a backend endpoint in
 * production — the screens only ever talk to this store, so replacing it with
 * an API client does not touch the UI. Business rules the PRD pins down
 * (rate limits, double opt-in, expiry, strikes) live here, not in screens.
 */

export type AuthProvider = 'password' | 'google';

/** Local-only account record while the database is disconnected (see src/lib/auth.ts). */
export interface LocalAccount {
  email: string;
  /** null for OAuth providers. */
  passwordHash: string | null;
  provider: AuthProvider;
}

interface AppState {
  me: User | null;
  account: LocalAccount | null;
  /** Session flag: sign-out keeps the account + profile; deletion removes both. */
  signedIn: boolean;
  /** @deprecated superseded by account.email; kept for shape stability. */
  emailOnFile: string | null;
  users: User[];
  patterns: TripPattern[];
  checkIns: TripCheckIn[];
  requests: ConnectionRequest[];
  connections: Connection[];
  messages: ChatMessage[];
  pins: MeetupVerification[];
  blocks: Block[];
  reports: Report[];
  /** Client-side count of blocked message attempts, for review-queue escalation. */
  filterViolations: number;
  seededAt: number;

  ensureSeeds: () => void;
  /** Demo-mode: guarantees one inbound request so the double-opt-in flow is reviewable. */
  ensureDemoInbound: () => void;
  sweep: () => void;

  signUp: (email: string, dob: Date, auth: { passwordHash: string | null; provider: AuthProvider }) => string | null;
  signIn: (email: string, passwordHash: string | null, provider: AuthProvider) => string | null;
  signOut: () => void;
  completeVerification: () => void;
  saveProfile: (p: Pick<User, 'displayName' | 'photo' | 'headline' | 'bio' | 'reasonTags' | 'industryTags'>) => void;
  deleteAccount: () => void;

  addPattern: (p: Omit<TripPattern, 'id' | 'userId'>) => void;
  removePattern: (id: string) => void;
  checkIn: (patternId: string) => TripCheckIn;
  endCheckIn: (id: string) => void;

  sendRequest: (toUserId: string, reason: ReasonTag, intro: string) => string | null;
  respondRequest: (id: string, accept: boolean) => Connection | null;

  sendMessage: (connectionId: string, text: string) => FilterResult;

  createPin: (connectionId: string) => MeetupVerification;
  confirmPin: (connectionId: string, entered: string) => 'verified' | 'expired' | 'mismatch';

  blockUser: (blockedId: string) => void;
  unblockUser: (blockedId: string) => void;
  fileReport: (reportedId: string, category: ReportCategory, context: string) => void;
  resolveReport: (reportId: string, confirmed: boolean) => void;
}

const ME_ID = 'u-me';

function standingFor(strikes: number): User['standing'] {
  if (strikes >= LIMITS.strikeBan) return 'banned';
  if (strikes >= LIMITS.strikeSuspend) return 'suspended';
  if (strikes >= LIMITS.strikeWarn) return 'warned';
  return 'good';
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      me: null,
      account: null,
      signedIn: false,
      emailOnFile: null,
      users: [],
      patterns: [],
      checkIns: [],
      requests: [],
      connections: [],
      messages: [],
      pins: [],
      blocks: [],
      reports: [],
      filterViolations: 0,
      seededAt: 0,

      ensureSeeds: () => {
        const s = get();
        const now = Date.now();
        if (s.users.length === 0) {
          set({ users: SEED_USERS, patterns: [...SEED_PATTERNS], checkIns: seedCheckIns(now), seededAt: now });
          return;
        }
        // Demo liveness: if every seed check-in has expired, refresh them so
        // the board isn't empty on a later launch. A real backend has real users.
        const anyActive = s.checkIns.some((c) => c.activeUntil > now && c.userId !== ME_ID);
        if (!anyActive) {
          const mine = s.checkIns.filter((c) => c.userId === ME_ID && c.activeUntil > now);
          set({ checkIns: [...mine, ...seedCheckIns(now)], seededAt: now });
        }
      },

      ensureDemoInbound: () => {
        const s = get();
        if (!s.me || s.me.verificationStatus !== 'verified') return;
        if (s.requests.some((r) => r.fromUserId === 'u-jules')) return;
        if (isBlockedEitherWay(s.blocks, ME_ID, 'u-jules')) return;
        set({
          requests: [
            ...s.requests,
            {
              id: newId(),
              fromUserId: 'u-jules',
              toUserId: ME_ID,
              reasonTag: 'mentorship_receive',
              introText:
                'Saw we overlap on the Penn Line most mornings — I’m an MBA student headed into consulting and would value a conversation sometime.',
              status: 'pending',
              createdAt: Date.now(),
            },
          ],
        });
      },

      sweep: () => {
        const now = Date.now();
        const s = get();
        // Scheduled-job stand-ins (PRD §7): expiry is enforced by code, not manual cleanup.
        const checkIns = s.checkIns.filter((c) => c.activeUntil > now);
        const expiredConnIds = new Set(
          s.connections
            .filter((c) => c.status === 'active')
            .filter((c) => {
              const last = s.messages
                .filter((m) => m.connectionId === c.id)
                .reduce((mx, m) => Math.max(mx, m.createdAt), c.createdAt);
              return now - last > LIMITS.chatExpiryDays * DAY;
            })
            .map((c) => c.id),
        );
        set({
          checkIns,
          connections: s.connections.map((c) =>
            expiredConnIds.has(c.id) ? { ...c, status: 'expired' as const } : c,
          ),
          messages: s.messages.filter((m) => !expiredConnIds.has(m.connectionId)),
          pins: s.pins.filter((p) => p.expiresAt > now && !p.used),
        });
      },

      signUp: (email, dob, auth) => {
        const age = (Date.now() - dob.getTime()) / (365.25 * DAY);
        if (age < 18) return 'Commuter Connect is for adults 18 and over.';
        const normalized = email.trim().toLowerCase();
        const existing = get().account;
        if (existing && existing.email === normalized) {
          return 'An account with this email already exists — sign in instead.';
        }
        set({
          account: { email: normalized, passwordHash: auth.passwordHash, provider: auth.provider },
          signedIn: true,
          emailOnFile: normalized,
          me: {
            id: ME_ID,
            displayName: '',
            photo: '·',
            verificationStatus: 'unverified',
            headline: '',
            bio: '',
            industryTags: [],
            reasonTags: [],
            strikes: 0,
            standing: 'good',
          },
        });
        return null;
      },

      signIn: (email, passwordHash, provider) => {
        const account = get().account;
        const normalized = email.trim().toLowerCase();
        if (!account || account.email !== normalized) {
          return 'NO_ACCOUNT';
        }
        if (provider === 'password') {
          if (account.provider !== 'password' || !account.passwordHash) {
            return 'This account uses Google sign-in — use “Continue with Google”.';
          }
          if (account.passwordHash !== passwordHash) {
            return 'That email and password don’t match.';
          }
        } else if (account.provider !== 'google') {
          return 'This account uses a password — sign in with email and password.';
        }
        set({ signedIn: true });
        return null;
      },

      signOut: () => {
        // Session ends; the account, profile, and data stay for the next sign-in.
        set({ signedIn: false });
      },

      completeVerification: () => {
        // The captured selfie is used for the liveness check and then discarded
        // (PRD §5.1) — only the resulting status is stored.
        const me = get().me;
        if (me) set({ me: { ...me, verificationStatus: 'verified' } });
      },

      saveProfile: (p) => {
        const me = get().me;
        if (me) set({ me: { ...me, ...p, bio: p.bio.slice(0, LIMITS.bioMaxChars) } });
      },

      deleteAccount: () => {
        // In-app deletion, not deactivation (App Store 5.1.1v / Play policy).
        set({
          me: null,
          account: null,
          signedIn: false,
          emailOnFile: null,
          patterns: get().patterns.filter((p) => p.userId !== ME_ID),
          checkIns: get().checkIns.filter((c) => c.userId !== ME_ID),
          requests: get().requests.filter((r) => r.fromUserId !== ME_ID && r.toUserId !== ME_ID),
          connections: get().connections.filter((c) => c.userA !== ME_ID && c.userB !== ME_ID),
          messages: [],
          pins: [],
          blocks: [],
          filterViolations: 0,
        });
      },

      addPattern: (p) => {
        set({ patterns: [...get().patterns, { ...p, id: newId(), userId: ME_ID }] });
      },

      removePattern: (id) => {
        set({
          patterns: get().patterns.filter((p) => p.id !== id),
          checkIns: get().checkIns.filter((c) => c.tripPatternId !== id),
        });
      },

      checkIn: (patternId) => {
        const now = Date.now();
        const ci: TripCheckIn = {
          id: newId(),
          tripPatternId: patternId,
          userId: ME_ID,
          activeFrom: now,
          activeUntil: now + LIMITS.checkInHours * HOUR,
        };
        // One active check-in per pattern; a new one replaces the old.
        set({
          checkIns: [...get().checkIns.filter((c) => !(c.userId === ME_ID && c.tripPatternId === patternId)), ci],
        });
        return ci;
      },

      endCheckIn: (id) => {
        set({ checkIns: get().checkIns.filter((c) => c.id !== id) });
      },

      sendRequest: (toUserId, reason, intro) => {
        const s = get();
        const dayStart = new Date().setHours(0, 0, 0, 0);
        const sentToday = s.requests.filter((r) => r.fromUserId === ME_ID && r.createdAt >= dayStart).length;
        if (sentToday >= LIMITS.requestsPerDay) {
          return `Daily limit reached — you can send up to ${LIMITS.requestsPerDay} requests per day.`;
        }
        if (s.requests.some((r) => r.fromUserId === ME_ID && r.toUserId === toUserId && r.status === 'pending')) {
          return 'You already have a pending request to this person.';
        }
        if (s.connections.some((c) => c.status === 'active' && [c.userA, c.userB].includes(toUserId) && [c.userA, c.userB].includes(ME_ID))) {
          return 'You are already connected.';
        }
        set({
          requests: [
            ...s.requests,
            {
              id: newId(),
              fromUserId: ME_ID,
              toUserId,
              reasonTag: reason,
              introText: intro.slice(0, LIMITS.introMaxChars),
              status: 'pending',
              createdAt: Date.now(),
            },
          ],
        });
        return null;
      },

      respondRequest: (id, accept) => {
        const s = get();
        const req = s.requests.find((r) => r.id === id);
        if (!req || req.status !== 'pending') return null;
        const requests = s.requests.map((r) =>
          r.id === id ? { ...r, status: accept ? ('accepted' as const) : ('declined' as const) } : r,
        );
        if (!accept) {
          set({ requests });
          return null;
        }
        const conn: Connection = {
          id: newId(),
          userA: req.fromUserId,
          userB: req.toUserId,
          createdAt: Date.now(),
          status: 'active',
        };
        set({ requests, connections: [...s.connections, conn] });
        return conn;
      },

      sendMessage: (connectionId, text) => {
        const result = filterMessage(text);
        const s = get();
        if (!result.ok) {
          const filterViolations = s.filterViolations + 1;
          const escalate = filterViolations === 3; // repeat violations → review queue (PRD §5.5)
          set({
            filterViolations,
            reports: escalate
              ? [
                  ...s.reports,
                  {
                    id: newId(),
                    reporterId: 'system-filter',
                    reportedId: ME_ID,
                    category: 'solicitation',
                    context: 'Automated: 3 blocked message attempts (contact info / solicitation patterns).',
                    status: 'open',
                    createdAt: Date.now(),
                    slaHours: 72,
                  },
                ]
              : s.reports,
          });
          return result;
        }
        set({
          messages: [
            ...s.messages,
            { id: newId(), connectionId, senderId: ME_ID, content: text, createdAt: Date.now() },
          ],
        });
        return result;
      },

      createPin: (connectionId) => {
        const pin: MeetupVerification = {
          id: newId(),
          connectionId,
          generatedBy: ME_ID,
          pin: generatePin(),
          expiresAt: Date.now() + LIMITS.pinMinutes * MINUTE,
          verifiedAt: null,
          used: false,
        };
        // Single-use: generating a new PIN invalidates any previous one for this connection.
        set({ pins: [...get().pins.filter((p) => p.connectionId !== connectionId), pin] });
        return pin;
      },

      confirmPin: (connectionId, entered) => {
        const s = get();
        const pin = s.pins.find((p) => p.connectionId === connectionId && !p.used);
        if (!pin || pin.expiresAt < Date.now()) return 'expired';
        if (pin.pin !== entered.trim()) return 'mismatch';
        set({
          pins: s.pins.map((p) =>
            p.id === pin.id ? { ...p, used: true, verifiedAt: Date.now() } : p,
          ),
        });
        return 'verified';
      },

      blockUser: (blockedId) => {
        const s = get();
        // Instant and silent (PRD §5.7): no notification, mutual invisibility,
        // removal from all discovery, requests, and threads.
        set({
          blocks: [...s.blocks, { blockerId: ME_ID, blockedId, createdAt: Date.now() }],
          requests: s.requests.filter(
            (r) => !([r.fromUserId, r.toUserId].includes(ME_ID) && [r.fromUserId, r.toUserId].includes(blockedId)),
          ),
          connections: s.connections.filter(
            (c) => !([c.userA, c.userB].includes(ME_ID) && [c.userA, c.userB].includes(blockedId)),
          ),
        });
      },

      unblockUser: (blockedId) => {
        set({ blocks: get().blocks.filter((b) => !(b.blockerId === ME_ID && b.blockedId === blockedId)) });
      },

      fileReport: (reportedId, category, context) => {
        const safetyFlagged = REPORT_CATEGORIES.find((c) => c.value === category)?.safetyFlagged ?? false;
        set({
          reports: [
            ...get().reports,
            {
              id: newId(),
              reporterId: ME_ID,
              reportedId,
              category,
              context,
              status: 'open',
              createdAt: Date.now(),
              slaHours: safetyFlagged ? 24 : 72,
            },
          ],
        });
      },

      resolveReport: (reportId, confirmed) => {
        const s = get();
        const report = s.reports.find((r) => r.id === reportId);
        if (!report || report.status !== 'open') return;
        let users = s.users;
        if (confirmed) {
          users = s.users.map((u) => {
            if (u.id !== report.reportedId) return u;
            const strikes = u.strikes + 1;
            return { ...u, strikes, standing: standingFor(strikes) };
          });
        }
        set({
          users,
          reports: s.reports.map((r) =>
            r.id === reportId ? { ...r, status: confirmed ? ('resolved' as const) : ('dismissed' as const) } : r,
          ),
        });
      },
    }),
    {
      name: 'commuter-connect-v2', // bumped when the persisted shape gained account/session

      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export const MY_ID = ME_ID;

/** Discovery matching (PRD §5.3): same mode + route + direction, both actively checked in. */
export function patternsMatch(a: TripPattern, b: TripPattern): boolean {
  return (
    a.mode === b.mode &&
    a.routeOrLine.trim().toLowerCase() === b.routeOrLine.trim().toLowerCase() &&
    a.direction.trim().toLowerCase() === b.direction.trim().toLowerCase()
  );
}

export function isBlockedEitherWay(blocks: Block[], a: string, b: string): boolean {
  return blocks.some(
    (bl) => (bl.blockerId === a && bl.blockedId === b) || (bl.blockerId === b && bl.blockedId === a),
  );
}
