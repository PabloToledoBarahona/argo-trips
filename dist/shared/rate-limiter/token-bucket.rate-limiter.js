"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var TokenBucketRateLimiter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenBucketRateLimiter = void 0;
const common_1 = require("@nestjs/common");
let TokenBucketRateLimiter = TokenBucketRateLimiter_1 = class TokenBucketRateLimiter {
    logger = new common_1.Logger(TokenBucketRateLimiter_1.name);
    buckets = new Map();
    createBucket(key, tokensPerSecond, capacity) {
        this.buckets.set(key, {
            tokens: capacity,
            capacity,
            refillRate: tokensPerSecond,
            lastRefill: Date.now(),
        });
        this.logger.log(`Rate limiter bucket created: ${key} (${tokensPerSecond} tokens/sec, capacity: ${capacity})`);
    }
    async acquire(key, tokens = 1) {
        const bucket = this.buckets.get(key);
        if (!bucket) {
            throw new Error(`Rate limiter bucket not found: ${key}`);
        }
        if (tokens > bucket.capacity) {
            throw new Error(`Cannot acquire ${tokens} tokens from bucket ${key} with capacity ${bucket.capacity}. ` +
                `Requested tokens must not exceed bucket capacity.`);
        }
        this.refillBucket(bucket);
        if (bucket.tokens >= tokens) {
            bucket.tokens -= tokens;
            return;
        }
        const tokensNeeded = tokens - bucket.tokens;
        const waitMs = (tokensNeeded / bucket.refillRate) * 1000;
        this.logger.debug(`Rate limit reached for ${key}. Waiting ${waitMs.toFixed(0)}ms for ${tokensNeeded} tokens`);
        await this.sleep(waitMs);
        this.refillBucket(bucket);
        bucket.tokens = Math.max(0, bucket.tokens - tokens);
    }
    tryAcquire(key, tokens = 1) {
        const bucket = this.buckets.get(key);
        if (!bucket) {
            throw new Error(`Rate limiter bucket not found: ${key}`);
        }
        if (tokens > bucket.capacity) {
            throw new Error(`Cannot acquire ${tokens} tokens from bucket ${key} with capacity ${bucket.capacity}. ` +
                `Requested tokens must not exceed bucket capacity.`);
        }
        this.refillBucket(bucket);
        if (bucket.tokens >= tokens) {
            bucket.tokens -= tokens;
            return true;
        }
        return false;
    }
    getAvailableTokens(key) {
        const bucket = this.buckets.get(key);
        if (!bucket) {
            throw new Error(`Rate limiter bucket not found: ${key}`);
        }
        this.refillBucket(bucket);
        return bucket.tokens;
    }
    reset(key) {
        const bucket = this.buckets.get(key);
        if (!bucket) {
            throw new Error(`Rate limiter bucket not found: ${key}`);
        }
        bucket.tokens = bucket.capacity;
        bucket.lastRefill = Date.now();
        this.logger.debug(`Rate limiter bucket reset: ${key}`);
    }
    refillBucket(bucket) {
        const now = Date.now();
        const elapsedSeconds = (now - bucket.lastRefill) / 1000;
        const tokensToAdd = elapsedSeconds * bucket.refillRate;
        bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd);
        bucket.lastRefill = now;
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
};
exports.TokenBucketRateLimiter = TokenBucketRateLimiter;
exports.TokenBucketRateLimiter = TokenBucketRateLimiter = TokenBucketRateLimiter_1 = __decorate([
    (0, common_1.Injectable)()
], TokenBucketRateLimiter);
//# sourceMappingURL=token-bucket.rate-limiter.js.map