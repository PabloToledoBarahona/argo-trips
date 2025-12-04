import { ConfigService } from '@nestjs/config';
import { HttpService } from '../../../shared/http/http.service.js';
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
    taxes?: number;
    specialCharges?: SpecialCharge[];
}
export declare class PricingClient {
    private readonly httpService;
    private readonly configService;
    private readonly logger;
    private readonly baseUrl;
    private readonly maxRetries;
    private readonly baseBackoffMs;
    constructor(httpService: HttpService, configService: ConfigService);
    quote(request: QuoteRequest): Promise<QuoteResponse>;
    finalize(request: FinalizeRequest): Promise<FinalizeResponse>;
    private validateQuoteResponse;
    private validateFinalizeResponse;
    private executeWithRetry;
    private isRetryableError;
    private getBackoffDelay;
    private sleep;
    private getErrorMessage;
}
