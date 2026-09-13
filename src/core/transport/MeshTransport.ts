/**
 * Emergency Mesh Nürnberg — Abstract Mesh Transport Driver
 * Enables seamless switching between BLE GATT, Nearby Connections, and Virtual Simulator.
 */

import { MeshPacket, PeerNode } from '../types.js';

export type PacketCallback = (packet: MeshPacket, fromPeerId?: string) => void;
export type PeerCallback = (peers: PeerNode[]) => void;

export interface MeshTransport {
  name: string;
  isAvailable(): Promise<boolean>;
  start(serviceId?: string): Promise<void>;
  stop(): Promise<void>;
  broadcast(packet: MeshPacket): Promise<void>;
  onPacket(callback: PacketCallback): void;
  onPeersUpdated(callback: PeerCallback): void;
  getConnectedPeers(): PeerNode[];
}
