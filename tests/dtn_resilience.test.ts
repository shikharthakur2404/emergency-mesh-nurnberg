import { describe, it, expect } from 'vitest';
import { StoreAndForwardBuffer } from '../src/core/dtn/StoreAndForwardBuffer';
import { SosPacket, SafePacket, MeshPacket, HazardPacket } from '../src/core/types';
import { MeshRouter } from '../src/core/router';
import { VirtualMeshTransport } from '../src/core/transport/VirtualMeshTransport';
import { VirtualNetworkBus } from '../src/core/transport/VirtualMeshTransport';

describe('Layer 4: DTN Store-and-Forward Buffer Resilience', () => {

  describe('4.1 1,000-Packet Flood Overflow & Priority Retention', () => {
    it('survives a 1,000-packet flood and preserves 100% of CRITICAL SOS beacons over lower priorities', () => {
      const capacity = 250;
      const buffer = new StoreAndForwardBuffer(capacity);
      const baseTime = 1789400000;

      // 1. Flood with 400 NORMAL packets
      for (let i = 0; i < 400; i++) {
        const normalPacket: MeshPacket = {
          type: 'INFO' as any,
          msg_id: `normal-${i}`,
          timestamp: baseTime + i,
          ttl: 5,
          hop_count: 0,
          priority: 'NORMAL'
        };
        buffer.addPacket(normalPacket);
      }
      expect(buffer.size).toBe(capacity);

      // 2. Flood with 400 HIGH packets (SAFE check-ins)
      for (let i = 0; i < 400; i++) {
        const highPacket: SafePacket = {
          type: 'SAFE',
          msg_id: `high-safe-${i}`,
          timestamp: baseTime + 1000 + i,
          ttl: 10,
          hop_count: 0,
          family_id: `fam_${i % 10}`,
          encrypted_payload: `payload_${i}`,
          priority: 'HIGH'
        };
        buffer.addPacket(highPacket);
      }
      expect(buffer.size).toBe(capacity);

      // 3. Flood with 200 CRITICAL packets (SOS beacons)
      for (let i = 0; i < 200; i++) {
        const sosPacket: SosPacket = {
          type: 'SOS',
          msg_id: `critical-sos-${i}`,
          timestamp: baseTime + 2000 + i,
          ttl: 15,
          hop_count: 0,
          sender_id: `victim_${i}`,
          category: 'MEDICAL',
          lat: 49.45,
          lon: 11.08,
          priority: 'CRITICAL'
        };
        buffer.addPacket(sosPacket);
      }

      // Buffer MUST never exceed capacity
      expect(buffer.size).toBe(capacity);

      // CRITICAL GUARANTEE: Every single one of the 200 SOS beacons MUST be retained!
      let retainedSosCount = 0;
      for (let i = 0; i < 200; i++) {
        if (buffer.getPacket(`critical-sos-${i}`)) {
          retainedSosCount++;
        }
      }
      expect(retainedSosCount).toBe(200);

      // The remaining 50 slots must be the newest HIGH packets
      let retainedHighCount = 0;
      for (let i = 0; i < 400; i++) {
        if (buffer.getPacket(`high-safe-${i}`)) {
          retainedHighCount++;
        }
      }
      expect(retainedHighCount).toBe(50);

      // All 400 NORMAL packets must have been completely evicted
      let retainedNormalCount = 0;
      for (let i = 0; i < 400; i++) {
        if (buffer.getPacket(`normal-${i}`)) {
          retainedNormalCount++;
        }
      }
      expect(retainedNormalCount).toBe(0);
    });
  });

  describe('4.2 Expiration & TTL Purging Mechanics', () => {
    it('purges entries strictly adhering to tier retention limits (CRITICAL 48h, HIGH 24h, NORMAL 6h)', () => {
      const buffer = new StoreAndForwardBuffer(100);
      const now = 1789500000;

      // 1. SOS (CRITICAL): one at 47h (valid), one at 49h (expired)
      const validSos: SosPacket = {
        type: 'SOS',
        msg_id: 'sos-valid-47h',
        timestamp: now - (47 * 3600),
        ttl: 10,
        hop_count: 1,
        sender_id: 'n1',
        category: 'FIRE',
        lat: 49.45,
        lon: 11.08,
        priority: 'CRITICAL'
      };
      const expiredSos: SosPacket = {
        type: 'SOS',
        msg_id: 'sos-expired-49h',
        timestamp: now - (49 * 3600),
        ttl: 10,
        hop_count: 1,
        sender_id: 'n2',
        category: 'FIRE',
        lat: 49.45,
        lon: 11.08,
        priority: 'CRITICAL'
      };

      // 2. SAFE / HAZARD (HIGH): one at 23h (valid), one at 25h (expired)
      const validHazard: HazardPacket = {
        type: 'HAZARD',
        msg_id: 'hazard-valid-23h',
        timestamp: now - (23 * 3600),
        ttl: 10,
        hop_count: 1,
        sender_id: 'n3',
        hazard_type: 'FLOOD',
        lat: 49.45,
        lon: 11.08,
        description: 'Wasserpegel Pegnitz',
        priority: 'HIGH'
      };
      const expiredHazard: HazardPacket = {
        type: 'HAZARD',
        msg_id: 'hazard-expired-25h',
        timestamp: now - (25 * 3600),
        ttl: 10,
        hop_count: 1,
        sender_id: 'n4',
        hazard_type: 'INFRASTRUCTURE',
        lat: 49.45,
        lon: 11.08,
        description: 'Brücke unpassierbar',
        priority: 'HIGH'
      };

      // 3. NORMAL: one at 5h (valid), one at 7h (expired)
      const validNormal: MeshPacket = {
        type: 'INFO' as any,
        msg_id: 'normal-valid-5h',
        timestamp: now - (5 * 3600),
        ttl: 5,
        hop_count: 0,
        priority: 'NORMAL'
      };
      const expiredNormal: MeshPacket = {
        type: 'INFO' as any,
        msg_id: 'normal-expired-7h',
        timestamp: now - (7 * 3600),
        ttl: 5,
        hop_count: 0,
        priority: 'NORMAL'
      };

      buffer.addPacket(validSos);
      buffer.addPacket(expiredSos);
      buffer.addPacket(validHazard);
      buffer.addPacket(expiredHazard);
      buffer.addPacket(validNormal);
      buffer.addPacket(expiredNormal);

      expect(buffer.size).toBe(6);

      const purgedCount = buffer.purgeExpired(now);
      expect(purgedCount).toBe(3);
      expect(buffer.size).toBe(3);

      // Verify retained set
      expect(buffer.getPacket('sos-valid-47h')).toBeDefined();
      expect(buffer.getPacket('hazard-valid-23h')).toBeDefined();
      expect(buffer.getPacket('normal-valid-5h')).toBeDefined();

      // Verify purged set
      expect(buffer.getPacket('sos-expired-49h')).toBeUndefined();
      expect(buffer.getPacket('hazard-expired-25h')).toBeUndefined();
      expect(buffer.getPacket('normal-expired-7h')).toBeUndefined();
    });
  });

  describe('4.3 Inventory Vector Ordering & Epidemic Sync Simulation', () => {
    it('sorts inventory with highest priority first, then freshest timestamp', () => {
      const buffer = new StoreAndForwardBuffer(10);

      buffer.addPacket({
        type: 'SAFE',
        msg_id: 'safe-old',
        timestamp: 1000,
        ttl: 5,
        hop_count: 0,
        family_id: 'f1',
        encrypted_payload: 'c',
        priority: 'HIGH'
      });
      buffer.addPacket({
        type: 'SAFE',
        msg_id: 'safe-new',
        timestamp: 2000,
        ttl: 5,
        hop_count: 0,
        family_id: 'f1',
        encrypted_payload: 'c',
        priority: 'HIGH'
      });
      buffer.addPacket({
        type: 'SOS',
        msg_id: 'sos-urgent',
        timestamp: 500, // Older timestamp, but CRITICAL rank
        ttl: 5,
        hop_count: 0,
        sender_id: 's1',
        category: 'MEDICAL',
        lat: 49.45,
        lon: 11.08,
        priority: 'CRITICAL'
      });

      const inv = buffer.getInventory();
      expect(inv).toHaveLength(3);
      expect(inv[0].msg_id).toBe('sos-urgent'); // CRITICAL takes precedence
      expect(inv[1].msg_id).toBe('safe-new');   // Newer HIGH
      expect(inv[2].msg_id).toBe('safe-old');   // Older HIGH
    });

    it('simulates physical carrier node walking between two isolated shelter clusters and syncing DTN bundles', async () => {
      const bus = VirtualNetworkBus.getInstance();

      // Cluster 1: Shelter Kaiserburg (Node A)
      // Carrier: Walking volunteer (Node B)
      // Cluster 2: Shelter Lorenzkirche (Node C)
      const nodeA = new VirtualMeshTransport('shelter-kaiserburg');
      const nodeB = new VirtualMeshTransport('carrier-volunteer');
      const nodeC = new VirtualMeshTransport('shelter-lorenzkirche');

      nodeA.start();
      nodeB.start();
      nodeC.start();

      const routerA = new MeshRouter({ nodeId: 'shelter-kaiserburg', maxTtl: 10, dedupCacheSize: 100, familySecrets: [] }, nodeA);
      const routerB = new MeshRouter({ nodeId: 'carrier-volunteer', maxTtl: 10, dedupCacheSize: 100, familySecrets: [] }, nodeB);
      const routerC = new MeshRouter({ nodeId: 'shelter-lorenzkirche', maxTtl: 10, dedupCacheSize: 100, familySecrets: [] }, nodeC);

      await routerA.start();
      await routerB.start();
      await routerC.start();

      // 1. Initial State: Cluster 1 and Cluster 2 are completely disconnected. Carrier is at Cluster 1.
      bus.linkNeighbors('shelter-kaiserburg', 'carrier-volunteer');

      // Shelter A originates an SOS
      const sosA = await routerA.broadcastSos('MEDICAL', 49.4578, 11.0772, 'Notfall in Kaiserburg');

      // Carrier B receives and DTN-buffers the SOS from Shelter A
      await new Promise(r => setTimeout(r, 40));
      expect(routerB.getDtnBuffer().size).toBe(1);

      // 2. Carrier disconnects from Shelter A (walks across Old Town)
      bus.unlinkNeighbors('shelter-kaiserburg', 'carrier-volunteer');

      // Verify Shelter C has not received the packet yet
      expect(routerC.getDtnBuffer().size).toBe(0);

      // 3. Carrier arrives at Shelter C (Cluster 2) and establishes radio link
      bus.linkNeighbors('carrier-volunteer', 'shelter-lorenzkirche');

      let packetDeliveredToShelterC = false;
      routerC.subscribe((pkt) => {
        if (pkt.msg_id === sosA.msg_id) {
          packetDeliveredToShelterC = true;
        }
      });

      // Carrier initiates DTN epidemic sync with Shelter C
      await routerB.triggerDtnSync();

      // Wait for SYNC_INV -> mutual SYNC_INV -> SYNC_DATA sequence
      await new Promise(r => setTimeout(r, 100));

      // 4. Verify Shelter C successfully synchronized the bundle across the disconnected clusters!
      expect(packetDeliveredToShelterC).toBe(true);
      expect(routerC.getDtnBuffer().size).toBe(1);

      await routerA.stop();
      await routerB.stop();
      await routerC.stop();
    });
  });
});
