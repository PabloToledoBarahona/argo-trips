import { RedisService } from '../../../shared/redis/redis.service.js';
export declare class PinCacheService {
    private readonly redisService;
    private readonly PIN_TTL;
    constructor(redisService: RedisService);
    storePin(tripId: string, pin: string): Promise<void>;
    getPin(tripId: string): Promise<string | null>;
    verifyPin(tripId: string, pin: string): Promise<boolean>;
    deletePin(tripId: string): Promise<void>;
    generatePin(): string;
}
