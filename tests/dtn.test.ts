import { describe, it, expect, beforeEach } from 'vitest';
import { StoreAndForwardBuffer } from '../src/core/dtn/StoreAndForwardBuffer';
import { SosPacket, SafePacket, PingPacket, SyncInvItem } from '../src/core/types';

describe('Delay-Tolerant Store & Forward Buffer (DTN)', () => {
  let buffer: StoreAndForwardBuffer;

  beforeEach(() => {
    buffer = new StoreAndForwardBuffer(5); // Small cap for testing eviction
  });

  it('buffers durable packets and marks dtn_buffered = true', () => {
    const sos: SosPacket = {
      type: 'SOS',
      msg_id: 'sos_001',
      timestamp: 1000,
      ttl: 15,
      hop_count: 0,
      sender_id: 'anon_1',
      category: 'MEDICAL',
      lat: 49.45,
      lon: 11.07
    };

    const added = buffer.addPacket(sos);
    expect(added).toBe(true);
    expect(buffer.size).toBe(1);

    const retrieved = buffer.getPacket('sos_001') as SosPacket;
    expect(retrieved).toBeDefined();
    expect(retrieved.dtn_buffered).toBe(true);
    expect(retrieved.priority).toBe('CRITICAL');
  });

  it('discards ephemeral packets (PING)', () => {
    const ping: PingPacket = {
      type: 'PING',
      msg_id: 'ping_001',
      timestamp: 1000,
      ttl: 1,
      hop_count: 0,
      node_id: 'anon_1'
    };

    const added = buffer.addPacket(ping);
    expect(added).toBe(false);
    expect(buffer.size).toBe(0);
  });

  it('generates prioritized inventory vectors for epidemic synchronization', () => {
    const safe: SafePacket = {
      type: 'SAFE',
      msg_id: 'safe_001',
      timestamp: 1000,
      ttl: 10,
      hop_count: 0,
      family_id: 'fam_1',
      encrypted_payload: 'cipher',
      priority: 'HIGH'
    };

    const sos: SosPacket = {
      type: 'SOS',
      msg_id: 'sos_001',
      timestamp: 900,
      ttl: 20,
      hop_count: 0,
      sender_id: 'anon_1',
      category: 'FIRE',
      lat: 49.45,
      lon: 11.07,
      priority: 'CRITICAL'
    };

    buffer.addPacket(safe);
    buffer.addPacket(sos);

    const inv = buffer.getInventory();
    expect(inv).toHaveLength(2);
    // CRITICAL should be first even though timestamp is earlier
    expect(inv[0].msg_id).toBe('sos_001');
    expect(inv[0].priority).toBe('CRITICAL');
    expect(inv[1].msg_id).toBe('safe_001');
  });

  it('identifies missing packets when resolving deltas with remote peer inventory', () => {
    const sos1: SosPacket = {
      type: 'SOS',
      msg_id: 'sos_local',
      timestamp: 1000,
      ttl: 15,
      hop_count: 0,
      sender_id: 'anon_1',
      category: 'SUPPLIES',
      lat: 49.45,
      lon: 11.07
    };
    buffer.addPacket(sos1);

    // Remote peer has 'sos_remote' but lacks 'sos_local'
    const remoteInv: SyncInvItem[] = [
      { msg_id: 'sos_remote', timestamp: 1050, type: 'SOS', priority: 'CRITICAL' }
    ];

    const outboundDelta = buffer.getOutboundDelta(remoteInv);
    expect(outboundDelta).toHaveLength(1);
    expect(outboundDelta[0].msg_id).toBe('sos_local');

    const missingFromRemote = buffer.getMissingIds(remoteInv);
    expect(missingFromRemote).toEqual(['sos_remote']);
  });

  it('evicts lowest priority packets when capacity limit is reached', () => {
    // Capacity is 5
    for (let i = 1; i <= 5; i++) {
      buffer.addPacket({
        type: 'SAFE',
        msg_id: `safe_${i}`,
        timestamp: 1000 + i,
        ttl: 10,
        hop_count: 0,
        family_id: 'fam',
        encrypted_payload: 'c',
        priority: 'HIGH'
      });
    }
    expect(buffer.size).toBe(5);

    // Add a CRITICAL packet — should evict oldest HIGH packet (safe_1)
    buffer.addPacket({
      type: 'SOS',
      msg_id: 'sos_critical',
      timestamp: 2000,
      ttl: 20,
      hop_count: 0,
      sender_id: 'anon_1',
      category: 'MEDICAL',
      lat: 49.45,
      lon: 11.07,
      priority: 'CRITICAL'
    });

    expect(buffer.size).toBe(5);
    expect(buffer.getPacket('sos_critical')).toBeDefined();
    expect(buffer.getPacket('safe_1')).toBeUndefined(); // Evicted
  });
});
