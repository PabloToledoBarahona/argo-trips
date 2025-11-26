import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '../../../shared/http/http.service.js';

export interface PricingQuoteRequest {
  vehicleType: string;
  originH3Res9: string;
  destH3Res9: string;
  distance_m: number;
  duration_s: number;
  city: string;
}

export interface PricingQuoteResponse {
  quoteId: string;
  basePrice: number;
  surgeMultiplier: number;
  totalPrice: number;
  currency: string;
  breakdown: Record<string, number>;
  expiresAt: Date;
}

@Injectable()
export class PricingClient {
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('PRICING_URL') || '';
  }

  async getQuote(request: PricingQuoteRequest): Promise<PricingQuoteResponse> {
    // TODO: Implement get quote logic
    throw new Error('Not implemented');
  }

  async validateQuote(quoteId: string): Promise<boolean> {
    // TODO: Implement validate quote logic
    throw new Error('Not implemented');
  }
}
