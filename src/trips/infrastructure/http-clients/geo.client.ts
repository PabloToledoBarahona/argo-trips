import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '../../../shared/http/http.service.js';
import { ServiceTokenService } from '../../../shared/auth/services/service-token.service.js';
import { TokenBucketRateLimiter } from '../../../shared/rate-limiter/token-bucket.rate-limiter.js';
import { CircuitBreaker } from '../../../shared/circuit-breaker/circuit-breaker.js';
import { H3CacheService } from '../../../shared/cache/h3-cache.service.js';

// ============================================================================
// DTOs - Common Types
// ============================================================================

export interface Coordinate {
  lat: number;
  lng: number;
}

export type GeoVehicleProfile = 'car' | 'moto';
export type GeoEngine = 'mapbox' | 'mapbox-matrix' | 'heuristic' | 'fallback';
export type GeoDegradationMode = 'NO_ROUTER' | 'NO_GEOCODER' | null;

// ============================================================================
// DTOs - ETA (Estimación de Tiempo de Llegada)
// ============================================================================

export interface EtaRequest {
  origins: Coordinate[];
  destinations: Coordinate[];
  profile: GeoVehicleProfile;
  city: string;
  hour_bucket?: string; // Format: "YYYY-MM-DDTHH"
}

export interface EtaPair {
  o: number; // Origin index
  d: number; // Destination index
  duration_sec: number;
  distance_m: number;
  from_cache: boolean;
}

export interface EtaResponse {
  engine: 'mapbox-matrix' | 'heuristic';
  pairs: EtaPair[];
  degradation: GeoDegradationMode;
}

// ============================================================================
// DTOs - Route (Cálculo de Rutas)
// ============================================================================

export interface RouteRequest {
  origin: Coordinate;
  destination: Coordinate;
  profile: GeoVehicleProfile;
  city: string;
  include_polyline?: boolean;
  alternatives?: number;
}

export interface RouteResponse {
  engine: 'mapbox' | 'heuristic';
  duration_sec: number;
  distance_m: number;
  polyline: string | null;
  waypoints: Coordinate[];
  h3_path_res9: string[];
  from_cache: boolean;
  degradation?: GeoDegradationMode;
}

// ============================================================================
// DTOs - H3 (Indexación Geoespacial)
// ============================================================================

export interface H3EncodeOperation {
  op: 'encode';
  lat: number;
  lng: number;
  res?: number; // Default: 9
}

export interface H3KRingOperation {
  op: 'kRing';
  h3: string;
  k?: number; // Default: 1
}

export type H3Operation = H3EncodeOperation | H3KRingOperation;

export interface H3Request {
  ops: H3Operation[];
}

export interface H3EncodeResult {
  op: 'encode';
  h3: string;
}

export interface H3KRingResult {
  op: 'kRing';
  cells: string[];
}

export interface H3ErrorResult {
  op: string;
  error: string;
}

export type H3Result = H3EncodeResult | H3KRingResult | H3ErrorResult;

export interface H3Response {
  results: H3Result[];
}

// ============================================================================
// DTOs - Geocoding (Directa e Inversa)
// ============================================================================

export interface GeocodeForwardRequest {
  query: string;
  city: string;
  country: string;
  limit?: number; // 1-10, default: 5
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  label: string;
  h3_res9: string;
}

export interface GeocodeForwardResponse {
  engine: 'mapbox' | 'fallback';
  results: GeocodeResult[];
  from_cache: boolean;
  degradation?: GeoDegradationMode;
}

export interface GeocodeReverseRequest {
  lat: number;
  lng: number;
  lang?: 'es' | 'en' | 'pt'; // Default: 'es'
}

export interface GeocodeReverseResponse {
  engine: 'mapbox' | 'fallback';
  label: string;
  h3_res9: string;
  from_cache: boolean;
  degradation?: GeoDegradationMode;
}

// ============================================================================
// GEO Client
// ============================================================================

/**
 * GEO Service Client (MS10-GEO)
 *
 * Client for the GEO microservice providing geospatial functionality:
 * - ETA calculation (multi-origin/destination)
 * - Route calculation with optional polyline
 * - H3 geospatial indexing (batch operations)
 * - Geocoding (forward and reverse)
 *
 * Features:
 * - JWT authentication for service-to-service calls
 * - Graceful degradation when Mapbox unavailable (heuristic fallback)
 * - Distributed caching with Redis
 * - Automatic retry with exponential backoff
 * - Rate limiting compliance (ETA: 50 rps, Route: 15 rps)
 * - Circuit breaker for fault tolerance
 * - Local H3 cache for coordinate conversions (~90% cache hit rate)
 *
 * Documentation: MS10-GEO Integration Guide v1.0.0
 */
@Injectable()
export class GeoClient implements OnModuleInit {
  private readonly logger = new Logger(GeoClient.name);
  private readonly baseUrl: string;

  // Timeouts per endpoint (from GEO documentation)
  private readonly ETA_TIMEOUT_MS = 5000; // 5 seconds
  private readonly ROUTE_TIMEOUT_MS = 8000; // 8 seconds
  private readonly GEOCODE_TIMEOUT_MS = 2000; // 2 seconds
  private readonly H3_TIMEOUT_MS = 5000; // 5 seconds

  // Circuit breakers per endpoint
  private readonly etaCircuitBreaker: CircuitBreaker;
  private readonly routeCircuitBreaker: CircuitBreaker;
  private readonly h3CircuitBreaker: CircuitBreaker;
  private readonly geocodeCircuitBreaker: CircuitBreaker;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly serviceTokenService: ServiceTokenService,
    private readonly rateLimiter: TokenBucketRateLimiter,
    private readonly h3Cache: H3CacheService,
  ) {
    // Base URL MUST include /geo prefix for API Gateway routing
    this.baseUrl =
      this.configService.get<string>('GEO_SERVICE_URL') ||
      'http://alb-argo-gateway-1317937741.us-east-2.elb.amazonaws.com/geo';

    // Initialize circuit breakers for each endpoint
    this.etaCircuitBreaker = new CircuitBreaker('geo-eta', {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000, // 1 minute
      rollingWindow: 60000,
    });

    this.routeCircuitBreaker = new CircuitBreaker('geo-route', {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000,
      rollingWindow: 60000,
    });

    this.h3CircuitBreaker = new CircuitBreaker('geo-h3', {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000,
      rollingWindow: 60000,
    });

    this.geocodeCircuitBreaker = new CircuitBreaker('geo-geocode', {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000,
      rollingWindow: 60000,
    });

    this.logger.log(`GEO Client initialized with base URL: ${this.baseUrl}`);
  }

  onModuleInit(): void {
    // Initialize rate limiter buckets per GEO documentation
    this.rateLimiter.createBucket('geo-eta', 50, 50); // 50 req/sec
    this.rateLimiter.createBucket('geo-route', 15, 15); // 15 req/sec
    this.rateLimiter.createBucket('geo-geocode', 10, 10); // 10 req/sec
    this.rateLimiter.createBucket('geo-h3', 100, 100); // No specific limit, using conservative 100

    this.logger.log('GEO Client rate limiters initialized');
  }

  /**
   * Calculate ETA (Estimated Time of Arrival) between origins and destinations
   *
   * MS10-GEO: POST /geo/eta
   *
   * Supports multiple origins and destinations in a single request (matrix calculation).
   * Results include duration, distance, and cache status for each origin-destination pair.
   *
   * Rate limit: 50 requests/second
   * Timeout: 5 seconds
   *
   * @param request - ETA request with origins, destinations, profile, and city
   * @returns ETA response with pairs of origin-destination results
   * @throws Error if service unavailable or invalid response
   *
   * @example
   * ```typescript
   * const eta = await geoClient.eta({
   *   origins: [{ lat: -17.78345, lng: -63.18117 }],
   *   destinations: [{ lat: -17.79456, lng: -63.19234 }],
   *   profile: 'car',
   *   city: 'SCZ'
   * });
   * console.log(`ETA: ${eta.pairs[0].duration_sec} seconds`);
   * ```
   */
  async eta(request: EtaRequest): Promise<EtaResponse> {
    try {
      this.logger.debug(
        `Calculating ETA: ${request.origins.length} origins → ${request.destinations.length} destinations, profile=${request.profile}, city=${request.city}`,
      );

      this.validateEtaRequest(request);

      // Apply rate limiting
      await this.rateLimiter.acquire('geo-eta');

      // Execute with circuit breaker protection
      const response = await this.etaCircuitBreaker.execute(async () => {
        return await this.httpService.post<EtaResponse>(
          `${this.baseUrl}/eta`,
          request,
          {
            headers: this.serviceTokenService.getServiceHeaders(),
            timeout: this.ETA_TIMEOUT_MS,
          },
        );
      });

      this.validateEtaResponse(response);

      // Log degradation warnings
      if (response.degradation) {
        this.logger.warn(
          `GEO ETA using degraded mode: engine=${response.engine}, degradation=${response.degradation}. Results may be less accurate.`,
        );
      }

      this.logger.debug(
        `ETA calculated: ${response.pairs.length} pairs, engine=${response.engine}, cached=${response.pairs.some((p) => p.from_cache)}`,
      );

      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to calculate ETA: ${message}`);
      throw new Error(`GEO service ETA failed: ${message}`);
    }
  }

  /**
   * Calculate route between origin and destination
   *
   * MS10-GEO: POST /geo/route
   *
   * Calculates a single route with duration, distance, and optional polyline geometry.
   * Can request alternative routes and H3 path resolution 9.
   *
   * Rate limit: 15 requests/second
   * Timeout: 8 seconds
   *
   * @param request - Route request with origin, destination, profile, and city
   * @returns Route response with duration, distance, and optional geometry
   * @throws Error if service unavailable or invalid response
   *
   * @example
   * ```typescript
   * const route = await geoClient.route({
   *   origin: { lat: -17.78345, lng: -63.18117 },
   *   destination: { lat: -17.79456, lng: -63.19234 },
   *   profile: 'moto',
   *   city: 'SCZ',
   *   include_polyline: true
   * });
   * console.log(`Route: ${route.distance_m}m in ${route.duration_sec}s`);
   * ```
   */
  async route(request: RouteRequest): Promise<RouteResponse> {
    try {
      this.logger.debug(
        `Calculating route: (${request.origin.lat},${request.origin.lng}) → (${request.destination.lat},${request.destination.lng}), profile=${request.profile}, city=${request.city}`,
      );

      this.validateRouteRequest(request);

      // Apply rate limiting
      await this.rateLimiter.acquire('geo-route');

      // Execute with circuit breaker protection
      const response = await this.routeCircuitBreaker.execute(async () => {
        return await this.httpService.post<RouteResponse>(
          `${this.baseUrl}/route`,
          request,
          {
            headers: this.serviceTokenService.getServiceHeaders(),
            timeout: this.ROUTE_TIMEOUT_MS,
          },
        );
      });

      this.validateRouteResponse(response);

      // Log degradation warnings
      if (response.degradation) {
        this.logger.warn(
          `GEO route using degraded mode: engine=${response.engine}, degradation=${response.degradation}. Results may be less accurate.`,
        );
      }

      this.logger.debug(
        `Route calculated: ${response.distance_m}m, ${response.duration_sec}s, engine=${response.engine}, cached=${response.from_cache}`,
      );

      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to calculate route: ${message}`);
      throw new Error(`GEO service route failed: ${message}`);
    }
  }

  /**
   * Convert coordinates to H3 indexes (batch operation)
   *
   * MS10-GEO: POST /geo/h3/encode
   *
   * Performs H3 geospatial indexing operations in batch.
   * Supports encode (lat/lng → H3) and kRing (H3 neighbors) operations.
   *
   * No specific rate limit
   * Timeout: 5 seconds
   *
   * @param request - H3 request with array of operations
   * @returns H3 response with results for each operation
   * @throws Error if service unavailable or invalid response
   *
   * @example
   * ```typescript
   * const h3 = await geoClient.h3Encode({
   *   ops: [
   *     { op: 'encode', lat: -17.78345, lng: -63.18117, res: 9 },
   *     { op: 'encode', lat: -17.79456, lng: -63.19234, res: 9 }
   *   ]
   * });
   * console.log(`H3 indexes: ${h3.results.map(r => r.h3).join(', ')}`);
   * ```
   */
  async h3Encode(request: H3Request): Promise<H3Response> {
    try {
      this.logger.debug(`H3 encode batch: ${request.ops.length} operations`);

      this.validateH3Request(request);

      // Initialize results array with exact size to preserve order
      const results: (H3Result | null)[] = new Array(request.ops.length).fill(null);
      const uncachedOps: H3Operation[] = [];
      const uncachedIndexMap: Map<number, number> = new Map(); // uncachedOps index → original index
      let cacheHits = 0;

      // Check cache and build uncached ops list while preserving indices
      for (let i = 0; i < request.ops.length; i++) {
        const op = request.ops[i];

        if (op.op === 'encode') {
          const res = op.res || 9;
          const cachedH3 = this.h3Cache.get(op.lat, op.lng, res);

          if (cachedH3) {
            // Cache hit: place result at original index
            results[i] = { op: 'encode', h3: cachedH3 };
            cacheHits++;
          } else {
            // Cache miss: add to uncached list and track mapping
            uncachedIndexMap.set(uncachedOps.length, i);
            uncachedOps.push(op);
          }
        } else {
          // kRing operations are not cached
          uncachedIndexMap.set(uncachedOps.length, i);
          uncachedOps.push(op);
        }
      }

      if (cacheHits > 0) {
        this.logger.debug(`H3 cache hits: ${cacheHits}/${request.ops.length}`);
      }

      // If all operations were cached, return immediately
      if (uncachedOps.length === 0) {
        return { results: results as H3Result[] };
      }

      // Apply rate limiting only if calling remote service
      await this.rateLimiter.acquire('geo-h3');

      // Execute remaining operations with circuit breaker
      const response = await this.h3CircuitBreaker.execute(async () => {
        return await this.httpService.post<H3Response>(
          `${this.baseUrl}/h3/encode`,
          { ops: uncachedOps },
          {
            headers: this.serviceTokenService.getServiceHeaders(),
            timeout: this.H3_TIMEOUT_MS,
          },
        );
      });

      this.validateH3Response(response);

      // Place remote results at correct positions and cache successful encodes
      for (let i = 0; i < uncachedOps.length; i++) {
        const op = uncachedOps[i];
        const result = response.results[i];
        const originalIndex = uncachedIndexMap.get(i)!;

        // Place result at original index to preserve order
        results[originalIndex] = result;

        // Cache successful encode results
        if (op.op === 'encode' && result.op === 'encode' && !('error' in result)) {
          const res = op.res || 9;
          this.h3Cache.set(op.lat, op.lng, res, result.h3);
        }
      }

      // Log any errors in results
      const errors = results.filter((r) => r && 'error' in r);
      if (errors.length > 0) {
        this.logger.warn(`H3 encode had ${errors.length} errors: ${JSON.stringify(errors)}`);
      }

      this.logger.debug(
        `H3 encode completed: ${results.length} results (${cacheHits} from cache, ${uncachedOps.length} from service)`,
      );

      return { results: results as H3Result[] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to encode H3: ${message}`);
      throw new Error(`GEO service H3 encode failed: ${message}`);
    }
  }

  /**
   * Convert single coordinate to H3 index (convenience method)
   *
   * Wrapper around h3Encode for single coordinate conversion.
   *
   * @param lat - Latitude
   * @param lng - Longitude
   * @param res - H3 resolution (default: 9)
   * @returns H3 index string
   * @throws Error if encoding fails
   *
   * @example
   * ```typescript
   * const h3Index = await geoClient.h3EncodeSingle(-17.78345, -63.18117, 9);
   * console.log(`H3 index: ${h3Index}`);
   * ```
   */
  async h3EncodeSingle(lat: number, lng: number, res: number = 9): Promise<string> {
    const response = await this.h3Encode({
      ops: [{ op: 'encode', lat, lng, res }],
    });

    const result = response.results[0];

    if ('error' in result) {
      throw new Error(`H3 encode failed: ${result.error}`);
    }

    if (result.op !== 'encode') {
      throw new Error(`Unexpected H3 result type: ${result.op}`);
    }

    return result.h3;
  }

  /**
   * Geocode forward (address/place → coordinates)
   *
   * MS10-GEO: POST /geo/geocode
   *
   * Converts text query (address, place name) to geographic coordinates.
   * Returns multiple results ranked by relevance.
   *
   * Rate limit: 10 requests/second
   * Timeout: 2 seconds
   *
   * @param request - Geocode request with query, city, and country
   * @returns Geocode response with results
   * @throws Error if service unavailable or no results found
   *
   * @example
   * ```typescript
   * const results = await geoClient.geocodeForward({
   *   query: 'plaza 24 de septiembre',
   *   city: 'Santa Cruz',
   *   country: 'BO',
   *   limit: 5
   * });
   * console.log(`Found: ${results.results[0].label}`);
   * ```
   */
  async geocodeForward(request: GeocodeForwardRequest): Promise<GeocodeForwardResponse> {
    try {
      this.logger.debug(
        `Geocoding forward: query="${request.query}", city=${request.city}, country=${request.country}`,
      );

      this.validateGeocodeForwardRequest(request);

      const response = await this.httpService.post<GeocodeForwardResponse>(
        `${this.baseUrl}/geocode`,
        request,
        {
          headers: this.serviceTokenService.getServiceHeaders(),
          timeout: this.GEOCODE_TIMEOUT_MS,
        },
      );

      this.validateGeocodeForwardResponse(response);

      if (response.degradation) {
        this.logger.warn(
          `GEO geocode using degraded mode: engine=${response.engine}, degradation=${response.degradation}`,
        );
      }

      this.logger.debug(
        `Geocode forward completed: ${response.results.length} results, engine=${response.engine}`,
      );

      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to geocode forward: ${message}`);
      throw new Error(`GEO service geocode forward failed: ${message}`);
    }
  }

  /**
   * Geocode reverse (coordinates → address/place)
   *
   * MS10-GEO: POST /geo/geocode/reverse
   *
   * Converts geographic coordinates to human-readable address.
   * Supports multiple languages.
   *
   * Rate limit: 10 requests/second
   * Timeout: 2 seconds
   *
   * @param request - Reverse geocode request with lat, lng, and optional language
   * @returns Reverse geocode response with address label
   * @throws Error if service unavailable or address not found
   *
   * @example
   * ```typescript
   * const address = await geoClient.geocodeReverse({
   *   lat: -17.78345,
   *   lng: -63.18117,
   *   lang: 'es'
   * });
   * console.log(`Address: ${address.label}`);
   * ```
   */
  async geocodeReverse(request: GeocodeReverseRequest): Promise<GeocodeReverseResponse> {
    try {
      this.logger.debug(
        `Geocoding reverse: (${request.lat},${request.lng}), lang=${request.lang || 'es'}`,
      );

      this.validateGeocodeReverseRequest(request);

      const response = await this.httpService.post<GeocodeReverseResponse>(
        `${this.baseUrl}/geocode/reverse`,
        request,
        {
          headers: this.serviceTokenService.getServiceHeaders(),
          timeout: this.GEOCODE_TIMEOUT_MS,
        },
      );

      this.validateGeocodeReverseResponse(response);

      if (response.degradation) {
        this.logger.warn(
          `GEO reverse geocode using degraded mode: engine=${response.engine}, degradation=${response.degradation}`,
        );
      }

      this.logger.debug(`Geocode reverse completed: engine=${response.engine}`);

      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to geocode reverse: ${message}`);
      throw new Error(`GEO service geocode reverse failed: ${message}`);
    }
  }

  // ============================================================================
  // Validation Methods
  // ============================================================================

  private validateEtaRequest(request: EtaRequest): void {
    if (!request.origins || request.origins.length === 0) {
      throw new Error('ETA request must have at least one origin');
    }

    if (!request.destinations || request.destinations.length === 0) {
      throw new Error('ETA request must have at least one destination');
    }

    if (!request.profile || !['car', 'moto'].includes(request.profile)) {
      throw new Error('ETA request must have valid profile (car or moto)');
    }

    if (!request.city || request.city.trim().length === 0) {
      throw new Error('ETA request must have city');
    }

    // Validate coordinates
    [...request.origins, ...request.destinations].forEach((coord, i) => {
      this.validateCoordinate(coord, `coordinate ${i}`);
    });
  }

  private validateRouteRequest(request: RouteRequest): void {
    if (!request.origin) {
      throw new Error('Route request must have origin');
    }

    if (!request.destination) {
      throw new Error('Route request must have destination');
    }

    if (!request.profile || !['car', 'moto'].includes(request.profile)) {
      throw new Error('Route request must have valid profile (car or moto)');
    }

    if (!request.city || request.city.trim().length === 0) {
      throw new Error('Route request must have city');
    }

    this.validateCoordinate(request.origin, 'origin');
    this.validateCoordinate(request.destination, 'destination');
  }

  private validateH3Request(request: H3Request): void {
    if (!request.ops || request.ops.length === 0) {
      throw new Error('H3 request must have at least one operation');
    }

    request.ops.forEach((op, i) => {
      if (op.op === 'encode') {
        if (typeof op.lat !== 'number' || typeof op.lng !== 'number') {
          throw new Error(`H3 encode operation ${i} must have lat and lng`);
        }
        this.validateCoordinate({ lat: op.lat, lng: op.lng }, `H3 operation ${i}`);
      } else if (op.op === 'kRing') {
        if (!op.h3 || typeof op.h3 !== 'string') {
          throw new Error(`H3 kRing operation ${i} must have h3 index`);
        }
      } else {
        throw new Error(`Unknown H3 operation type: ${(op as any).op}`);
      }
    });
  }

  private validateGeocodeForwardRequest(request: GeocodeForwardRequest): void {
    if (!request.query || request.query.trim().length === 0) {
      throw new Error('Geocode forward request must have query');
    }

    if (!request.city || request.city.trim().length === 0) {
      throw new Error('Geocode forward request must have city');
    }

    if (!request.country || request.country.trim().length === 0) {
      throw new Error('Geocode forward request must have country');
    }

    if (request.limit !== undefined && (request.limit < 1 || request.limit > 10)) {
      throw new Error('Geocode forward request limit must be between 1 and 10');
    }
  }

  private validateGeocodeReverseRequest(request: GeocodeReverseRequest): void {
    this.validateCoordinate({ lat: request.lat, lng: request.lng }, 'geocode reverse');

    if (request.lang && !['es', 'en', 'pt'].includes(request.lang)) {
      throw new Error('Geocode reverse language must be es, en, or pt');
    }
  }

  private validateCoordinate(coord: Coordinate, context: string): void {
    if (typeof coord.lat !== 'number' || typeof coord.lng !== 'number') {
      throw new Error(`${context}: coordinates must be numbers`);
    }

    if (coord.lat < -90 || coord.lat > 90) {
      throw new Error(`${context}: latitude must be between -90 and 90`);
    }

    if (coord.lng < -180 || coord.lng > 180) {
      throw new Error(`${context}: longitude must be between -180 and 180`);
    }
  }

  private validateEtaResponse(response: EtaResponse): void {
    if (!response.engine) {
      throw new Error('Invalid ETA response: missing engine');
    }

    if (!Array.isArray(response.pairs)) {
      throw new Error('Invalid ETA response: pairs must be array');
    }

    response.pairs.forEach((pair, i) => {
      if (typeof pair.duration_sec !== 'number' || typeof pair.distance_m !== 'number') {
        throw new Error(`Invalid ETA response: pair ${i} missing duration_sec or distance_m`);
      }
    });
  }

  private validateRouteResponse(response: RouteResponse): void {
    if (!response.engine) {
      throw new Error('Invalid route response: missing engine');
    }

    if (typeof response.duration_sec !== 'number' || typeof response.distance_m !== 'number') {
      throw new Error('Invalid route response: missing duration_sec or distance_m');
    }

    if (!Array.isArray(response.waypoints)) {
      throw new Error('Invalid route response: waypoints must be array');
    }

    if (!Array.isArray(response.h3_path_res9)) {
      throw new Error('Invalid route response: h3_path_res9 must be array');
    }
  }

  private validateH3Response(response: H3Response): void {
    if (!Array.isArray(response.results)) {
      throw new Error('Invalid H3 response: results must be array');
    }
  }

  private validateGeocodeForwardResponse(response: GeocodeForwardResponse): void {
    if (!response.engine) {
      throw new Error('Invalid geocode forward response: missing engine');
    }

    if (!Array.isArray(response.results)) {
      throw new Error('Invalid geocode forward response: results must be array');
    }
  }

  private validateGeocodeReverseResponse(response: GeocodeReverseResponse): void {
    if (!response.engine) {
      throw new Error('Invalid geocode reverse response: missing engine');
    }

    if (!response.label || typeof response.label !== 'string') {
      throw new Error('Invalid geocode reverse response: missing label');
    }

    if (!response.h3_res9 || typeof response.h3_res9 !== 'string') {
      throw new Error('Invalid geocode reverse response: missing h3_res9');
    }
  }
}
