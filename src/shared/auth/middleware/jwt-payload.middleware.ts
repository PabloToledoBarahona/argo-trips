import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ArgoUser } from '../types/argo-user.type.js';

@Injectable()
export class JwtPayloadMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const jwtPayload = req.headers['x-jwt-payload'] as string;

    if (!jwtPayload) {
      throw new UnauthorizedException('Missing X-JWT-Payload header');
    }

    try {
      const decoded = Buffer.from(jwtPayload, 'base64').toString('utf-8');
      const payload = JSON.parse(decoded);

      if (!payload.sub || !payload.roles || !Array.isArray(payload.roles)) {
        throw new UnauthorizedException('Invalid JWT payload structure');
      }

      // Derive identityType from roles if not present
      let identityType: 'rider' | 'driver' | 'admin' = 'rider';
      if (payload.roles.includes('admin')) {
        identityType = 'admin';
      } else if (payload.roles.includes('driver')) {
        identityType = 'driver';
      } else if (payload.roles.includes('rider')) {
        identityType = 'rider';
      }

      const user: ArgoUser = {
        sub: payload.sub,
        roles: payload.roles,
        identityType: payload.identityType || identityType,
        deviceId: payload.did || payload.deviceId,
      };

      (req as any).user = user;
      next();
    } catch (error) {
      throw new UnauthorizedException('Invalid JWT payload');
    }
  }
}
