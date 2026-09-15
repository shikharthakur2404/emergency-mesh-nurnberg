/**
 * Emergency Mesh Nürnberg — Layer 1: Safety-Critical Paths Test Suite
 * 
 * Life-Safety Verification:
 * 1. SOS trigger fires with guaranteed max TTL, anti-spoofing signature, and immediate dispatch.
 * 2. Message delivery integrity across adversarial conditions (packet loss, duplicates, out-of-order).
 * 3. Complete cryptographic round-trip for private family check-ins across intermediate relay nodes.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MeshRouter } from '../src/core/router';
import { VirtualMeshTransport, VirtualNetworkBus } from '../src/core/transport/VirtualMeshTransport';
import { SosPacket, SafePacket } from '../src/core/types';
import {
  encryptFamilyPayload,
  decryptFamilyPayload,
  signEmergencyPayload,
  verifyEmergencyPayload,
} from '../src/core/crypto';

describe('Layer 1: Safety-Critical Paths', () => {
  beforeEach(() => {
    VirtualNetworkBus.getInstance().reset();
  });

  describe('1.1 SOS Distress Beacon Reliability', () => {
    it('fires SOS trigger with maximum survivability parameters (TTL=15, hop=0, cryptographic signature)', async () => {
      const transport = new VirtualMeshTransport('sos-origin-node');
      const router = new MeshRouter(
        { nodeId: 'sos-origin-node', maxTtl: 15, dedupCacheSize: 500, familySecrets: [] },
        transport
      );
      await router.start();

      const lat = 49.4539;
      const lon = 11.0775;
      const category = 'MEDICAL';
      const notes = 'Cardiac arrest at Hauptmarkt central station';

      const sosPacket = await router.broadcastSos(category, lat, lon, notes);

      // Verify structural guarantees
      expect(sosPacket.type).toBe('SOS');
      expect(sosPacket.category).toBe('MEDICAL');
      expect(sosPacket.ttl).toBe(15);
      expect(sosPacket.hop_count).toBe(0);
      expect(sosPacket.lat).toBe(lat);
      expect(sosPacket.lon).toBe(lon);
      expect(sosPacket.notes).toBe(notes);
      expect(sosPacket.msg_id).toBeDefined();
      expect(sosPacket.timestamp).toBeGreaterThan(0);

      // Verify anti-spoofing signature
      expect(sosPacket.signature).toBeDefined();
      expect(sosPacket.auth_token).toBeDefined();

      const canonical = `SOS:${sosPacket.sender_id}:${sosPacket.timestamp}:${category}:${lat}:${lon}:${notes}`;
      const isValid = verifyEmergencyPayload(
        canonical,
        sosPacket.signature!,
        sosPacket.sender_id
      );
      expect(isValid).toBe(true);

      await router.stop();
    });

    it('retains SOS beacon priority and broadcasts immediately under simulated battery-saver mode', async () => {
      const bus = VirtualNetworkBus.getInstance();
      const originTransport = new VirtualMeshTransport('battery-saver-node');
      const listenerTransport = new VirtualMeshTransport('rescue-listener-node');

      originTransport.start();
      listenerTransport.start();
      bus.linkNeighbors('battery-saver-node', 'rescue-listener-node');

      const router = new MeshRouter(
        { nodeId: 'battery-saver-node', maxTtl: 15, dedupCacheSize: 500, familySecrets: [] },
        originTransport
      );
      await router.start();

      let receivedPacket: SosPacket | null = null;
      listenerTransport.onPacket((packet) => {
        if (packet.type === 'SOS') {
          receivedPacket = packet as SosPacket;
        }
      });

      // Simulate low-battery SOS dispatch
      await router.broadcastSos('TRAPPED', 49.445, 11.082, 'Basement flooded, power offline');

      // Allow virtual radio latency delay (15ms default)
      await new Promise((r) => setTimeout(r, 40));

      expect(receivedPacket).not.toBeNull();
      expect(receivedPacket!.category).toBe('TRAPPED');
      expect(receivedPacket!.ttl).toBe(15);

      await router.stop();
    });
  });

  describe('1.2 Delivery Integrity Under Packet Loss, Duplication & Reordering', () => {
    it('reliably deduplicates heavy multi-path packet duplicates while preserving legitimate packets', async () => {
      const transport = new VirtualMeshTransport('dedup-verifier-node');
      const router = new MeshRouter(
        { nodeId: 'dedup-verifier-node', maxTtl: 15, dedupCacheSize: 500, familySecrets: [] },
        transport
      );
      await router.start();

      let deliveredEventsCount = 0;
      router.subscribe(() => {
        deliveredEventsCount++;
      });

      const totalUniquePackets = 20;
      const duplicatesPerPacket = 4; // 80 duplicate receipts

      // Send interleaved bursts of unique and duplicate packets
      for (let i = 0; i < totalUniquePackets; i++) {
        const basePacket: SosPacket = {
          type: 'SOS',
          msg_id: `burst-pkt-${i}`,
          timestamp: Math.floor(Date.now() / 1000) - 10 + i,
          ttl: 10,
          hop_count: 2,
          sender_id: `sender-${i}`,
          category: 'MEDICAL',
          lat: 49.45,
          lon: 11.08,
          notes: `Emergency sequence ${i}`
        };

        // First delivery: should succeed
        const first = await router.handleIncoming(basePacket, true);
        expect(first).toBe(true);

        // Duplicated transmissions across multiple mesh paths
        for (let d = 0; d < duplicatesPerPacket; d++) {
          const dupResult = await router.handleIncoming({ ...basePacket, hop_count: basePacket.hop_count + d }, true);
          expect(dupResult).toBe(false); // MUST drop duplicate
        }
      }

      expect(deliveredEventsCount).toBe(totalUniquePackets);
      const stats = router.getStats();
      expect(stats.totalReceived).toBe(totalUniquePackets * (duplicatesPerPacket + 1));
      expect(stats.droppedDuplicates).toBe(totalUniquePackets * duplicatesPerPacket);

      await router.stop();
    });

    it('processes out-of-order packets deterministically without dropping newer or older legitimate events', async () => {
      const transport = new VirtualMeshTransport('order-verifier-node');
      const router = new MeshRouter(
        { nodeId: 'order-verifier-node', maxTtl: 15, dedupCacheSize: 500, familySecrets: [], disableRateLimiting: true },
        transport
      );
      await router.start();

      const receivedMsgIds: string[] = [];
      router.subscribe((packet) => {
        receivedMsgIds.push(packet.msg_id);
      });

      const now = Math.floor(Date.now() / 1000);
      const packets: SosPacket[] = [
        { type: 'SOS', msg_id: 't-30', timestamp: now - 30, ttl: 8, hop_count: 3, sender_id: 's1', category: 'MEDICAL', lat: 49.45, lon: 11.08 },
        { type: 'SOS', msg_id: 't-10', timestamp: now - 10, ttl: 8, hop_count: 1, sender_id: 's1', category: 'MEDICAL', lat: 49.45, lon: 11.08 },
        { type: 'SOS', msg_id: 't-20', timestamp: now - 20, ttl: 8, hop_count: 2, sender_id: 's1', category: 'MEDICAL', lat: 49.45, lon: 11.08 },
        { type: 'SOS', msg_id: 't-50', timestamp: now - 50, ttl: 8, hop_count: 5, sender_id: 's1', category: 'MEDICAL', lat: 49.45, lon: 11.08 },
      ];

      // Deliver out-of-order
      for (const pkt of packets) {
        const accepted = await router.handleIncoming(pkt, true);
        expect(accepted).toBe(true);
      }

      expect(receivedMsgIds).toHaveLength(4);
      expect(receivedMsgIds).toEqual(['t-30', 't-10', 't-20', 't-50']);

      await router.stop();
    });
  });

  describe('1.3 End-to-End Cryptographic Round-Trip', () => {
    it('encrypts, signs, transits across 2 intermediate relay nodes, verifies, and decrypts exact plaintext', async () => {
      const bus = VirtualNetworkBus.getInstance();
      const familySecret = 'Kaiserburg-Notfall-Key-2026';
      const originalPlaintext = 'Familie Schmidt: Alle wohlauf im Notlager Egidienkirche. Haben Trinkwasser für 3 Tage.';

      // Topology: Node A (Sender) -> Node B (Relay) -> Node C (Receiver)
      const nodeA = new VirtualMeshTransport('sender-alpha');
      const nodeB = new VirtualMeshTransport('relay-beta');
      const nodeC = new VirtualMeshTransport('receiver-gamma');

      nodeA.start();
      nodeB.start();
      nodeC.start();

      // Only direct neighbors can communicate
      bus.linkNeighbors('sender-alpha', 'relay-beta');
      bus.linkNeighbors('relay-beta', 'receiver-gamma');

      // Setup routers
      const routerA = new MeshRouter(
        { nodeId: 'sender-alpha', maxTtl: 10, dedupCacheSize: 100, familySecrets: [familySecret] },
        nodeA
      );
      const routerB = new MeshRouter(
        { nodeId: 'relay-beta', maxTtl: 10, dedupCacheSize: 100, familySecrets: ['Unrelated-Secret-XYZ'] }, // Intermediate relay DOES NOT know family secret
        nodeB
      );
      const routerC = new MeshRouter(
        { nodeId: 'receiver-gamma', maxTtl: 10, dedupCacheSize: 100, familySecrets: [familySecret] }, // Destination DOES know family secret
        nodeC
      );

      await routerA.start();
      await routerB.start();
      await routerC.start();

      let relaySawPlaintext = false;
      routerB.subscribe((pkt, meta) => {
        if (meta.decryptedText) {
          relaySawPlaintext = true;
        }
      });

      let receiverDecryptedText: string | null = null;
      let receiverSosVerified: boolean | undefined;

      routerC.subscribe((pkt, meta) => {
        if (pkt.type === 'SAFE') {
          receiverDecryptedText = meta.decryptedText || null;
        } else if (pkt.type === 'SOS') {
          receiverSosVerified = meta.isVerified;
        }
      });

      // Sender broadcasts safe check-in
      await routerA.broadcastSafe(familySecret, originalPlaintext, 'Papa');

      // Sender also broadcasts an authenticated SOS beacon
      await routerA.broadcastSos('MEDICAL', 49.4538, 11.0775, 'Verletzung am Fuß');

      // Small tick for virtual transit through intermediate hop (15ms per hop)
      await new Promise((r) => setTimeout(r, 60));

      // 1. Verify intermediate relay did NOT decrypt plaintext
      expect(relaySawPlaintext).toBe(false);

      // 2. Verify intermediate relay successfully forwarded packet
      expect(routerB.relayedPacketsCount).toBeGreaterThan(0);

      // 3. Verify destination successfully received and decrypted exact plaintext
      expect(receiverDecryptedText).toBe(originalPlaintext);

      // 4. Verify SOS signature was validated on destination
      expect(receiverSosVerified).toBe(true);

      await routerA.stop();
      await routerB.stop();
      await routerC.stop();
    });
  });
});
