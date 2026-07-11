import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ReasonTag, ReportCategory, TravelMode, TripPattern, User } from '../domain/types';
import { filterMessage } from '../lib/contentFilter';
import { supabase } from '../lib/supabase';

/**
 * Live data layer backed by Supabase. Every business rule (rate limits,
 * double opt-in, content filter, PIN, blocks, strikes) is enforced by
 * SECURITY DEFINER functions server-side — this store is a thin, cached
 * client for those RPCs plus RLS-scoped reads. The local content filter runs
 * as a pre-check for instant feedback; the server remains the truth.
 */

export interface BoardEntry {
  pattern: TripPattern;
  liveCount: number;
  memberCount: number;
  checkedInUntil: number | null;
}

export interface PersonCard {
  id: string;
  displayName: string;
  monogram: string;
  headline: string;
  bio: string;
  industryTags: string[];
  reasonTags: ReasonTag[];
  verificationStatus: string;
}

export interface RequestRow {
  id: string;
  fromUserId: string;
  toUserId: string;
  reasonTag: ReasonTag;
  introText: string;
  createdAt: number;
  otherName: string;
  otherMonogram: string;
  otherHeadline: string;
  otherVerified: boolean;
}

export interface ConnectionRow {
  id: string;
  otherId: string;
  otherName: string;
  otherMonogram: string;
  otherVerified: boolean;
  status: 'active' | 'expired';
  lastMessage: string | null;
}

export interface Message {
  id: string;
  connectionId: string;
  senderId: string;
  content: string;
  createdAt: number;
}

interface AppState {
  booted: boolean;
  myId: string | null;
  me: User | null;
  patterns: TripPattern[];
  board: BoardEntry[];
  people: Record<string, PersonCard[]>;
  requestsIn: RequestRow[];
  requestsOut: RequestRow[];
  connections: ConnectionRow[];
  messages: Record<string, Message[]>;
  blocked: { id: string; displayName: string }[];
  /** patternId → scheduled local-notification ids (device-local, persisted). */
  reminders: Record<string, string[]>;

  boot: () => Promise<void>;
  refresh: () => Promise<void>;

  signUp: (email: string, password: string, dob: Date) => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<string | null>;
  confirmPasswordReset: (email: string, code: string, newPassword: string) => Promise<string | null>;
  /** Uploads the selfie to private storage and records the verification. */
  submitVerification: (imageBase64: string | null) => Promise<string | null>;
  completeVerification: () => Promise<void>;
  saveProfile: (p: {
    displayName: string; monogram: string; headline: string; bio: string;
    industryTags: string[]; reasonTags: ReasonTag[];
  }) => Promise<string | null>;

  addPattern: (p: {
    mode: TravelMode; routeId?: string; routeOrLine: string; direction: string;
    daysOfWeek: number[]; windowStart: string; windowEnd: string; stationOrCode: string;
  }) => Promise<string | null>;
  removePattern: (id: string) => Promise<void>;
  checkIn: (patternId: string) => Promise<void>;
  endCheckIn: (patternId: string) => Promise<void>;
  loadPeople: (patternId: string) => Promise<void>;

  sendRequest: (toUserId: string, reason: ReasonTag, intro: string) => Promise<string | null>;
  respondRequest: (id: string, accept: boolean) => Promise<string | null>;

  loadMessages: (connectionId: string) => Promise<void>;
  subscribeMessages: (connectionId: string) => () => void;
  sendMessage: (connectionId: string, text: string) => Promise<{ ok: boolean; message?: string }>;

  createPin: (connectionId: string) => Promise<{ pin: string; expiresAt: number } | null>;
  confirmPin: (connectionId: string, pin: string) => Promise<'verified' | 'mismatch' | 'expired'>;
  pinVerified: (connectionId: string) => Promise<boolean>;
  submitMeetupFeedback: (connectionId: string, rating: 'good' | 'issue') => Promise<void>;

  blockUser: (blockedId: string) => Promise<void>;
  unblockUser: (blockedId: string) => Promise<void>;
  fileReport: (reportedId: string, category: ReportCategory, context: string) => Promise<void>;
  operatorOverview: () => Promise<{
    density: { rkey: string; route: string; members: number; live: number }[];
    openReports: { id: string; category: string; context: string; slaHours: number; reportedName: string; strikes: number; standing: string }[];
    feedback: { rating: string; aboutName: string; createdAt: string }[];
  } | null>;

  setReminder: (patternId: string, notificationIds: string[] | null) => void;
}

const DAY = 86_400_000;

function mapProfile(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    displayName: (row.display_name as string) ?? '',
    photo: (row.monogram as string) ?? '·',
    verificationStatus: row.verification_status as User['verificationStatus'],
    headline: (row.headline as string) ?? '',
    bio: (row.bio as string) ?? '',
    industryTags: (row.industry_tags as string[]) ?? [],
    reasonTags: (row.reason_tags as ReasonTag[]) ?? [],
    strikes: (row.strikes as number) ?? 0,
    standing: (row.standing as User['standing']) ?? 'good',
  };
}

function mapPattern(row: Record<string, unknown>): TripPattern {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    mode: row.mode as TravelMode,
    routeId: (row.route_id as string) ?? undefined,
    routeOrLine: row.route_or_line as string,
    direction: row.direction as string,
    daysOfWeek: row.days_of_week as number[],
    windowStart: row.window_start as string,
    windowEnd: row.window_end as string,
    stationOrCode: (row.station_or_code as string) ?? '',
  };
}

function authErrorText(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'That email and password don’t match.';
  if (/already registered/i.test(message)) return 'An account with this email already exists — sign in instead.';
  if (/password/i.test(message)) return 'Password needs at least 8 characters.';
  if (/rate limit/i.test(message)) return 'Too many attempts — wait a minute and try again.';
  return message;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      booted: false,
      myId: null,
      me: null,
      patterns: [],
      board: [],
      people: {},
      requestsIn: [],
      requestsOut: [],
      connections: [],
      messages: {},
      blocked: [],
      reminders: {},

      boot: async () => {
        const { data } = await supabase.auth.getSession();
        set({ myId: data.session?.user.id ?? null, booted: true });
        supabase.auth.onAuthStateChange((_event, session) => {
          const prev = get().myId;
          const next = session?.user.id ?? null;
          if (prev !== next) {
            set({
              myId: next, me: null, patterns: [], board: [], people: {},
              requestsIn: [], requestsOut: [], connections: [], messages: {}, blocked: [],
            });
            if (next) void get().refresh();
          }
        });
        if (data.session) await get().refresh();
      },

      refresh: async () => {
        const myId = get().myId;
        if (!myId) return;

        // Pilot demo scaffolding: keeps demo riders checked in + one inbound request.
        await supabase.rpc('demo_bootstrap');

        const [meRes, patternsRes, summaryRes, checkInsRes, reqRes, connRes, blockedRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', myId).single(),
          supabase.from('trip_patterns').select('*').order('created_at'),
          supabase.rpc('board_summary'),
          supabase.from('check_ins').select('pattern_id, active_until'),
          supabase.from('connection_requests').select('*, from_profile:profiles!connection_requests_from_user_fkey(display_name, monogram, headline, verification_status), to_profile:profiles!connection_requests_to_user_fkey(display_name, monogram, headline, verification_status)').eq('status', 'pending'),
          supabase.from('connections').select('*, a:profiles!connections_user_a_fkey(id, display_name, monogram, verification_status), b:profiles!connections_user_b_fkey(id, display_name, monogram, verification_status), messages(content, created_at)').order('created_at', { ascending: false }),
          supabase.rpc('blocked_profiles'),
        ]);

        const patterns = (patternsRes.data ?? []).map(mapPattern);
        const summary = new Map(
          ((summaryRes.data ?? []) as { pattern_id: string; live_count: number; member_count: number }[])
            .map((r) => [r.pattern_id, r]),
        );
        const activeByPattern = new Map(
          ((checkInsRes.data ?? []) as { pattern_id: string; active_until: string }[])
            .filter((c) => new Date(c.active_until).getTime() > Date.now())
            .map((c) => [c.pattern_id, new Date(c.active_until).getTime()]),
        );

        const requests = (reqRes.data ?? []) as Record<string, any>[];
        const mapReq = (r: Record<string, any>, other: Record<string, any>): RequestRow => ({
          id: r.id,
          fromUserId: r.from_user,
          toUserId: r.to_user,
          reasonTag: r.reason_tag,
          introText: r.intro_text,
          createdAt: new Date(r.created_at).getTime(),
          otherName: other?.display_name ?? 'Member',
          otherMonogram: other?.monogram ?? '·',
          otherHeadline: other?.headline ?? '',
          otherVerified: other?.verification_status === 'verified',
        });

        const conns = ((connRes.data ?? []) as Record<string, any>[]).map((c) => {
          const other = c.a?.id === myId ? c.b : c.a;
          const msgs = (c.messages ?? []) as { content: string; created_at: string }[];
          const last = msgs.length ? msgs.reduce((m, x) => (x.created_at > m.created_at ? x : m)) : null;
          return {
            id: c.id as string,
            otherId: other?.id ?? '',
            otherName: other?.display_name ?? 'Member',
            otherMonogram: other?.monogram ?? '·',
            otherVerified: other?.verification_status === 'verified',
            status: c.status as 'active' | 'expired',
            lastMessage: last?.content ?? null,
          };
        });

        set({
          me: meRes.data ? mapProfile(meRes.data) : null,
          patterns,
          board: patterns.map((p) => ({
            pattern: p,
            liveCount: Number(summary.get(p.id)?.live_count ?? 0),
            memberCount: Number(summary.get(p.id)?.member_count ?? 0),
            checkedInUntil: activeByPattern.get(p.id) ?? null,
          })),
          requestsIn: requests.filter((r) => r.to_user === myId).map((r) => mapReq(r, r.from_profile)),
          requestsOut: requests.filter((r) => r.from_user === myId).map((r) => mapReq(r, r.to_profile)),
          connections: conns,
          blocked: ((blockedRes.data ?? []) as { id: string; display_name: string }[])
            .map((b) => ({ id: b.id, displayName: b.display_name })),
        });
      },

      signUp: async (email, password, dob) => {
        // 18+ hard gate (PRD §5.1). DOB is checked and discarded — never stored.
        if ((Date.now() - dob.getTime()) / (365.25 * DAY) < 18) {
          return 'Commuter Connect is for adults 18 and over.';
        }
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) return authErrorText(error.message);
        if (!data.session) {
          return 'CONFIRM_EMAIL';
        }
        await get().refresh();
        return null;
      },

      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return authErrorText(error.message);
        await get().refresh();
        return null;
      },

      signOut: async () => {
        await supabase.auth.signOut();
      },

      deleteAccount: async () => {
        await supabase.rpc('delete_account');
        await supabase.auth.signOut();
      },

      requestPasswordReset: async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
        return error ? authErrorText(error.message) : null;
      },

      confirmPasswordReset: async (email, code, newPassword) => {
        if (newPassword.length < 8) return 'Password needs at least 8 characters.';
        const { error } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: code.trim(),
          type: 'recovery',
        });
        if (error) return 'That code isn’t valid or has expired — request a new one.';
        const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
        if (updateError) return authErrorText(updateError.message);
        await get().refresh();
        return null;
      },

      submitVerification: async (imageBase64) => {
        const myId = get().myId;
        if (!myId) return 'Not signed in.';
        let imagePath: string | null = null;
        if (imageBase64) {
          // Private bucket; RLS limits writes to the caller's own folder and
          // reads to the verification pipeline (PRD §5.1 / §7).
          const { decode } = await import('base64-arraybuffer');
          imagePath = `${myId}/selfie-${Date.now()}.jpg`;
          const { error: uploadError } = await supabase.storage
            .from('verifications')
            .upload(imagePath, decode(imageBase64), { contentType: 'image/jpeg' });
          if (uploadError) return `Upload failed: ${uploadError.message}`;
        }
        const { error } = await supabase.rpc('submit_verification', { p_image_path: imagePath });
        if (error) return error.message;
        await get().refresh();
        return null;
      },

      completeVerification: async () => {
        await supabase.rpc('complete_verification');
        await get().refresh();
      },

      saveProfile: async (p) => {
        const myId = get().myId;
        if (!myId) return 'Not signed in.';
        const { error } = await supabase.from('profiles').update({
          display_name: p.displayName,
          monogram: p.monogram,
          headline: p.headline,
          bio: p.bio.slice(0, 280),
          industry_tags: p.industryTags,
          reason_tags: p.reasonTags,
        }).eq('id', myId);
        if (error) return error.message;
        await get().refresh();
        return null;
      },

      addPattern: async (p) => {
        const myId = get().myId;
        if (!myId) return 'Not signed in.';
        const { error } = await supabase.from('trip_patterns').insert({
          user_id: myId,
          mode: p.mode,
          route_id: p.routeId ?? null,
          route_or_line: p.routeOrLine,
          direction: p.direction,
          days_of_week: p.daysOfWeek,
          window_start: p.windowStart,
          window_end: p.windowEnd,
          station_or_code: p.stationOrCode,
        });
        if (error) return error.message;
        await get().refresh();
        return null;
      },

      removePattern: async (id) => {
        await supabase.from('trip_patterns').delete().eq('id', id);
        const { [id]: _gone, ...reminders } = get().reminders;
        set({ reminders });
        await get().refresh();
      },

      checkIn: async (patternId) => {
        await supabase.rpc('check_in', { p_pattern_id: patternId });
        await get().refresh();
      },

      endCheckIn: async (patternId) => {
        await supabase.rpc('end_check_in', { p_pattern_id: patternId });
        await get().refresh();
      },

      loadPeople: async (patternId) => {
        const { data } = await supabase.rpc('route_people', { p_pattern_id: patternId });
        set({
          people: {
            ...get().people,
            [patternId]: ((data ?? []) as Record<string, any>[]).map((r) => ({
              id: r.id,
              displayName: r.display_name,
              monogram: r.monogram,
              headline: r.headline,
              bio: r.bio,
              industryTags: r.industry_tags ?? [],
              reasonTags: r.reason_tags ?? [],
              verificationStatus: r.verification_status,
            })),
          },
        });
      },

      sendRequest: async (toUserId, reason, intro) => {
        const { data, error } = await supabase.rpc('send_request', {
          p_to: toUserId, p_reason: reason, p_intro: intro,
        });
        if (error) return error.message;
        const res = data as { ok: boolean; error?: string };
        if (!res.ok) return res.error ?? 'Could not send request.';
        await get().refresh();
        return null;
      },

      respondRequest: async (id, accept) => {
        const { data, error } = await supabase.rpc('respond_request', {
          p_request_id: id, p_accept: accept,
        });
        await get().refresh();
        if (error) return null;
        return (data as string | null) ?? null;
      },

      loadMessages: async (connectionId) => {
        const { data } = await supabase.from('messages').select('*')
          .eq('connection_id', connectionId).order('created_at');
        set({
          messages: {
            ...get().messages,
            [connectionId]: ((data ?? []) as Record<string, any>[]).map((m) => ({
              id: m.id, connectionId: m.connection_id, senderId: m.sender_id,
              content: m.content, createdAt: new Date(m.created_at).getTime(),
            })),
          },
        });
      },

      subscribeMessages: (connectionId) => {
        const channel = supabase
          .channel(`messages-${connectionId}`)
          .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages', filter: `connection_id=eq.${connectionId}` },
            (payload) => {
              const m = payload.new as Record<string, any>;
              const existing = get().messages[connectionId] ?? [];
              if (existing.some((x) => x.id === m.id)) return;
              set({
                messages: {
                  ...get().messages,
                  [connectionId]: [...existing, {
                    id: m.id, connectionId: m.connection_id, senderId: m.sender_id,
                    content: m.content, createdAt: new Date(m.created_at).getTime(),
                  }],
                },
              });
            })
          .subscribe();
        return () => { void supabase.removeChannel(channel); };
      },

      sendMessage: async (connectionId, text) => {
        // Local pre-check for instant, explanatory feedback; server re-checks.
        const local = filterMessage(text);
        if (!local.ok) return { ok: false, message: local.message };
        const { data, error } = await supabase.rpc('send_message', {
          p_connection_id: connectionId, p_content: text,
        });
        if (error) return { ok: false, message: error.message };
        const res = data as { ok: boolean; error?: string; violations?: string[] };
        if (!res.ok) {
          return {
            ok: false,
            message: res.error ?? 'This message wasn’t sent — it looks like it contains contact info or solicitation. Commuter Connect keeps conversations in-app and pitch-free.',
          };
        }
        await get().loadMessages(connectionId);
        return { ok: true };
      },

      createPin: async (connectionId) => {
        const { data, error } = await supabase.rpc('create_pin', { p_connection_id: connectionId });
        if (error || !data) return null;
        const res = data as { pin: string; expires_at: string };
        return { pin: res.pin, expiresAt: new Date(res.expires_at).getTime() };
      },

      confirmPin: async (connectionId, pin) => {
        const { data, error } = await supabase.rpc('confirm_pin', {
          p_connection_id: connectionId, p_pin: pin,
        });
        if (error) return 'expired';
        return data as 'verified' | 'mismatch' | 'expired';
      },

      pinVerified: async (connectionId) => {
        const { data } = await supabase.rpc('pin_status', { p_connection_id: connectionId });
        return !!(data as { verified?: boolean })?.verified;
      },

      submitMeetupFeedback: async (connectionId, rating) => {
        await supabase.rpc('submit_meetup_feedback', {
          p_connection_id: connectionId, p_rating: rating,
        });
      },

      blockUser: async (blockedId) => {
        await supabase.rpc('block_user', { p_blocked: blockedId });
        await get().refresh();
      },

      unblockUser: async (blockedId) => {
        await supabase.from('blocks').delete().eq('blocked_id', blockedId);
        await get().refresh();
      },

      fileReport: async (reportedId, category, context) => {
        await supabase.rpc('file_report', {
          p_reported: reportedId, p_category: category, p_context: context,
        });
      },

      operatorOverview: async () => {
        const { data, error } = await supabase.rpc('operator_overview');
        if (error || !data || (data as Record<string, unknown>).error) return null;
        const d = data as Record<string, any>;
        return {
          density: (d.density ?? []).map((r: Record<string, any>) => ({
            rkey: r.rkey, route: r.route, members: Number(r.members), live: Number(r.live),
          })),
          openReports: (d.open_reports ?? []).map((r: Record<string, any>) => ({
            id: r.id, category: r.category, context: r.context, slaHours: r.sla_hours,
            reportedName: r.reported_name, strikes: r.strikes, standing: r.standing,
          })),
          feedback: (d.feedback ?? []).map((f: Record<string, any>) => ({
            rating: f.rating, aboutName: f.about_name, createdAt: f.created_at,
          })),
        };
      },

      setReminder: (patternId, notificationIds) => {
        const current = get().reminders;
        if (notificationIds === null) {
          const { [patternId]: _off, ...rest } = current;
          set({ reminders: rest });
        } else {
          set({ reminders: { ...current, [patternId]: notificationIds } });
        }
      },
    }),
    {
      name: 'commuter-connect-local-v1',
      storage: createJSONStorage(() => AsyncStorage),
      // Only device-local concerns persist here; Supabase owns all shared data.
      partialize: (s) => ({ reminders: s.reminders }) as AppState,
    },
  ),
);
