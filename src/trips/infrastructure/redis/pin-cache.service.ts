import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../shared/redis/redis.service.js';

@Injectable()
export class PinCacheService {
  private readonly PIN_TTL = 900; // 15 minutes

  constructor(private readonly redisService: RedisService) {}

  async storePin(tripId: string, pin: string): Promise<void> {
    const key = `trip:pin:${tripId}`;
    await this.redisService.set(key, pin, this.PIN_TTL);
  }

  async getPin(tripId: string): Promise<string | null> {
    const key = `trip:pin:${tripId}`;
    return await this.redisService.get(key);
  }

  async verifyPin(tripId: string, pin: string): Promise<boolean> {
    const storedPin = await this.getPin(tripId);
    return storedPin === pin;
  }

  async deletePin(tripId: string): Promise<void> {
    const key = `trip:pin:${tripId}`;
    await this.redisService.del(key);
  }

  generatePin(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }
}
