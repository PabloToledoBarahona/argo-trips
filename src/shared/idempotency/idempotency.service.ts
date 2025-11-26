import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service.js';

@Injectable()
export class IdempotencyService {
  private readonly IDEMPOTENCY_TTL = 86400; // 24 hours

  constructor(private readonly redisService: RedisService) {}

  async getIdempotentResponse<T>(key: string): Promise<T | null> {
    return await this.redisService.getJson<T>(`idempotency:${key}`);
  }

  async setIdempotentResponse(key: string, response: any): Promise<void> {
    await this.redisService.setJson(
      `idempotency:${key}`,
      response,
      this.IDEMPOTENCY_TTL,
    );
  }

  async isProcessed(key: string): Promise<boolean> {
    return await this.redisService.exists(`idempotency:${key}`);
  }
}
