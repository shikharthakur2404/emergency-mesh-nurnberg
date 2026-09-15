/**
 * Emergency Mesh Nürnberg — Token Bucket Anti-Spam Rate Limiter
 * Enforces per-node transmission rate bounds on public unencrypted emergency broadcasts.
 * Prevents continuous packet saturation from a single compromised or malicious node.
 */

export class LeakyBucketRateLimiter {
  private buckets: Map<string, { tokens: number; lastUpdated: number }> = new Map();
  private readonly maxBurst: number;
  private readonly refillIntervalSeconds: number;

  /**
   * @param maxBurst Maximum burst allowance (default: 2 packets)
   * @param refillIntervalSeconds Seconds required to restore 1 token (default: 60s)
   */
  constructor(maxBurst = 2, refillIntervalSeconds = 60) {
    this.maxBurst = maxBurst;
    this.refillIntervalSeconds = refillIntervalSeconds;
  }

  /**
   * Attempts to consume 1 token for the specified sender ID.
   * Returns true if allowed, false if rate limit exceeded.
   */
  public tryAcquire(senderId: string, now = Date.now() / 1000): boolean {
    const bucket = this.buckets.get(senderId) || {
      tokens: this.maxBurst,
      lastUpdated: now,
    };

    // Calculate token refill over elapsed time
    const elapsed = Math.max(0, now - bucket.lastUpdated);
    const refilledTokens = elapsed / this.refillIntervalSeconds;
    bucket.tokens = Math.min(this.maxBurst, bucket.tokens + refilledTokens);
    bucket.lastUpdated = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      this.buckets.set(senderId, bucket);
      return true;
    }

    this.buckets.set(senderId, bucket);
    return false;
  }

  public getRemainingTokens(senderId: string, now = Date.now() / 1000): number {
    const bucket = this.buckets.get(senderId);
    if (!bucket) return this.maxBurst;
    const elapsed = Math.max(0, now - bucket.lastUpdated);
    return Math.min(this.maxBurst, bucket.tokens + elapsed / this.refillIntervalSeconds);
  }

  public reset(): void {
    this.buckets.clear();
  }
}
