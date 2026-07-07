import { ReasonTag, ReportCategory, TravelMode } from './types';

/**
 * Controlled vocabularies (PRD §5.2): no free-text "what I'm looking for" —
 * a small, enforceable moderation surface.
 */

export const REASON_TAGS: { value: ReasonTag; label: string }[] = [
  { value: 'industry_peer', label: 'Industry peer' },
  { value: 'mentorship_give', label: 'Mentorship (give)' },
  { value: 'mentorship_receive', label: 'Mentorship (receive)' },
  { value: 'career_conversation', label: 'Career conversation' },
  { value: 'expanding_network', label: 'Just expanding my network' },
];

export const reasonLabel = (tag: ReasonTag) =>
  REASON_TAGS.find((t) => t.value === tag)?.label ?? tag;

export const MODES: { value: TravelMode; label: string; code: string }[] = [
  { value: 'train', label: 'Train', code: 'TRN' },
  { value: 'flight', label: 'Flight', code: 'FLT' },
  { value: 'bus', label: 'Bus', code: 'BUS' },
  { value: 'boat', label: 'Ferry / Boat', code: 'FRY' },
  { value: 'rideshare', label: 'Rideshare', code: 'RDS' },
  { value: 'place', label: 'Place', code: 'PLC' },
];

export const modeCode = (mode: TravelMode) =>
  MODES.find((m) => m.value === mode)?.code ?? mode.toUpperCase().slice(0, 3);

export const REPORT_CATEGORIES: {
  value: ReportCategory;
  label: string;
  safetyFlagged: boolean;
}[] = [
  { value: 'solicitation', label: 'Solicitation / selling', safetyFlagged: false },
  { value: 'harassment', label: 'Harassment', safetyFlagged: true },
  { value: 'fake_profile', label: 'Fake profile', safetyFlagged: false },
  { value: 'inappropriate_content', label: 'Inappropriate content', safetyFlagged: false },
  { value: 'safety_concern', label: 'Safety concern', safetyFlagged: true },
  { value: 'other', label: 'Other', safetyFlagged: false },
];

export const LIMITS = {
  bioMaxChars: 280,
  introMaxChars: 200,
  /** Outbound connection requests per day (PRD §5.4). */
  requestsPerDay: 10,
  /** Check-in window: default 3h, hard max 3h (PRD §5.3). */
  checkInHours: 3,
  /** Chat threads auto-expire N days after last activity (PRD §5.5). */
  chatExpiryDays: 30,
  /** Meetup PIN validity (PRD §5.6). */
  pinMinutes: 15,
  /** Strike thresholds: warning → temporary suspension → permanent ban (PRD §5.7). */
  strikeWarn: 1,
  strikeSuspend: 2,
  strikeBan: 3,
} as const;
