import { describe, it, expect } from 'vitest';
import {
  hashFamilySecret,
  encryptFamilyPayload,
  decryptFamilyPayload,
  generateMsgId,
  generateNodeId,
  signEmergencyPayload,
  verifyEmergencyPayload,
  isTimestampFresh
} from '../src/core/crypto';

describe('Cryptographic Engine', () => {
  it('generates deterministic SHA-256 family secret hashes', () => {
    const hash1 = hashFamilySecret('Nbg-Alpha-2026');
    const hash2 = hashFamilySecret('nbg-alpha-2026 '); // Case & whitespace insensitive
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(16);
  });

  it('encrypts and decrypts family check-in payloads with matching secret', () => {
    const secret = 'Nordklinikum-SafeKey-99';
    const message = 'I am safe at Klinikum Nord shelter with drinking water.';

    const ciphertext = encryptFamilyPayload(secret, message);
    expect(ciphertext).not.toBe(message);
    expect(typeof ciphertext).toBe('string');
    expect(ciphertext.length).toBeGreaterThan(16);

    const decrypted = decryptFamilyPayload(secret, ciphertext);
    expect(decrypted).toBe(message);
  });

  it('rejects decryption when an incorrect secret is provided', () => {
    const secret = 'Correct-Family-Secret';
    const wrongSecret = 'Attacker-Wrong-Secret';
    const message = 'Confidential rendezvous at Hauptmarkt.';

    const ciphertext = encryptFamilyPayload(secret, message);
    const decrypted = decryptFamilyPayload(wrongSecret, ciphertext);
    expect(decrypted).toBeNull();
  });

  it('generates unique message and node IDs', () => {
    const id1 = generateMsgId();
    const id2 = generateMsgId();
    expect(id1).not.toBe(id2);
    expect(id1.length).toBeGreaterThanOrEqual(6);

    const node1 = generateNodeId();
    expect(node1).toMatch(/^anon_[a-z0-9]+$/);
  });
});

  it('signs and verifies emergency payloads, rejecting tampered content', () => {
    const senderId = 'anon_kats1';
    const canonical = 'SOS:anon_kats1:1789390000:MEDICAL:49.4539:11.0775:Trapped in basement';

    const { signature, authToken } = signEmergencyPayload(canonical, senderId);
    expect(signature).toBeDefined();
    expect(authToken).toBeDefined();

    // Valid verification
    const isValid = verifyEmergencyPayload(canonical, signature, senderId);
    expect(isValid).toBe(true);

    // Tampered payload rejected
    const tampered = 'SOS:anon_kats1:1789390000:MEDICAL:49.4539:11.0775:Fake notes injected';
    const isTamperedValid = verifyEmergencyPayload(tampered, signature, senderId);
    expect(isTamperedValid).toBe(false);

    // Impersonated sender rejected
    const isImpersonatedValid = verifyEmergencyPayload(canonical, signature, 'anon_impostor');
    expect(isImpersonatedValid).toBe(false);
  });

  it('evaluates timestamp freshness accurately', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(isTimestampFresh(now)).toBe(true);
    expect(isTimestampFresh(now - 3600)).toBe(true); // 1 hr ago is fresh
    expect(isTimestampFresh(now - 200000)).toBe(false); // > 48 hr ago is stale
    expect(isTimestampFresh(now + 600)).toBe(false); // > 5m in future is rejected
  });
