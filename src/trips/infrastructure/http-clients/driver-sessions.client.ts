import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '../../../shared/http/http.service.js';
import { ServiceTokenService } from '../../../shared/auth/services/service-token.service.js';
import { TokenBucketRateLimiter } from '../../../shared/rate-limiter/token-bucket.rate-limiter.js';
import { CircuitBreaker } from '../../../shared/circuit-breaker/circuit-breaker.js';

// ============================================================================
// DTOs - MS03 Driver Sessions API Format (snake_case)
// ============================================================================

/**
 * Last known location from MS03 Driver Sessions
 */
export interface DriverLastLocation {
  lat: number;
  lng: number;
  h3_res9: string;
  speed_mps: number;
  heading_deg: number;
  ts: string;
}

/**
 * Eligibility status from MS03 Profiles verification
 */
export interface DriverEligibility {
  ok: boolean;
  status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
}

/**
 * Driver session response from MS03-DRIVER-SESSIONS
 * GET /driver-sessions/sessions/:driverId
 */
export interface DriverSessionResponse {
  driver_id: string;
  online: boolean;
  last_loc: DriverLastLocation | null;
  trip_id: string | null;
  eligibility: DriverEligibility;
}

/**
 * Nearby drivers query response from MS03-DRIVER-SESSIONS
 * GET /driver-sessions/sessions/nearby
 */
export interface NearbyDriversRequest {
  h3: string;
  k?: number; // k-ring distance (default: 1)
  limit?: number; // Max drivers to return (default: 50)
}

export interface NearbyDriversResponse {
  drivers: string[];
  queried_cells: string[];
}

// ============================================================================
// Driver Sessions Client
// ============================================================================

/**
 * Driver Sessions Client for MS03-DRIVER-SESSIONS Service
 *
 * Integrates with MS03 Driver Sessions microservice for real-time driver
 * availability, location, and eligibility data.
 *
 * Features:
 * - JWT authentication via ServiceTokenService
 * - Circuit breaker for fault tolerance
 * - Rate limiting compliance
 * - H3 geospatial queries for nearby driver search
 * - Eligibility verification integration with Profiles service
 *
 * @see MS03-DRIVER-SESSIONS Integration Guide v1.0.0
 */
@Injectable()
export class DriverSessionsClient implements OnModuleInit {
  private readonly logger = new Logger(DriverSessionsClient.name);
  private readonly baseUrl: string;

  // Circuit breakers per endpoint
  private readonly sessionCircuitBreaker: CircuitBreaker;
  private readonly nearbyCircuitBreaker: CircuitBreaker;

  // Timeouts per endpoint
  private readonly SESSION_TIMEOUT_MS = 3000; // 3 seconds
  private readonly NEARBY_TIMEOUT_MS = 5000; // 5 seconds

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly serviceTokenService: ServiceTokenService,
    private readonly rateLimiter: TokenBucketRateLimiter,
  ) {
    // Base URL MUST include /driver-sessions prefix for API Gateway routing
    this.baseUrl =
      this.configService.get<string>('DRIVER_SESSIONS_SERVICE_URL') ||
      'http://argo-shared-alb-828452645.us-east-2.elb.amazonaws.com/driver-sessions';

    // Initialize circuit breakers for each endpoint
    this.sessionCircuitBreaker = new CircuitBreaker('driver-sessions-session', {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000, // 1 minute
      rollingWindow: 60000,
    });

    this.nearbyCircuitBreaker = new CircuitBreaker('driver-sessions-nearby', {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000,
      rollingWindow: 60000,
    });

    this.logger.log(`Driver Sessions Client initialized with base URL: ${this.baseUrl}`);
  }

  /**
   * Initialize rate limiter buckets
   * Called by NestJS lifecycle
   */
  onModuleInit(): void {
    // MS03-DRIVER-SESSIONS rate limits (conservative estimates based on typical usage)
    this.rateLimiter.createBucket('driver-sessions-get', 100, 100); // 100 req/sec
    this.rateLimiter.createBucket('driver-sessions-nearby', 50, 50); // 50 req/sec

    this.logger.log('Driver Sessions Client rate limiters initialized');
  }

  /**
   * Get driver session details
   *
   * MS03-DRIVER-SESSIONS: GET /driver-sessions/sessions/:driverId
   *
   * Returns current session state including:
   * - Online/offline status
   * - Last known location with H3 index
   * - Current trip assignment
   * - Eligibility status from Profiles service
   *
   * Timeout: 3 seconds
   * Rate limit: 100 requests/second
   *
   * @param driverId - Driver identifier (e.g., "drv_7")
   * @returns Driver session information
   * @throws Error if service unavailable, driver not found, or invalid response
   *
   * @example
   * ```typescript
   * const session = await driverSessionsClient.getSession('drv_7');
   * if (session.online && session.eligibility.ok) {
   *   console.log(`Driver ${session.driver_id} is available at ${session.last_loc?.h3_res9}`);
   * }
   * ```
   */
  async getSession(driverId: string): Promise<DriverSessionResponse> {
    try {
      this.logger.debug(`Getting session for driver: ${driverId}`);

      this.validateDriverId(driverId);

      // Apply rate limiting
      await this.rateLimiter.acquire('driver-sessions-get');

      // Execute with circuit breaker protection
      const response = await this.sessionCircuitBreaker.execute(async () => {
        const headers = await this.serviceTokenService.getServiceHeaders();
        return await this.httpService.get<DriverSessionResponse>(
          `${this.baseUrl}/sessions/${driverId}`,
          {
            headers,
            timeout: this.SESSION_TIMEOUT_MS,
          },
        );
      });

      this.validateSessionResponse(response);

      this.logger.debug(
        `Driver session: ${driverId}, online=${response.online}, eligible=${response.eligibility.ok}, trip=${response.trip_id || 'none'}`,
      );

      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get driver session for ${driverId}: ${message}`);
      throw new Error(`Driver Sessions service failed: ${message}`);
    }
  }

  /**
   * Find nearby drivers using H3 geospatial index
   *
   * MS03-DRIVER-SESSIONS: GET /driver-sessions/sessions/nearby
   *
   * Searches for online, eligible drivers near a given H3 cell.
   * Uses k-ring expansion to search neighboring cells.
   *
   * Timeout: 5 seconds
   * Rate limit: 50 requests/second
   *
   * @param request - Nearby drivers query with H3 cell and search parameters
   * @returns List of driver IDs and queried H3 cells
   * @throws Error if service unavailable or invalid response
   *
   * @example
   * ```typescript
   * const nearby = await driverSessionsClient.findNearbyDrivers({
   *   h3: '8928308280fffff',
   *   k: 2,           // Search within 2-ring distance
   *   limit: 20       // Return max 20 drivers
   * });
   * console.log(`Found ${nearby.drivers.length} drivers in ${nearby.queried_cells.length} cells`);
   * ```
   */
  async findNearbyDrivers(request: NearbyDriversRequest): Promise<NearbyDriversResponse> {
    try {
      this.logger.debug(
        `Finding nearby drivers: h3=${request.h3}, k=${request.k || 1}, limit=${request.limit || 50}`,
      );

      this.validateNearbyRequest(request);

      // Apply rate limiting
      await this.rateLimiter.acquire('driver-sessions-nearby');

      // Build query parameters
      const params = new URLSearchParams({
        h3: request.h3,
        ...(request.k !== undefined && { k: request.k.toString() }),
        ...(request.limit !== undefined && { limit: request.limit.toString() }),
      });

      // Execute with circuit breaker protection
      const response = await this.nearbyCircuitBreaker.execute(async () => {
        const headers = await this.serviceTokenService.getServiceHeaders();
        return await this.httpService.get<NearbyDriversResponse>(
          `${this.baseUrl}/sessions/nearby?${params.toString()}`,
          {
            headers,
            timeout: this.NEARBY_TIMEOUT_MS,
          },
        );
      });

      this.validateNearbyResponse(response);

      this.logger.debug(
        `Found ${response.drivers.length} nearby drivers in ${response.queried_cells.length} cells`,
      );

      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to find nearby drivers: ${message}`);
      throw new Error(`Driver Sessions nearby search failed: ${message}`);
    }
  }

  // ============================================================================
  // Validation Methods
  // ============================================================================

  private validateDriverId(driverId: string): void {
    if (!driverId || typeof driverId !== 'string' || driverId.trim().length === 0) {
      throw new Error('Invalid driverId: must be non-empty string');
    }
  }

  private validateSessionResponse(response: DriverSessionResponse): void {
    if (!response.driver_id || typeof response.driver_id !== 'string') {
      throw new Error('Invalid session response: missing driver_id');
    }

    if (typeof response.online !== 'boolean') {
      throw new Error('Invalid session response: missing online status');
    }

    if (!response.eligibility || typeof response.eligibility.ok !== 'boolean') {
      throw new Error('Invalid session response: missing eligibility');
    }

    // last_loc can be null if driver never sent location
    if (response.last_loc !== null) {
      if (
        typeof response.last_loc.lat !== 'number' ||
        typeof response.last_loc.lng !== 'number' ||
        typeof response.last_loc.h3_res9 !== 'string'
      ) {
        throw new Error('Invalid session response: malformed last_loc');
      }
    }
  }

  private validateNearbyRequest(request: NearbyDriversRequest): void {
    if (!request.h3 || typeof request.h3 !== 'string') {
      throw new Error('Invalid nearby request: h3 cell required');
    }

    // H3 resolution 9 cells are 15 characters long
    if (request.h3.length !== 15) {
      throw new Error('Invalid nearby request: h3 must be resolution 9 (15 characters)');
    }

    if (request.k !== undefined && (request.k < 0 || request.k > 5)) {
      throw new Error('Invalid nearby request: k must be between 0 and 5');
    }

    if (request.limit !== undefined && (request.limit < 1 || request.limit > 100)) {
      throw new Error('Invalid nearby request: limit must be between 1 and 100');
    }
  }

  private validateNearbyResponse(response: NearbyDriversResponse): void {
    if (!Array.isArray(response.drivers)) {
      throw new Error('Invalid nearby response: drivers must be array');
    }

    if (!Array.isArray(response.queried_cells)) {
      throw new Error('Invalid nearby response: queried_cells must be array');
    }
  }
}
