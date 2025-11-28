import { ConfigService } from '@nestjs/config';
import { HttpService } from '../../../shared/http/http.service.js';
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
export declare class PricingClient {
    private readonly httpService;
    private readonly configService;
    private readonly logger;
    private readonly baseUrl;
    private readonly timeout;
    constructor(httpService: HttpService, configService: ConfigService);
    private getErrorMessage;
    private getErrorStack;
    quoteTrip(request: QuoteTripRequest): Promise<QuoteTripResponse>;
    finalizeTrip(request: FinalizeTripRequest): Promise<FinalizeTripResponse>;
    validateQuote(quoteId: string): Promise<boolean>;
}
