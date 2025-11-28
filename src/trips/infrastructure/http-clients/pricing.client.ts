import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '../../../shared/http/http.service.js';

// ============================================================================
// DTOs - Quote Trip
// ============================================================================

export interface QuoteTripRequest {
  vehicleType: string;
  originH3Res9: string;
  destH3Res9: string;
  originH3Res7?: string;
  destH3Res7?: string;
  distance_m_est?: number;
  duration_s_est?: number;
  city: string;
  requestedAt?: string;
}

export interface FareBreakdown {
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  surgeFare?: number;
  serviceFee?: number;
  taxes?: number;
  totalFare: number;
}

export interface PricingDetails {
  basePrice: number;
  surgeMultiplier: number;
  totalPrice: number;
  currency: string;
  breakdown: FareBreakdown;
}

export interface QuoteTripResponse {
  quoteId: string;
  distance_m_est: number;
  duration_s_est: number;
  pricingDetails: PricingDetails;
  expiresAt: string;
  validitySeconds: number;
}

// ============================================================================
// DTOs - Finalize Trip
// ============================================================================

export interface FinalizeTripRequest {
  tripId: string;
  quoteId: string;
  distance_m_final: number;
  duration_s_final: number;
  originH3Res7: string;
  destH3Res7: string;
  cancel?: {
    is_canceled: boolean;
    reason?: string;
    side?: string;
    seconds_since_assign?: number;
  };
}

export interface CancelFeeDetails {
  freeCancelSeconds: number;
  cancelFeeBase: number;
  cancelFeeApplied: number;
  isFreeCancel: boolean;
}

export interface FinalizeTripResponse {
  quoteId: string;
  tripId: string;
  finalSnapshot: {
    basePrice: number;
    surgeMultiplier: number;
    totalPrice: number;
    currency: string;
    breakdown: FareBreakdown;
  };
  cancelFee?: CancelFeeDetails;
  finalizedAt: string;
}

// ============================================================================
// Pricing Client
// ============================================================================

@Injectable()
export class PricingClient {
  private readonly logger = new Logger(PricingClient.name);
  private readonly baseUrl: string;
  private readonly timeout: number = 5000;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('PRICING_SERVICE_URL') || 'http://localhost:3006';
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }

  private getErrorStack(error: unknown): string | undefined {
    if (error instanceof Error) return error.stack;
    return undefined;
  }

  /**
   * Get a price quote for a trip
   *
   * MS06-PRICING: POST /pricing/quote
   *
   * Returns initial quote with estimated pricing based on vehicle type,
   * origin/destination, and estimated metrics.
   */
  async quoteTrip(request: QuoteTripRequest): Promise<QuoteTripResponse> {
    try {
      this.logger.debug(`Requesting quote for trip: ${request.city}, ${request.vehicleType}`);

      const response = await this.httpService.post<QuoteTripResponse>(
        `${this.baseUrl}/pricing/quote`,
        request,
        { timeout: this.timeout },
      );

      // Validate response structure
      if (!response.quoteId || !response.pricingDetails) {
        throw new Error('Invalid quote response: missing required fields');
      }

      this.logger.debug(`Quote received: ${response.quoteId}, total: ${response.pricingDetails.totalPrice}`);

      return response;
    } catch (error) {
      this.logger.error(`Failed to get pricing quote: ${this.getErrorMessage(error)}`, this.getErrorStack(error));
      throw new Error(`Pricing service unavailable: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * Finalize trip pricing with actual metrics
   *
   * MS06-PRICING: POST /pricing/finalize
   *
   * Finalizes the trip pricing using actual distance and duration.
   * Also handles cancellation fees if trip was canceled.
   */
  async finalizeTrip(request: FinalizeTripRequest): Promise<FinalizeTripResponse> {
    try {
      this.logger.debug(`Finalizing pricing for trip: ${request.tripId}, canceled: ${request.cancel?.is_canceled || false}`);

      const response = await this.httpService.post<FinalizeTripResponse>(
        `${this.baseUrl}/pricing/finalize`,
        request,
        { timeout: this.timeout },
      );

      // Validate response structure
      if (!response.finalSnapshot || !response.quoteId) {
        throw new Error('Invalid finalize response: missing required fields');
      }

      this.logger.debug(`Pricing finalized: ${response.quoteId}, total: ${response.finalSnapshot.totalPrice}`);

      if (response.cancelFee) {
        this.logger.debug(`Cancel fee applied: ${response.cancelFee.cancelFeeApplied}, free: ${response.cancelFee.isFreeCancel}`);
      }

      return response;
    } catch (error) {
      this.logger.error(`Failed to finalize pricing: ${this.getErrorMessage(error)}`, this.getErrorStack(error));
      throw new Error(`Pricing finalize failed: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * Validate an existing quote
   *
   * MS06-PRICING: GET /pricing/quote/:quoteId/validate
   */
  async validateQuote(quoteId: string): Promise<boolean> {
    try {
      this.logger.debug(`Validating quote: ${quoteId}`);

      const response = await this.httpService.get<{ valid: boolean; expiresAt?: string }>(
        `${this.baseUrl}/pricing/quote/${quoteId}/validate`,
        { timeout: this.timeout },
      );

      return response.valid;
    } catch (error) {
      this.logger.warn(`Quote validation failed for ${quoteId}: ${this.getErrorMessage(error)}`);
      return false;
    }
  }
}
