import { describe, it, expect, beforeEach } from 'vitest';
import { MeshRouter } from '../src/core/router.js';
import { VirtualMeshTransport, VirtualNetworkBus } from '../src/core/transport/VirtualMeshTransport.js';
import { MeshPacket } from '../src/core/types.js';

describe('Multi-Hop Virtual Mesh Simulation (3-Node Relay)', () => {
  let bus: VirtualNetworkBus;

  beforeEach(() => {
    bus = VirtualNetworkBus.getInstance();
    bus.reset();
    bus.simulatedLatencyMs = 5; // Fast deterministic delivery for tests
  });

  it('relays packets across intermediate nodes (Node A -> Node B -> Node C) and increments hop_count', async () => {
    // 1. Setup 3 nodes
    const transportA = new VirtualMeshTransport('nodeA-altstadt');
    const transportB = new VirtualMeshTransport('nodeB-gostenhof');
    const transportC = new VirtualMeshTransport('nodeC-langwasser');

    const routerA = new MeshRouter(
      { nodeId: 'nodeA-altstadt', maxTtl: 10, dedupCacheSize: 50, familySecrets: ['SecretNbg2026'] },
      transportA
    );
    const routerB = new MeshRouter(
      { nodeId: 'nodeB-gostenhof', maxTtl: 10, dedupCacheSize: 50, familySecrets: [] },
      transportB
    );
    const routerC = new MeshRouter(
      { nodeId: 'nodeC-langwasser', maxTtl: 10, dedupCacheSize: 50, familySecrets: ['SecretNbg2026'] },
      transportC
    );

    await routerA.start();
    await routerB.start();
    await routerC.start();

    // 2. Configure Linear Adjacency: A <-> B <-> C (A cannot reach C directly)
    bus.linkNeighbors('nodeA-altstadt', 'nodeB-gostenhof');
    bus.linkNeighbors('nodeB-gostenhof', 'nodeC-langwasser');

    // Collect packets received at Node C
    const receivedAtC: { packet: MeshPacket; decryptedText?: string }[] = [];
    routerC.subscribe((packet, meta) => {
      receivedAtC.push({ packet, decryptedText: meta.decryptedText });
    });

    // 3. Node A broadcasts targeted SAFE check-in
    await routerA.broadcastSafe('SecretNbg2026', 'Family safe at Hauptmarkt well.', 'Papa');

    // Allow virtual RF propagation across the 2 hops
    await new Promise((resolve) => setTimeout(resolve, 60));

    // 4. Assertions at destination Node C
    expect(receivedAtC.length).toBe(1);
    const entry = receivedAtC[0];

    expect(entry.packet.type).toBe('SAFE');
    expect(entry.packet.hop_count).toBe(1); // 1 hop traversed through Node B
    expect(entry.packet.ttl).toBe(9);       // Decremented from 10 to 9 by Node B
    expect(entry.decryptedText).toBe('Family safe at Hauptmarkt well.'); // Successfully decrypted via shared secret!

    // Verify intermediate node B stats
    expect(routerB.relayedPacketsCount).toBe(1);

    // Clean up
    await routerA.stop();
    await routerB.stop();
    await routerC.stop();
  });
});
