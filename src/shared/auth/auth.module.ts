import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { JwtPayloadMiddleware } from './middleware/jwt-payload.middleware.js';

@Module({})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(JwtPayloadMiddleware).forRoutes('*');
  }
}
