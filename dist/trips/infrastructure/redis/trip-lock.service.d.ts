import { RedisService } from '../../../shared/redis/redis.service.js';
export declare class TripLockService {
    private readonly redisService;
    private readonly LOCK_TTL;
    constructor(redisService: RedisService);
    acquireLock(tripId: string): Promise<boolean>;
    releaseLock(tripId: string): Promise<void>;
    withLock<T>(tripId: string, callback: () => Promise<T>): Promise<T | null>;
}
