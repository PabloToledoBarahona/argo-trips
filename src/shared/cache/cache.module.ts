import { Module } from '@nestjs/common';
import { H3CacheService } from './h3-cache.service.js';

@Module({
  providers: [H3CacheService],
  exports: [H3CacheService],
})
export class CacheModule {}
