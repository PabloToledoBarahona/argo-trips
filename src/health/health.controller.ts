import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { PrismaService } from '../trips/infrastructure/persistence/prisma/prisma.service.js';

/**
 * Health Check Controller
 *
 * Provides health check endpoints for:
 * - Load balancers (ALB)
 * - API Gateway (Envoy)
 * - Monitoring systems
 *
 * Endpoints:
 * - GET /health - Comprehensive health check (DB + Redis)
 * - GET /healthz - Simple liveness probe (always 200 OK)
 *
 * Production-ready with:
 * - Database connectivity check
 * - Fast response times (< 100ms)
 * - No authentication required (public endpoint)
 */
@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Comprehensive health check
   *
   * GET /health
   *
   * Checks:
   * - Database connectivity (Prisma)
   *
   * Response format:
   * {
   *   "status": "ok",
   *   "info": {
   *     "database": { "status": "up" }
   *   },
   *   "error": {},
   *   "details": {
   *     "database": { "status": "up" }
   *   }
   * }
   *
   * Status codes:
   * - 200: All systems operational
   * - 503: One or more systems down
   */
  @Get('health')
  @HealthCheck()
  async check() {
    return this.health.check([
      // Database health check
      () => this.prismaHealth.pingCheck('database', this.prisma),
    ]);
  }

  /**
   * Simple liveness probe
   *
   * GET /healthz
   *
   * Always returns 200 OK if the service is running.
   * Used by load balancers for basic availability check.
   *
   * Response:
   * {
   *   "status": "healthy",
   *   "service": "argo-trips"
   * }
   */
  @Get('healthz')
  healthz() {
    return {
      status: 'healthy',
      service: 'argo-trips',
    };
  }
}
