/**
 * Emergency Mesh Nürnberg — Hybrid Mesh Transport Driver
 * Coordinates physical over-the-air UDP radio (hardware) and virtual simulation bus.
 * Guarantees zero-infrastructure physical node-to-node communications while preserving simulation capability.
 */

import { MeshPacket, PeerNode } from '../types';
import { MeshTransport, PacketCallback, PeerCallback } from './MeshTransport';
import { PhysicalUdpMeshTransport } from './PhysicalUdpMeshTransport';
import { VirtualMeshTransport } from './VirtualMeshTransport';

export class HybridMeshTransport implements MeshTransport {
  public name = 'Hybrid-Radio-Transport';
  public readonly physicalTransport: PhysicalUdpMeshTransport;
  public readonly virtualTransport: VirtualMeshTransport;

  private packetCallback: PacketCallback | null = null;
  private peerCallback: PeerCallback | null = null;
  private isPhysicalActive = false;

  constructor(nodeId: string, port = 8888) {
    this.physicalTransport = new PhysicalUdpMeshTransport(nodeId, port);
    this.virtualTransport = new VirtualMeshTransport(nodeId);

    // Forward packets from physical hardware radio
    this.physicalTransport.onPacket((packet, fromPeerId) => {
      if (this.packetCallback) {
        this.packetCallback(packet, fromPeerId);
      }
    });

    // Forward packets from virtual bus
    this.virtualTransport.onPacket((packet, fromPeerId) => {
      if (this.packetCallback) {
        this.packetCallback(packet, fromPeerId);
      }
    });

    // Forward peer updates
    this.physicalTransport.onPeersUpdated(() => {
      this.emitCombinedPeers();
    });
    this.virtualTransport.onPeersUpdated(() => {
      this.emitCombinedPeers();
    });
  }

  public async isAvailable(): Promise<boolean> {
    return true;
  }

  public async start(serviceId?: string): Promise<void> {
    // Start virtual transport
    await this.virtualTransport.start();

    // Start physical radio if supported on device
    const physicalAvailable = await this.physicalTransport.isAvailable();
    if (physicalAvailable) {
      try {
        await this.physicalTransport.start();
        this.isPhysicalActive = true;
        console.info('[HybridMeshTransport] Physical OTA hardware radio initialized successfully.');
      } catch (err) {
        console.warn('[HybridMeshTransport] Physical radio start encountered error, falling back:', err);
        this.isPhysicalActive = false;
      }
    } else {
      console.info('[HybridMeshTransport] Native radio unavailable on this platform/environment, running in virtual mode.');
      this.isPhysicalActive = false;
    }
  }

  public async stop(): Promise<void> {
    await this.virtualTransport.stop();
    await this.physicalTransport.stop();
    this.isPhysicalActive = false;
  }

  public async broadcast(packet: MeshPacket): Promise<void> {
    const promises: Promise<void>[] = [this.virtualTransport.broadcast(packet)];
    if (this.isPhysicalActive) {
      promises.push(this.physicalTransport.broadcast(packet));
    }
    await Promise.allSettled(promises);
  }

  public onPacket(callback: PacketCallback): void {
    this.packetCallback = callback;
  }

  public onPeersUpdated(callback: PeerCallback): void {
    this.peerCallback = callback;
  }

  public getConnectedPeers(): PeerNode[] {
    const virtualPeers = this.virtualTransport.getConnectedPeers();
    const physicalPeers = this.physicalTransport.getConnectedPeers();

    const peerMap = new Map<string, PeerNode>();
    for (const p of virtualPeers) {
      peerMap.set(p.id, p);
    }
    for (const p of physicalPeers) {
      peerMap.set(p.id, p);
    }
    return Array.from(peerMap.values());
  }

  public isHardwareRadioActive(): boolean {
    return this.isPhysicalActive;
  }

  private emitCombinedPeers(): void {
    if (this.peerCallback) {
      this.peerCallback(this.getConnectedPeers());
    }
  }
}
