/**
 * Emergency Mesh Nürnberg — Cryptographic Engine
 * Zero-leakage family secret pairing & lightweight offline payload encryption.
 */

import CryptoJS from 'crypto-js';

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
