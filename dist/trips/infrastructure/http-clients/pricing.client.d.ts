import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '../../../shared/http/http.service.js';
import { ServiceTokenService } from '../../../shared/auth/services/service-token.service.js';
import { TokenBucketRateLimiter } from '../../../shared/rate-limiter/token-bucket.rate-limiter.js';
export interface PricingCoordinate {
    lat: number;
    lng: number;
}
export type MS06VehicleType = 'moto' | 'delivery' | 'economy' | 'comfort' | 'premium' | 'xl';
export type TripStatus = 'completed' | 'cancelled';
export type DegradationMode = 'NO_ROUTER' | null;
export interface QuoteRequest {
    origin: PricingCoordinate;
    destination: PricingCoordinate;
    vehicle_type: string;
    city: string;
    include_breakdown?: boolean;
    distance_m_est?: number;
    duration_s_est?: number;
}
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
export interface ExtraCharge {
    code: string;
    amount: number;
    description: string;
}
export interface ZoneInfo {
    h3_res7: string;
    surge: number;
}
export interface QuoteResponse {
    quote_id: string;
    currency: string;
    estimate_total: number;
    expires_at: string;
    degradation: DegradationMode;
    breakdown?: PriceBreakdown;
    zone: ZoneInfo;
}
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
export interface Tax {
    code: string;
    amount: number;
    rate: number;
    description: string;
}
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
export declare class PricingClient implements OnModuleInit {
    private readonly httpService;
    private readonly configService;
    private readonly serviceTokenService;
    private readonly rateLimiter;
    private readonly logger;
    private readonly baseUrl;
    private readonly quoteCircuitBreaker;
    private readonly finalizeCircuitBreaker;
    private readonly QUOTE_TIMEOUT_MS;
    private readonly FINALIZE_TIMEOUT_MS;
    constructor(httpService: HttpService, configService: ConfigService, serviceTokenService: ServiceTokenService, rateLimiter: TokenBucketRateLimiter);
    onModuleInit(): void;
    quote(request: QuoteRequest): Promise<QuoteResponse>;
    finalize(request: FinalizeRequest): Promise<FinalizeResponse>;
    private validateQuoteRequest;
    private validateQuoteResponse;
    private validateFinalizeRequest;
    private validateFinalizeResponse;
}
