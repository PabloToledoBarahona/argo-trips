import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../shared/redis/redis.service.js';

@Injectable()
export class TripLockService {
  private readonly LOCK_TTL = 30; // 30 seconds

  constructor(private readonly redisService: RedisService) {}

  async acquireLock(tripId: string): Promise<boolean> {
    const lockKey = `trip:lock:${tripId}`;
    return await this.redisService.setNx(lockKey, 'locked', this.LOCK_TTL);
  }

  async releaseLock(tripId: string): Promise<void> {
    const lockKey = `trip:lock:${tripId}`;
    await this.redisService.del(lockKey);
  }

  async withLock<T>(
    tripId: string,
    callback: () => Promise<T>,
  ): Promise<T | null> {
    const acquired = await this.acquireLock(tripId);
    if (!acquired) {
      return null;
    }

    try {
      return await callback();
    } finally {
      await this.releaseLock(tripId);
    }
  }
}
