import { TripCheckIn, TripPattern, User } from '../domain/types';
import { HOUR } from '../lib/time';

/**
 * Demo-mode seed data. In production this comes from the backend; the store
 * keeps the same shapes so swapping the data layer is mechanical. Seed users
 * ride the MARC Penn Line pilot route (PRD §13 Q1), plus one flight and one
 * place pattern to exercise the mode-agnostic model.
 */

export const SEED_USERS: User[] = [
  {
    id: 'u-dana',
    displayName: 'Dana Okafor',
    photo: 'DO',
    verificationStatus: 'verified',
    headline: 'Health policy analyst, HHS',
    bio: 'Ten years in federal health policy. Happy to talk grad school, fellowships, or how to survive the Hill.',
    industryTags: ['Policy', 'Healthcare'],
    reasonTags: ['mentorship_give', 'industry_peer'],
    strikes: 0,
    standing: 'good',
  },
  {
    id: 'u-marcus',
    displayName: 'Marcus Bell',
    photo: 'MB',
    verificationStatus: 'verified',
    headline: 'Staff engineer, fintech',
    bio: 'Backend systems, payments infrastructure. Always up for an engineering war-story swap on the ride down.',
    industryTags: ['Software', 'Fintech'],
    reasonTags: ['industry_peer', 'expanding_network'],
    strikes: 0,
    standing: 'good',
  },
  {
    id: 'u-priya',
    displayName: 'Priya Raman',
    photo: 'PR',
    verificationStatus: 'verified',
    headline: 'Museum exhibits designer',
    bio: 'Design lead at a Smithsonian-affiliate. Career-switched from architecture; glad to talk about that leap.',
    industryTags: ['Design', 'Museums'],
    reasonTags: ['career_conversation', 'mentorship_give'],
    strikes: 0,
    standing: 'good',
  },
  {
    id: 'u-jules',
    displayName: 'Jules Hart',
    photo: 'JH',
    verificationStatus: 'pending',
    headline: 'MBA candidate, part-time consultant',
    bio: 'Second-year MBA, commuting to a DC client three days a week. Looking for mentors in strategy consulting.',
    industryTags: ['Consulting'],
    reasonTags: ['mentorship_receive', 'expanding_network'],
    strikes: 0,
    standing: 'good',
  },
  {
    id: 'u-sam',
    displayName: 'Sam Whitfield',
    photo: 'SW',
    verificationStatus: 'verified',
    headline: 'Federal contracts attorney',
    bio: 'GovCon law, small-business set-asides. Weekly BWI→BOS flyer for a New England client.',
    industryTags: ['Legal', 'GovCon'],
    reasonTags: ['industry_peer'],
    strikes: 0,
    standing: 'good',
  },
];

export const SEED_PATTERNS: TripPattern[] = [
  {
    id: 'tp-dana',
    userId: 'u-dana',
    mode: 'train',
    routeOrLine: 'MARC Penn Line',
    direction: 'Baltimore → DC',
    daysOfWeek: [1, 2, 3, 4, 5],
    windowStart: '06:45',
    windowEnd: '07:30',
    stationOrCode: 'BAL',
  },
  {
    id: 'tp-marcus',
    userId: 'u-marcus',
    mode: 'train',
    routeOrLine: 'MARC Penn Line',
    direction: 'Baltimore → DC',
    daysOfWeek: [1, 2, 3, 4, 5],
    windowStart: '07:00',
    windowEnd: '07:45',
    stationOrCode: 'BAL',
  },
  {
    id: 'tp-priya',
    userId: 'u-priya',
    mode: 'train',
    routeOrLine: 'MARC Penn Line',
    direction: 'Baltimore → DC',
    daysOfWeek: [1, 2, 3, 4],
    windowStart: '06:30',
    windowEnd: '07:15',
    stationOrCode: 'BAL',
  },
  {
    id: 'tp-jules',
    userId: 'u-jules',
    mode: 'train',
    routeOrLine: 'MARC Penn Line',
    direction: 'Baltimore → DC',
    daysOfWeek: [2, 3, 4],
    windowStart: '07:00',
    windowEnd: '07:45',
    stationOrCode: 'BAL',
  },
  {
    id: 'tp-sam',
    userId: 'u-sam',
    mode: 'flight',
    routeOrLine: 'BWI → BOS',
    direction: 'Northbound',
    daysOfWeek: [1],
    windowStart: '08:00',
    windowEnd: '10:00',
    stationOrCode: 'BWI',
  },
  {
    id: 'tp-sam-place',
    userId: 'u-sam',
    mode: 'place',
    routeOrLine: 'Gate C concourse, BWI',
    direction: 'Regular',
    daysOfWeek: [1],
    windowStart: '07:30',
    windowEnd: '09:00',
    stationOrCode: 'BWI',
  },
];

/** Fresh ephemeral check-ins relative to "now" so the demo board is live. */
export function seedCheckIns(now = Date.now()): TripCheckIn[] {
  return [
    { id: 'ci-dana', tripPatternId: 'tp-dana', userId: 'u-dana', activeFrom: now - HOUR / 2, activeUntil: now + 2 * HOUR },
    { id: 'ci-marcus', tripPatternId: 'tp-marcus', userId: 'u-marcus', activeFrom: now - HOUR / 4, activeUntil: now + 2.5 * HOUR },
    { id: 'ci-priya', tripPatternId: 'tp-priya', userId: 'u-priya', activeFrom: now - HOUR, activeUntil: now + HOUR },
    { id: 'ci-sam', tripPatternId: 'tp-sam', userId: 'u-sam', activeFrom: now - HOUR / 2, activeUntil: now + 2 * HOUR },
  ];
}
