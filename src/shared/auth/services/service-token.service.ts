import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Service Token Service
 *
 * Generates authentication payloads for service-to-service communication.
 * Used when calling other microservices (GEO, Pricing, etc.) through the Gateway.
 *
 * The Gateway expects X-JWT-Payload header with base64-encoded JWT payload.
 */
@Injectable()
export class ServiceTokenService {
  private readonly serviceId: string;

  constructor(private readonly configService: ConfigService) {
    this.serviceId = this.configService.get<string>('SERVICE_ID') || 'argo-trips';
  }

  /**
   * Generate X-JWT-Payload header value for service-to-service calls
   *
   * Creates a base64-encoded JWT payload with admin role for inter-service communication.
   * This allows TRIPS to call other services (GEO, Pricing, etc.) through the Gateway.
   *
   * @returns Base64-encoded JWT payload string
   */
  generateServicePayload(): string {
    const payload = {
      sub: this.serviceId,
      roles: ['admin', 'service'],
      identityType: 'admin' as const,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiry
    };

    const jsonPayload = JSON.stringify(payload);
    return Buffer.from(jsonPayload, 'utf-8').toString('base64');
  }

  /**
   * Get authorization headers for service-to-service HTTP calls
   *
   * @returns Object with X-JWT-Payload header
   */
  getServiceHeaders(): Record<string, string> {
    return {
      'X-JWT-Payload': this.generateServicePayload(),
      'Content-Type': 'application/json',
    };
  }
}
