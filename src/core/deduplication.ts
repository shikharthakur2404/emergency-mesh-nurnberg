/**
 * Emergency Mesh Nürnberg — Seen-Message Deduplication Engine
 * Fast LRU seen-packet cache to prevent circular rebroadcasts and network flooding.
 */

export class DeduplicationCache {
  private capacity: number;
  private seenMap: Map<string, number>; // msg_id -> timestamp seen

  constructor(capacity = 500) {
    this.capacity = capacity;
    this.seenMap = new Map();
  }

  /**
   * Returns true if message ID was already processed or originated locally.
   */
  public hasSeen(msgId: string): boolean {
    return this.seenMap.has(msgId);
  }

  /**
   * Records that this message ID was seen.
   * Evicts oldest entries if capacity is reached.
   */
  public recordSeen(msgId: string): void {
    if (this.seenMap.has(msgId)) {
      // Refresh order
      this.seenMap.delete(msgId);
    } else if (this.seenMap.size >= this.capacity) {
      // Evict oldest (first key in map iterator)
      const oldestKey = this.seenMap.keys().next().value;
      if (oldestKey) {
        this.seenMap.delete(oldestKey);
      }
    }
    this.seenMap.set(msgId, Date.now());
  }

  /**
   * Current number of recorded message IDs.
   */
  public get size(): number {
    return this.seenMap.size;
  }

  /**
   * Clears the deduplication table.
   */
  public clear(): void {
    this.seenMap.clear();
  }

  /**
   * Export seen list for persistent storage (e.g. MMKV)
   */
  public exportSnapshot(): string[] {
    return Array.from(this.seenMap.keys());
  }

  /**
   * Hydrate cache from stored array.
   */
  public hydrate(ids: string[]): void {
    for (const id of ids) {
      this.recordSeen(id);
    }
  }
}
