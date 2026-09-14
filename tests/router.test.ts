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
