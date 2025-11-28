import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '../../../shared/http/http.service.js';

// ============================================================================
// DTOs - Common Types
// ============================================================================

export interface Location {
  lat: number;
  lng: number;
  h3_res9: string;
}

export type VehicleType = 'economy' | 'premium' | 'delivery';

// ============================================================================
// DTOs - Quote
// ============================================================================

export interface QuoteRequest {
  riderId: string;
  vehicleType: VehicleType;
  origin: Location;
  destination: Location;
}

export interface PriceBreakdown {
  distancePrice: number;
  timePrice: number;
  serviceFee: number;
  dynamicMultiplier: number;
}

export interface QuoteResponse {
  quoteId: string;
  currency: string;
  baseFare: number;
  distanceMeters: number;
  durationSeconds: number;
  totalPrice: number;
  breakdown: PriceBreakdown;
}

// ============================================================================
// DTOs - Finalize
// ============================================================================

export interface FinalizeRequest {
  quoteId: string;
  tripId: string;
}

export interface FinalizeResponse {
  finalPrice: number;
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
    try {
      this.logger.debug(
        `Requesting quote for rider: ${request.riderId}, vehicle: ${request.vehicleType}`,
      );

      const response = await this.httpService.post<QuoteResponse>(
        `${this.baseUrl}/pricing/quote`,
        request,
      );

      if (!response.quoteId || !response.totalPrice) {
        throw new Error('Invalid quote response: missing required fields');
      }

      this.logger.debug(
        `Quote received: ${response.quoteId}, total: ${response.totalPrice} ${response.currency}`,
      );

      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get pricing quote: ${message}`);
      throw new Error(`Pricing service quote failed: ${message}`);
    }
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
    try {
      this.logger.debug(
        `Finalizing pricing for trip: ${request.tripId}, quote: ${request.quoteId}`,
      );

      const response = await this.httpService.post<FinalizeResponse>(
        `${this.baseUrl}/pricing/finalize`,
        request,
      );

      if (typeof response.finalPrice !== 'number' || !response.currency) {
        throw new Error('Invalid finalize response: missing required fields');
      }

      this.logger.debug(
        `Pricing finalized: ${response.finalPrice} ${response.currency}`,
      );

      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to finalize pricing: ${message}`);
      throw new Error(`Pricing service finalize failed: ${message}`);
    }
  }
}
