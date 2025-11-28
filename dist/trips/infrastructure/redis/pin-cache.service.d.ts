import { RedisService } from '../../../shared/redis/redis.service.js';
export declare class PinCacheService {
    private readonly redisService;
    private readonly logger;
    private readonly MAX_ATTEMPTS;
    private readonly BLOCK_TTL;
    private readonly HASH_ITERATIONS;
    private readonly HASH_KEYLEN;
    private readonly HASH_DIGEST;
    constructor(redisService: RedisService);
    setPin(tripId: string, pin: string, ttlSeconds: number): Promise<void>;
    validatePin(tripId: string, pin: string): Promise<boolean>;
    isBlocked(tripId: string): Promise<boolean>;
    clearPin(tripId: string): Promise<void>;
    private getAttempts;
    private incrementAttempts;
    private clearAttempts;
    private blockTrip;
}
