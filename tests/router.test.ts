import { describe, it, expect, beforeEach } from 'vitest';
import { MeshRouter } from '../src/core/router';
import { VirtualMeshTransport, VirtualNetworkBus } from '../src/core/transport/VirtualMeshTransport';
import { SosPacket, SafePacket, HazardPacket } from '../src/core/types';

describe('Mesh Router & Relay Engine', () => {
  beforeEach(() => {
    VirtualNetworkBus.getInstance().reset();
  });

  it('originates strictly-typed SOS packets with initial hop_count: 0', async () => {
    const transport = new VirtualMeshTransport('node-1');
    const router = new MeshRouter(
      { nodeId: 'node-1', maxTtl: 15, dedupCacheSize: 100, familySecrets: [] },
      transport
    );
    await router.start();

    const sos = await router.broadcastSos('MEDICAL', 49.4521, 11.0767, 'Severe injury near St. Lorenz');
    expect(sos.type).toBe('SOS');
    expect(sos.category).toBe('MEDICAL');
    expect(sos.hop_count).toBe(0);
    expect(sos.ttl).toBe(15);
    expect(sos.lat).toBe(49.4521);
    expect(sos.lon).toBe(11.0767);
  });

  it('drops duplicate packets and updates telemetry stats', async () => {
    const transport = new VirtualMeshTransport('node-drop-test');
    const router = new MeshRouter(
      { nodeId: 'node-drop-test', maxTtl: 10, dedupCacheSize: 100, familySecrets: [] },
      transport
    );
    await router.start();

    const fakeSos: SosPacket = {
      type: 'SOS',
      msg_id: 'duplicate-test-id',
      timestamp: Math.floor(Date.now() / 1000),
      ttl: 5,
      hop_count: 1,
      sender_id: 'peer-x',
      category: 'FIRE',
      lat: 49.45,
      lon: 11.08
    };

    // First receive -> accepted & relayed
    const firstAccepted = await router.handleIncoming(fakeSos, true);
    expect(firstAccepted).toBe(true);

    // Second receive of same msg_id -> dropped
    const secondAccepted = await router.handleIncoming(fakeSos, true);
    expect(secondAccepted).toBe(false);

    const stats = router.getStats();
    expect(stats.droppedDuplicates).toBe(1);
    expect(stats.totalReceived).toBe(2);
  });

  it('terminates relay when packet TTL drops to 1', async () => {
    const transport = new VirtualMeshTransport('node-ttl-term');
    const router = new MeshRouter(
      { nodeId: 'node-ttl-term', maxTtl: 10, dedupCacheSize: 100, familySecrets: [] },
      transport
    );
    await router.start();

    const deadPacket: HazardPacket = {
      type: 'HAZARD',
      msg_id: 'dead-pkt-99',
      timestamp: Math.floor(Date.now() / 1000),
      ttl: 1, // Will NOT be relayed since next TTL would be 0
      hop_count: 5,
      sender_id: 'peer-far',
      hazard_type: 'FLOOD',
      lat: 49.46,
      lon: 11.07,
      description: 'Pegnitz river overflow'
    };

    await router.handleIncoming(deadPacket, true);
    expect(router.relayedPacketsCount).toBe(0);
  });
});

  it('signs SOS beacons and verifies integrity on receive', async () => {
    const transport = new VirtualMeshTransport('node-signer');
    const router = new MeshRouter(
      { nodeId: 'node-signer', maxTtl: 15, dedupCacheSize: 100, familySecrets: [] },
      transport
    );
    await router.start();

    let verifiedEvent: boolean | undefined;
    router.subscribe((pkt, meta) => {
      verifiedEvent = meta.isVerified;
    });

    const sos = await router.broadcastSos('MEDICAL', 49.45, 11.08, 'Broken limb');
    expect(sos.signature).toBeDefined();
    expect(sos.auth_token).toBeDefined();
    expect(sos.priority).toBe('CRITICAL');

    // Simulate incoming verified SOS from peer
    const peerSos: SosPacket = {
      ...sos,
      msg_id: 'peer-signed-sos-001'
    };

    await router.handleIncoming(peerSos, true);
    expect(verifiedEvent).toBe(true);
  });

  it('performs epidemic DTN synchronization on receiving SYNC_INV', async () => {
    const transportA = new VirtualMeshTransport('node-a');
    const routerA = new MeshRouter(
      { nodeId: 'node-a', maxTtl: 15, dedupCacheSize: 100, familySecrets: [] },
      transportA
    );
    await routerA.start();

    // Node A originates an SOS beacon (buffered in DTN)
    const sosA = await routerA.broadcastSos('TRAPPED', 49.4539, 11.0775, 'Shelter cellar blocked');
    expect(routerA.getStats().dtnBufferedCount).toBe(1);

    // Node B arrives (empty buffer) and broadcasts SYNC_INV
    const transportB = new VirtualMeshTransport('node-b');
    const routerB = new MeshRouter(
      { nodeId: 'node-b', maxTtl: 15, dedupCacheSize: 100, familySecrets: [] },
      transportB
    );
    await routerB.start();

    // Capture packets received by Node B
    let receivedByB: SosPacket | null = null;
    routerB.subscribe((pkt) => {
      if (pkt.type === 'SOS') {
        receivedByB = pkt as SosPacket;
      }
    });

    // Node B triggers DTN Sync
    await routerA.handleIncoming({
      type: 'SYNC_INV',
      msg_id: 'sync-inv-b',
      timestamp: Math.floor(Date.now() / 1000),
      ttl: 1,
      hop_count: 0,
      sender_id: 'node-b',
      inventory: [] // Node B has empty inventory
    }, true);

    // Router A should have initiated a SYNC_DATA burst
    expect(routerA.getStats().dtnSyncs).toBe(1);
  });
