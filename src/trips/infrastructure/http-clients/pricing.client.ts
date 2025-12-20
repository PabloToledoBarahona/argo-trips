import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isAxiosError } from 'axios';
import { HttpService } from '../../../shared/http/http.service.js';
import { ServiceTokenService } from '../../../shared/auth/services/service-token.service.js';
import { TokenBucketRateLimiter } from '../../../shared/rate-limiter/token-bucket.rate-limiter.js';
import { CircuitBreaker } from '../../../shared/circuit-breaker/circuit-breaker.js';

// ============================================================================
// DTOs - MS06 API Format (snake_case)
// ============================================================================

/**
 * Coordinate location for Pricing API (MS06 format)
 */
export interface PricingCoordinate {
  lat: number;
  lng: number;
}

/**
 * MS06 Vehicle Types
 * See: MS06-Pricing Integration Guide - Vehicle Types
 */
export type MS06VehicleType = 'moto' | 'delivery' | 'economy' | 'comfort' | 'premium' | 'xl';

/**
 * Trip status for finalize endpoint
 */
export type TripStatus = 'completed' | 'cancelled';

/**
 * Degradation modes returned by MS06
 */
export type DegradationMode = 'NO_ROUTER' | null;

// ============================================================================
// Quote DTOs (MS06 Format)
// ============================================================================

/**
 * Quote request for MS06-Pricing
 * POST /pricing/quote
 */
export interface QuoteRequest {
  origin: PricingCoordinate;
  destination: PricingCoordinate;
  vehicle_type: string;
  city: string;
  include_breakdown?: boolean;
  distance_m_est?: number;
  duration_s_est?: number;
}

/**
 * Price breakdown structure from MS06
 */
export interface PriceBreakdown {
  base: number;
  per_km: {
    rate: number;
    distance_km: number;
    amount: number;
    note?: string;
  };
  per_min: {
    rate: number;
    duration_min: number;
    amount: number;
    note?: string;
  };
  multipliers: {
    vehicle: number;
    surge: number;
    time: number;
  };
  extras: ExtraCharge[];
  min_fare: number;
  rounded_step: number;
}

/**
 * Extra charge from MS06
 */
export interface ExtraCharge {
  code: string;
  amount: number;
  description: string;
}

/**
 * Zone information from MS06
 */
export interface ZoneInfo {
  h3_res7: string;
  surge: number;
}

/**
 * Quote response from MS06-Pricing
 */
export interface QuoteResponse {
  quote_id: string;
  currency: string;
  estimate_total: number;
  expires_at: string;
  degradation: DegradationMode;
  breakdown?: PriceBreakdown;
  zone: ZoneInfo;
}

// ============================================================================
// Finalize DTOs (MS06 Format)
// ============================================================================

/**
 * Finalize request for MS06-Pricing
 * POST /pricing/finalize
 */
export interface FinalizeRequest {
  trip_id: string;
  quote_id?: string;
  vehicle_type: string;
  h3_res7: string;
  distance_m_final?: number;
  duration_s_final?: number;
  city: string;
  status: TripStatus;
  cancelled_at?: string;
}

/**
 * Tax information from MS06
 */
export interface Tax {
  code: string;
  amount: number;
  rate: number;
  description: string;
}

/**
 * Finalize response from MS06-Pricing
 */
export interface FinalizeResponse {
  trip_id: string;
  currency: string;
  total_final: number;
  taxes: Tax[];
  surge_used: number;
  min_fare_applied: boolean;
  cancel_fee_applied: boolean;
  pricing_rule_version: string;
  degradation: DegradationMode;
}

// ============================================================================
// Pricing Client Implementation
// ============================================================================

/**
 * Pricing Client for MS06-Pricing Service
 *
 * Implements complete integration with MS06-Pricing API including:
 * - JWT authentication via ServiceTokenService
 * - Rate limiting (50 req/s for quote, 20 req/s for finalize)
 * - Circuit breaker for fault tolerance
 * - Graceful degradation handling
 * - Automatic retry with exponential backoff
 *
 * @see MS06-Pricing Integration Guide v1.0.0
 */
@Injectable()
export class PricingClient implements OnModuleInit {
  private readonly logger = new Logger(PricingClient.name);
  private readonly baseUrl: string;

  // Circuit breakers per endpoint
  private readonly quoteCircuitBreaker: CircuitBreaker;
  private readonly finalizeCircuitBreaker: CircuitBreaker;

  // Timeouts
  private readonly QUOTE_TIMEOUT_MS = 5000;
  private readonly FINALIZE_TIMEOUT_MS = 10000;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly serviceTokenService: ServiceTokenService,
    private readonly rateLimiter: TokenBucketRateLimiter,
  ) {
    // Base URL MUST include /pricing prefix for API Gateway routing
    this.baseUrl =
      this.configService.get<string>('PRICING_SERVICE_URL') ||
      'http://alb-argo-gateway-1317937741.us-east-2.elb.amazonaws.com/pricing';

    // Initialize circuit breakers for each endpoint
    this.quoteCircuitBreaker = new CircuitBreaker('pricing-quote', {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000,
      rollingWindow: 60000,
    });

    this.finalizeCircuitBreaker = new CircuitBreaker('pricing-finalize', {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000,
      rollingWindow: 60000,
    });

    this.logger.log(`Pricing Client initialized with base URL: ${this.baseUrl}`);
  }

  /**
   * Initialize rate limiter buckets
   * Called by NestJS lifecycle
   */
  onModuleInit(): void {
    // MS06-Pricing rate limits
    this.rateLimiter.createBucket('pricing-quote', 50, 50); // 50 req/sec
    this.rateLimiter.createBucket('pricing-finalize', 20, 20); // 20 req/sec

    this.logger.log('Pricing Client rate limiters initialized');
  }

  /**
   * Get a price quote for a trip
   *
   * MS06-PRICING: POST /quote
   * Rate Limit: 50 requests/second
   *
   * @param request - Quote request with origin, destination, vehicle type
   * @returns Quote response with pricing details and quote_id
   * @throws Error if service unavailable or invalid response
   *
   * @example
   * const quote = await pricingClient.quote({
   *   origin: { lat: -17.78345, lng: -63.18117 },
   *   destination: { lat: -17.79456, lng: -63.19234 },
   *   vehicle_type: 'comfort',
   *   city: 'SCZ',
   *   distance_m_est: 3100,
   *   duration_s_est: 360
   * });
   * console.log(`Quote: ${quote.quote_id}, Total: ${quote.estimate_total}`);
   */
  async quote(request: QuoteRequest): Promise<QuoteResponse> {
    this.logger.debug(
      `Requesting quote for city: ${request.city}, vehicle: ${request.vehicle_type}`,
    );

    this.validateQuoteRequest(request);

    // Apply rate limiting
    await this.rateLimiter.acquire('pricing-quote');

    // Execute with circuit breaker
    const wrappedResponse = await this.quoteCircuitBreaker.execute(async () => {
      const headers = await this.serviceTokenService.getServiceHeaders();
      return await this.httpService.post<any>(
        `${this.baseUrl}/quote`,
        request,
        {
          headers,
          timeout: this.QUOTE_TIMEOUT_MS,
        },
      );
    });

    // Unwrap the success envelope from MS06-Pricing
    // Response format: { success: true, data: { quote_id, ... } }
    const response: QuoteResponse = wrappedResponse.data || wrappedResponse;

    this.validateQuoteResponse(response);

    // Log degradation warning
    if (response.degradation) {
      this.logger.warn(
        `Quote ${response.quote_id} returned with degradation mode: ${response.degradation}. Estimate may be less accurate.`,
      );
    }

    this.logger.debug(
      `Quote received: ${response.quote_id}, est total: ${response.estimate_total} ${response.currency}, surge=${response.zone.surge}, degradation=${response.degradation ?? 'none'}`,
    );

    return response;
  }

  /**
   * Finalize trip pricing
   *
   * MS06-PRICING: POST /finalize
   * Rate Limit: 20 requests/second
   * Idempotent: Uses trip_id as idempotency key
   *
   * @param request - Finalize request with trip details and final metrics
   * @returns Final price and breakdown
   * @throws Error if service unavailable or invalid response
   *
   * @example
   * const final = await pricingClient.finalize({
   *   trip_id: 'trip-123',
   *   quote_id: 'quote-456',
   *   vehicle_type: 'comfort',
   *   h3_res7: '8728308a1ffffff',
   *   distance_m_final: 3250,
   *   duration_s_final: 380,
   *   city: 'SCZ',
   *   status: 'completed'
   * });
   * console.log(`Final price: ${final.total_final} ${final.currency}`);
   */
  async finalize(request: FinalizeRequest): Promise<FinalizeResponse> {
    this.logger.debug(
      `Finalizing pricing for trip: ${request.trip_id}, quote: ${request.quote_id}, status: ${request.status}`,
    );

    this.validateFinalizeRequest(request);

    // Apply rate limiting
    await this.rateLimiter.acquire('pricing-finalize');

    // Execute with circuit breaker
    const wrappedResponse = await this.finalizeCircuitBreaker.execute(async () => {
      const headers = await this.serviceTokenService.getServiceHeaders();
      return await this.httpService.post<any>(
        `${this.baseUrl}/finalize`,
        request,
        {
          headers,
          timeout: this.FINALIZE_TIMEOUT_MS,
        },
      );
    });

    // Unwrap the success envelope from MS06-Pricing
    // Response format: { success: true, data: { trip_id, ... } }
    const response: FinalizeResponse = wrappedResponse.data || wrappedResponse;

    this.validateFinalizeResponse(response);

    // Log degradation warning
    if (response.degradation) {
      this.logger.warn(
        `Finalize for trip ${response.trip_id} returned with degradation mode: ${response.degradation}`,
      );
    }

    this.logger.debug(
      `Pricing finalized: trip ${response.trip_id}, total: ${response.total_final} ${response.currency}, surge=${response.surge_used}, min_fare_applied=${response.min_fare_applied}, degradation=${response.degradation ?? 'none'}`,
    );

    return response;
  }

  // ============================================================================
  // Validation Methods
  // ============================================================================

  private validateQuoteRequest(request: QuoteRequest): void {
    if (!request.origin || typeof request.origin.lat !== 'number' || typeof request.origin.lng !== 'number') {
      throw new Error('Invalid quote request: origin coordinates required');
    }

    if (!request.destination || typeof request.destination.lat !== 'number' || typeof request.destination.lng !== 'number') {
      throw new Error('Invalid quote request: destination coordinates required');
    }

    if (!request.vehicle_type || typeof request.vehicle_type !== 'string') {
      throw new Error('Invalid quote request: vehicle_type required');
    }

    if (!request.city || typeof request.city !== 'string') {
      throw new Error('Invalid quote request: city required');
    }

    // Validate coordinate ranges
    if (request.origin.lat < -90 || request.origin.lat > 90) {
      throw new Error('Invalid quote request: origin.lat must be between -90 and 90');
    }

    if (request.origin.lng < -180 || request.origin.lng > 180) {
      throw new Error('Invalid quote request: origin.lng must be between -180 and 180');
    }

    if (request.destination.lat < -90 || request.destination.lat > 90) {
      throw new Error('Invalid quote request: destination.lat must be between -90 and 90');
    }

    if (request.destination.lng < -180 || request.destination.lng > 180) {
      throw new Error('Invalid quote request: destination.lng must be between -180 and 180');
    }
  }

  private validateQuoteResponse(response: QuoteResponse): void {
    if (!response.quote_id || typeof response.quote_id !== 'string') {
      throw new Error('Invalid quote response: missing quote_id');
    }

    if (typeof response.estimate_total !== 'number') {
      throw new Error('Invalid quote response: missing estimate_total');
    }

    if (!response.currency || typeof response.currency !== 'string') {
      throw new Error('Invalid quote response: missing currency');
    }

    if (!response.expires_at || typeof response.expires_at !== 'string') {
      throw new Error('Invalid quote response: missing expires_at');
    }

    if (!response.zone || typeof response.zone.h3_res7 !== 'string' || typeof response.zone.surge !== 'number') {
      throw new Error('Invalid quote response: missing or invalid zone information');
    }
  }

  private validateFinalizeRequest(request: FinalizeRequest): void {
    if (!request.trip_id || typeof request.trip_id !== 'string') {
      throw new Error('Invalid finalize request: trip_id required');
    }

    if (!request.vehicle_type || typeof request.vehicle_type !== 'string') {
      throw new Error('Invalid finalize request: vehicle_type required');
    }

    if (!request.h3_res7 || typeof request.h3_res7 !== 'string') {
      throw new Error('Invalid finalize request: h3_res7 required');
    }

    if (!request.city || typeof request.city !== 'string') {
      throw new Error('Invalid finalize request: city required');
    }

    if (!request.status || (request.status !== 'completed' && request.status !== 'cancelled')) {
      throw new Error('Invalid finalize request: status must be "completed" or "cancelled"');
    }

    // Validate required fields for completed trips
    if (request.status === 'completed') {
      if (typeof request.distance_m_final !== 'number') {
        throw new Error('Invalid finalize request: distance_m_final required for completed trips');
      }

      if (typeof request.duration_s_final !== 'number') {
        throw new Error('Invalid finalize request: duration_s_final required for completed trips');
      }
    }

    // Validate required fields for cancelled trips
    if (request.status === 'cancelled') {
      if (!request.cancelled_at || typeof request.cancelled_at !== 'string') {
        throw new Error('Invalid finalize request: cancelled_at required for cancelled trips');
      }
    }
  }

  private validateFinalizeResponse(response: FinalizeResponse): void {
    if (!response.trip_id || typeof response.trip_id !== 'string') {
      throw new Error('Invalid finalize response: missing trip_id');
    }

    if (typeof response.total_final !== 'number') {
      throw new Error('Invalid finalize response: missing total_final');
    }

    if (!response.currency || typeof response.currency !== 'string') {
      throw new Error('Invalid finalize response: missing currency');
    }

    if (typeof response.surge_used !== 'number') {
      throw new Error('Invalid finalize response: missing surge_used');
    }

    if (typeof response.min_fare_applied !== 'boolean') {
      throw new Error('Invalid finalize response: missing min_fare_applied');
    }

    if (typeof response.cancel_fee_applied !== 'boolean') {
      throw new Error('Invalid finalize response: missing cancel_fee_applied');
    }

    if (!response.pricing_rule_version || typeof response.pricing_rule_version !== 'string') {
      throw new Error('Invalid finalize response: missing pricing_rule_version');
    }

    if (!Array.isArray(response.taxes)) {
      throw new Error('Invalid finalize response: taxes must be an array');
    }
  }
}
