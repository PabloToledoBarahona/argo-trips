import { RedisService } from '../../../shared/redis/redis.service.js';
export interface Timer {
    tripId: string;
    type: 'no_show' | 'offer_expiration' | 'pickup_timeout';
    expiresAt: Date;
}
export declare class TimerService {
    private readonly redisService;
    constructor(redisService: RedisService);
    setTimer(timer: Timer): Promise<void>;
    getTimer(tripId: string, type: Timer['type']): Promise<Timer | null>;
    cancelTimer(tripId: string, type: Timer['type']): Promise<void>;
    hasExpired(tripId: string, type: Timer['type']): Promise<boolean>;
}
