import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isAxiosError } from 'axios';
import { HttpService } from '../../../shared/http/http.service.js';

// ============================================================================
// DTOs - Common Types
// ============================================================================

export interface PricingLocation {
  lat: number;
  lng: number;
  h3_res7?: string;
  h3_res9?: string;
}

export type PricingVehicleType = 'economy' | 'premium' | 'delivery';

export interface SpecialCharge {
  type: string;
  amount: number;
  description?: string;
}

export interface PriceBreakdown {
  distancePrice: number;
  timePrice: number;
  serviceFee: number;
  specialCharges?: SpecialCharge[];
}

// ============================================================================
// DTOs - Quote
// ============================================================================

export interface QuoteRequest {
  riderId?: string;
  city: string;
  vehicleType: PricingVehicleType;
  origin: PricingLocation;
  destination: PricingLocation;
  distance_m?: number;
  duration_s?: number;
}

export interface QuoteResponse {
  quoteId: string;
  city: string;
  vehicleType: PricingVehicleType;
  currency: string;
  basePrice: number;
  surgeMultiplier: number;
  estimateTotal: number;
  breakdown: PriceBreakdown;
  distanceMeters?: number;
  durationSeconds?: number;
}

// ============================================================================
// DTOs - Finalize
// ============================================================================

export interface FinalizeRequest {
  quoteId: string;
  tripId: string;
  city?: string;
  vehicleType?: PricingVehicleType;
  distance_m_final?: number;
  duration_s_final?: number;
}

export interface FinalizeResponse {
  quoteId: string;
  tripId?: string;
  totalPrice: number;
  basePrice: number;
  surgeMultiplier: number;
  currency: string;
  breakdown: PriceBreakdown;
}

// ============================================================================
// Pricing Client
// ============================================================================

@Injectable()
export class PricingClient {
  private readonly logger = new Logger(PricingClient.name);
  private readonly baseUrl: string;
  private readonly maxRetries = 3;
  private readonly baseBackoffMs = 250;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('PRICING_SERVICE_URL') || 'http://localhost:3006';
  }

  /**
   * Get a price quote for a trip
   *
   * MS06-PRICING: POST /pricing/quote
   *
   * @param request - Quote request with rider, vehicle type, origin and destination
   * @returns Quote response with pricing details
   * @throws Error if service unavailable or invalid response
   */
  async quote(request: QuoteRequest): Promise<QuoteResponse> {
    this.logger.debug(
      `Requesting quote for city: ${request.city}, vehicle: ${request.vehicleType}`,
    );

    const response = await this.executeWithRetry<QuoteResponse>(
      () => this.httpService.post<QuoteResponse>(
        `${this.baseUrl}/pricing/quote`,
        request,
      ),
      'pricing quote',
    );

    this.validateQuoteResponse(response);

    this.logger.debug(
      `Quote received: ${response.quoteId}, est total: ${response.estimateTotal} ${response.currency}, surge=${response.surgeMultiplier}`,
    );

    return response;
  }

  /**
   * Finalize trip pricing
   *
   * MS06-PRICING: POST /pricing/finalize
   *
   * @param request - Finalize request with quote ID and trip ID
   * @returns Final price and breakdown
   * @throws Error if service unavailable or invalid response
   */
  async finalize(request: FinalizeRequest): Promise<FinalizeResponse> {
    this.logger.debug(
      `Finalizing pricing for trip: ${request.tripId}, quote: ${request.quoteId}`,
    );

    const response = await this.executeWithRetry<FinalizeResponse>(
      () => this.httpService.post<FinalizeResponse>(
        `${this.baseUrl}/pricing/finalize`,
        request,
      ),
      'pricing finalize',
    );

    this.validateFinalizeResponse(response);

    this.logger.debug(
      `Pricing finalized: ${response.totalPrice} ${response.currency}, surge=${response.surgeMultiplier}`,
    );

    return response;
  }

  private validateQuoteResponse(response: QuoteResponse): void {
    if (!response.quoteId) {
      throw new Error('Invalid quote response: missing quoteId');
    }

    if (typeof response.estimateTotal !== 'number' || typeof response.basePrice !== 'number') {
      throw new Error('Invalid quote response: missing price totals');
    }

    if (typeof response.surgeMultiplier !== 'number') {
      throw new Error('Invalid quote response: missing surge multiplier');
    }

    if (!response.breakdown) {
      throw new Error('Invalid quote response: missing breakdown');
    }
  }

  private validateFinalizeResponse(response: FinalizeResponse): void {
    if (!response.quoteId && !response.tripId) {
      throw new Error('Invalid finalize response: missing identifiers');
    }

    if (typeof response.totalPrice !== 'number' || typeof response.basePrice !== 'number') {
      throw new Error('Invalid finalize response: missing price totals');
    }

    if (typeof response.surgeMultiplier !== 'number') {
      throw new Error('Invalid finalize response: missing surge multiplier');
    }

    if (!response.breakdown) {
      throw new Error('Invalid finalize response: missing breakdown');
    }
  }

  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    operation: string,
  ): Promise<T> {
    let attempt = 0;

    // Attempt counter is zero-based but logging uses human-readable (attempt + 1)
    for (;;) {
      try {
        return await fn();
      } catch (error) {
        const retryable = this.isRetryableError(error);

        if (!retryable || attempt >= this.maxRetries) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(`Failed ${operation} after ${attempt + 1} attempts: ${message}`);
          throw error;
        }

        attempt += 1;
        const delay = this.getBackoffDelay(attempt);

        this.logger.warn(
          `Retrying ${operation} (${attempt}/${this.maxRetries}) after ${delay}ms due to ${this.getErrorMessage(error)}`,
        );
        await this.sleep(delay);
      }
    }
  }

  private isRetryableError(error: unknown): boolean {
    if (isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 429) {
        return true;
      }

      if (status && status >= 400 && status < 500) {
        return false;
      }

      // Retry on network errors / timeouts / 5xx
      if (!status || status >= 500) {
        return true;
      }
    }

    return true;
  }

  private getBackoffDelay(attempt: number): number {
    const jitter = Math.floor(Math.random() * 100);
    return Math.pow(2, attempt - 1) * this.baseBackoffMs + jitter;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getErrorMessage(error: unknown): string {
    if (isAxiosError(error)) {
      const status = error.response?.status;
      const statusText = error.response?.statusText;
      return status ? `${status}${statusText ? ` ${statusText}` : ''}` : error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}
