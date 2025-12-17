export declare class TokenBucketRateLimiter {
    private readonly logger;
    private readonly buckets;
    createBucket(key: string, tokensPerSecond: number, capacity: number): void;
    acquire(key: string, tokens?: number): Promise<void>;
    tryAcquire(key: string, tokens?: number): boolean;
    getAvailableTokens(key: string): number;
    reset(key: string): void;
    private refillBucket;
    private sleep;
}
