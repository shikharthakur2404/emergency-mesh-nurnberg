/**
 * Emergency Mesh Nürnberg — Core Protocol Definitions & Wire Schemas
 * Designed for zero-cloud, byte-efficient, P2P disaster coordination.
 */

export type MeshPacketType = 'SAFE' | 'SOS' | 'HAZARD' | 'PING' | 'SYNC_INV' | 'SYNC_DATA';

export type PacketPriority = 'CRITICAL' | 'HIGH' | 'NORMAL';

export interface BasePacket {
  msg_id: string;      // Unique 8-12 char identifier for deduplication
  timestamp: number;   // UNIX timestamp in seconds
  ttl: number;         // Decremented on each hop; dropped when 0
  hop_count: number;   // Total hops traversed so far
  priority?: PacketPriority; // Priority for DTN retention & queue ordering
  dtn_buffered?: boolean;    // Flagged if carried/synced via store-and-forward
}

export interface SafePacket extends BasePacket {
  type: 'SAFE';
  family_id: string;          // Cryptographic hash of family secret
  encrypted_payload: string;  // Ciphertext / verified status
  sender_alias?: string;      // Optional local nickname
}

export type SosCategory = 'MEDICAL' | 'FIRE' | 'TRAPPED' | 'SUPPLIES' | 'GENERAL';

export interface SosPacket extends BasePacket {
  type: 'SOS';
  sender_id: string;          // Ephemeral anonymous node identifier
  category: SosCategory;
  lat: number;
  lon: number;
  notes?: string;
  signature?: string;         // Cryptographic integrity signature (anti-spoofing)
  auth_token?: string;        // Node verification token
}

export type HazardType = 'FLOOD' | 'COLLAPSE' | 'GRID_DOWN' | 'BLOCKED_ROUTE' | 'FIRE';

export interface HazardPacket extends BasePacket {
  type: 'HAZARD';
  sender_id: string;
  hazard_type: HazardType;
  lat: number;
  lon: number;
  description: string;
  signature?: string;         // Cryptographic integrity signature (anti-spoofing)
  auth_token?: string;        // Node verification token
}

export interface PingPacket extends BasePacket {
  type: 'PING';
  node_id: string;
}

export interface SyncInvItem {
  msg_id: string;
  timestamp: number;
  type: MeshPacketType;
  priority: PacketPriority;
}

export interface SyncInvPacket extends BasePacket {
  type: 'SYNC_INV';
  sender_id: string;
  inventory: SyncInvItem[];
}

export interface SyncDataPacket extends BasePacket {
  type: 'SYNC_DATA';
  sender_id: string;
  packets: MeshPacket[];
}

export type MeshPacket = SafePacket | SosPacket | HazardPacket | PingPacket | SyncInvPacket | SyncDataPacket;

export interface PeerNode {
  id: string;
  lastSeen: number;
  rssi?: number;
  directConnection: boolean;
  hopDistance: number;
}

export type PoiCategory = 'HOSPITAL' | 'WATER' | 'SHELTER' | 'THW_CIVIL_DEFENSE';

export interface NurnbergEmergencyPoi {
  id: string;
  name: string;
  category: PoiCategory;
  address: string;
  district: string;
  lat: number;
  lon: number;
  notes: string;
  capacity?: string;
  radioFrequency?: string;
}

export interface RouterConfig {
  nodeId: string;
  maxTtl: number;
  dedupCacheSize: number;
  familySecrets: string[]; // Hashes of family secrets configured on this node
  dtnCapacity?: number;
  dtnSyncIntervalMs?: number;
}
