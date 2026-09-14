/**
 * Emergency Mesh Nürnberg — Delay-Tolerant Store & Forward Engine
 * Implements RFC 5050 bundle-style epidemic synchronization across disconnected shelter clusters.
 */

import { MeshPacket, PacketPriority, SyncInvItem } from '../types';

export interface BufferedEntry {
  packet: MeshPacket;
  storedAt: number;
  priority: PacketPriority;
}

export class StoreAndForwardBuffer {
  private buffer: Map<string, BufferedEntry> = new Map();
  private maxCapacity: number;

  constructor(maxCapacity = 250) {
    this.maxCapacity = maxCapacity;
  }

  /**
   * Adds a packet to the durable store-and-forward buffer.
   * Discards ephemeral protocol packets (PING, SYNC_INV, SYNC_DATA).
   */
  public addPacket(packet: MeshPacket): boolean {
    if (packet.type === 'PING' || packet.type === 'SYNC_INV' || packet.type === 'SYNC_DATA') {
      return false;
    }

    if (this.buffer.has(packet.msg_id)) {
      return false;
    }

    const priority: PacketPriority =
      packet.priority ||
      (packet.type === 'SOS' ? 'CRITICAL' : packet.type === 'SAFE' || packet.type === 'HAZARD' ? 'HIGH' : 'NORMAL');

    // If at capacity, evict oldest lowest-priority packet
    if (this.buffer.size >= this.maxCapacity) {
      this.evictLowestPriority();
    }

    this.buffer.set(packet.msg_id, {
      packet: { ...packet, dtn_buffered: true, priority },
      storedAt: Math.floor(Date.now() / 1000),
      priority
    });

    return true;
  }

  /**
   * Generates a lightweight summary of all buffered packets for sync exchange.
   */
  public getInventory(): SyncInvItem[] {
    const items: SyncInvItem[] = [];
    for (const [msg_id, entry] of this.buffer.entries()) {
      items.push({
        msg_id,
        timestamp: entry.packet.timestamp,
        type: entry.packet.type,
        priority: entry.priority
      });
    }

    // Sort: CRITICAL first, then most recent timestamp
    const priorityRank = (p: PacketPriority) => (p === 'CRITICAL' ? 3 : p === 'HIGH' ? 2 : 1);
    return items.sort((a, b) => {
      const rankDiff = priorityRank(b.priority) - priorityRank(a.priority);
      return rankDiff !== 0 ? rankDiff : b.timestamp - a.timestamp;
    });
  }

  /**
   * Compares our buffer with a remote peer's inventory.
   * Returns packets that we have in our buffer which the peer lacks.
   */
  public getOutboundDelta(remoteInventory: SyncInvItem[], maxBatch = 10): MeshPacket[] {
    const remoteIds = new Set(remoteInventory.map(item => item.msg_id));
    const delta: MeshPacket[] = [];

    // Prioritize critical packets first
    const sortedEntries = Array.from(this.buffer.values()).sort((a, b) => {
      const priorityRank = (p: PacketPriority) => (p === 'CRITICAL' ? 3 : p === 'HIGH' ? 2 : 1);
      return priorityRank(b.priority) - priorityRank(a.priority);
    });

    for (const entry of sortedEntries) {
      if (!remoteIds.has(entry.packet.msg_id)) {
        delta.push(entry.packet);
        if (delta.length >= maxBatch) break;
      }
    }

    return delta;
  }

  /**
   * Identifies IDs in the remote inventory that we currently lack.
   */
  public getMissingIds(remoteInventory: SyncInvItem[]): string[] {
    return remoteInventory
      .filter(item => !this.buffer.has(item.msg_id))
      .map(item => item.msg_id);
  }

  public getPacket(msgId: string): MeshPacket | undefined {
    return this.buffer.get(msgId)?.packet;
  }

  public getAllPackets(): MeshPacket[] {
    return Array.from(this.buffer.values()).map(e => e.packet);
  }

  public get size(): number {
    return this.buffer.size;
  }

  public clear(): void {
    this.buffer.clear();
  }

  /**
   * Purges entries that have exceeded their maximum retention window:
   * CRITICAL (SOS): 48 hours
   * HIGH (SAFE, HAZARD): 24 hours
   * NORMAL: 6 hours
   */
  public purgeExpired(now = Math.floor(Date.now() / 1000)): number {
    let purged = 0;
    for (const [msg_id, entry] of this.buffer.entries()) {
      const age = now - entry.packet.timestamp;
      const maxAge =
        entry.priority === 'CRITICAL'
          ? 48 * 3600
          : entry.priority === 'HIGH'
          ? 24 * 3600
          : 6 * 3600;

      if (age > maxAge) {
        this.buffer.delete(msg_id);
        purged++;
      }
    }
    return purged;
  }

  private evictLowestPriority(): void {
    let candidateKey: string | null = null;
    let lowestRank = 999;
    let oldestTimestamp = Infinity;

    const priorityRank = (p: PacketPriority) => (p === 'CRITICAL' ? 3 : p === 'HIGH' ? 2 : 1);

    for (const [msg_id, entry] of this.buffer.entries()) {
      const rank = priorityRank(entry.priority);
      if (rank < lowestRank || (rank === lowestRank && entry.packet.timestamp < oldestTimestamp)) {
        lowestRank = rank;
        oldestTimestamp = entry.packet.timestamp;
        candidateKey = msg_id;
      }
    }

    if (candidateKey) {
      this.buffer.delete(candidateKey);
    }
  }
}
