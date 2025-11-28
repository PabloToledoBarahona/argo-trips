import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../shared/redis/redis.service.js';
import { createHash, randomBytes, pbkdf2Sync } from 'crypto';

/**
 * PinCacheService
 *
 * Manages PIN verification for trips stored in Redis.
 *
 * Responsibilities:
 * - Store hashed PIN with expiration
 * - Validate PIN with attempt tracking
 * - Block after MAX_ATTEMPTS failed validations
 * - Clear PIN data when no longer needed
 *
 * Keys used:
 * - trip:{id}:pin - Stores PBKDF2 hash of PIN with salt
 * - trip:{id}:pin:attempts - Tracks failed validation attempts
 * - trip:{id}:pin:blocked - Indicates if PIN validation is blocked
 *
 * Security:
 * - PINs are hashed with PBKDF2 (100,000 iterations) before storage
 * - Random salt per PIN for additional security
 * - No PIN values are logged, only metadata
 * - Automatic blocking after failed attempts
 */
@Injectable()
export class PinCacheService {
  private readonly logger = new Logger(PinCacheService.name);

  // Maximum failed attempts before blocking
  private readonly MAX_ATTEMPTS = 3;

  // Block duration after MAX_ATTEMPTS (15 minutes)
  private readonly BLOCK_TTL = 900;

  // PBKDF2 iterations for PIN hashing
  private readonly HASH_ITERATIONS = 100000;
  private readonly HASH_KEYLEN = 64;
  private readonly HASH_DIGEST = 'sha512';

  constructor(private readonly redisService: RedisService) {}

  /**
   * Store a PIN for a trip with expiration
   *
   * The PIN is hashed with PBKDF2 before storage for security.
   * Any existing PIN data (attempts, blocked status) is cleared.
   *
   * @param tripId - Trip identifier
   * @param pin - Plain text PIN to store
   * @param ttlSeconds - Time-to-live in seconds
   */
  async setPin(tripId: string, pin: string, ttlSeconds: number): Promise<void> {
    try {
      const pinKey = `trip:${tripId}:pin`;

      // Generate random salt
      const salt = randomBytes(16).toString('hex');

      // Hash PIN with PBKDF2
      const hash = pbkdf2Sync(
        pin,
        salt,
        this.HASH_ITERATIONS,
        this.HASH_KEYLEN,
        this.HASH_DIGEST,
      ).toString('hex');

      // Store salt:hash format
      const storedValue = `${salt}:${hash}`;
      await this.redisService.set(pinKey, storedValue, ttlSeconds);

      // Clear any existing attempts and blocked status
      await this.clearAttempts(tripId);

      this.logger.debug(`PIN set for trip: ${tripId}, TTL: ${ttlSeconds}s`);
    } catch (error) {
      this.logger.error(`Failed to set PIN for trip ${tripId}`, error);
      throw error;
    }
  }

  /**
   * Validate a PIN for a trip
   *
   * Checks if the trip is blocked before validation.
   * Compares provided PIN against stored hash using PBKDF2.
   * Increments failed attempts counter on mismatch.
   * Blocks trip after MAX_ATTEMPTS failed validations.
   *
   * @param tripId - Trip identifier
   * @param pin - Plain text PIN to validate
   * @returns true if PIN matches and not blocked, false otherwise
   */
  async validatePin(tripId: string, pin: string): Promise<boolean> {
    try {
      // Check if blocked first
      const blocked = await this.isBlocked(tripId);
      if (blocked) {
        this.logger.warn(`PIN validation blocked for trip: ${tripId}`);
        return false;
      }

      const pinKey = `trip:${tripId}:pin`;
      const storedValue = await this.redisService.get(pinKey);

      if (!storedValue) {
        this.logger.warn(`No PIN found for trip: ${tripId}`);
        return false;
      }

      // Extract salt and hash from stored value
      const [salt, storedHash] = storedValue.split(':');
      if (!salt || !storedHash) {
        this.logger.error(`Invalid PIN format for trip: ${tripId}`);
        return false;
      }

      // Hash provided PIN with stored salt
      const hash = pbkdf2Sync(
        pin,
        salt,
        this.HASH_ITERATIONS,
        this.HASH_KEYLEN,
        this.HASH_DIGEST,
      ).toString('hex');

      // Compare hashes (constant-time comparison would be ideal, but simple comparison is acceptable)
      const isValid = hash === storedHash;

      if (isValid) {
        // Valid PIN - clear attempts
        await this.clearAttempts(tripId);
        this.logger.debug(`PIN validated successfully for trip: ${tripId}`);
        return true;
      } else {
        // Invalid PIN - increment attempts
        await this.incrementAttempts(tripId);
        const attempts = await this.getAttempts(tripId);

        this.logger.warn(`Invalid PIN for trip: ${tripId}, attempts: ${attempts}/${this.MAX_ATTEMPTS}`);

        // Block if max attempts reached
        if (attempts >= this.MAX_ATTEMPTS) {
          await this.blockTrip(tripId);
          this.logger.warn(`Trip blocked due to max PIN attempts: ${tripId}`);
        }

        return false;
      }
    } catch (error) {
      this.logger.error(`Failed to validate PIN for trip ${tripId}`, error);
      return false;
    }
  }

  /**
   * Check if PIN validation is blocked for a trip
   *
   * @param tripId - Trip identifier
   * @returns true if blocked, false otherwise
   */
  async isBlocked(tripId: string): Promise<boolean> {
    try {
      const blockedKey = `trip:${tripId}:pin:blocked`;
      const blocked = await this.redisService.get(blockedKey);
      return blocked === 'true';
    } catch (error) {
      this.logger.error(`Failed to check if trip ${tripId} is blocked`, error);
      return false;
    }
  }

  /**
   * Clear all PIN data for a trip
   *
   * Removes PIN hash, attempts counter, and blocked status.
   *
   * @param tripId - Trip identifier
   */
  async clearPin(tripId: string): Promise<void> {
    try {
      const pinKey = `trip:${tripId}:pin`;
      const attemptsKey = `trip:${tripId}:pin:attempts`;
      const blockedKey = `trip:${tripId}:pin:blocked`;

      await Promise.all([
        this.redisService.del(pinKey),
        this.redisService.del(attemptsKey),
        this.redisService.del(blockedKey),
      ]);

      this.logger.debug(`PIN data cleared for trip: ${tripId}`);
    } catch (error) {
      this.logger.error(`Failed to clear PIN for trip ${tripId}`, error);
      throw error;
    }
  }

  /**
   * Get current failed attempts count
   *
   * @param tripId - Trip identifier
   * @returns Number of failed attempts
   */
  private async getAttempts(tripId: string): Promise<number> {
    const attemptsKey = `trip:${tripId}:pin:attempts`;
    const attempts = await this.redisService.get(attemptsKey);
    return attempts ? parseInt(attempts, 10) : 0;
  }

  /**
   * Increment failed attempts counter
   *
   * @param tripId - Trip identifier
   */
  private async incrementAttempts(tripId: string): Promise<void> {
    const attemptsKey = `trip:${tripId}:pin:attempts`;
    const currentAttempts = await this.getAttempts(tripId);
    const newAttempts = currentAttempts + 1;

    // Set with TTL to auto-expire
    await this.redisService.set(attemptsKey, newAttempts.toString(), this.BLOCK_TTL);
  }

  /**
   * Clear failed attempts counter
   *
   * @param tripId - Trip identifier
   */
  private async clearAttempts(tripId: string): Promise<void> {
    const attemptsKey = `trip:${tripId}:pin:attempts`;
    const blockedKey = `trip:${tripId}:pin:blocked`;

    await Promise.all([
      this.redisService.del(attemptsKey),
      this.redisService.del(blockedKey),
    ]);
  }

  /**
   * Block PIN validation for a trip
   *
   * @param tripId - Trip identifier
   */
  private async blockTrip(tripId: string): Promise<void> {
    const blockedKey = `trip:${tripId}:pin:blocked`;
    await this.redisService.set(blockedKey, 'true', this.BLOCK_TTL);
  }
}
