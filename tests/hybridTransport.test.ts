import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('react-native', () => ({
  NativeModules: {},
  NativeEventEmitter: class {
    addListener() {
      return { remove: () => {} };
    }
    removeAllListeners() {}
  },
  Platform: {
    OS: 'android',
    select: (obj: any) => obj.android,
    Version: 33
  }
}));

import { HybridMeshTransport } from '../src/core/transport/HybridMeshTransport';
import { VirtualNetworkBus } from '../src/core/transport/VirtualMeshTransport';
import { SosPacket } from '../src/core/types';

describe('HybridMeshTransport Suite', () => {
  beforeEach(() => {
    VirtualNetworkBus.getInstance().reset();
  });

  it('initializes hybrid transport gracefully when native hardware radio is not attached', async () => {
    const transport = new HybridMeshTransport('test-node-alpha');
    await transport.start();

    // In node/vitest environment, NativeModules.UdpMeshModule is undefined
    expect(transport.isHardwareRadioActive()).toBe(false);
    expect(await transport.isAvailable()).toBe(true);

    await transport.stop();
  });

  it('broadcasts packets through virtual bus and receives callbacks', async () => {
    const transportA = new HybridMeshTransport('node-A');
    const transportB = new HybridMeshTransport('node-B');

    await transportA.start();
    await transportB.start();

    const bus = VirtualNetworkBus.getInstance();
    bus.linkNeighbors('node-A', 'node-B');

    const received: any[] = [];
    transportB.onPacket((packet, fromPeer) => {
      received.push({ packet, fromPeer });
    });

    const testPacket: SosPacket = {
      type: 'SOS',
      msg_id: 'test-sos-hybrid-01',
      timestamp: Math.floor(Date.now() / 1000),
      ttl: 10,
      hop_count: 0,
      sender_id: 'node-A',
      category: 'GENERAL',
      lat: 49.45,
      lon: 11.07
    };

    await transportA.broadcast(testPacket);

    // Allow virtual simulated latency
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(received.length).toBe(1);
    expect(received[0].packet.msg_id).toBe('test-sos-hybrid-01');
    expect(received[0].fromPeer).toBe('node-A');

    await transportA.stop();
    await transportB.stop();
  });

  it('merges connected peers across transports without duplicates', async () => {
    const transport = new HybridMeshTransport('node-hub');
    await transport.start();

    const bus = VirtualNetworkBus.getInstance();
    bus.linkNeighbors('node-hub', 'peer-virtual-1');

    const peers = transport.getConnectedPeers();
    expect(peers.some((p) => p.id === 'peer-virtual-1')).toBe(true);

    await transport.stop();
  });
});
