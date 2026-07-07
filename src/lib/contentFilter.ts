/**
 * Automated message content filtering (PRD §5.5).
 *
 * First-pass, on-device pattern matching for contact info and solicitation
 * language. Blocks the send and tells the sender why; repeat violations
 * escalate to the review queue (handled by the store). A production build
 * runs the same checks server-side — never trust the client alone.
 */

export type FilterViolation = 'phone' | 'email' | 'handle' | 'link' | 'solicitation';

export interface FilterResult {
  ok: boolean;
  violations: FilterViolation[];
  message?: string;
}

const PHONE = /(\+?\d[\s\-.()]*){7,}/;
const EMAIL = /[a-z0-9._%+-]+\s*(@|\[at\]|\(at\))\s*[a-z0-9.-]+\s*(\.|\[dot\]|\(dot\))\s*[a-z]{2,}/i;
const LINK = /(https?:\/\/|www\.)\S+|\b\S+\.(com|net|org|io|co|app|ly|me)(\/\S*)?\b/i;
const HANDLE =
  /(@[a-z0-9_.]{3,})|\b(insta(gram)?|ig|snap(chat)?|whatsapp|telegram|signal|linkedin|x\.com|twitter|tiktok|facebook|fb)\b[\s:]*[a-z0-9_.@-]*/i;
const SOLICITATION =
  /\b(check out my|buy|for sale|discount|pricing|price list|invest(ment)? opportunity|crypto|token sale|dm me to (buy|join)|join my (team|downline)|passive income|work from home opportunity|recruiting bonus|commission|free trial|limited(-| )time offer)\b/i;

const EXPLANATIONS: Record<FilterViolation, string> = {
  phone: 'phone numbers',
  email: 'email addresses',
  handle: 'external handles or social accounts',
  link: 'links',
  solicitation: 'sales or solicitation language',
};

export function filterMessage(text: string): FilterResult {
  const violations: FilterViolation[] = [];
  if (PHONE.test(text)) violations.push('phone');
  if (EMAIL.test(text)) violations.push('email');
  if (LINK.test(text)) violations.push('link');
  if (HANDLE.test(text)) violations.push('handle');
  if (SOLICITATION.test(text)) violations.push('solicitation');

  if (violations.length === 0) return { ok: true, violations };

  const parts = [...new Set(violations.map((v) => EXPLANATIONS[v]))];
  return {
    ok: false,
    violations,
    message:
      `This message wasn't sent — it looks like it contains ${parts.join(' and ')}. ` +
      `Commuter Connect keeps conversations in-app and pitch-free. Repeated attempts are reviewed.`,
  };
}
