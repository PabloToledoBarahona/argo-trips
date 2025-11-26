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
export declare class PricingClient {
    private readonly httpService;
    private readonly configService;
    private readonly baseUrl;
    constructor(httpService: HttpService, configService: ConfigService);
    getQuote(request: PricingQuoteRequest): Promise<PricingQuoteResponse>;
    validateQuote(quoteId: string): Promise<boolean>;
}
