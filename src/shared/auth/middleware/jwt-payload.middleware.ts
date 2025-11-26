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
      const user: ArgoUser = JSON.parse(decoded);

      if (!user.sub || !user.identityType) {
        throw new UnauthorizedException('Invalid JWT payload structure');
      }

      (req as any).user = user;
      next();
    } catch (error) {
      throw new UnauthorizedException('Invalid JWT payload');
    }
  }
}
