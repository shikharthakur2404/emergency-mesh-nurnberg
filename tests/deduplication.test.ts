import { describe, it, expect } from 'vitest';
import { DeduplicationCache } from '../src/core/deduplication';

describe('Seen-Message Deduplication Engine', () => {
  it('records seen message IDs and reports true on duplicates', () => {
    const cache = new DeduplicationCache(10);
    expect(cache.hasSeen('msg-101')).toBe(false);

    cache.recordSeen('msg-101');
    expect(cache.hasSeen('msg-101')).toBe(true);
    expect(cache.size).toBe(1);
  });

  it('evicts oldest entries when bounded capacity is exceeded (LRU FIFO)', () => {
    const cache = new DeduplicationCache(3);
    cache.recordSeen('msg-1');
    cache.recordSeen('msg-2');
    cache.recordSeen('msg-3');
    expect(cache.size).toBe(3);

    // Adding 4th must evict msg-1
    cache.recordSeen('msg-4');
    expect(cache.size).toBe(3);
    expect(cache.hasSeen('msg-1')).toBe(false);
    expect(cache.hasSeen('msg-2')).toBe(true);
    expect(cache.hasSeen('msg-3')).toBe(true);
    expect(cache.hasSeen('msg-4')).toBe(true);
  });

  it('exports and rehydrates snapshots across app sessions', () => {
    const cache1 = new DeduplicationCache(10);
    cache1.recordSeen('pkt-a');
    cache1.recordSeen('pkt-b');

    const snapshot = cache1.exportSnapshot();
    expect(snapshot).toEqual(['pkt-a', 'pkt-b']);

    const cache2 = new DeduplicationCache(10);
    cache2.hydrate(snapshot);
    expect(cache2.hasSeen('pkt-a')).toBe(true);
    expect(cache2.hasSeen('pkt-b')).toBe(true);
    expect(cache2.hasSeen('pkt-c')).toBe(false);
  });
});
