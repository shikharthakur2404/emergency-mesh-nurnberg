import { describe, it, expect } from 'vitest';
import {
  signEmergencyPayload,
  verifyEmergencyPayload,
  isTimestampFresh,
  encryptFamilyPayload,
  decryptFamilyPayload,
  hashFamilySecret,
  generateMsgId
} from '../src/core/crypto';
import { MeshRouter } from '../src/core/router';
import { VirtualMeshTransport } from '../src/core/transport/VirtualMeshTransport';
import { SosPacket, HazardPacket, MeshPacket } from '../src/core/types';

describe('Layer 3: Security & Hostile Fuzzing Resilience', () => {

  describe('3.1 HMAC-SHA256 Tamper Resistance & Impersonation Defense', () => {
    const senderId = 'node_nuernberg_alpha_01';
    const canonical = 'SOS:node_nuernberg_alpha_01:1789400000:MEDICAL:49.4538:11.0775:Schwere Kopfverletzung Hauptmarkt';
    const { signature } = signEmergencyPayload(canonical, senderId);

    it('verifies untampered authentic payload successfully', () => {
      expect(verifyEmergencyPayload(canonical, signature, senderId)).toBe(true);
    });

    it('detects and rejects single-bit and character tampering across all fields', () => {
      // 1. Altered category
      const tamperedCategory = 'SOS:node_nuernberg_alpha_01:1789400000:EVACUATION:49.4538:11.0775:Schwere Kopfverletzung Hauptmarkt';
      expect(verifyEmergencyPayload(tamperedCategory, signature, senderId)).toBe(false);

      // 2. Altered coordinates (e.g. moving emergency location)
      const tamperedCoords = 'SOS:node_nuernberg_alpha_01:1789400000:MEDICAL:49.4539:11.0775:Schwere Kopfverletzung Hauptmarkt';
      expect(verifyEmergencyPayload(tamperedCoords, signature, senderId)).toBe(false);

      // 3. Altered notes
      const tamperedNotes = 'SOS:node_nuernberg_alpha_01:1789400000:MEDICAL:49.4538:11.0775:Keine Verletzung alles gut';
      expect(verifyEmergencyPayload(tamperedNotes, signature, senderId)).toBe(false);

      // 4. Altered timestamp
      const tamperedTime = 'SOS:node_nuernberg_alpha_01:1789400001:MEDICAL:49.4538:11.0775:Schwere Kopfverletzung Hauptmarkt';
      expect(verifyEmergencyPayload(tamperedTime, signature, senderId)).toBe(false);
    });

    it('rejects sender node impersonation even with matching signature from original sender', () => {
      const imposterId = 'node_nuernberg_attacker_99';
      expect(verifyEmergencyPayload(canonical, signature, imposterId)).toBe(false);
    });

    it('rejects malformed, truncated, or injected signatures', () => {
      expect(verifyEmergencyPayload(canonical, '', senderId)).toBe(false);
      expect(verifyEmergencyPayload(canonical, 'invalid_sig', senderId)).toBe(false);
      expect(verifyEmergencyPayload(canonical, signature.substring(0, 10), senderId)).toBe(false);
      expect(verifyEmergencyPayload(canonical, signature + 'f', senderId)).toBe(false);
      expect(verifyEmergencyPayload(canonical, "' OR '1'='1", senderId)).toBe(false);
    });
  });

  describe('3.2 Anti-Replay & Time Vector Defense', () => {
    it('evaluates exact timestamp boundary thresholds', () => {
      const now = Math.floor(Date.now() / 1000);

      // Past boundaries: maxAgeSeconds = 172800 (48h)
      expect(isTimestampFresh(now - 172790)).toBe(true); // Within 48h
      expect(isTimestampFresh(now - 172805)).toBe(false); // Stale (> 48h)

      // Future boundaries: maxFutureSeconds = 300 (5m)
      expect(isTimestampFresh(now + 290)).toBe(true); // Within 5m drift
      expect(isTimestampFresh(now + 310)).toBe(false); // Rejected (> 5m future drift)
    });

    it('rejects extreme and pathological timestamps', () => {
      expect(isTimestampFresh(-1)).toBe(false);
      expect(isTimestampFresh(0)).toBe(false);
      expect(isTimestampFresh(1000)).toBe(false);
      expect(isTimestampFresh(2147483647)).toBe(false); // Y2038 boundary
      expect(isTimestampFresh(32503680000)).toBe(false); // Year 3000
    });

    it('ensures MeshRouter drops stale packets immediately without listener notification', async () => {
      const transport = new VirtualMeshTransport('security-test-node');
      const router = new MeshRouter(
        { nodeId: 'security-test-node', maxTtl: 10, dedupCacheSize: 100, familySecrets: [] },
        transport
      );
      await router.start();

      let received = false;
      router.subscribe(() => {
        received = true;
      });

      const stalePacket: SosPacket = {
        type: 'SOS',
        msg_id: 'stale-msg-1',
        timestamp: Math.floor(Date.now() / 1000) - 200000, // 55+ hours ago
        ttl: 5,
        hop_count: 1,
        sender_id: 'victim-node',
        category: 'MEDICAL',
        lat: 49.45,
        lon: 11.08
      };

      const accepted = await router.handleIncoming(stalePacket, true);
      expect(accepted).toBe(false);
      expect(received).toBe(false);

      await router.stop();
    });
  });

  describe('3.3 AES-256 Boundary & Degradation Immunity', () => {
    const validSecret = 'Pegnitz-Tal-Schutz-2026';
    const sampleMessage = 'Familie Meier befindet sich im U-Bahnhof Lorenzkirche. Alle unverletzt. äöüß!';

    it('safely handles incorrect secrets returning null without unhandled exceptions', () => {
      const ciphertext = encryptFamilyPayload(validSecret, sampleMessage);
      const wrongKeys = ['wrong_secret', '', '   ', 'Pegnitz-Tal-Schutz-2025'];

      for (const wrongKey of wrongKeys) {
        expect(() => {
          const result = decryptFamilyPayload(wrongKey, ciphertext);
          expect(result).toBeNull();
        }).not.toThrow();
      }
    });

    it('safely handles corrupted, truncated, or hostile ciphertexts without crashing', () => {
      const hostileCiphertexts = [
        '',
        'not_a_valid_ciphertext',
        'salt_only_no_iv',
        'salt:iv_only',
        'invalid_hex_salt:invalid_hex_iv:not_base64_ciphertext',
        '00112233:44556677:truncated_data',
        ':::;;;@@@###$$$',
        'A'.repeat(5000)
      ];

      for (const corrupted of hostileCiphertexts) {
        expect(() => {
          const result = decryptFamilyPayload(validSecret, corrupted);
          expect(result).toBeNull();
        }).not.toThrow();
      }
    });

    it('encrypts and decrypts high-entropy unicode, German umlauts, and large buffers', () => {
      const largeComplexMessage = 'Äpfel, Überläufer, Notstände, Straße, Großstadt — ' + '🚨'.repeat(50) + ' ' + 'A'.repeat(10000);
      const encrypted = encryptFamilyPayload(validSecret, largeComplexMessage);
      const decrypted = decryptFamilyPayload(validSecret, encrypted);
      expect(decrypted).toBe(largeComplexMessage);
    });
  });

  describe('3.4 Hostile Input Fuzzing & Structural Edge Cases', () => {
    it('handles 1MB oversized strings in emergency packets gracefully', async () => {
      const transport = new VirtualMeshTransport('fuzz-node-1');
      const router = new MeshRouter(
        { nodeId: 'fuzz-node-1', maxTtl: 10, dedupCacheSize: 100, familySecrets: [] },
        transport
      );
      await router.start();

      let receivedPacket: MeshPacket | null = null;
      router.subscribe((pkt) => {
        receivedPacket = pkt;
      });

      const oversizedString = 'M'.repeat(1024 * 1024); // 1MB payload
      const hugeSosPacket: SosPacket = {
        type: 'SOS',
        msg_id: 'huge-sos-001',
        timestamp: Math.floor(Date.now() / 1000),
        ttl: 5,
        hop_count: 0,
        sender_id: 'node-fuzzer',
        category: 'OTHER',
        lat: 49.45,
        lon: 11.08,
        notes: oversizedString
      };

      expect(async () => {
        const result = await router.handleIncoming(hugeSosPacket, true);
        expect(result).toBe(true);
      }).not.toThrow();

      expect(receivedPacket).not.toBeNull();
      expect((receivedPacket as SosPacket).notes?.length).toBe(1024 * 1024);

      await router.stop();
    });

    it('resists prototype pollution payloads in incoming mesh packets', async () => {
      const transport = new VirtualMeshTransport('fuzz-node-2');
      const router = new MeshRouter(
        { nodeId: 'fuzz-node-2', maxTtl: 10, dedupCacheSize: 100, familySecrets: [] },
        transport
      );
      await router.start();

      const maliciousJson = JSON.parse('{"type":"SOS","msg_id":"proto-pollute-01","timestamp":' +
        Math.floor(Date.now() / 1000) +
        ',"ttl":5,"hop_count":0,"sender_id":"evil","category":"MEDICAL","lat":49.45,"lon":11.08,"__proto__":{"polluted":true},"constructor":{"prototype":{"injected":true}}}');

      await router.handleIncoming(maliciousJson, true);

      // Verify global Object prototype was not corrupted
      const testObj: any = {};
      expect(testObj.polluted).toBeUndefined();
      expect(testObj.injected).toBeUndefined();

      await router.stop();
    });

    it('safely handles pathological TTL and hop count edge cases without infinite loops', async () => {
      const transport = new VirtualMeshTransport('fuzz-node-3');
      const router = new MeshRouter(
        { nodeId: 'fuzz-node-3', maxTtl: 10, dedupCacheSize: 100, familySecrets: [] },
        transport
      );
      await router.start();

      // TTL <= 1 must not be relayed
      const zeroTtlPacket: SosPacket = {
        type: 'SOS',
        msg_id: 'zero-ttl-pkt',
        timestamp: Math.floor(Date.now() / 1000),
        ttl: 1, // TTL of 1: local delivery only, never relayed
        hop_count: 5,
        sender_id: 'hop-tester',
        category: 'FIRE',
        lat: 49.45,
        lon: 11.08
      };

      await router.handleIncoming(zeroTtlPacket, true);
      expect(router.relayedPacketsCount).toBe(0);

      // Negative TTL packet
      const negativeTtlPacket: SosPacket = {
        type: 'SOS',
        msg_id: 'neg-ttl-pkt',
        timestamp: Math.floor(Date.now() / 1000),
        ttl: -5,
        hop_count: 100,
        sender_id: 'hop-tester',
        category: 'FIRE',
        lat: 49.45,
        lon: 11.08
      };

      await router.handleIncoming(negativeTtlPacket, true);
      expect(router.relayedPacketsCount).toBe(0);

      await router.stop();
    });
  });
});
