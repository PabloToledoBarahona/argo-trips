import { Module } from '@nestjs/common';
import { HttpModule as NestHttpModule } from '@nestjs/axios';
import { HttpService } from './http.service.js';

@Module({
  imports: [NestHttpModule],
  providers: [HttpService],
  exports: [HttpService],
})
export class HttpModule {}
