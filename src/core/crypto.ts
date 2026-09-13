/**
 * Emergency Mesh Nürnberg — Cryptographic Engine
 * Zero-leakage family secret pairing & lightweight offline payload encryption.
 */

import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Computes a deterministic SHA-256 hash of a family group secret.
 * Shared across family devices via offline QR code or manual entry.
 */
export function hashFamilySecret(secret: string): string {
  const normalized = secret.trim().toLowerCase();
  return createHash('sha256').update(`emergency-mesh-nurnberg:${normalized}`).digest('hex').slice(0, 16);
}

/**
 * Generates an 8-character unique hex message ID for deduplication.
 */
export function generateMsgId(): string {
  return randomBytes(4).toString('hex');
}

/**
 * Generates an ephemeral anonymous node ID.
 */
export function generateNodeId(): string {
  return `anon_${randomBytes(2).toString('hex')}`;
}

/**
 * Derives a 32-byte key from the family secret using SHA-256.
 */
function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a message with AES-256-GCM using the derived family secret key.
 * Format: iv:authTag:ciphertext (base64)
 */
export function encryptFamilyPayload(secret: string, plaintext: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted message.
 * Returns null if authentication fails or secret is wrong.
 */
export function decryptFamilyPayload(secret: string, packetCiphertext: string): string | null {
  try {
    const parts = packetCiphertext.split(':');
    if (parts.length !== 3) return null;

    const [ivHex, authTagHex, encryptedHex] = parts;
    const key = deriveKey(secret);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch {
    return null;
  }
}
