import { RedisService } from '../../../shared/redis/redis.service.js';
import { Trip } from '../../domain/entities/trip.entity.js';
export declare class TripStateCacheService {
    private readonly redisService;
    private readonly CACHE_TTL;
    constructor(redisService: RedisService);
    cacheTrip(trip: Trip): Promise<void>;
    getTrip(tripId: string): Promise<Trip | null>;
    invalidateTrip(tripId: string): Promise<void>;
}
