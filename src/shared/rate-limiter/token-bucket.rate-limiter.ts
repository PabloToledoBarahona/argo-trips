import { Injectable, Logger } from '@nestjs/common';

/**
 * Token Bucket Rate Limiter
 *
 * Implementation of the Token Bucket algorithm for client-side rate limiting.
 * Each bucket refills at a constant rate and can burst up to capacity.
 *
 * Features:
 * - Thread-safe token consumption
 * - Automatic token refill
 * - Configurable capacity and refill rate
 * - Zero external dependencies
 *
 * @example
 * const limiter = new TokenBucketRateLimiter(50, 50); // 50 tokens/sec, capacity 50
 * await limiter.acquire('geo-eta'); // Waits if no tokens available
 */
@Injectable()
export class TokenBucketRateLimiter {
  private readonly logger = new Logger(TokenBucketRateLimiter.name);
  private readonly buckets = new Map<
    string,
    {
      tokens: number;
      capacity: number;
      refillRate: number;
      lastRefill: number;
    }
  >();

  /**
   * Create a rate limiter bucket
   *
   * @param key - Unique identifier for this bucket
   * @param tokensPerSecond - Rate at which tokens are added
   * @param capacity - Maximum tokens the bucket can hold
   */
  createBucket(key: string, tokensPerSecond: number, capacity: number): void {
    this.buckets.set(key, {
      tokens: capacity,
      capacity,
      refillRate: tokensPerSecond,
      lastRefill: Date.now(),
    });

    this.logger.log(
      `Rate limiter bucket created: ${key} (${tokensPerSecond} tokens/sec, capacity: ${capacity})`,
    );
  }

  /**
   * Acquire a token from the bucket
   *
   * Waits until a token is available if the bucket is empty.
   * Returns immediately if a token is available.
   *
   * @param key - Bucket identifier
   * @param tokens - Number of tokens to acquire (default: 1)
   * @returns Promise that resolves when tokens are acquired
   */
  async acquire(key: string, tokens: number = 1): Promise<void> {
    const bucket = this.buckets.get(key);

    if (!bucket) {
      throw new Error(`Rate limiter bucket not found: ${key}`);
    }

    // Validate tokens requested doesn't exceed bucket capacity
    if (tokens > bucket.capacity) {
      throw new Error(
        `Cannot acquire ${tokens} tokens from bucket ${key} with capacity ${bucket.capacity}. ` +
          `Requested tokens must not exceed bucket capacity.`,
      );
    }

    // Refill tokens based on elapsed time
    this.refillBucket(bucket);

    // If enough tokens, consume immediately
    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens;
      return;
    }

    // Calculate wait time for token refill
    const tokensNeeded = tokens - bucket.tokens;
    const waitMs = (tokensNeeded / bucket.refillRate) * 1000;

    this.logger.debug(
      `Rate limit reached for ${key}. Waiting ${waitMs.toFixed(0)}ms for ${tokensNeeded} tokens`,
    );

    // Wait for tokens to refill
    await this.sleep(waitMs);

    // Refill and consume
    this.refillBucket(bucket);
    bucket.tokens = Math.max(0, bucket.tokens - tokens);
  }

  /**
   * Try to acquire tokens without waiting
   *
   * @param key - Bucket identifier
   * @param tokens - Number of tokens to acquire (default: 1)
   * @returns true if tokens were acquired, false otherwise
   */
  tryAcquire(key: string, tokens: number = 1): boolean {
    const bucket = this.buckets.get(key);

    if (!bucket) {
      throw new Error(`Rate limiter bucket not found: ${key}`);
    }

    // Validate tokens requested doesn't exceed bucket capacity
    if (tokens > bucket.capacity) {
      throw new Error(
        `Cannot acquire ${tokens} tokens from bucket ${key} with capacity ${bucket.capacity}. ` +
          `Requested tokens must not exceed bucket capacity.`,
      );
    }

    this.refillBucket(bucket);

    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens;
      return true;
    }

    return false;
  }

  /**
   * Get current token count
   *
   * @param key - Bucket identifier
   * @returns Current number of available tokens
   */
  getAvailableTokens(key: string): number {
    const bucket = this.buckets.get(key);

    if (!bucket) {
      throw new Error(`Rate limiter bucket not found: ${key}`);
    }

    this.refillBucket(bucket);
    return bucket.tokens;
  }

  /**
   * Reset bucket to full capacity
   *
   * @param key - Bucket identifier
   */
  reset(key: string): void {
    const bucket = this.buckets.get(key);

    if (!bucket) {
      throw new Error(`Rate limiter bucket not found: ${key}`);
    }

    bucket.tokens = bucket.capacity;
    bucket.lastRefill = Date.now();

    this.logger.debug(`Rate limiter bucket reset: ${key}`);
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refillBucket(bucket: {
    tokens: number;
    capacity: number;
    refillRate: number;
    lastRefill: number;
  }): void {
    const now = Date.now();
    const elapsedSeconds = (now - bucket.lastRefill) / 1000;
    const tokensToAdd = elapsedSeconds * bucket.refillRate;

    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
