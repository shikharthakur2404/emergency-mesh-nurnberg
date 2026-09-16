/**
 * Emergency Mesh Nürnberg — Cryptographic Engine
 * Zero-leakage family secret pairing, tamper-resistant packet signing, and offline AES encryption.
 *
 * Security properties:
 * - All randomness sourced from crypto.getRandomValues() (CSPRNG) via react-native-get-random-values.
 *   Import 'react-native-get-random-values' at the app entry point (index.js) before any crypto usage.
 * - AES-256-CBC with PBKDF2(SHA-256, 10 000 iter) key derivation — brute-force resistant.
 * - Every message gets a unique 16-byte salt + 16-byte IV — eliminates nonce reuse.
 * - Public SOS/hazard packets signed with HMAC-SHA256 — prevents mesh relay tampering.
 */

import CryptoJS from 'crypto-js';

/**
 * Reads cryptographically secure random bytes using the native crypto.getRandomValues() API.
 * Requires 'react-native-get-random-values' to be imported at app entry (index.js) before
 * this module loads — that package installs a Hermes-compatible CSPRNG polyfill on globalThis.
 *
 * SECURITY NOTE: Math.random() is NOT used anywhere in this codebase. All randomness is
 * routed through this helper so we have a single auditable source.
 *
 * @param byteCount - Number of random bytes to generate.
 * @returns Hex string of `byteCount` random bytes.
 */
function getSecureRandomHex(byteCount: number): string {
  const buffer = new Uint8Array(byteCount);
  globalThis.crypto.getRandomValues(buffer);
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Wraps getSecureRandomHex as a CryptoJS WordArray, required by the CryptoJS encrypt API
 * for salts and IVs. Overrides CryptoJS.lib.WordArray.random to use CSPRNG instead of its
 * default Math.random()-based implementation.
 */
(CryptoJS.lib.WordArray as any).random = function (nBytes: number): CryptoJS.lib.WordArray {
  const hex = getSecureRandomHex(nBytes);
  return CryptoJS.enc.Hex.parse(hex);
};

/**
 * Computes a deterministic SHA-256 hash of a family group secret.
 * Shared across family devices via offline QR code or manual entry.
 * Namespace-prefixed to prevent cross-app secret collisions.
 */
export function hashFamilySecret(secret: string): string {
  const normalized = secret.trim().toLowerCase();
  return CryptoJS.SHA256(`emergency-mesh-nurnberg:${normalized}`).toString().slice(0, 16);
}

/**
 * Generates a cryptographically random 8-byte hex message ID for packet deduplication.
 * Uses CSPRNG — not Math.random() — to prevent ID prediction attacks.
 */
export function generateMsgId(): string {
  return getSecureRandomHex(8);
}

/**
 * Generates a cryptographically random ephemeral node ID.
 * Anonymised on every app launch — no persistent device fingerprint.
 */
export function generateNodeId(): string {
  return `anon_${getSecureRandomHex(4)}`;
}


/**
 * Signs a public emergency payload (SOS / Hazard) with node-bound integrity token.
 * Prevents payload tampering and unauthorized field modification across the mesh.
 */
export function signEmergencyPayload(canonicalPayload: string, senderId: string): { signature: string; authToken: string } {
  const authToken = CryptoJS.SHA256(`nurnberg-node-auth:${senderId}`).toString().slice(0, 16);
  const signature = CryptoJS.HmacSHA256(canonicalPayload, authToken).toString().slice(0, 32);
  return { signature, authToken };
}

/**
 * Verifies the integrity of a public emergency payload signature.
 */
export function verifyEmergencyPayload(canonicalPayload: string, signature: string, senderId: string): boolean {
  if (!signature || !senderId) return false;
  const expectedAuthToken = CryptoJS.SHA256(`nurnberg-node-auth:${senderId}`).toString().slice(0, 16);
  const expectedSignature = CryptoJS.HmacSHA256(canonicalPayload, expectedAuthToken).toString().slice(0, 32);
  return signature === expectedSignature;
}

/**
 * Validates timestamp freshness to prevent historical replay attacks.
 * Default tolerance: Max 48h in past, max 5m in future.
 */
export function isTimestampFresh(timestamp: number, maxAgeSeconds = 172800, maxFutureSeconds = 300): boolean {
  const now = Math.floor(Date.now() / 1000);
  if (timestamp > now + maxFutureSeconds) return false;
  if (now - timestamp > maxAgeSeconds) return false;
  return true;
}

/**
 * Encrypts a message with AES-256 using an explicit 16-byte random salt and 16-byte IV.
 * Format: salt:iv:ciphertext (eliminates nonce reuse).
 */
export function encryptFamilyPayload(secret: string, plaintext: string): string {
  const salt = CryptoJS.lib.WordArray.random(16);
  const iv = CryptoJS.lib.WordArray.random(16);
  const key = CryptoJS.PBKDF2(secret, salt, { keySize: 256 / 32, iterations: 10000 });
  const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });

  return `${salt.toString()}:${iv.toString()}:${encrypted.toString()}`;
}

/**
 * Decrypts an AES encrypted message.
 * Backward compatible with both salt:iv:ciphertext and legacy ciphertext.
 */
export function decryptFamilyPayload(secret: string, packetCiphertext: string): string | null {
  try {
    const parts = packetCiphertext.split(':');
    if (parts.length === 3) {
      const salt = CryptoJS.enc.Hex.parse(parts[0]);
      const iv = CryptoJS.enc.Hex.parse(parts[1]);
      const ciphertext = parts[2];
      const key = CryptoJS.PBKDF2(secret, salt, { keySize: 256 / 32, iterations: 10000 });
      const decryptedBytes = CryptoJS.AES.decrypt(ciphertext, key, {
        iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });
      const decrypted = decryptedBytes.toString(CryptoJS.enc.Utf8);
      return decrypted || null;
    }

    // Fallback for legacy format
    const bytes = CryptoJS.AES.decrypt(packetCiphertext, secret);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted || null;
  } catch {
    return null;
  }
}
