import { RedisService } from '../redis/redis.service.js';
export declare class IdempotencyService {
    private readonly redisService;
    private readonly IDEMPOTENCY_TTL;
    constructor(redisService: RedisService);
    getIdempotentResponse<T>(key: string): Promise<T | null>;
    setIdempotentResponse(key: string, response: any): Promise<void>;
    isProcessed(key: string): Promise<boolean>;
}
