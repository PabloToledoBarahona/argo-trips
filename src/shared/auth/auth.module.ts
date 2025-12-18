import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { JwtPayloadMiddleware } from './middleware/jwt-payload.middleware.js';
import { ServiceTokenService } from './services/service-token.service.js';

@Module({
  providers: [ServiceTokenService],
  exports: [ServiceTokenService],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(JwtPayloadMiddleware)
      .exclude(
        // Health check endpoints - public, no authentication required
        { path: 'health', method: RequestMethod.GET },
        { path: 'healthz', method: RequestMethod.GET },
      )
      .forRoutes('*');
  }
}
