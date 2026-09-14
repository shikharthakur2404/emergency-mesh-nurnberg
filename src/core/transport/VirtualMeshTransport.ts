/**
 * Emergency Mesh Nürnberg — Virtual Mesh Network Bus & Simulator Transport
 * Simulates real-world RF topology, adjacent neighbors, packet latency, and drop rates.
 */

import { MeshPacket, PeerNode } from '../types';
import { MeshTransport, PacketCallback, PeerCallback } from './MeshTransport';

export class VirtualNetworkBus {
  private static instance: VirtualNetworkBus;
  private nodes: Map<string, VirtualMeshTransport> = new Map();
  private adjacency: Map<string, Set<string>> = new Map(); // nodeA -> Set of reachable neighbor IDs
  public simulatedLatencyMs = 15;
  public simulatedDropRate = 0.0; // 0% drop default

  public static getInstance(): VirtualNetworkBus {
    if (!VirtualNetworkBus.instance) {
      VirtualNetworkBus.instance = new VirtualNetworkBus();
    }
    return VirtualNetworkBus.instance;
  }

  public register(transport: VirtualMeshTransport): void {
    this.nodes.set(transport.nodeId, transport);
    if (!this.adjacency.has(transport.nodeId)) {
      this.adjacency.set(transport.nodeId, new Set());
    }
  }

  public unregister(nodeId: string): void {
    this.nodes.delete(nodeId);
    this.adjacency.delete(nodeId);
    // Remove from other adjacencies
    for (const neighbors of this.adjacency.values()) {
      neighbors.delete(nodeId);
    }
  }

  /**
   * Links two nodes as bidirectional RF neighbors within broadcast range.
   */
  public linkNeighbors(nodeA: string, nodeB: string): void {
    this.adjacency.get(nodeA)?.add(nodeB);
    this.adjacency.get(nodeB)?.add(nodeA);
    this.syncPeerLists();
  }

  /**
   * Unlinks two nodes (e.g. peer moved out of radio range).
   */
  public unlinkNeighbors(nodeA: string, nodeB: string): void {
    this.adjacency.get(nodeA)?.delete(nodeB);
    this.adjacency.get(nodeB)?.delete(nodeA);
    this.syncPeerLists();
  }

  private syncPeerLists(): void {
    for (const [nodeId, transport] of this.nodes.entries()) {
      const neighborIds = this.adjacency.get(nodeId) || new Set();
      const peers: PeerNode[] = Array.from(neighborIds).map((peerId) => ({
        id: peerId,
        lastSeen: Date.now(),
        rssi: -65,
        directConnection: true,
        hopDistance: 1
      }));
      transport.notifyPeers(peers);
    }
  }

  /**
   * Transmits a packet from a sender to all directly adjacent radio neighbors.
   */
  public transmit(senderId: string, packet: MeshPacket): void {
    const neighbors = this.adjacency.get(senderId);
    if (!neighbors || neighbors.size === 0) return;

    for (const neighborId of neighbors) {
      if (Math.random() < this.simulatedDropRate) {
        continue; // Packet dropped due to simulated interference
      }

      const target = this.nodes.get(neighborId);
      if (target) {
        setTimeout(() => {
          target.receiveIncoming(JSON.parse(JSON.stringify(packet)), senderId);
        }, this.simulatedLatencyMs);
      }
    }
  }

  public reset(): void {
    this.nodes.clear();
    this.adjacency.clear();
    this.simulatedDropRate = 0.0;
  }
}

export class VirtualMeshTransport implements MeshTransport {
  public name = 'VirtualMeshSimulator';
  public nodeId: string;
  private bus: VirtualNetworkBus;
  private packetCallbacks: PacketCallback[] = [];
  private peerCallbacks: PeerCallback[] = [];
  private activePeers: PeerNode[] = [];
  private running = false;

  constructor(nodeId: string) {
    this.nodeId = nodeId;
    this.bus = VirtualNetworkBus.getInstance();
  }

  public async isAvailable(): Promise<boolean> {
    return true;
  }

  public async start(): Promise<void> {
    this.running = true;
    this.bus.register(this);
  }

  public async stop(): Promise<void> {
    this.running = false;
    this.bus.unregister(this.nodeId);
    this.activePeers = [];
  }

  public async broadcast(packet: MeshPacket): Promise<void> {
    if (!this.running) return;
    this.bus.transmit(this.nodeId, packet);
  }

  public onPacket(callback: PacketCallback): void {
    this.packetCallbacks.push(callback);
  }

  public onPeersUpdated(callback: PeerCallback): void {
    this.peerCallbacks.push(callback);
  }

  public getConnectedPeers(): PeerNode[] {
    return this.activePeers;
  }

  // Internal invocation from bus
  public receiveIncoming(packet: MeshPacket, fromPeerId: string): void {
    if (!this.running) return;
    for (const cb of this.packetCallbacks) {
      cb(packet, fromPeerId);
    }
  }

  public notifyPeers(peers: PeerNode[]): void {
    this.activePeers = peers;
    for (const cb of this.peerCallbacks) {
      cb(peers);
    }
  }
}
