import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../shared/redis/redis.service.js';

export interface Timer {
  tripId: string;
  type: 'no_show' | 'offer_expiration' | 'pickup_timeout';
  expiresAt: Date;
}

@Injectable()
export class TimerService {
  constructor(private readonly redisService: RedisService) {}

  async setTimer(timer: Timer): Promise<void> {
    const key = `trip:timer:${timer.type}:${timer.tripId}`;
    const ttl = Math.floor(
      (timer.expiresAt.getTime() - Date.now()) / 1000,
    );
    await this.redisService.setJson(key, timer, ttl);
  }

  async getTimer(
    tripId: string,
    type: Timer['type'],
  ): Promise<Timer | null> {
    const key = `trip:timer:${type}:${tripId}`;
    return await this.redisService.getJson<Timer>(key);
  }

  async cancelTimer(tripId: string, type: Timer['type']): Promise<void> {
    const key = `trip:timer:${type}:${tripId}`;
    await this.redisService.del(key);
  }

  async hasExpired(tripId: string, type: Timer['type']): Promise<boolean> {
    const timer = await this.getTimer(tripId, type);
    if (!timer) return false;
    return new Date() > new Date(timer.expiresAt);
  }
}
