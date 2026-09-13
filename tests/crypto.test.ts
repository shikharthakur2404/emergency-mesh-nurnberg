import { describe, it, expect } from 'vitest';
import {
  hashFamilySecret,
  encryptFamilyPayload,
  decryptFamilyPayload,
  generateMsgId,
  generateNodeId
} from '../src/core/crypto.js';

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
    expect(ciphertext.split(':')).toHaveLength(3); // iv:tag:cipher

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
    expect(id1).toHaveLength(8);

    const node1 = generateNodeId();
    expect(node1).toMatch(/^anon_[a-f0-9]{4}$/);
  });
});
