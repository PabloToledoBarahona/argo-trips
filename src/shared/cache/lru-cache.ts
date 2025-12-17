import { Injectable, Logger } from '@nestjs/common';

/**
 * LRU (Least Recently Used) Cache
 *
 * Thread-safe in-memory cache with automatic eviction of least recently used items.
 * Perfect for caching immutable data like H3 coordinate conversions.
 *
 * Features:
 * - O(1) get and set operations
 * - Automatic eviction when capacity reached
 * - Optional TTL (time-to-live) for entries
 * - Cache statistics (hits, misses, size)
 *
 * @example
 * const cache = new LRUCache<string>(1000); // Max 1000 entries
 * cache.set('key', 'value', 3600000); // Cache for 1 hour
 * const value = cache.get('key');
 */
@Injectable()
export class LRUCache<T> {
  private readonly logger = new Logger(LRUCache.name);
  private readonly cache = new Map<
    string,
    {
      value: T;
      expiry?: number;
    }
  >();
  private hits = 0;
  private misses = 0;

  constructor(
    private readonly maxSize: number = 10000,
    private readonly name: string = 'default',
  ) {
    this.logger.log(`LRU cache initialized: ${name} (max size: ${maxSize})`);
  }

  /**
   * Get value from cache
   *
   * @param key - Cache key
   * @returns Cached value or undefined if not found/expired
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return undefined;
    }

    // Check if expired
    if (entry.expiry && Date.now() > entry.expiry) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    this.hits++;

    return entry.value;
  }

  /**
   * Set value in cache
   *
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttlMs - Optional TTL in milliseconds
   */
  set(key: string, value: T, ttlMs?: number): void {
    // Remove if already exists (to update position)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
        this.logger.debug(`LRU cache ${this.name}: Evicted oldest entry (${firstKey})`);
      }
    }

    const expiry = ttlMs ? Date.now() + ttlMs : undefined;
    this.cache.set(key, { value, expiry });
  }

  /**
   * Check if key exists in cache
   *
   * @param key - Cache key
   * @returns true if key exists and not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check if expired
    if (entry.expiry && Date.now() > entry.expiry) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete key from cache
   *
   * @param key - Cache key
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.logger.log(`LRU cache ${this.name}: Cleared`);
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hits: number;
    misses: number;
    hitRate: number;
  } {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? this.hits / total : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate,
    };
  }

  /**
   * Remove expired entries
   *
   * Should be called periodically to free memory.
   */
  cleanup(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiry && now > entry.expiry) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      this.logger.debug(`LRU cache ${this.name}: Cleaned up ${removed} expired entries`);
    }
  }

  /**
   * Get current cache size
   */
  size(): number {
    return this.cache.size;
  }
}
