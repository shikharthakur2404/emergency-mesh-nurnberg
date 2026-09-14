/**
 * Emergency Mesh Nürnberg — Physical Over-The-Air UDP Hardware Transport Driver
 * Communicates with native Android UdpMeshModule over 255.255.255.255:8888.
 * Allows physical phones on the same offline hotspot / Wi-Fi to exchange mesh packets.
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { MeshPacket, PeerNode } from '../types';
import { MeshTransport, PacketCallback, PeerCallback } from './MeshTransport';

const { UdpMeshModule } = NativeModules;

export class PhysicalUdpMeshTransport implements MeshTransport {
  public name = 'Physical-UDP-Radio';
  public readonly nodeId: string;
  public readonly port: number;

  private packetCallback: PacketCallback | null = null;
  private peerCallback: PeerCallback | null = null;
  private eventEmitter: NativeEventEmitter | null = null;
  private subscription: any = null;
  private knownPeers: Map<string, { peer: PeerNode; lastSeen: number }> = new Map();
  private isRunning = false;

  constructor(nodeId: string, port = 8888) {
    this.nodeId = nodeId;
    this.port = port;

    if (UdpMeshModule) {
      this.eventEmitter = new NativeEventEmitter(UdpMeshModule);
    }
  }

  public async isAvailable(): Promise<boolean> {
    return Platform.OS === 'android' && Boolean(UdpMeshModule);
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;

    if (!UdpMeshModule) {
      console.warn('[PhysicalUdpMeshTransport] Native UdpMeshModule not loaded; hardware radio unavailable.');
      return;
    }

    try {
      await UdpMeshModule.startRadio(this.port);
      this.isRunning = true;

      if (this.eventEmitter) {
        this.subscription = this.eventEmitter.addListener('onUdpPacket', (event: { payload: string; fromAddress: string; fromPort: number }) => {
          this.handleInboundDatagram(event.payload, event.fromAddress);
        });
      }

      console.info(`[PhysicalUdpMeshTransport] Hardware radio active on 0.0.0.0:${this.port}`);
    } catch (err) {
      console.error('[PhysicalUdpMeshTransport] Failed to start UDP radio:', err);
      throw err;
    }
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
    if (UdpMeshModule) {
      try {
        await UdpMeshModule.stopRadio();
      } catch (err) {
        console.warn('[PhysicalUdpMeshTransport] Error stopping radio:', err);
      }
    }
    this.knownPeers.clear();
  }

  public async broadcast(packet: MeshPacket): Promise<void> {
    if (!UdpMeshModule || !this.isRunning) {
      return;
    }

    try {
      const serialized = JSON.stringify(packet);
      await UdpMeshModule.broadcastPacket(serialized, this.port);
    } catch (err) {
      console.error('[PhysicalUdpMeshTransport] Broadcast error:', err);
    }
  }

  public onPacket(callback: PacketCallback): void {
    this.packetCallback = callback;
  }

  public onPeersUpdated(callback: PeerCallback): void {
    this.peerCallback = callback;
  }

  public getConnectedPeers(): PeerNode[] {
    const now = Date.now();
    const active: PeerNode[] = [];
    for (const [id, entry] of this.knownPeers.entries()) {
      if (now - entry.lastSeen < 60000) {
        active.push(entry.peer);
      } else {
        this.knownPeers.delete(id);
      }
    }
    return active;
  }

  private extractSenderId(packet: MeshPacket): string {
    if ('sender_id' in packet && packet.sender_id) return packet.sender_id;
    if ('node_id' in packet && packet.node_id) return packet.node_id;
    if ('sender_alias' in packet && packet.sender_alias) return packet.sender_alias;
    return 'unknown-peer';
  }

  private handleInboundDatagram(rawPayload: string, fromAddress: string): void {
    try {
      const packet = JSON.parse(rawPayload) as MeshPacket;
      if (!packet || !packet.msg_id) return;

      const senderId = this.extractSenderId(packet);

      // Drop self-echo packets
      if (senderId === this.nodeId) {
        return;
      }

      // Track peer discovery
      if (senderId !== 'unknown-peer') {
        this.recordPeer(senderId, fromAddress);
      }

      // Forward to mesh router
      if (this.packetCallback) {
        this.packetCallback(packet, senderId);
      }
    } catch (err) {
      console.warn('[PhysicalUdpMeshTransport] Discarding invalid datagram payload:', err);
    }
  }

  private recordPeer(peerId: string, ipAddress: string): void {
    const isNew = !this.knownPeers.has(peerId);
    this.knownPeers.set(peerId, {
      peer: {
        id: peerId,
        lastSeen: Date.now(),
        rssi: -45, // Direct local broadcast baseline
        directConnection: true,
        hopDistance: 1
      },
      lastSeen: Date.now()
    });

    if (isNew && this.peerCallback) {
      this.peerCallback(this.getConnectedPeers());
    }
  }
}
