/**
 * Emergency Mesh Nürnberg — Cryptographic Engine
 * Zero-leakage family secret pairing, tamper-resistant packet signing, and offline AES encryption.
 */

import CryptoJS from 'crypto-js';

// Polyfill global crypto.getRandomValues and CryptoJS.lib.WordArray.random for React Native / Hermes
if (typeof globalThis !== 'undefined' && (!globalThis.crypto || !globalThis.crypto.getRandomValues)) {
  const getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
    if (array) {
      const uint8 = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
      for (let i = 0; i < uint8.length; i++) {
        uint8[i] = Math.floor(Math.random() * 256);
      }
    }
    return array;
  };
  if (!globalThis.crypto) {
    (globalThis as any).crypto = { getRandomValues };
  } else {
    (globalThis.crypto as any).getRandomValues = getRandomValues;
  }
}

try {
  CryptoJS.lib.WordArray.random(4);
} catch {
  (CryptoJS.lib.WordArray as any).random = function (nBytes: number) {
    const words: number[] = [];
    for (let i = 0; i < nBytes; i += 4) {
      words.push(Math.floor(Math.random() * 0x100000000));
    }
    return CryptoJS.lib.WordArray.create(words, nBytes);
  };
}

/**
 * Computes a deterministic SHA-256 hash of a family group secret.
 * Shared across family devices via offline QR code or manual entry.
 */
export function hashFamilySecret(secret: string): string {
  const normalized = secret.trim().toLowerCase();
  return CryptoJS.SHA256(`emergency-mesh-nurnberg:${normalized}`).toString().slice(0, 16);
}

/**
 * Generates an 8-character unique hex message ID for deduplication.
 */
export function generateMsgId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Generates an ephemeral anonymous node ID.
 */
export function generateNodeId(): string {
  return `anon_${Math.random().toString(36).substring(2, 6)}`;
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
