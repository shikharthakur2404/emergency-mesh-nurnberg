/**
 * Emergency Mesh Nürnberg — Coordination & Routing Arbiter
 * Enforces deterministic TTL decrement, loop detection, packet relaying,
 * family key decryption, anti-spoofing signature verification, and DTN epidemic store-and-forward.
 */

import {
  MeshPacket,
  SafePacket,
  SosPacket,
  HazardPacket,
  SyncInvPacket,
  SyncDataPacket,
  SosCategory,
  HazardType,
  RouterConfig,
  PeerNode
} from './types';
import { DeduplicationCache } from './deduplication';
import {
  generateMsgId,
  hashFamilySecret,
  encryptFamilyPayload,
  decryptFamilyPayload,
  signEmergencyPayload,
  verifyEmergencyPayload,
  isTimestampFresh
} from './crypto';
import { StoreAndForwardBuffer } from './dtn/StoreAndForwardBuffer';
import { MeshTransport } from './transport/MeshTransport';

export type MeshEventListener = (
  packet: MeshPacket,
  meta: { isDirect: boolean; decryptedText?: string; isVerified?: boolean }
) => void;

export class MeshRouter {
  public config: RouterConfig;
  private transport: MeshTransport;
  private dedupCache: DeduplicationCache;
  private dtnBuffer: StoreAndForwardBuffer;
  private listeners: Set<MeshEventListener> = new Set();
  private familySecretMap: Map<string, string> = new Map(); // hash -> rawSecret
  public relayedPacketsCount = 0;
  public droppedLoopPacketsCount = 0;
  public totalReceivedCount = 0;
  public dtnSyncCount = 0;
  private dtnTimer: any = null;

  constructor(config: RouterConfig, transport: MeshTransport) {
    this.config = config;
    this.transport = transport;
    this.dedupCache = new DeduplicationCache(config.dedupCacheSize || 500);
    this.dtnBuffer = new StoreAndForwardBuffer(config.dtnCapacity || 250);

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
    const intervalMs = this.config.dtnSyncIntervalMs || 25000;
    if (intervalMs > 0 && typeof setInterval !== 'undefined') {
      this.dtnTimer = setInterval(() => {
        this.triggerDtnSync().catch(() => {});
      }, intervalMs);
    }
  }

  public async stop(): Promise<void> {
    if (this.dtnTimer) {
      clearInterval(this.dtnTimer);
      this.dtnTimer = null;
    }
    await this.transport.stop();
  }

  public clearCache(): void {
    this.dedupCache.clear();
    this.dtnBuffer.clear();
  }

  public getDtnBuffer(): StoreAndForwardBuffer {
    return this.dtnBuffer;
  }

  public subscribe(listener: MeshEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public getConnectedPeers(): PeerNode[] {
    return this.transport.getConnectedPeers();
  }

  /**
   * Broadcasts a lightweight inventory vector (SYNC_INV) of our buffered packets
   * to initiate epidemic synchronization across disconnected cluster partitions.
   */
  public async triggerDtnSync(): Promise<void> {
    const inventory = this.dtnBuffer.getInventory();
    if (inventory.length === 0) return;

    const syncInv: SyncInvPacket = {
      type: 'SYNC_INV',
      msg_id: generateMsgId(),
      timestamp: Math.floor(Date.now() / 1000),
      ttl: 1, // 1-hop direct exchange only
      hop_count: 0,
      sender_id: this.config.nodeId,
      inventory
    };

    await this.transport.broadcast(syncInv);
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
      sender_alias: alias || this.config.nodeId,
      priority: 'HIGH'
    };

    // Buffer in DTN store-and-forward vault
    this.dtnBuffer.addPacket(packet);

    // Mark seen locally to never accept own echoes
    this.dedupCache.recordSeen(msgId);
    await this.transport.broadcast(packet);
    return packet;
  }

  /**
   * Originates a new public SOS Emergency Beacon with cryptographic tamper protection.
   */
  public async broadcastSos(
    category: SosCategory,
    lat: number,
    lon: number,
    notes?: string
  ): Promise<SosPacket> {
    const msgId = generateMsgId();
    const timestamp = Math.floor(Date.now() / 1000);
    const canonical = `SOS:${this.config.nodeId}:${timestamp}:${category}:${lat}:${lon}:${notes || ''}`;
    const { signature, authToken } = signEmergencyPayload(canonical, this.config.nodeId);

    const packet: SosPacket = {
      type: 'SOS',
      msg_id: msgId,
      timestamp,
      ttl: this.config.maxTtl || 20,
      hop_count: 0,
      sender_id: this.config.nodeId,
      category,
      lat,
      lon,
      notes,
      signature,
      auth_token: authToken,
      priority: 'CRITICAL'
    };

    // Buffer in DTN store-and-forward vault
    this.dtnBuffer.addPacket(packet);

    this.dedupCache.recordSeen(msgId);
    await this.transport.broadcast(packet);
    return packet;
  }

  /**
   * Originates a new Local Hazard Notification with cryptographic tamper protection.
   */
  public async broadcastHazard(
    hazardType: HazardType,
    lat: number,
    lon: number,
    description: string
  ): Promise<HazardPacket> {
    const msgId = generateMsgId();
    const timestamp = Math.floor(Date.now() / 1000);
    const canonical = `HAZARD:${this.config.nodeId}:${timestamp}:${hazardType}:${lat}:${lon}:${description}`;
    const { signature, authToken } = signEmergencyPayload(canonical, this.config.nodeId);

    const packet: HazardPacket = {
      type: 'HAZARD',
      msg_id: msgId,
      timestamp,
      ttl: this.config.maxTtl || 15,
      hop_count: 0,
      sender_id: this.config.nodeId,
      hazard_type: hazardType,
      lat,
      lon,
      description,
      signature,
      auth_token: authToken,
      priority: 'HIGH'
    };

    // Buffer in DTN store-and-forward vault
    this.dtnBuffer.addPacket(packet);

    this.dedupCache.recordSeen(msgId);
    await this.transport.broadcast(packet);
    return packet;
  }

  /**
   * Central routing engine pipeline for all packets received from the network.
   */
  public async handleIncoming(packet: MeshPacket, isDirect: boolean): Promise<boolean> {
    this.totalReceivedCount++;

    // 0. Handle Epidemic DTN Synchronization Packets (1-Hop Only)
    if (packet.type === 'SYNC_INV') {
      if (packet.sender_id === this.config.nodeId) return false;
      const delta = this.dtnBuffer.getOutboundDelta(packet.inventory);
      if (delta.length > 0) {
        const syncData: SyncDataPacket = {
          type: 'SYNC_DATA',
          msg_id: generateMsgId(),
          timestamp: Math.floor(Date.now() / 1000),
          ttl: 1,
          hop_count: 0,
          sender_id: this.config.nodeId,
          packets: delta
        };
        this.dtnSyncCount++;
        await this.transport.broadcast(syncData);
      }
      return true;
    }

    if (packet.type === 'SYNC_DATA') {
      if (packet.sender_id === this.config.nodeId) return false;
      for (const item of packet.packets) {
        await this.handleIncoming(item, false);
      }
      return true;
    }

    // 1. Loop Prevention & Deduplication
    if (this.dedupCache.hasSeen(packet.msg_id)) {
      this.droppedLoopPacketsCount++;
      return false; // Silently drop duplicate packet
    }

    // 2. Timestamp Freshness Check (Prevent stale replays)
    if (!isTimestampFresh(packet.timestamp)) {
      return false;
    }

    // 3. Record packet as seen
    this.dedupCache.recordSeen(packet.msg_id);

    // 4. Archive packet into DTN Store & Forward Buffer
    this.dtnBuffer.addPacket(packet);

    // 5. Cryptographic Family Decryption & Signature Verification
    let decryptedText: string | undefined;
    let isVerified: boolean | undefined;

    if (packet.type === 'SAFE') {
      const matchingSecret = this.familySecretMap.get(packet.family_id);
      if (matchingSecret) {
        const decrypted = decryptFamilyPayload(matchingSecret, packet.encrypted_payload);
        if (decrypted) {
          decryptedText = decrypted;
        }
      }
    } else if (packet.type === 'SOS') {
      if (packet.signature && packet.sender_id) {
        const canonical = `SOS:${packet.sender_id}:${packet.timestamp}:${packet.category}:${packet.lat}:${packet.lon}:${packet.notes || ''}`;
        isVerified = verifyEmergencyPayload(canonical, packet.signature, packet.sender_id);
      }
    } else if (packet.type === 'HAZARD') {
      if (packet.signature && packet.sender_id) {
        const canonical = `HAZARD:${packet.sender_id}:${packet.timestamp}:${packet.hazard_type}:${packet.lat}:${packet.lon}:${packet.description}`;
        isVerified = verifyEmergencyPayload(canonical, packet.signature, packet.sender_id);
      }
    }

    // 6. Notify Local Subscribers (UI / State Store)
    for (const listener of this.listeners) {
      listener(packet, { isDirect, decryptedText, isVerified });
    }

    // 7. Hop-Count Decrement & Relay Decision
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
      dtnBufferedCount: this.dtnBuffer.size,
      relayedPackets: this.relayedPacketsCount,
      droppedDuplicates: this.droppedLoopPacketsCount,
      totalReceived: this.totalReceivedCount,
      dtnSyncs: this.dtnSyncCount,
      connectedPeers: this.transport.getConnectedPeers().length
    };
  }
}
