/**
 * Emergency Mesh Nürnberg — Coordination & Routing Arbiter
 * Enforces deterministic TTL decrement, loop detection, packet relaying, and family key decryption.
 */

import {
  MeshPacket,
  SafePacket,
  SosPacket,
  HazardPacket,
  SosCategory,
  HazardType,
  RouterConfig,
  PeerNode
} from './types.js';
import { DeduplicationCache } from './deduplication.js';
import {
  generateMsgId,
  hashFamilySecret,
  encryptFamilyPayload,
  decryptFamilyPayload
} from './crypto.js';
import { MeshTransport } from './transport/MeshTransport.js';

export type MeshEventListener = (packet: MeshPacket, meta: { isDirect: boolean; decryptedText?: string }) => void;

export class MeshRouter {
  public config: RouterConfig;
  private transport: MeshTransport;
  private dedupCache: DeduplicationCache;
  private listeners: Set<MeshEventListener> = new Set();
  private familySecretMap: Map<string, string> = new Map(); // hash -> rawSecret
  public relayedPacketsCount = 0;
  public droppedLoopPacketsCount = 0;
  public totalReceivedCount = 0;

  constructor(config: RouterConfig, transport: MeshTransport) {
    this.config = config;
    this.transport = transport;
    this.dedupCache = new DeduplicationCache(config.dedupCacheSize || 500);

    // Register family secrets
    for (const secret of config.familySecrets || []) {
      this.registerFamilySecret(secret);
    }

    // Attach transport receiver
    this.transport.onPacket((packet, fromPeerId) => {
      this.handleIncoming(packet, Boolean(fromPeerId));
    });
  }

  public registerFamilySecret(secret: string): void {
    const hash = hashFamilySecret(secret);
    this.familySecretMap.set(hash, secret);
  }

  public async start(): Promise<void> {
    await this.transport.start();
  }

  public async stop(): Promise<void> {
    await this.transport.stop();
  }

  public subscribe(listener: MeshEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public getConnectedPeers(): PeerNode[] {
    return this.transport.getConnectedPeers();
  }

  /**
   * Originates a new "I am Safe" targeted broadcast.
   */
  public async broadcastSafe(secret: string, statusText: string, alias?: string): Promise<SafePacket> {
    const familyHash = hashFamilySecret(secret);
    const encrypted = encryptFamilyPayload(secret, statusText);
    const msgId = generateMsgId();

    const packet: SafePacket = {
      type: 'SAFE',
      msg_id: msgId,
      timestamp: Math.floor(Date.now() / 1000),
      ttl: this.config.maxTtl || 15,
      hop_count: 0,
      family_id: familyHash,
      encrypted_payload: encrypted,
      sender_alias: alias || this.config.nodeId
    };

    // Mark seen locally to never accept own echoes
    this.dedupCache.recordSeen(msgId);
    await this.transport.broadcast(packet);
    return packet;
  }

  /**
   * Originates a new public SOS Emergency Beacon.
   */
  public async broadcastSos(
    category: SosCategory,
    lat: number,
    lon: number,
    notes?: string
  ): Promise<SosPacket> {
    const msgId = generateMsgId();
    const packet: SosPacket = {
      type: 'SOS',
      msg_id: msgId,
      timestamp: Math.floor(Date.now() / 1000),
      ttl: this.config.maxTtl || 20,
      hop_count: 0,
      sender_id: this.config.nodeId,
      category,
      lat,
      lon,
      notes
    };

    this.dedupCache.recordSeen(msgId);
    await this.transport.broadcast(packet);
    return packet;
  }

  /**
   * Originates a new Local Hazard Notification (e.g. Flooded Underpass, Blocked Ring Road).
   */
  public async broadcastHazard(
    hazardType: HazardType,
    lat: number,
    lon: number,
    description: string
  ): Promise<HazardPacket> {
    const msgId = generateMsgId();
    const packet: HazardPacket = {
      type: 'HAZARD',
      msg_id: msgId,
      timestamp: Math.floor(Date.now() / 1000),
      ttl: this.config.maxTtl || 15,
      hop_count: 0,
      sender_id: this.config.nodeId,
      hazard_type: hazardType,
      lat,
      lon,
      description
    };

    this.dedupCache.recordSeen(msgId);
    await this.transport.broadcast(packet);
    return packet;
  }

  /**
   * Central routing engine pipeline for all packets received from the network.
   */
  public async handleIncoming(packet: MeshPacket, isDirect: boolean): Promise<boolean> {
    this.totalReceivedCount++;

    // 1. Loop Prevention & Deduplication
    if (this.dedupCache.hasSeen(packet.msg_id)) {
      this.droppedLoopPacketsCount++;
      return false; // Silently drop duplicate packet
    }

    // 2. Record packet as seen
    this.dedupCache.recordSeen(packet.msg_id);

    // 3. Cryptographic Family Decryption (if applicable)
    let decryptedText: string | undefined;
    if (packet.type === 'SAFE') {
      const matchingSecret = this.familySecretMap.get(packet.family_id);
      if (matchingSecret) {
        const decrypted = decryptFamilyPayload(matchingSecret, packet.encrypted_payload);
        if (decrypted) {
          decryptedText = decrypted;
        }
      }
    }

    // 4. Notify Local Subscribers (UI / State Store)
    for (const listener of this.listeners) {
      listener(packet, { isDirect, decryptedText });
    }

    // 5. Hop-Count Decrement & Relay Decision
    if (packet.ttl > 1) {
      const relayPacket: MeshPacket = {
        ...packet,
        ttl: packet.ttl - 1,
        hop_count: packet.hop_count + 1
      };
      this.relayedPacketsCount++;
      await this.transport.broadcast(relayPacket);
      return true;
    }

    // TTL reached 1 -> next hop is 0 -> terminate relay
    return true;
  }

  public getStats() {
    return {
      nodeId: this.config.nodeId,
      dedupCacheSize: this.dedupCache.size,
      relayedPackets: this.relayedPacketsCount,
      droppedDuplicates: this.droppedLoopPacketsCount,
      totalReceived: this.totalReceivedCount,
      connectedPeers: this.transport.getConnectedPeers().length
    };
  }
}
