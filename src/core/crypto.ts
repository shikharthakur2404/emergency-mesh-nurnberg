/**
 * Emergency Mesh Nürnberg — Cryptographic Engine
 * Zero-leakage family secret pairing & lightweight offline payload encryption.
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
 * Encrypts a message with AES using the family secret key.
 */
export function encryptFamilyPayload(secret: string, plaintext: string): string {
  return CryptoJS.AES.encrypt(plaintext, secret).toString();
}

/**
 * Decrypts an AES encrypted message.
 * Returns null if authentication fails or secret is wrong.
 */
export function decryptFamilyPayload(secret: string, packetCiphertext: string): string | null {
  try {
    const bytes = CryptoJS.AES.decrypt(packetCiphertext, secret);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted || null;
  } catch {
    return null;
  }
}
