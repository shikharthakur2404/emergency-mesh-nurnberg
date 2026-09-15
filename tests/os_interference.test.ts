import { describe, it, expect, vi } from 'vitest';
import { requestMeshPermissions } from '../src/utils/permissions';
import { PhysicalUdpMeshTransport } from '../src/core/transport/PhysicalUdpMeshTransport';
import { MeshRouter } from '../src/core/router';
import { VirtualMeshTransport } from '../src/core/transport/VirtualMeshTransport';
import { PermissionsAndroid, AppState, NativeModules } from 'react-native';

describe('Layer 7: OS-Level Interference & Resilience', () => {

  describe('7.1 Runtime Permission Revocation & Graceful Degradation', () => {
    it('handles complete location and nearby device permission denial without crashing', async () => {
      // Mock user denying all permissions
      vi.spyOn(PermissionsAndroid, 'requestMultiple').mockResolvedValueOnce({
        [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]: PermissionsAndroid.RESULTS.DENIED,
        [PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION]: PermissionsAndroid.RESULTS.DENIED,
        [PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES]: PermissionsAndroid.RESULTS.DENIED,
      });

      let granted: boolean | undefined;
      await expect((async () => {
        granted = await requestMeshPermissions();
      })()).resolves.not.toThrow();

      expect(granted).toBe(true); // Should complete gracefully without unhandled throw
    });

    it('handles unexpected permission exception without throwing out to caller', async () => {
      vi.spyOn(PermissionsAndroid, 'requestMultiple').mockRejectedValueOnce(
        new Error('OS SecurityException: Permission request interrupted')
      );

      const result = await requestMeshPermissions();
      expect(result).toBe(false); // Graceful fallback
    });

    it('allows mesh router to originate SOS even when GPS fix is missing due to permission denial', async () => {
      const transport = new VirtualMeshTransport('no-gps-node');
      const router = new MeshRouter(
        { nodeId: 'no-gps-node', maxTtl: 10, dedupCacheSize: 100, familySecrets: [] },
        transport
      );
      await router.start();

      // GPS denied: coordinates are 0, 0 or null-island
      const packet = await router.broadcastSos('MEDICAL', 0, 0, 'No GPS permission available');
      expect(packet).toBeDefined();
      expect(packet.msg_id).toBeDefined();
      expect(packet.lat).toBe(0);
      expect(packet.lon).toBe(0);

      await router.stop();
    });
  });

  describe('7.2 Android Doze Mode & Background State Transition Resilience', () => {
    it('retains router listeners and DTN buffer state across AppState active -> background -> active cycles', async () => {
      const transport = new VirtualMeshTransport('doze-test-node');
      const router = new MeshRouter(
        { nodeId: 'doze-test-node', maxTtl: 10, dedupCacheSize: 100, familySecrets: [] },
        transport
      );
      await router.start();

      let deliveredCount = 0;
      router.subscribe(() => {
        deliveredCount++;
      });

      // 1. Initial active state: broadcast packet
      await router.broadcastSos('FIRE', 49.45, 11.08, 'Pre-Doze Beacon');
      expect(router.getDtnBuffer().size).toBe(1);

      // 2. Simulate OS transitioning to Background / Doze mode
      let currentState = 'active';
      const listeners: Array<(state: string) => void> = [];
      vi.spyOn(AppState, 'addEventListener').mockImplementation((event, cb) => {
        listeners.push(cb);
        return { remove: () => {} };
      });

      // Notify AppState change
      currentState = 'background';
      listeners.forEach(cb => cb(currentState));

      // 3. Router and DTN state must NOT be wiped or disrupted during background state
      expect(router.getDtnBuffer().size).toBe(1);
      expect(router.getStats().dtnBufferedCount).toBe(1);

      // 4. Simulate App returning to foreground
      currentState = 'active';
      listeners.forEach(cb => cb(currentState));

      expect(router.getDtnBuffer().size).toBe(1);
      await router.stop();
    });
  });

  describe('7.3 Native Hardware Driver Radio Lifecycle & Error Containment', () => {
    it('contains native radio start failures without crashing transport layer', async () => {
      // Temporarily mock startRadio failure (e.g. port bind collision or permission fault)
      vi.spyOn(NativeModules.UdpMeshModule, 'startRadio').mockRejectedValueOnce(
        new Error('EADDRINUSE: Address already in use')
      );

      const physicalTransport = new PhysicalUdpMeshTransport('fault-node', 8888);

      await expect(physicalTransport.start()).rejects.toThrow('EADDRINUSE');

      // Subsequent stop must execute safely
      await expect(physicalTransport.stop()).resolves.not.toThrow();
    });

    it('swallows native broadcast errors to prevent unhandled JS promise rejections', async () => {
      vi.spyOn(NativeModules.UdpMeshModule, 'broadcastPacket').mockRejectedValueOnce(
        new Error('ENETUNREACH: Network is unreachable')
      );

      const physicalTransport = new PhysicalUdpMeshTransport('unreachable-node', 8888);
      // Force running state
      (physicalTransport as any).isRunning = true;

      await expect(
        physicalTransport.broadcast({
          type: 'SOS',
          msg_id: 'test-unreachable',
          timestamp: Math.floor(Date.now() / 1000),
          ttl: 5,
          hop_count: 0,
          sender_id: 'unreachable-node',
          category: 'OTHER',
          lat: 49.45,
          lon: 11.08
        })
      ).resolves.not.toThrow();
    });
  });
});
