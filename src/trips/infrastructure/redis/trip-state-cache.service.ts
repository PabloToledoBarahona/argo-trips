import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../shared/redis/redis.service.js';
import { Trip } from '../../domain/entities/trip.entity.js';

@Injectable()
export class TripStateCacheService {
  private readonly CACHE_TTL = 3600; // 1 hour

  constructor(private readonly redisService: RedisService) {}

  async cacheTrip(trip: Trip): Promise<void> {
    const key = `trip:state:${trip.id}`;
    await this.redisService.setJson(key, trip, this.CACHE_TTL);
  }

  async getTrip(tripId: string): Promise<Trip | null> {
    const key = `trip:state:${tripId}`;
    return await this.redisService.getJson<Trip>(key);
  }

  async invalidateTrip(tripId: string): Promise<void> {
    const key = `trip:state:${tripId}`;
    await this.redisService.del(key);
  }
}
