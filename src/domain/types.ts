/**
 * Domain model (PRD §4). These types are the contract a real backend
 * implements; the MVP ships with a local mock store behind the same shapes.
 */

/** Extensible by design (PRD §5.3): add modes without a schema change. */
export type TravelMode = 'train' | 'flight' | 'boat' | 'bus' | 'rideshare' | 'place';

export type VerificationStatus = 'unverified' | 'pending' | 'verified';

export type ReasonTag =
  | 'industry_peer'
  | 'mentorship_give'
  | 'mentorship_receive'
  | 'career_conversation'
  | 'expanding_network';

export interface User {
  id: string;
  displayName: string;
  /** Monogram initials, the fallback when no photo is set. */
  photo: string;
  /** Public URL of the profile photo (opt-in copy of the verified selfie). */
  avatarUrl: string | null;
  verificationStatus: VerificationStatus;
  headline: string;
  bio: string;
  industryTags: string[];
  reasonTags: ReasonTag[];
  /** Trust & safety (PRD §5.7): confirmed violations accrue strikes. */
  strikes: number;
  standing: 'good' | 'warned' | 'suspended' | 'banned';
}

export interface TripPattern {
  id: string;
  userId: string;
  mode: TravelMode;
  /** Canonical catalog route id when picked from the catalog; undefined for custom routes. */
  routeId?: string;
  routeOrLine: string;
  direction: string;
  daysOfWeek: number[]; // 0 = Sunday
  /** "HH:mm" 24h local — start/end of the typical window. */
  windowStart: string;
  windowEnd: string;
  stationOrCode: string;
  /** One-off "I'm here now" presence — auto-deleted after its check-in lapses. */
  oneOff: boolean;
}

/** Ephemeral, opt-in, per-instance (PRD §5.3). Nothing is visible without one. */
export interface TripCheckIn {
  id: string;
  tripPatternId: string;
  userId: string;
  activeFrom: number; // epoch ms
  activeUntil: number; // epoch ms; auto-expires ≤ 3 hours
}

export type RequestStatus = 'pending' | 'accepted' | 'declined' | 'expired';

export interface ConnectionRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  reasonTag: ReasonTag;
  introText: string;
  status: RequestStatus;
  createdAt: number;
}

export interface Connection {
  id: string;
  userA: string;
  userB: string;
  createdAt: number;
  status: 'active' | 'expired';
}

export interface ChatMessage {
  id: string;
  connectionId: string;
  senderId: string;
  content: string;
  createdAt: number;
}

export interface MeetupVerification {
  id: string;
  connectionId: string;
  generatedBy: string;
  pin: string; // 6 digits, CSPRNG, single-use
  expiresAt: number; // 15 minutes after generation
  verifiedAt: number | null;
  used: boolean;
}

export interface Block {
  blockerId: string;
  blockedId: string;
  createdAt: number;
}

/** One-tap pulse after a PIN-verified meetup (feeds trust signals + operator view). */
export interface MeetupFeedback {
  id: string;
  connectionId: string;
  byUserId: string;
  aboutUserId: string;
  rating: 'good' | 'issue';
  createdAt: number;
}

export type ReportCategory =
  | 'solicitation'
  | 'harassment'
  | 'fake_profile'
  | 'inappropriate_content'
  | 'safety_concern'
  | 'other';

export interface Report {
  id: string;
  reporterId: string;
  reportedId: string;
  category: ReportCategory;
  context: string;
  status: 'open' | 'resolved' | 'dismissed';
  createdAt: number;
  /** SLA target (PRD §5.7 / §9.1): 24h for safety-flagged, 72h otherwise. */
  slaHours: 24 | 72;
}
