import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { LRUCache } from './lru-cache.js';

/**
 * H3 Cache Service
 *
 * Specialized cache for H3 geospatial index conversions.
 * H3 indexes are immutable for given coordinates, making them perfect for caching.
 *
 * Benefits:
 * - Reduces GEO service calls by ~90% for repeated coordinates
 * - O(1) lookup performance
 * - Automatic LRU eviction (keeps most frequently used)
 * - Memory efficient (10k entries ~2MB)
 *
 * Cache keys format: "lat,lng,res" (e.g., "-17.78345,-63.18117,9")
 */
@Injectable()
export class H3CacheService implements OnModuleInit {
  private readonly logger = new Logger(H3CacheService.name);
  private readonly cache = new LRUCache<string>(10000, 'h3-cache');
  private readonly CLEANUP_INTERVAL_MS = 300000; // 5 minutes
  private cleanupTimer?: NodeJS.Timeout;

  onModuleInit(): void {
    // Start periodic cleanup of expired entries
    this.cleanupTimer = setInterval(() => {
      this.cache.cleanup();
    }, this.CLEANUP_INTERVAL_MS);

    this.logger.log('H3 cache service initialized with periodic cleanup');
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }

  /**
   * Get H3 index from cache
   *
   * @param lat - Latitude
   * @param lng - Longitude
   * @param res - H3 resolution
   * @returns Cached H3 index or undefined
   */
  get(lat: number, lng: number, res: number): string | undefined {
    const key = this.buildKey(lat, lng, res);
    const value = this.cache.get(key);

    if (value) {
      this.logger.debug(`H3 cache HIT: (${lat},${lng}) res=${res} → ${value}`);
    }

    return value;
  }

  /**
   * Store H3 index in cache
   *
   * H3 indexes are immutable, so no TTL is needed.
   *
   * @param lat - Latitude
   * @param lng - Longitude
   * @param res - H3 resolution
   * @param h3Index - H3 index to cache
   */
  set(lat: number, lng: number, res: number, h3Index: string): void {
    const key = this.buildKey(lat, lng, res);
    this.cache.set(key, h3Index); // No TTL - immutable data

    this.logger.debug(`H3 cache SET: (${lat},${lng}) res=${res} → ${h3Index}`);
  }

  /**
   * Get multiple H3 indexes from cache
   *
   * @param coordinates - Array of [lat, lng, res] tuples
   * @returns Map of keys to H3 indexes (only for cache hits)
   */
  getMany(
    coordinates: Array<{ lat: number; lng: number; res: number }>,
  ): Map<string, string> {
    const results = new Map<string, string>();

    for (const coord of coordinates) {
      const key = this.buildKey(coord.lat, coord.lng, coord.res);
      const value = this.cache.get(key);

      if (value) {
        results.set(key, value);
      }
    }

    return results;
  }

  /**
   * Store multiple H3 indexes in cache
   *
   * @param entries - Array of [lat, lng, res, h3Index] tuples
   */
  setMany(
    entries: Array<{ lat: number; lng: number; res: number; h3Index: string }>,
  ): void {
    for (const entry of entries) {
      this.set(entry.lat, entry.lng, entry.res, entry.h3Index);
    }
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
    return this.cache.getStats();
  }

  /**
   * Clear all cached H3 indexes
   */
  clear(): void {
    this.cache.clear();
    this.logger.log('H3 cache cleared');
  }

  /**
   * Build cache key from coordinates
   */
  private buildKey(lat: number, lng: number, res: number): string {
    // Round to 6 decimal places (~0.1m precision) to improve cache hits
    const roundedLat = Math.round(lat * 1000000) / 1000000;
    const roundedLng = Math.round(lng * 1000000) / 1000000;
    return `${roundedLat},${roundedLng},${res}`;
  }
}
