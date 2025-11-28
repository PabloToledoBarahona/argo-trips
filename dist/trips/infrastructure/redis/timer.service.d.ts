import { RedisService } from '../../../shared/redis/redis.service.js';
export declare class TimerService {
    private readonly redisService;
    private readonly logger;
    constructor(redisService: RedisService);
    setOfferExpiry(tripId: string, expirySeconds: number): Promise<void>;
    isOfferExpired(tripId: string): Promise<boolean>;
    clearOfferExpiry(tripId: string): Promise<void>;
    setRiderNoShow(tripId: string, noShowSeconds: number): Promise<void>;
    isRiderNoShow(tripId: string): Promise<boolean>;
    setDriverNoShow(tripId: string, noShowSeconds: number): Promise<void>;
    isDriverNoShow(tripId: string): Promise<boolean>;
    clearNoShow(tripId: string): Promise<void>;
}
