import { Module } from '@nestjs/common';
import { TokenBucketRateLimiter } from './token-bucket.rate-limiter.js';

@Module({
  providers: [TokenBucketRateLimiter],
  exports: [TokenBucketRateLimiter],
})
export class RateLimiterModule {}
