import { ConfigService } from '@nestjs/config';
import { HttpService } from '../../../shared/http/http.service.js';
export interface Location {
    lat: number;
    lng: number;
    h3_res9: string;
}
export type VehicleType = 'economy' | 'premium' | 'delivery';
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
export interface FinalizeRequest {
    quoteId: string;
    tripId: string;
}
export interface FinalizeResponse {
    finalPrice: number;
    currency: string;
    breakdown: PriceBreakdown;
}
export declare class PricingClient {
    private readonly httpService;
    private readonly configService;
    private readonly logger;
    private readonly baseUrl;
    constructor(httpService: HttpService, configService: ConfigService);
    quote(request: QuoteRequest): Promise<QuoteResponse>;
    finalize(request: FinalizeRequest): Promise<FinalizeResponse>;
}
