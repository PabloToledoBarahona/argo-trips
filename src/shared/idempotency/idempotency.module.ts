import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module.js';
import { IdempotencyService } from './idempotency.service.js';
import { IdempotencyInterceptor } from './idempotency.interceptor.js';

@Module({
  imports: [RedisModule],
  providers: [IdempotencyService, IdempotencyInterceptor],
  exports: [IdempotencyService, IdempotencyInterceptor],
})
export class IdempotencyModule {}
