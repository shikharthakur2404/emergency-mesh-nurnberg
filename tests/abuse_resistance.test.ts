import { describe, it, expect } from 'vitest';
import { solveProofOfWork, verifyProofOfWork } from '../src/core/pow';
import { LeakyBucketRateLimiter } from '../src/core/rateLimiter';
import { MeshRouter } from '../src/core/router';
import { VirtualMeshTransport, VirtualNetworkBus } from '../src/core/transport/VirtualMeshTransport';
import { SosPacket } from '../src/core/types';

describe('Broadcast Abuse Resistance & Anti-Spam Architecture', () => {

  describe('1. Proof-of-Work (PoW) Hashcash Throttling', () => {
    it('solves and verifies SHA-256 Proof-of-Work challenge', () => {
      const canonical = 'SOS:node_alpha:1789400000:MEDICAL:49.4539:11.0775:Herzstillstand';
      const difficulty = 12; // 3 hex zeros

      const nonce = solveProofOfWork(canonical, difficulty);
      expect(nonce).toBeGreaterThanOrEqual(0);

      // Verification of valid solution
      const isValid = verifyProofOfWork(canonical, nonce, difficulty);
      expect(isValid).toBe(true);

      // Wrong nonce fails verification
      expect(verifyProofOfWork(canonical, nonce + 1, difficulty)).toBe(false);

      // Tampered payload with valid nonce fails verification
      const tampered = 'SOS:node_alpha:1789400000:FIRE:49.4539:11.0775:Herzstillstand';
      expect(verifyProofOfWork(tampered, nonce, difficulty)).toBe(false);

      // Missing / undefined nonce fails
      expect(verifyProofOfWork(canonical, undefined, difficulty)).toBe(false);
    });
  });

  describe('2. Node-Bound Leaky Bucket Rate Limiting', () => {
    it('allows initial burst of 2 packets and enforces rate ceiling on 3rd attempt', () => {
      const limiter = new LeakyBucketRateLimiter(2, 60); // 2 burst, 60s refill
      const senderA = 'node_nuernberg_spammer_01';
      const senderB = 'node_nuernberg_legit_02';

      const t0 = 1000;
      // First 2 packets allowed
      expect(limiter.tryAcquire(senderA, t0)).toBe(true);
      expect(limiter.tryAcquire(senderA, t0)).toBe(true);

      // 3rd packet within window is blocked!
      expect(limiter.tryAcquire(senderA, t0)).toBe(false);
      expect(limiter.tryAcquire(senderA, t0 + 10)).toBe(false);

      // Distinct node B is unaffected by A's rate limit
      expect(limiter.tryAcquire(senderB, t0)).toBe(true);
      expect(limiter.tryAcquire(senderB, t0)).toBe(true);
      expect(limiter.tryAcquire(senderB, t0)).toBe(false);

      // After 60 seconds, sender A regains 1 token
      expect(limiter.tryAcquire(senderA, t0 + 60)).toBe(true);
      expect(limiter.tryAcquire(senderA, t0 + 60)).toBe(false);
    });

    it('MeshRouter automatically drops high-frequency spam bursts from single node', async () => {
      const transport = new VirtualMeshTransport('monitor-node');
      const router = new MeshRouter(
        { nodeId: 'monitor-node', maxTtl: 10, dedupCacheSize: 100, familySecrets: [] },
        transport
      );
      await router.start();

      let deliveredPackets = 0;
      router.subscribe(() => {
        deliveredPackets++;
      });

      const spammerId = 'hostile_flooder_99';
      const now = Math.floor(Date.now() / 1000);

      // Attempt to flood 10 SOS packets in rapid succession
      for (let i = 0; i < 10; i++) {
        const pkt: SosPacket = {
          type: 'SOS',
          msg_id: `spam-pkt-${i}`,
          timestamp: now,
          ttl: 5,
          hop_count: 0,
          sender_id: spammerId,
          category: 'FIRE',
          lat: 49.45,
          lon: 11.08
        };
        await router.handleIncoming(pkt, true);
      }

      // Exactly 2 packets allowed through burst; remaining 8 dropped at rate limiter
      expect(deliveredPackets).toBe(2);
      expect(router.droppedRateLimitPacketsCount).toBe(8);

      await router.stop();
    });
  });

  describe('3. Decentralized Peer Attestation (Web of Trust)', () => {
    it('promotes an unverified beacon to verified status after 3 distinct witness attestations', async () => {
      const bus = VirtualNetworkBus.getInstance();

      // Node A = Originator, Node B = Witness 1, Node C = Witness 2, Node D = Observer
      const transportA = new VirtualMeshTransport('originator-a');
      const transportB = new VirtualMeshTransport('witness-b');
      const transportC = new VirtualMeshTransport('witness-c');
      const transportD = new VirtualMeshTransport('observer-d');

      transportA.start();
      transportB.start();
      transportC.start();
      transportD.start();

      bus.linkNeighbors('originator-a', 'observer-d');
      bus.linkNeighbors('witness-b', 'observer-d');
      bus.linkNeighbors('witness-c', 'observer-d');

      const routerA = new MeshRouter({ nodeId: 'originator-a', maxTtl: 10, dedupCacheSize: 100, familySecrets: [] }, transportA);
      const routerB = new MeshRouter({ nodeId: 'witness-b', maxTtl: 10, dedupCacheSize: 100, familySecrets: [] }, transportB);
      const routerC = new MeshRouter({ nodeId: 'witness-c', maxTtl: 10, dedupCacheSize: 100, familySecrets: [] }, transportC);
      const routerD = new MeshRouter({ nodeId: 'observer-d', maxTtl: 10, dedupCacheSize: 100, familySecrets: [] }, transportD);

      await routerA.start();
      await routerB.start();
      await routerC.start();
      await routerD.start();

      let latestWitnessCount = 0;
      let latestIsAttested = false;

      routerD.subscribe((pkt, meta) => {
        if ('target_msg_id' in pkt || pkt.type === 'SOS') {
          if (meta.witnessCount !== undefined) latestWitnessCount = meta.witnessCount;
          if (meta.isAttested !== undefined) latestIsAttested = meta.isAttested;
        }
      });

      // 1. Originator A broadcasts SOS
      const sos = await routerA.broadcastSos('TRAPPED', 49.454, 11.077, 'Trümmer eingestürzt');
      await new Promise(r => setTimeout(r, 40));

      expect(latestWitnessCount).toBe(1);
      expect(latestIsAttested).toBe(false);

      // 2. Witness B confirms seeing the emergency
      await routerB.broadcastAttestation(sos.msg_id);
      await new Promise(r => setTimeout(r, 40));

      expect(latestWitnessCount).toBe(2);
      expect(latestIsAttested).toBe(false);

      // 3. Witness B re-broadcasts attestation (duplicate check) -> must not double count
      await routerB.broadcastAttestation(sos.msg_id);
      await new Promise(r => setTimeout(r, 40));
      expect(latestWitnessCount).toBe(2);

      // 4. Witness C confirms seeing the emergency -> 3rd witness reaches verified quorum!
      await routerC.broadcastAttestation(sos.msg_id);
      await new Promise(r => setTimeout(r, 40));

      expect(latestWitnessCount).toBe(3);
      expect(latestIsAttested).toBe(true);

      await routerA.stop();
      await routerB.stop();
      await routerC.stop();
      await routerD.stop();
    });
  });

  describe('4. Local Quarantine & Node Muting', () => {
    it('completely suppresses packets from a locally muted sender', async () => {
      const transport = new VirtualMeshTransport('user-node');
      const router = new MeshRouter(
        { nodeId: 'user-node', maxTtl: 10, dedupCacheSize: 100, familySecrets: [] },
        transport
      );
      await router.start();

      let deliveredEvents = 0;
      router.subscribe(() => {
        deliveredEvents++;
      });

      const badActor = 'annoying_spammer_node';
      const legitActor = 'friendly_neighbor_node';

      // 1. Before muting: packets are delivered
      await router.handleIncoming({
        type: 'SOS',
        msg_id: 'bad-1',
        timestamp: Math.floor(Date.now() / 1000),
        ttl: 5,
        hop_count: 0,
        sender_id: badActor,
        category: 'OTHER' as any,
        lat: 49.45,
        lon: 11.08
      }, true);
      expect(deliveredEvents).toBe(1);

      // 2. User mutes the bad actor
      router.muteNode(badActor);
      expect(router.isNodeMuted(badActor)).toBe(true);

      // 3. Bad actor transmits more packets -> completely ignored!
      const blockedResult = await router.handleIncoming({
        type: 'SOS',
        msg_id: 'bad-2',
        timestamp: Math.floor(Date.now() / 1000),
        ttl: 5,
        hop_count: 0,
        sender_id: badActor,
        category: 'OTHER' as any,
        lat: 49.45,
        lon: 11.08
      }, true);

      expect(blockedResult).toBe(false);
      expect(deliveredEvents).toBe(1);
      expect(router.droppedMutedPacketsCount).toBe(1);

      // 4. Legitimate actor packets still arrive without disruption
      await router.handleIncoming({
        type: 'SOS',
        msg_id: 'legit-1',
        timestamp: Math.floor(Date.now() / 1000),
        ttl: 5,
        hop_count: 0,
        sender_id: legitActor,
        category: 'MEDICAL',
        lat: 49.45,
        lon: 11.08
      }, true);
      expect(deliveredEvents).toBe(2);

      // 5. Unmuting restores reception
      router.unmuteNode(badActor);
      expect(router.isNodeMuted(badActor)).toBe(false);

      await router.stop();
    });
  });
});
