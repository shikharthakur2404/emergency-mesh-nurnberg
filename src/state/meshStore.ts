/**
 * Emergency Mesh Nürnberg — Reactive State Management (Zustand)
 * Maintains packet telemetry, peer counts, and family decrypted state.
 */

import { create } from 'zustand';
import {
  MeshPacket,
  SafePacket,
  SosPacket,
  HazardPacket,
  PeerNode,
  NurnbergEmergencyPoi,
  SosCategory,
  HazardType
} from '../core/types.js';
import { MeshRouter } from '../core/router.js';
import { generateNodeId } from '../core/crypto.js';
import { NURNBERG_EMERGENCY_POIS } from '../data/nurnberg-emergency-data.js';

export interface DecryptedSafeEntry {
  msgId: string;
  senderAlias: string;
  plaintext: string;
  timestamp: number;
  hopCount: number;
}

export interface MeshState {
  nodeId: string;
  router: MeshRouter | null;
  packets: MeshPacket[];
  decryptedFamilyMessages: DecryptedSafeEntry[];
  connectedPeers: PeerNode[];
  activeFamilySecret: string;
  offlinePois: NurnbergEmergencyPoi[];
  stats: {
    totalReceived: number;
    relayedCount: number;
    droppedDuplicates: number;
  };

  // Actions
  attachRouter: (router: MeshRouter) => void;
  setFamilySecret: (secret: string) => void;
  sendSafeStatus: (text: string, alias?: string) => Promise<SafePacket | null>;
  sendSosBeacon: (category: SosCategory, lat: number, lon: number, notes?: string) => Promise<SosPacket | null>;
  sendHazardAlert: (type: HazardType, lat: number, lon: number, desc: string) => Promise<HazardPacket | null>;
  updatePeers: (peers: PeerNode[]) => void;
  clearHistory: () => void;
}

export const useMeshStore = create<MeshState>((set, get) => ({
  nodeId: generateNodeId(),
  router: null,
  packets: [],
  decryptedFamilyMessages: [],
  connectedPeers: [],
  activeFamilySecret: '',
  offlinePois: NURNBERG_EMERGENCY_POIS,
  stats: {
    totalReceived: 0,
    relayedCount: 0,
    droppedDuplicates: 0
  },

  attachRouter: (router: MeshRouter) => {
    set({ router, nodeId: router.config.nodeId });

    router.subscribe((packet, meta) => {
      set((state) => {
        const nextPackets = [packet, ...state.packets.slice(0, 99)]; // Keep latest 100
        const nextStats = {
          totalReceived: router.totalReceivedCount,
          relayedCount: router.relayedPacketsCount,
          droppedDuplicates: router.droppedLoopPacketsCount
        };

        if (packet.type === 'SAFE' && meta.decryptedText) {
          const entry: DecryptedSafeEntry = {
            msgId: packet.msg_id,
            senderAlias: packet.sender_alias || 'Family Member',
            plaintext: meta.decryptedText,
            timestamp: packet.timestamp,
            hopCount: packet.hop_count
          };
          return {
            packets: nextPackets,
            decryptedFamilyMessages: [entry, ...state.decryptedFamilyMessages],
            stats: nextStats
          };
        }

        return {
          packets: nextPackets,
          stats: nextStats
        };
      });
    });
  },

  setFamilySecret: (secret: string) => {
    const { router } = get();
    if (router && secret.trim()) {
      router.registerFamilySecret(secret);
    }
    set({ activeFamilySecret: secret });
  },

  sendSafeStatus: async (text: string, alias?: string) => {
    const { router, activeFamilySecret, nodeId } = get();
    if (!router || !activeFamilySecret) return null;

    const packet = await router.broadcastSafe(activeFamilySecret, text, alias || nodeId);
    // Add to local decrypted feed directly
    const entry: DecryptedSafeEntry = {
      msgId: packet.msg_id,
      senderAlias: alias || nodeId,
      plaintext: text,
      timestamp: packet.timestamp,
      hopCount: 0
    };

    set((state) => ({
      packets: [packet, ...state.packets],
      decryptedFamilyMessages: [entry, ...state.decryptedFamilyMessages]
    }));

    return packet;
  },

  sendSosBeacon: async (category: SosCategory, lat: number, lon: number, notes?: string) => {
    const { router } = get();
    if (!router) return null;

    const packet = await router.broadcastSos(category, lat, lon, notes);
    set((state) => ({
      packets: [packet, ...state.packets]
    }));
    return packet;
  },

  sendHazardAlert: async (type: HazardType, lat: number, lon: number, desc: string) => {
    const { router } = get();
    if (!router) return null;

    const packet = await router.broadcastHazard(type, lat, lon, desc);
    set((state) => ({
      packets: [packet, ...state.packets]
    }));
    return packet;
  },

  updatePeers: (peers: PeerNode[]) => {
    set({ connectedPeers: peers });
  },

  clearHistory: () => {
    set({
      packets: [],
      decryptedFamilyMessages: [],
      stats: { totalReceived: 0, relayedCount: 0, droppedDuplicates: 0 }
    });
  }
}));
