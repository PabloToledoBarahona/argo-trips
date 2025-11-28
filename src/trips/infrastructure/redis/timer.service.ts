import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../shared/redis/redis.service.js';

/**
 * TimerService
 *
 * Manages time-based validations for trip lifecycle stored in Redis.
 *
 * Responsibilities:
 * - Track offer expiration (e.g., driver has 30s to accept)
 * - Track rider no-show timeout (e.g., 5 minutes after ASSIGNED)
 * - Track driver no-show timeout (e.g., 10 minutes after PICKUP_STARTED)
 * - Provide expiration checks without external polling
 *
 * Keys used:
 * - trip:{id}:offer_expiry - Timestamp when offer expires
 * - trip:{id}:rider_ns - Timestamp when rider is considered no-show
 * - trip:{id}:driver_ns - Timestamp when driver is considered no-show
 *
 * All timestamps are stored as Unix epoch milliseconds.
 * Keys auto-expire via Redis TTL for cleanup.
 */
@Injectable()
export class TimerService {
  private readonly logger = new Logger(TimerService.name);

  constructor(private readonly redisService: RedisService) {}

  // ============================================================================
  // Offer Expiry Timer
  // ============================================================================

  /**
   * Set offer expiration timer
   *
   * Used when a trip is OFFERED to a driver. The driver must accept
   * within the specified TTL or the offer expires.
   *
   * @param tripId - Trip identifier
   * @param expirySeconds - Seconds until offer expires (e.g., 30)
   */
  async setOfferExpiry(tripId: string, expirySeconds: number): Promise<void> {
    try {
      const key = `trip:${tripId}:offer_expiry`;
      const expiresAt = Date.now() + expirySeconds * 1000;

      // Store expiration timestamp with TTL
      await this.redisService.set(key, expiresAt.toString(), expirySeconds);

      this.logger.debug(`Offer expiry set for trip: ${tripId}, expires in ${expirySeconds}s`);
    } catch (error) {
      this.logger.error(`Failed to set offer expiry for trip ${tripId}`, error);
      throw error;
    }
  }

  /**
   * Check if offer has expired
   *
   * Returns true if the offer expiration time has passed or if no timer exists.
   *
   * @param tripId - Trip identifier
   * @returns true if offer expired, false if still valid
   */
  async isOfferExpired(tripId: string): Promise<boolean> {
    try {
      const key = `trip:${tripId}:offer_expiry`;
      const expiresAtStr = await this.redisService.get(key);

      if (!expiresAtStr) {
        // No timer means expired or never set
        return true;
      }

      const expiresAt = parseInt(expiresAtStr, 10);
      const now = Date.now();

      return now >= expiresAt;
    } catch (error) {
      this.logger.error(`Failed to check offer expiry for trip ${tripId}`, error);
      // Fail safe: consider expired on error
      return true;
    }
  }

  /**
   * Clear offer expiry timer
   *
   * Called when driver accepts trip or trip is canceled.
   *
   * @param tripId - Trip identifier
   */
  async clearOfferExpiry(tripId: string): Promise<void> {
    try {
      const key = `trip:${tripId}:offer_expiry`;
      await this.redisService.del(key);

      this.logger.debug(`Offer expiry cleared for trip: ${tripId}`);
    } catch (error) {
      this.logger.error(`Failed to clear offer expiry for trip ${tripId}`, error);
      // Non-critical error - don't throw
    }
  }

  // ============================================================================
  // Rider No-Show Timer
  // ============================================================================

  /**
   * Set rider no-show timer
   *
   * Used when a trip is ASSIGNED. If rider doesn't verify PIN or show up
   * within the specified TTL, they're considered a no-show.
   *
   * @param tripId - Trip identifier
   * @param noShowSeconds - Seconds until rider is no-show (e.g., 300 = 5 minutes)
   */
  async setRiderNoShow(tripId: string, noShowSeconds: number): Promise<void> {
    try {
      const key = `trip:${tripId}:rider_ns`;
      const expiresAt = Date.now() + noShowSeconds * 1000;

      // Store expiration timestamp with TTL
      await this.redisService.set(key, expiresAt.toString(), noShowSeconds);

      this.logger.debug(`Rider no-show timer set for trip: ${tripId}, expires in ${noShowSeconds}s`);
    } catch (error) {
      this.logger.error(`Failed to set rider no-show timer for trip ${tripId}`, error);
      throw error;
    }
  }

  /**
   * Check if rider no-show timer has expired
   *
   * @param tripId - Trip identifier
   * @returns true if rider is no-show, false if still within window
   */
  async isRiderNoShow(tripId: string): Promise<boolean> {
    try {
      const key = `trip:${tripId}:rider_ns`;
      const expiresAtStr = await this.redisService.get(key);

      if (!expiresAtStr) {
        // No timer means not set or already expired
        return false;
      }

      const expiresAt = parseInt(expiresAtStr, 10);
      const now = Date.now();

      return now >= expiresAt;
    } catch (error) {
      this.logger.error(`Failed to check rider no-show for trip ${tripId}`, error);
      return false;
    }
  }

  // ============================================================================
  // Driver No-Show Timer
  // ============================================================================

  /**
   * Set driver no-show timer
   *
   * Used when driver starts pickup (PICKUP_STARTED). If driver doesn't
   * start trip within the specified TTL, they're considered a no-show.
   *
   * @param tripId - Trip identifier
   * @param noShowSeconds - Seconds until driver is no-show (e.g., 600 = 10 minutes)
   */
  async setDriverNoShow(tripId: string, noShowSeconds: number): Promise<void> {
    try {
      const key = `trip:${tripId}:driver_ns`;
      const expiresAt = Date.now() + noShowSeconds * 1000;

      // Store expiration timestamp with TTL
      await this.redisService.set(key, expiresAt.toString(), noShowSeconds);

      this.logger.debug(`Driver no-show timer set for trip: ${tripId}, expires in ${noShowSeconds}s`);
    } catch (error) {
      this.logger.error(`Failed to set driver no-show timer for trip ${tripId}`, error);
      throw error;
    }
  }

  /**
   * Check if driver no-show timer has expired
   *
   * @param tripId - Trip identifier
   * @returns true if driver is no-show, false if still within window
   */
  async isDriverNoShow(tripId: string): Promise<boolean> {
    try {
      const key = `trip:${tripId}:driver_ns`;
      const expiresAtStr = await this.redisService.get(key);

      if (!expiresAtStr) {
        // No timer means not set or already expired
        return false;
      }

      const expiresAt = parseInt(expiresAtStr, 10);
      const now = Date.now();

      return now >= expiresAt;
    } catch (error) {
      this.logger.error(`Failed to check driver no-show for trip ${tripId}`, error);
      return false;
    }
  }

  // ============================================================================
  // Clear No-Show Timers
  // ============================================================================

  /**
   * Clear all no-show timers for a trip
   *
   * Called when trip progresses normally or is canceled.
   * Clears both rider and driver no-show timers.
   *
   * @param tripId - Trip identifier
   */
  async clearNoShow(tripId: string): Promise<void> {
    try {
      const riderKey = `trip:${tripId}:rider_ns`;
      const driverKey = `trip:${tripId}:driver_ns`;

      await Promise.all([
        this.redisService.del(riderKey),
        this.redisService.del(driverKey),
      ]);

      this.logger.debug(`No-show timers cleared for trip: ${tripId}`);
    } catch (error) {
      this.logger.error(`Failed to clear no-show timers for trip ${tripId}`, error);
      // Non-critical error - don't throw
    }
  }
}
