import { Module } from '@nestjs/common';
import { HttpModule } from './http/http.module.js';
import { RedisModule } from './redis/redis.module.js';
import { LoggerModule } from './logger/logger.module.js';
import { AuthModule } from './auth/auth.module.js';
import { IdempotencyModule } from './idempotency/idempotency.module.js';

@Module({
  imports: [HttpModule, RedisModule, LoggerModule, AuthModule, IdempotencyModule],
  exports: [HttpModule, RedisModule, LoggerModule, AuthModule, IdempotencyModule],
})
export class SharedModule {}
