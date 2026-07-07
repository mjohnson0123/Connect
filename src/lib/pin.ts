import * as Crypto from 'expo-crypto';

/**
 * Meetup PIN generation (PRD §5.6 / §7).
 * Cryptographically secure RNG — never derived from user or account IDs.
 * Rejection sampling keeps the 6-digit distribution uniform.
 */
export function generatePin(): string {
  // 1,000,000 possible PINs; sample a uint32 and reject values that would bias the modulo.
  const limit = Math.floor(0xffffffff / 1_000_000) * 1_000_000;
  for (;;) {
    const bytes = Crypto.getRandomBytes(4);
    const n = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
    if (n < limit) return String(n % 1_000_000).padStart(6, '0');
  }
}

export function newId(): string {
  return Crypto.randomUUID();
}
