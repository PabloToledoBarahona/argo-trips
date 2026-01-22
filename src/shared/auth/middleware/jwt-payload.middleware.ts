import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ArgoUser } from '../types/argo-user.type.js';

@Injectable()
export class JwtPayloadMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const jwtPayload = req.headers['x-jwt-payload'] as string | undefined;

    try {
      const payload = jwtPayload
        ? JSON.parse(Buffer.from(jwtPayload, 'base64').toString('utf-8'))
        : this.decodeJwtPayloadFromAuthHeader(req);

      if (!payload.sub || !payload.roles || !Array.isArray(payload.roles)) {
        throw new UnauthorizedException('Invalid JWT payload structure');
      }

      this.assertTokenClaims(payload);

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

  private decodeJwtPayloadFromAuthHeader(req: Request): any {
    const authHeader = req.headers['authorization'];
    const token =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : undefined;

    if (!token) {
      throw new UnauthorizedException('Missing X-JWT-Payload header');
    }

    const parts = token.split('.');
    if (parts.length < 2) {
      throw new UnauthorizedException('Invalid JWT format');
    }

    const payload = parts[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');

    return JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'));
  }

  private assertTokenClaims(payload: any): void {
    const nowSeconds = Math.floor(Date.now() / 1000);

    if (payload.exp && Number.isFinite(payload.exp) && payload.exp < nowSeconds) {
      throw new UnauthorizedException('JWT expired');
    }

    const issuer = process.env.JWT_ISSUER;
    if (issuer && payload.iss && payload.iss !== issuer) {
      throw new UnauthorizedException('Invalid JWT issuer');
    }

    const audience = process.env.JWT_AUDIENCE;
    if (audience) {
      if (Array.isArray(payload.aud)) {
        if (!payload.aud.includes(audience)) {
          throw new UnauthorizedException('Invalid JWT audience');
        }
      } else if (payload.aud && payload.aud !== audience) {
        throw new UnauthorizedException('Invalid JWT audience');
      }
    }
  }
}
