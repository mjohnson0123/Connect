import * as Crypto from 'expo-crypto';

/**
 * Local-only auth for the disconnected-database build.
 *
 * SECURITY NOTE: credentials live on this device only, for testing flows.
 * This is NOT a production credential store — production auth is a backend
 * concern (server-side hashing with a real KDF, sessions/tokens, and OAuth
 * token validation). Everything below is the seam that backend replaces.
 */

export async function hashPassword(email: string, password: string): Promise<string> {
  // SHA-256 with a static app salt — enough to avoid storing plaintext in
  // AsyncStorage during testing; a real backend uses bcrypt/argon2 server-side.
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `commuter-connect-local:${email.trim().toLowerCase()}:${password}`,
  );
}

export interface GoogleProfile {
  email: string;
}

/**
 * Google sign-in seam. Simulated while the database is disconnected.
 *
 * To make this real: add `expo-auth-session` + `expo-web-browser`, create
 * iOS/Android/web OAuth client IDs in Google Cloud Console, and replace the
 * body with Google.useAuthRequest / promptAsync, sending the resulting ID
 * token to the backend for validation. Ship Sign in with Apple alongside it
 * (App Store Guideline 4.8 requires it once any third-party login exists).
 */
export async function signInWithGoogle(): Promise<GoogleProfile> {
  await new Promise((r) => setTimeout(r, 900)); // simulated account-chooser round-trip
  return { email: 'demo.rider@gmail.com' };
}
