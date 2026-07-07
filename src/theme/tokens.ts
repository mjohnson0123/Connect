/**
 * Commuter Connect design tokens.
 *
 * The visual world is transit and wayfinding: departure boards, platform
 * signage, timetables. Colors and type are specified by the PRD (§10) —
 * do not substitute defaults.
 */

export const color = {
  /** Deep graphite-navy. High-emphasis moments only (headers, active check-in, splash). */
  ink: '#12161C',
  /** Primary light surface. Cool off-white — the dominant chrome. */
  chalk: '#EDEEE9',
  /** Primary accent — split-flap board amber. Primary actions + signature flip. */
  amber: '#E8A33D',
  /** Reserved for verification/trust states (verified badge, safe-to-connect). Semantic, not decorative. */
  signal: '#2F6E5C',
  /** Reserved for destructive/warning actions only (block, report, delete account). */
  caution: '#B4483A',
  /** Hairline dividers and borders. */
  steel: '#3A4149',

  // Derived working shades (kept minimal; all pairings checked for WCAG AA)
  chalkRaised: '#F6F6F3',
  inkSoft: '#2A313B',
  textOnChalk: '#12161C',
  textMutedOnChalk: '#4A525C',
  textOnInk: '#EDEEE9',
  textMutedOnInk: '#A9B0B8',
  /** Amber is decorative/large-type only on chalk; on ink it passes AA for text. */
  amberOnInk: '#E8A33D',
  /** Darkened amber that passes AA (4.6:1) as text on chalk. */
  amberTextOnChalk: '#8A5A10',
  signalTintBg: '#DFE9E5',
  cautionTintBg: '#F0E1DE',
  hairline: 'rgba(58, 65, 73, 0.28)',
} as const;

export const font = {
  /** Overpass — display: names, headlines, departure-board numerals. */
  display: 'Overpass_700Bold',
  displaySemi: 'Overpass_600SemiBold',
  /** Public Sans — body: bios, chat, body copy. */
  body: 'PublicSans_400Regular',
  bodyMedium: 'PublicSans_500Medium',
  bodySemi: 'PublicSans_600SemiBold',
  /** IBM Plex Mono — utility/data: timestamps, route codes, PINs, windows. */
  mono: 'IBMPlexMono_500Medium',
  monoRegular: 'IBMPlexMono_400Regular',
} as const;

export const type = {
  display: { fontFamily: font.display, fontSize: 30, lineHeight: 36, letterSpacing: -0.4 },
  title: { fontFamily: font.display, fontSize: 22, lineHeight: 27, letterSpacing: -0.25 },
  headline: { fontFamily: font.displaySemi, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: font.body, fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontFamily: font.bodyMedium, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: font.body, fontSize: 13, lineHeight: 18 },
  mono: { fontFamily: font.mono, fontSize: 13, lineHeight: 18, letterSpacing: 0.4 },
  monoSmall: { fontFamily: font.mono, fontSize: 11, lineHeight: 15, letterSpacing: 0.6 },
  monoBoard: { fontFamily: font.mono, fontSize: 15, lineHeight: 20, letterSpacing: 0.5 },
} as const;

export const space = (n: number) => n * 4;

export const radius = {
  row: 12,
  card: 16,
  chip: 999,
  button: 12,
} as const;
